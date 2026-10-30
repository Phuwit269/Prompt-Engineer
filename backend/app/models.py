"""SQLAlchemy models — 8 tables:
users, plans, subscriptions, games, gamepasses, orders, order_items, transactions
"""
import enum
from datetime import datetime, timezone
from decimal import Decimal

from sqlalchemy import (
    Boolean,
    DateTime,
    Enum,
    ForeignKey,
    Integer,
    Numeric,
    String,
    Text,
    UniqueConstraint,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship

from .database import Base


def utcnow() -> datetime:
    """Naive UTC timestamp (stored without tz so it behaves the same on Postgres & SQLite)."""
    return datetime.now(timezone.utc).replace(tzinfo=None)


class Role(str, enum.Enum):
    admin = "admin"
    free = "free"
    pro = "pro"


class SubscriptionStatus(str, enum.Enum):
    pending = "pending"
    active = "active"
    expired = "expired"
    cancelled = "cancelled"


class OrderStatus(str, enum.Enum):
    pending = "pending"
    paid = "paid"
    cancelled = "cancelled"


class TxKind(str, enum.Enum):
    order = "order"
    subscription = "subscription"


class TxStatus(str, enum.Enum):
    pending = "pending"
    succeeded = "succeeded"
    failed = "failed"


class User(Base):
    __tablename__ = "users"

    id: Mapped[int] = mapped_column(primary_key=True)
    email: Mapped[str] = mapped_column(String(255), unique=True, index=True)
    display_name: Mapped[str] = mapped_column(String(80))
    shop_name: Mapped[str | None] = mapped_column(String(80), nullable=True)
    password_hash: Mapped[str] = mapped_column(String(255))
    role: Mapped[Role] = mapped_column(Enum(Role, name="role"), default=Role.free, index=True)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=utcnow)

    subscriptions: Mapped[list["Subscription"]] = relationship(back_populates="user")
    gamepasses: Mapped[list["Gamepass"]] = relationship(back_populates="seller")
    orders: Mapped[list["Order"]] = relationship(back_populates="buyer")


class Plan(Base):
    __tablename__ = "plans"

    id: Mapped[int] = mapped_column(primary_key=True)
    code: Mapped[str] = mapped_column(String(40), unique=True)
    name: Mapped[str] = mapped_column(String(80))
    price_thb: Mapped[Decimal] = mapped_column(Numeric(10, 2))
    max_listings: Mapped[int | None] = mapped_column(Integer, nullable=True)  # None = unlimited
    commission_rate: Mapped[Decimal] = mapped_column(Numeric(5, 4))
    duration_days: Mapped[int] = mapped_column(Integer, default=30)


class Subscription(Base):
    __tablename__ = "subscriptions"

    id: Mapped[int] = mapped_column(primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), index=True)
    plan_id: Mapped[int] = mapped_column(ForeignKey("plans.id"))
    status: Mapped[SubscriptionStatus] = mapped_column(
        Enum(SubscriptionStatus, name="subscription_status"), default=SubscriptionStatus.pending
    )
    start_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    end_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=utcnow)

    user: Mapped[User] = relationship(back_populates="subscriptions")
    plan: Mapped[Plan] = relationship()


class Game(Base):
    __tablename__ = "games"

    id: Mapped[int] = mapped_column(primary_key=True)
    name_en: Mapped[str] = mapped_column(String(120), unique=True)
    name_th: Mapped[str] = mapped_column(String(120))
    category_en: Mapped[str] = mapped_column(String(80), default="Custom shop")
    category_th: Mapped[str] = mapped_column(String(80), default="ร้านค้าแบบกำหนดเอง")
    accent: Mapped[int] = mapped_column(Integer, default=0)  # index into UI gradient palette
    created_by: Mapped[int | None] = mapped_column(ForeignKey("users.id"), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=utcnow)

    gamepasses: Mapped[list["Gamepass"]] = relationship(back_populates="game")


class Gamepass(Base):
    __tablename__ = "gamepasses"

    id: Mapped[int] = mapped_column(primary_key=True)
    game_id: Mapped[int] = mapped_column(ForeignKey("games.id"), index=True)
    seller_id: Mapped[int] = mapped_column(ForeignKey("users.id"), index=True)
    name_en: Mapped[str] = mapped_column(String(120))
    name_th: Mapped[str] = mapped_column(String(120))
    description: Mapped[str] = mapped_column(Text, default="")
    price: Mapped[Decimal] = mapped_column(Numeric(10, 2))
    badge: Mapped[str | None] = mapped_column(String(20), nullable=True)  # new | hot | limited
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, index=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=utcnow)

    game: Mapped[Game] = relationship(back_populates="gamepasses")
    seller: Mapped[User] = relationship(back_populates="gamepasses")


class Order(Base):
    __tablename__ = "orders"

    id: Mapped[int] = mapped_column(primary_key=True)
    buyer_id: Mapped[int] = mapped_column(ForeignKey("users.id"), index=True)
    total: Mapped[Decimal] = mapped_column(Numeric(10, 2))
    commission_total: Mapped[Decimal] = mapped_column(Numeric(10, 2), default=0)
    status: Mapped[OrderStatus] = mapped_column(Enum(OrderStatus, name="order_status"), default=OrderStatus.pending)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=utcnow)
    paid_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)

    buyer: Mapped[User] = relationship(back_populates="orders")
    items: Mapped[list["OrderItem"]] = relationship(back_populates="order", cascade="all, delete-orphan")


class OrderItem(Base):
    __tablename__ = "order_items"

    id: Mapped[int] = mapped_column(primary_key=True)
    order_id: Mapped[int] = mapped_column(ForeignKey("orders.id", ondelete="CASCADE"), index=True)
    gamepass_id: Mapped[int] = mapped_column(ForeignKey("gamepasses.id"), index=True)
    seller_id: Mapped[int] = mapped_column(ForeignKey("users.id"), index=True)
    gamepass_name: Mapped[str] = mapped_column(String(255))  # snapshot at purchase time
    unit_price: Mapped[Decimal] = mapped_column(Numeric(10, 2))
    quantity: Mapped[int] = mapped_column(Integer, default=1)
    commission_rate: Mapped[Decimal] = mapped_column(Numeric(5, 4))
    commission_amount: Mapped[Decimal] = mapped_column(Numeric(10, 2))

    order: Mapped[Order] = relationship(back_populates="items")
    gamepass: Mapped[Gamepass] = relationship()


class Transaction(Base):
    """Payment log for both subscription upgrades and marketplace orders (simulated PromptPay QR)."""

    __tablename__ = "transactions"
    __table_args__ = (UniqueConstraint("reference"),)

    id: Mapped[int] = mapped_column(primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id"), index=True)
    kind: Mapped[TxKind] = mapped_column(Enum(TxKind, name="tx_kind"))
    amount: Mapped[Decimal] = mapped_column(Numeric(10, 2))
    currency: Mapped[str] = mapped_column(String(3), default="THB")
    status: Mapped[TxStatus] = mapped_column(Enum(TxStatus, name="tx_status"), default=TxStatus.pending, index=True)
    provider: Mapped[str] = mapped_column(String(30), default="mock_promptpay")
    reference: Mapped[str] = mapped_column(String(40))
    order_id: Mapped[int | None] = mapped_column(ForeignKey("orders.id"), nullable=True)
    subscription_id: Mapped[int | None] = mapped_column(ForeignKey("subscriptions.id"), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=utcnow)
    paid_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)

    user: Mapped[User] = relationship()
    order: Mapped[Order | None] = relationship()
    subscription: Mapped[Subscription | None] = relationship()
