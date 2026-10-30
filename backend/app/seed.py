"""Idempotent seed: plans always; demo users/catalog/history only when the DB has no users yet."""
import random
from datetime import timedelta
from decimal import Decimal

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from .models import (
    Game, Gamepass, Order, OrderItem, OrderStatus, Plan, Role, Subscription, SubscriptionStatus,
    Transaction, TxKind, TxStatus, User, utcnow,
)
from .security import hash_password

PLANS = [
    # code, name, price, max_listings, commission, days
    ("creator_lite", "Creator Lite", "199.00", 1, "0.0800", 30),
    ("creator_pro", "Creator Pro", "499.00", None, "0.0500", 30),
]

GAMES = [
    ("Blox City", "บล็อกซิตี้", "Roleplay", "โรลเพลย์"),
    ("Sky Raiders", "สกายเรเดอร์ส", "Adventure", "ผจญภัย"),
    ("Pet Kingdom", "เพ็ทคิงดอม", "Simulator", "ซิมูเลเตอร์"),
    ("Speed Legends", "สปีดเลเจนด์", "Racing", "แข่งรถ"),
    ("Dungeon Forge", "ดันเจี้ยนฟอร์จ", "RPG", "อาร์พีจี"),
]

# (game index, en, th, price, badge, seller key)
PASSES = [
    (0, "VIP Pass", "วีไอพีเพส", 299, "hot", "pro"),
    (0, "Double Cash", "เงินสองเท่า", 149, None, "pro"),
    (0, "Mansion Access", "เข้าคฤหาสน์", 499, "limited", "lite"),
    (1, "Jetpack Pass", "เจ็ตแพ็ค", 199, "new", "pro"),
    (1, "Galaxy Skin Pack", "ชุดสกินกาแล็กซี", 349, "hot", "pro"),
    (2, "Lucky Egg x3", "ไข่นำโชค x3", 99, None, "pro"),
    (2, "Mega Pet Slot", "ช่องเพ็ทพิเศษ", 249, "new", "pro"),
    (3, "Turbo Engine", "เครื่องยนต์เทอร์โบ", 399, "hot", "pro"),
    (3, "Neon Garage", "โรงรถนีออน", 179, None, "pro"),
    (4, "Legendary Sword", "ดาบในตำนาน", 599, "limited", "pro"),
    (4, "Extra Backpack", "กระเป๋าเพิ่มช่อง", 129, None, "pro"),
]

FIRST = ["Nina", "Top", "Mint", "Beam", "Ploy", "Fah", "Gun", "Aom", "Tan", "Ice", "Pang", "Kaew", "Bank", "Earth", "Jane"]


def seed_plans(db: Session) -> None:
    for code, name, price, limit, comm, days in PLANS:
        if not db.scalar(select(Plan).where(Plan.code == code)):
            db.add(Plan(code=code, name=name, price_thb=Decimal(price), max_listings=limit,
                        commission_rate=Decimal(comm), duration_days=days))
    db.commit()


def seed(db: Session) -> None:
    """Plans always; demo users/catalog/history only on an empty database."""
    seed_plans(db)
    if db.scalar(select(func.count(User.id))):
        return  # already seeded / real data present

    rnd = random.Random(42)
    now = utcnow()
    plans = {p.code: p for p in db.scalars(select(Plan))}

    def mk_user(email, name, pw_hash, role=Role.free, shop=None, days_ago=0):
        u = User(email=email, display_name=name, shop_name=shop, password_hash=pw_hash, role=role,
                 created_at=now - timedelta(days=days_ago, hours=rnd.randint(0, 20)))
        db.add(u)
        db.flush()
        return u

    admin = mk_user("admin@promptmarket.dev", "Admin", hash_password("Admin123!"), Role.admin, days_ago=40)
    seller_hash = hash_password("Seller123!")
    buyer_hash = hash_password("Buyer123!")
    pro = mk_user("seller@promptmarket.dev", "Pro Seller", seller_hash, Role.pro, "Pixel Forge Shop", days_ago=35)
    lite = mk_user("lite@promptmarket.dev", "Lite Seller", seller_hash, Role.pro, "Tiny Mart", days_ago=20)
    buyer = mk_user("buyer@promptmarket.dev", "Demo Buyer", buyer_hash, Role.free, days_ago=10)
    sellers = {"pro": pro, "lite": lite}

    def activate_sub(user, plan, days_ago):
        start = now - timedelta(days=days_ago)
        end = start + timedelta(days=plan.duration_days)
        live = end > now
        sub = Subscription(user_id=user.id, plan_id=plan.id, status=SubscriptionStatus.active if live else SubscriptionStatus.expired,
                           start_at=start, end_at=end, created_at=start)
        db.add(sub)
        db.flush()
        db.add(Transaction(user_id=user.id, kind=TxKind.subscription, amount=plan.price_thb, status=TxStatus.succeeded,
                           reference=f"PM-SEED{sub.id:06d}", subscription_id=sub.id, created_at=start, paid_at=start))
        if not live and user.role == Role.pro:
            user.role = Role.free
        return sub

    activate_sub(pro, plans["creator_pro"], 12)
    activate_sub(lite, plans["creator_lite"], 7)

    games = []
    for i, (en, th, cen, cth) in enumerate(GAMES):
        g = Game(name_en=en, name_th=th, category_en=cen, category_th=cth, accent=i % 6, created_by=pro.id)
        db.add(g)
        games.append(g)
    db.flush()
    passes = []
    for gi, en, th, price, badge, who in PASSES:
        gp = Gamepass(game_id=games[gi].id, seller_id=sellers[who].id, name_en=en, name_th=th,
                      description=f"{en} for {GAMES[gi][0]} — delivered to your Roblox account after payment.",
                      price=Decimal(price), badge=badge, created_at=now - timedelta(days=rnd.randint(3, 30)))
        db.add(gp)
        passes.append(gp)
    db.flush()

    shared_hash = hash_password("Demo12345!")
    customers = [buyer]

    def make_order(user, day_offset):
        paid_at = now - timedelta(days=day_offset, hours=rnd.randint(0, 22), minutes=rnd.randint(0, 59))
        chosen = rnd.sample(passes, rnd.randint(1, 3))
        order = Order(buyer_id=user.id, total=Decimal(0), commission_total=Decimal(0), status=OrderStatus.paid,
                      created_at=paid_at, paid_at=paid_at)
        total = comm_total = Decimal(0)
        for gp in chosen:
            if gp.seller_id == user.id:
                continue
            qty = rnd.choice([1, 1, 1, 2])
            rate = Decimal(plans["creator_pro" if gp.seller_id == pro.id else "creator_lite"].commission_rate)
            line = (gp.price * qty).quantize(Decimal("0.01"))
            cm = (line * rate).quantize(Decimal("0.01"))
            total += line
            comm_total += cm
            order.items.append(OrderItem(gamepass_id=gp.id, seller_id=gp.seller_id,
                                         gamepass_name=f"{games[[g.id for g in games].index(gp.game_id)].name_en} • {gp.name_en}",
                                         unit_price=gp.price, quantity=qty, commission_rate=rate, commission_amount=cm))
        if not order.items:
            return
        order.total, order.commission_total = total, comm_total
        db.add(order)
        db.flush()
        db.add(Transaction(user_id=user.id, kind=TxKind.order, amount=total, status=TxStatus.succeeded,
                           reference=f"PM-SEED-O{order.id:06d}", order_id=order.id, created_at=paid_at, paid_at=paid_at))

    for d in range(29, -1, -1):
        for _ in range(rnd.choice([0, 1, 1, 2, 3])):
            u = mk_user(f"user{len(customers)}@example.com", f"{rnd.choice(FIRST)} {len(customers)}", shared_hash,
                        days_ago=d)
            customers.append(u)
            if rnd.random() < 0.18:
                activate_sub(u, plans[rnd.choice(["creator_lite", "creator_lite", "creator_pro"])], max(d - 1, 0))
                if u.role == Role.free and db.scalar(select(func.count(Subscription.id)).where(
                        Subscription.user_id == u.id, Subscription.status == SubscriptionStatus.active)):
                    u.role = Role.pro
        for _ in range(rnd.randint(1, 4)):
            make_order(rnd.choice(customers), d)
    db.commit()
