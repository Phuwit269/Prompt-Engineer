"""Plans, subscriptions, orders and the simulated payment (mock PromptPay QR) workflow.

Flow
----
1. client  -> POST /subscriptions/checkout  or  POST /orders/checkout   (creates PENDING record + transaction)
2. client shows the mock QR for `qr_payload`
3. client  -> POST /payments/{reference}/confirm                        (simulates the bank webhook)
4. server settles: order -> paid, or subscription -> active + user.role = pro
"""
import uuid
from datetime import timedelta
from decimal import ROUND_HALF_UP, Decimal

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.orm import Session, joinedload

from ..config import get_settings
from ..database import get_db
from ..deps import active_subscription, get_current_user
from ..models import (
    Gamepass, Order, OrderItem, OrderStatus, Plan, Role, Subscription, SubscriptionStatus,
    Transaction, TxKind, TxStatus, User, utcnow,
)
from ..schemas import (
    OrderCheckoutIn, OrderOut, PaymentIntentOut, PlanOut, SubscriptionCheckoutIn, SubscriptionOut, TransactionOut,
)

settings = get_settings()
router = APIRouter(tags=["billing"])
CENT = Decimal("0.01")


def _money(v: Decimal) -> Decimal:
    return v.quantize(CENT, rounding=ROUND_HALF_UP)


def _new_reference() -> str:
    return "PM-" + uuid.uuid4().hex[:12].upper()


def _intent(tx: Transaction, description: str) -> PaymentIntentOut:
    return PaymentIntentOut(
        reference=tx.reference,
        kind=tx.kind,
        amount=tx.amount,
        currency=tx.currency,
        status=tx.status,
        qr_payload=f"PROMPTMARKET-MOCK-PROMPTPAY|{tx.reference}|{tx.amount}|{tx.currency}",
        description=description,
    )


# ---------------- plans & subscriptions ----------------
@router.get("/plans", response_model=list[PlanOut])
def list_plans(db: Session = Depends(get_db)):
    return db.scalars(select(Plan).order_by(Plan.price_thb)).all()


@router.get("/subscriptions/me", response_model=SubscriptionOut | None)
def my_subscription(user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    sub = active_subscription(db, user)
    if sub is None:
        return None
    return sub


@router.post("/subscriptions/checkout", response_model=PaymentIntentOut, status_code=status.HTTP_201_CREATED)
def subscription_checkout(data: SubscriptionCheckoutIn, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    if user.role == Role.admin:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Admins do not need a subscription")
    plan = db.scalar(select(Plan).where(Plan.code == data.plan_code))
    if not plan:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Plan not found")
    current = active_subscription(db, user)
    if current and current.plan.price_thb >= plan.price_thb and current.plan_id != plan.id:
        raise HTTPException(status.HTTP_409_CONFLICT, "You already have a higher plan")
    if current and current.plan_id == plan.id:
        raise HTTPException(status.HTTP_409_CONFLICT, "This plan is already active")
    sub = Subscription(user_id=user.id, plan_id=plan.id, status=SubscriptionStatus.pending)
    db.add(sub)
    db.flush()
    tx = Transaction(
        user_id=user.id, kind=TxKind.subscription, amount=plan.price_thb, status=TxStatus.pending,
        reference=_new_reference(), subscription_id=sub.id,
    )
    db.add(tx)
    db.commit()
    return _intent(tx, f"Subscription: {plan.name}")


# ---------------- orders ----------------
def _seller_commission_rate(db: Session, seller: User) -> Decimal:
    if seller.role == Role.pro:
        sub = active_subscription(db, seller)
        if sub:
            return Decimal(sub.plan.commission_rate)
    return Decimal(str(settings.default_commission_rate))


@router.post("/orders/checkout", response_model=PaymentIntentOut, status_code=status.HTTP_201_CREATED)
def order_checkout(data: OrderCheckoutIn, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    # merge duplicate lines; prices ALWAYS come from the database, never from the client
    wanted: dict[int, int] = {}
    for line in data.items:
        wanted[line.gamepass_id] = min(wanted.get(line.gamepass_id, 0) + line.quantity, 20)
    passes = db.scalars(
        select(Gamepass).options(joinedload(Gamepass.seller), joinedload(Gamepass.game)).where(Gamepass.id.in_(wanted))
    ).unique().all()
    by_id = {p.id: p for p in passes}
    order = Order(buyer_id=user.id, total=Decimal("0"), commission_total=Decimal("0"), status=OrderStatus.pending)
    total = Decimal("0")
    commission_total = Decimal("0")
    rates: dict[int, Decimal] = {}
    for pid, qty in wanted.items():
        gp = by_id.get(pid)
        if gp is None or not gp.is_active:
            raise HTTPException(status.HTTP_404_NOT_FOUND, f"Gamepass {pid} is not available")
        if gp.seller_id == user.id:
            raise HTTPException(status.HTTP_400_BAD_REQUEST, "You cannot buy your own gamepass")
        rate = rates.setdefault(gp.seller_id, _seller_commission_rate(db, gp.seller))
        line_total = _money(gp.price * qty)
        commission = _money(line_total * rate)
        total += line_total
        commission_total += commission
        order.items.append(
            OrderItem(
                gamepass_id=gp.id, seller_id=gp.seller_id, gamepass_name=f"{gp.game.name_en} • {gp.name_en}",
                unit_price=gp.price, quantity=qty, commission_rate=rate, commission_amount=commission,
            )
        )
    order.total = _money(total)
    order.commission_total = _money(commission_total)
    db.add(order)
    db.flush()
    tx = Transaction(
        user_id=user.id, kind=TxKind.order, amount=order.total, status=TxStatus.pending,
        reference=_new_reference(), order_id=order.id,
    )
    db.add(tx)
    db.commit()
    return _intent(tx, f"Order #{order.id}")


@router.get("/orders/me", response_model=list[OrderOut])
def my_orders(user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    return db.scalars(
        select(Order).options(joinedload(Order.items)).where(Order.buyer_id == user.id).order_by(Order.id.desc())
    ).unique().all()


# ---------------- payments (simulated) ----------------
def _own_tx(db: Session, reference: str, user: User) -> Transaction:
    tx = db.scalar(select(Transaction).where(Transaction.reference == reference))
    if not tx or tx.user_id != user.id:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Payment not found")
    return tx


@router.get("/payments/{reference}", response_model=TransactionOut)
def get_payment(reference: str, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    return _own_tx(db, reference, user)


@router.get("/payments", response_model=list[TransactionOut])
def my_payments(user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    return db.scalars(select(Transaction).where(Transaction.user_id == user.id).order_by(Transaction.id.desc())).all()


def settle_transaction(db: Session, tx: Transaction) -> None:
    now = utcnow()
    tx.status = TxStatus.succeeded
    tx.paid_at = now
    if tx.kind == TxKind.order and tx.order:
        tx.order.status = OrderStatus.paid
        tx.order.paid_at = now
    elif tx.kind == TxKind.subscription and tx.subscription:
        sub = tx.subscription
        # an upgrade replaces any other live plan
        others = db.scalars(
            select(Subscription).where(
                Subscription.user_id == tx.user_id, Subscription.status == SubscriptionStatus.active, Subscription.id != sub.id
            )
        ).all()
        for o in others:
            o.status = SubscriptionStatus.cancelled
            o.end_at = now
        sub.status = SubscriptionStatus.active
        sub.start_at = now
        sub.end_at = now + timedelta(days=sub.plan.duration_days)
        user = db.get(User, tx.user_id)
        if user.role != Role.admin:
            user.role = Role.pro  # <-- permission change happens here


@router.post("/payments/{reference}/confirm", response_model=TransactionOut)
def confirm_payment(reference: str, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    """Simulates the payment-provider webhook ("customer scanned the QR and paid")."""
    tx = _own_tx(db, reference, user)
    if tx.status == TxStatus.succeeded:
        return tx  # idempotent
    if tx.status == TxStatus.failed:
        raise HTTPException(status.HTTP_409_CONFLICT, "This payment was cancelled")
    settle_transaction(db, tx)
    db.commit()
    db.refresh(tx)
    return tx


@router.post("/payments/{reference}/cancel", response_model=TransactionOut)
def cancel_payment(reference: str, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    tx = _own_tx(db, reference, user)
    if tx.status == TxStatus.succeeded:
        raise HTTPException(status.HTTP_409_CONFLICT, "Payment already completed")
    tx.status = TxStatus.failed
    if tx.order:
        tx.order.status = OrderStatus.cancelled
    if tx.subscription:
        tx.subscription.status = SubscriptionStatus.cancelled
    db.commit()
    db.refresh(tx)
    return tx
