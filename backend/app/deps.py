from datetime import datetime

from fastapi import Cookie, Depends, Header, HTTPException, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from .config import get_settings
from .database import get_db
from .models import Role, Subscription, SubscriptionStatus, User, utcnow
from .security import decode_access_token

settings = get_settings()


def sync_subscription_state(db: Session, user: User, now: datetime | None = None) -> None:
    """Expire lapsed subscriptions and keep `user.role` consistent with the active plan.

    free <-> pro is derived from subscriptions; admins are never touched.
    """
    now = now or utcnow()
    subs = db.scalars(
        select(Subscription).where(Subscription.user_id == user.id, Subscription.status == SubscriptionStatus.active)
    ).all()
    has_live = False
    for s in subs:
        if s.end_at and s.end_at <= now:
            s.status = SubscriptionStatus.expired
        else:
            has_live = True
    if user.role != Role.admin:
        wanted = Role.pro if has_live else Role.free
        if user.role != wanted:
            user.role = wanted
    db.commit()


def active_subscription(db: Session, user: User) -> Subscription | None:
    now = utcnow()
    return db.scalars(
        select(Subscription)
        .where(
            Subscription.user_id == user.id,
            Subscription.status == SubscriptionStatus.active,
            Subscription.end_at > now,
        )
        .order_by(Subscription.end_at.desc())
    ).first()


def get_current_user(
    db: Session = Depends(get_db),
    authorization: str | None = Header(default=None),
    cookie_token: str | None = Cookie(default=None, alias=settings.cookie_name),
) -> User:
    token = None
    if authorization and authorization.lower().startswith("bearer "):
        token = authorization[7:].strip()
    elif cookie_token:
        token = cookie_token
    if not token:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Not authenticated")
    user_id = decode_access_token(token)
    user = db.get(User, user_id) if user_id else None
    if user is None or not user.is_active:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Invalid or expired session")
    sync_subscription_state(db, user)
    return user


def get_optional_user(
    db: Session = Depends(get_db),
    authorization: str | None = Header(default=None),
    cookie_token: str | None = Cookie(default=None, alias=settings.cookie_name),
) -> User | None:
    try:
        return get_current_user(db, authorization, cookie_token)
    except HTTPException:
        return None


def require_roles(*roles: Role):
    """Dependency factory for role-based access control (RBAC)."""

    def checker(user: User = Depends(get_current_user)) -> User:
        if user.role not in roles:
            raise HTTPException(status.HTTP_403_FORBIDDEN, f"Requires role: {', '.join(r.value for r in roles)}")
        return user

    return checker


require_admin = require_roles(Role.admin)
require_seller = require_roles(Role.pro, Role.admin)
