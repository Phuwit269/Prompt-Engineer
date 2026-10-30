from datetime import timedelta
from decimal import Decimal

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import func, or_, select
from sqlalchemy.orm import Session

from ..database import get_db
from ..deps import active_subscription, require_admin, require_seller
from ..models import (
    Game, Gamepass, Order, OrderItem, OrderStatus, Plan, Role, Subscription, SubscriptionStatus,
    Transaction, TxKind, TxStatus, User, utcnow,
)
from ..schemas import AdminUserPage, AdminUserUpdate, SellerSummary, TransactionOut, UserOut

router = APIRouter(tags=["dashboard"])


def _f(v) -> float:
    return float(v or 0)


# ---------------- seller ----------------
@router.get("/seller/summary", response_model=SellerSummary)
def seller_summary(user: User = Depends(require_seller), db: Session = Depends(get_db)):
    sub = active_subscription(db, user)
    active_listings = db.scalar(
        select(func.count(Gamepass.id)).where(Gamepass.seller_id == user.id, Gamepass.is_active.is_(True))
    )
    units, gross, commission = db.execute(
        select(
            func.coalesce(func.sum(OrderItem.quantity), 0),
            func.coalesce(func.sum(OrderItem.unit_price * OrderItem.quantity), 0),
            func.coalesce(func.sum(OrderItem.commission_amount), 0),
        )
        .join(Order, Order.id == OrderItem.order_id)
        .where(OrderItem.seller_id == user.id, Order.status == OrderStatus.paid)
    ).one()
    return SellerSummary(
        active_listings=active_listings or 0,
        listing_limit=sub.plan.max_listings if sub else None,
        plan_name=sub.plan.name if sub else ("Admin" if user.role == Role.admin else None),
        plan_end_at=sub.end_at if sub else None,
        units_sold=int(units),
        gross_sales=Decimal(gross),
        commission_paid=Decimal(commission),
        net_earnings=Decimal(gross) - Decimal(commission),
    )


# ---------------- admin ----------------
@router.get("/admin/analytics")
def admin_analytics(
    days: int = Query(default=30, ge=7, le=90),
    _: User = Depends(require_admin),
    db: Session = Depends(get_db),
):
    now = utcnow()
    today = now.replace(hour=0, minute=0, second=0, microsecond=0)
    start = today - timedelta(days=days - 1)

    # ---- headline KPIs ----
    total_users = db.scalar(select(func.count(User.id)))
    role_rows = dict(db.execute(select(User.role, func.count(User.id)).group_by(User.role)).all())
    users_by_role = [{"role": r.value, "count": int(role_rows.get(r, 0))} for r in (Role.free, Role.pro, Role.admin)]
    new_users = db.scalar(select(func.count(User.id)).where(User.created_at >= start))

    live_subs = db.execute(
        select(Subscription, Plan)
        .join(Plan, Plan.id == Subscription.plan_id)
        .where(Subscription.status == SubscriptionStatus.active, Subscription.end_at > now)
    ).all()
    mrr = sum(_f(p.price_thb) * (30 / p.duration_days) for _, p in live_subs)  # normalised to 30 days
    plan_mix: dict[str, int] = {}
    for _, p in live_subs:
        plan_mix[p.name] = plan_mix.get(p.name, 0) + 1

    paid_orders = db.execute(
        select(Order.id, Order.total, Order.commission_total, Order.paid_at).where(
            Order.status == OrderStatus.paid, Order.paid_at >= start
        )
    ).all()
    sub_tx = db.execute(
        select(Transaction.amount, Transaction.paid_at).where(
            Transaction.kind == TxKind.subscription, Transaction.status == TxStatus.succeeded, Transaction.paid_at >= start
        )
    ).all()
    gmv = sum(_f(o.total) for o in paid_orders)
    commission_revenue = sum(_f(o.commission_total) for o in paid_orders)
    subscription_revenue = sum(_f(t.amount) for t in sub_tx)

    paying_base = (role_rows.get(Role.free, 0) or 0) + (role_rows.get(Role.pro, 0) or 0)
    conversion = (role_rows.get(Role.pro, 0) or 0) / paying_base if paying_base else 0.0
    tx_count, tx_volume = db.execute(
        select(func.count(Transaction.id), func.coalesce(func.sum(Transaction.amount), 0)).where(
            Transaction.status == TxStatus.succeeded, Transaction.paid_at >= start
        )
    ).one()

    # ---- daily series ----
    def day_key(dt):
        return dt.date().isoformat()

    series = {
        (start + timedelta(days=i)).date().isoformat(): {
            "date": (start + timedelta(days=i)).date().isoformat(),
            "signups": 0, "gmv": 0.0, "subscription_revenue": 0.0, "commission": 0.0, "mrr": 0.0,
        }
        for i in range(days)
    }
    for (created,) in db.execute(select(User.created_at).where(User.created_at >= start)).all():
        series[day_key(created)]["signups"] += 1
    for o in paid_orders:
        d = series[day_key(o.paid_at)]
        d["gmv"] += _f(o.total)
        d["commission"] += _f(o.commission_total)
    for t in sub_tx:
        series[day_key(t.paid_at)]["subscription_revenue"] += _f(t.amount)
    all_subs = db.execute(
        select(Subscription.start_at, Subscription.end_at, Plan.price_thb, Plan.duration_days)
        .join(Plan, Plan.id == Subscription.plan_id)
        .where(Subscription.start_at.is_not(None), Subscription.status != SubscriptionStatus.pending)
    ).all()
    for key, d in series.items():
        eod = start.replace(year=int(key[:4]), month=int(key[5:7]), day=int(key[8:10])) + timedelta(days=1)
        d["mrr"] = round(sum(_f(p) * (30 / dur) for s, e, p, dur in all_subs if s < eod and (e is None or e >= eod)), 2)
        d["platform_revenue"] = round(d["commission"] + d["subscription_revenue"], 2)
        for k in ("gmv", "commission", "subscription_revenue"):
            d[k] = round(d[k], 2)

    # ---- leaderboards (window) ----
    base = (
        select(OrderItem)
        .join(Order, Order.id == OrderItem.order_id)
        .where(Order.status == OrderStatus.paid, Order.paid_at >= start)
        .subquery()
    )
    line = base.c.unit_price * base.c.quantity
    top_passes = db.execute(
        select(Gamepass.id, Gamepass.name_en, Game.name_en, func.sum(base.c.quantity), func.sum(line))
        .join(Gamepass, Gamepass.id == base.c.gamepass_id)
        .join(Game, Game.id == Gamepass.game_id)
        .group_by(Gamepass.id, Gamepass.name_en, Game.name_en)
        .order_by(func.sum(line).desc())
        .limit(5)
    ).all()
    top_games = db.execute(
        select(Game.name_en, func.sum(base.c.quantity), func.sum(line))
        .join(Gamepass, Gamepass.id == base.c.gamepass_id)
        .join(Game, Game.id == Gamepass.game_id)
        .group_by(Game.name_en)
        .order_by(func.sum(line).desc())
        .limit(5)
    ).all()
    top_sellers = db.execute(
        select(User.id, func.coalesce(User.shop_name, User.display_name), func.sum(base.c.quantity), func.sum(line))
        .join(User, User.id == base.c.seller_id)
        .group_by(User.id, User.shop_name, User.display_name)
        .order_by(func.sum(line).desc())
        .limit(5)
    ).all()

    return {
        "window_days": days,
        "kpis": {
            "total_users": total_users,
            "new_users": new_users,
            "active_subscriptions": len(live_subs),
            "mrr": round(mrr, 2),
            "arr": round(mrr * 12, 2),
            "gmv": round(gmv, 2),
            "commission_revenue": round(commission_revenue, 2),
            "subscription_revenue": round(subscription_revenue, 2),
            "platform_revenue": round(commission_revenue + subscription_revenue, 2),
            "transaction_count": int(tx_count),
            "transaction_volume": _f(tx_volume),
            "conversion_rate": round(conversion, 4),
            "active_listings": db.scalar(select(func.count(Gamepass.id)).where(Gamepass.is_active.is_(True))),
        },
        "users_by_role": users_by_role,
        "plan_mix": [{"plan": k, "count": v} for k, v in plan_mix.items()],
        "daily": list(series.values()),
        "top_gamepasses": [
            {"id": i, "name": n, "game": g, "units": int(u), "revenue": _f(r)} for i, n, g, u, r in top_passes
        ],
        "top_games": [{"game": g, "units": int(u), "revenue": _f(r)} for g, u, r in top_games],
        "top_sellers": [{"id": i, "seller": n, "units": int(u), "revenue": _f(r)} for i, n, u, r in top_sellers],
    }


@router.get("/admin/users", response_model=AdminUserPage)
def admin_users(
    q: str | None = Query(default=None, max_length=80),
    role: Role | None = None,
    limit: int = Query(default=20, ge=1, le=100),
    offset: int = Query(default=0, ge=0),
    _: User = Depends(require_admin),
    db: Session = Depends(get_db),
):
    stmt = select(User)
    if q:
        like = f"%{q.strip()}%"
        stmt = stmt.where(or_(User.email.ilike(like), User.display_name.ilike(like)))
    if role:
        stmt = stmt.where(User.role == role)
    total = db.scalar(select(func.count()).select_from(stmt.subquery()))
    items = db.scalars(stmt.order_by(User.id.desc()).limit(limit).offset(offset)).all()
    return AdminUserPage(total=total, items=items)


@router.patch("/admin/users/{user_id}", response_model=UserOut)
def admin_update_user(user_id: int, data: AdminUserUpdate, admin: User = Depends(require_admin), db: Session = Depends(get_db)):
    target = db.get(User, user_id)
    if not target:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "User not found")
    if target.id == admin.id:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "You cannot change your own role or status")
    if data.role is not None:
        if data.role == Role.pro:
            raise HTTPException(status.HTTP_400_BAD_REQUEST, "Pro is granted only through a paid subscription")
        if data.role == Role.free and target.role in (Role.pro, Role.admin):
            for s in db.scalars(
                select(Subscription).where(Subscription.user_id == target.id, Subscription.status == SubscriptionStatus.active)
            ):
                s.status = SubscriptionStatus.cancelled
                s.end_at = utcnow()
        target.role = data.role
    if data.is_active is not None:
        target.is_active = data.is_active
    db.commit()
    db.refresh(target)
    return target


@router.get("/admin/transactions", response_model=list[TransactionOut])
def admin_transactions(
    limit: int = Query(default=25, ge=1, le=100),
    _: User = Depends(require_admin),
    db: Session = Depends(get_db),
):
    return db.scalars(select(Transaction).order_by(Transaction.id.desc()).limit(limit)).all()
