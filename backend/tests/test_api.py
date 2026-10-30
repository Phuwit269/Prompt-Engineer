from datetime import timedelta
from decimal import Decimal

from sqlalchemy import select

from app.models import Gamepass, Role, Subscription, SubscriptionStatus, User, utcnow
from tests.conftest import login, make_user


def upgrade(client, headers, plan="creator_pro"):
    r = client.post("/api/subscriptions/checkout", json={"plan_code": plan}, headers=headers)
    assert r.status_code == 201, r.text
    ref = r.json()["reference"]
    assert client.post(f"/api/payments/{ref}/confirm", headers=headers).status_code == 200


def new_pass(client, headers, **over):
    body = {"new_game_name": "Test Game", "name_en": "Pass A", "price": "100.00", **over}
    return client.post("/api/gamepasses", json=body, headers=headers)


# ---------- auth ----------
def test_register_login_me(client):
    r = client.post("/api/auth/register", json={"email": "A@Example.com", "password": "Passw0rd!x", "display_name": "Aaa"})
    assert r.status_code == 201
    assert r.json()["user"]["role"] == "free"
    assert "access_token" in r.cookies or client.cookies.get("access_token")
    me = client.get("/api/auth/me")  # cookie auth
    assert me.status_code == 200 and me.json()["email"] == "a@example.com"
    assert client.post("/api/auth/register", json={"email": "a@example.com", "password": "Passw0rd!x", "display_name": "Aaa"}).status_code == 409


def test_login_failures_and_validation(client, db):
    make_user(db, "u@example.com")
    assert client.post("/api/auth/login", json={"email": "u@example.com", "password": "wrong"}).status_code == 401
    assert client.post("/api/auth/login", json={"email": "nobody@example.com", "password": "x"}).status_code == 401
    assert client.post("/api/auth/register", json={"email": "bad", "password": "Passw0rd!x", "display_name": "Zed"}).status_code == 422
    assert client.post("/api/auth/register", json={"email": "z@example.com", "password": "short", "display_name": "Zed"}).status_code == 422
    client.cookies.clear()
    assert client.get("/api/auth/me").status_code == 401


def test_password_is_hashed(client, db):
    u = make_user(db, "h@example.com")
    assert u.password_hash.startswith("$2") and "Passw0rd" not in u.password_hash


# ---------- RBAC + feature gating ----------
def test_rbac_blocks(client, db):
    make_user(db, "free@example.com")
    h = login(client, "free@example.com")
    assert new_pass(client, h).status_code == 403  # free can't list
    assert client.get("/api/admin/analytics", headers=h).status_code == 403
    assert client.get("/api/seller/summary", headers=h).status_code == 403
    client.cookies.clear()
    assert client.get("/api/admin/users").status_code == 401


def test_upgrade_changes_permissions_and_limits(client, db):
    make_user(db, "s@example.com")
    h = login(client, "s@example.com")
    upgrade(client, h, "creator_lite")
    assert client.get("/api/auth/me", headers=h).json()["role"] == "pro"
    assert new_pass(client, h).status_code == 201
    r = new_pass(client, h, name_en="Pass B")
    assert r.status_code == 403 and "limit" in r.json()["detail"].lower()  # Lite = 1 listing
    upgrade(client, h, "creator_pro")  # upgrade replaces lite
    assert new_pass(client, h, name_en="Pass B").status_code == 201
    subs = db.scalars(select(Subscription).where(Subscription.status == SubscriptionStatus.active)).all()
    assert len(subs) == 1 and subs[0].plan.code == "creator_pro"
    assert client.post("/api/subscriptions/checkout", json={"plan_code": "creator_lite"}, headers=h).status_code == 409


def test_subscription_expiry_downgrades(client, db):
    u = make_user(db, "e@example.com")
    h = login(client, "e@example.com")
    upgrade(client, h)
    sub = db.scalars(select(Subscription)).first()
    sub.end_at = utcnow() - timedelta(minutes=1)
    db.commit()
    assert client.get("/api/auth/me", headers=h).json()["role"] == "free"
    assert new_pass(client, h).status_code == 403


# ---------- orders / payments ----------
def test_order_flow_server_side_price_and_commission(client, db):
    make_user(db, "seller@example.com")
    make_user(db, "buyer@example.com")
    hs = login(client, "seller@example.com")
    hb = login(client, "buyer@example.com")
    upgrade(client, hs, "creator_pro")
    pid = new_pass(client, hs, price="250.00").json()["id"]

    # own pass is rejected
    assert client.post("/api/orders/checkout", json={"items": [{"gamepass_id": pid}]}, headers=hs).status_code == 400
    # client-supplied price is ignored
    r = client.post("/api/orders/checkout", json={"items": [{"gamepass_id": pid, "quantity": 2, "price": "1"}]}, headers=hb)
    assert r.status_code == 201
    intent = r.json()
    assert Decimal(intent["amount"]) == Decimal("500.00")
    assert client.get("/api/orders/me", headers=hb).json()[0]["status"] == "pending"
    ok = client.post(f"/api/payments/{intent['reference']}/confirm", headers=hb)
    assert ok.json()["status"] == "succeeded"
    assert client.get("/api/orders/me", headers=hb).json()[0]["status"] == "paid"
    # someone else can't touch the payment
    assert client.post(f"/api/payments/{intent['reference']}/confirm", headers=hs).status_code == 404
    s = client.get("/api/seller/summary", headers=hs).json()
    assert s["units_sold"] == 2 and Decimal(s["gross_sales"]) == Decimal("500.00")
    assert Decimal(s["commission_paid"]) == Decimal("25.00")  # Creator Pro = 5%
    assert Decimal(s["net_earnings"]) == Decimal("475.00")


def test_listing_ownership_and_soft_delete(client, db):
    make_user(db, "o1@example.com")
    make_user(db, "o2@example.com")
    make_user(db, "b@example.com")
    h1, h2, hb = (login(client, e) for e in ("o1@example.com", "o2@example.com", "b@example.com"))
    upgrade(client, h1)
    upgrade(client, h2)
    pid = new_pass(client, h1).json()["id"]
    assert client.patch(f"/api/gamepasses/{pid}", json={"price": "150.00"}, headers=h2).status_code == 403
    assert client.patch(f"/api/gamepasses/{pid}", json={"price": "150.00"}, headers=h1).json()["price"] in ("150.00", "150.0", 150.0)
    # sold -> delete becomes soft delete
    ref = client.post("/api/orders/checkout", json={"items": [{"gamepass_id": pid}]}, headers=hb).json()["reference"]
    client.post(f"/api/payments/{ref}/confirm", headers=hb)
    assert client.delete(f"/api/gamepasses/{pid}", headers=h1).status_code == 204
    assert client.get(f"/api/gamepasses/{pid}").status_code == 404
    assert db.get(Gamepass, pid).is_active is False


def test_cancel_payment(client, db):
    make_user(db, "c@example.com")
    h = login(client, "c@example.com")
    ref = client.post("/api/subscriptions/checkout", json={"plan_code": "creator_lite"}, headers=h).json()["reference"]
    assert client.post(f"/api/payments/{ref}/cancel", headers=h).json()["status"] == "failed"
    assert client.post(f"/api/payments/{ref}/confirm", headers=h).status_code == 409
    assert client.get("/api/auth/me", headers=h).json()["role"] == "free"


# ---------- admin ----------
def test_admin_analytics_and_user_management(client, db):
    make_user(db, "admin@example.com", Role.admin)
    make_user(db, "u@example.com")
    ha = login(client, "admin@example.com")
    hu = login(client, "u@example.com")
    upgrade(client, hu, "creator_pro")
    a = client.get("/api/admin/analytics?days=14", headers=ha)
    assert a.status_code == 200
    k = a.json()["kpis"]
    assert k["active_subscriptions"] == 1 and k["mrr"] == 499.0 and k["arr"] == 499.0 * 12
    assert k["subscription_revenue"] == 499.0 and len(a.json()["daily"]) == 14
    assert a.json()["daily"][-1]["mrr"] == 499.0
    users = client.get("/api/admin/users?q=u@", headers=ha).json()
    assert users["total"] == 1
    uid = users["items"][0]["id"]
    assert client.patch(f"/api/admin/users/{uid}", json={"role": "pro"}, headers=ha).status_code == 400
    me = client.get("/api/auth/me", headers=ha).json()
    assert client.patch(f"/api/admin/users/{me['id']}", json={"is_active": False}, headers=ha).status_code == 400
    assert client.patch(f"/api/admin/users/{uid}", json={"is_active": False}, headers=ha).json()["is_active"] is False
    assert client.get("/api/auth/me", headers=hu).status_code == 401  # disabled users are locked out
