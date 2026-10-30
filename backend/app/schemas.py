from datetime import datetime
from decimal import Decimal
from typing import Literal

from pydantic import BaseModel, ConfigDict, EmailStr, Field, field_validator

from .models import OrderStatus, Role, SubscriptionStatus, TxKind, TxStatus


class ORM(BaseModel):
    model_config = ConfigDict(from_attributes=True)


# ---------- auth / users ----------
class RegisterIn(BaseModel):
    email: EmailStr
    password: str = Field(min_length=8, max_length=72)
    display_name: str = Field(min_length=2, max_length=80)

    @field_validator("display_name")
    @classmethod
    def strip_name(cls, v: str) -> str:
        return v.strip()


class LoginIn(BaseModel):
    email: EmailStr
    password: str = Field(min_length=1, max_length=72)


class UserOut(ORM):
    id: int
    email: EmailStr
    display_name: str
    shop_name: str | None
    role: Role
    is_active: bool
    created_at: datetime


class AuthOut(BaseModel):
    user: UserOut
    access_token: str
    token_type: str = "bearer"


class ProfileUpdate(BaseModel):
    display_name: str | None = Field(default=None, min_length=2, max_length=80)
    shop_name: str | None = Field(default=None, max_length=80)


class PasswordChange(BaseModel):
    current_password: str = Field(max_length=72)
    new_password: str = Field(min_length=8, max_length=72)


# ---------- catalog ----------
class GameOut(ORM):
    id: int
    name_en: str
    name_th: str
    category_en: str
    category_th: str
    accent: int
    pass_count: int = 0


class GamepassOut(ORM):
    id: int
    game_id: int
    game_name_en: str
    game_name_th: str
    seller_id: int
    seller_name: str
    name_en: str
    name_th: str
    description: str
    price: Decimal
    badge: str | None
    is_active: bool
    created_at: datetime


class GamepassCreate(BaseModel):
    game_id: int | None = None
    new_game_name: str | None = Field(default=None, min_length=2, max_length=120)
    name_en: str = Field(min_length=2, max_length=120)
    name_th: str | None = Field(default=None, max_length=120)
    description: str = Field(default="", max_length=2000)
    price: Decimal = Field(gt=0, le=1_000_000, decimal_places=2)
    badge: Literal["new", "hot", "limited"] | None = "new"


class GamepassUpdate(BaseModel):
    name_en: str | None = Field(default=None, min_length=2, max_length=120)
    name_th: str | None = Field(default=None, max_length=120)
    description: str | None = Field(default=None, max_length=2000)
    price: Decimal | None = Field(default=None, gt=0, le=1_000_000, decimal_places=2)
    badge: Literal["new", "hot", "limited"] | None = None
    is_active: bool | None = None


# ---------- plans / subscriptions ----------
class PlanOut(ORM):
    id: int
    code: str
    name: str
    price_thb: Decimal
    max_listings: int | None
    commission_rate: Decimal
    duration_days: int


class SubscriptionOut(ORM):
    id: int
    plan: PlanOut
    status: SubscriptionStatus
    start_at: datetime | None
    end_at: datetime | None


class SubscriptionCheckoutIn(BaseModel):
    plan_code: str


# ---------- orders / payments ----------
class CartLine(BaseModel):
    gamepass_id: int
    quantity: int = Field(default=1, ge=1, le=20)


class OrderCheckoutIn(BaseModel):
    items: list[CartLine] = Field(min_length=1, max_length=50)


class OrderItemOut(ORM):
    id: int
    gamepass_id: int
    gamepass_name: str
    unit_price: Decimal
    quantity: int


class OrderOut(ORM):
    id: int
    total: Decimal
    status: OrderStatus
    created_at: datetime
    paid_at: datetime | None
    items: list[OrderItemOut]


class TransactionOut(ORM):
    id: int
    user_id: int
    kind: TxKind
    amount: Decimal
    currency: str
    status: TxStatus
    provider: str
    reference: str
    order_id: int | None
    subscription_id: int | None
    created_at: datetime
    paid_at: datetime | None


class PaymentIntentOut(BaseModel):
    """Returned by both checkout endpoints: the front-end shows a mock QR for `qr_payload`."""

    reference: str
    kind: TxKind
    amount: Decimal
    currency: str = "THB"
    status: TxStatus
    qr_payload: str
    description: str


# ---------- seller / admin ----------
class SellerSummary(BaseModel):
    active_listings: int
    listing_limit: int | None
    plan_name: str | None
    plan_end_at: datetime | None
    units_sold: int
    gross_sales: Decimal
    commission_paid: Decimal
    net_earnings: Decimal


class AdminUserUpdate(BaseModel):
    role: Role | None = None
    is_active: bool | None = None


class AdminUserPage(BaseModel):
    total: int
    items: list[UserOut]
