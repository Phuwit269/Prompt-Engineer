from fastapi import APIRouter, Depends, HTTPException, Query, Response, status
from sqlalchemy import func, or_, select
from sqlalchemy.orm import Session, joinedload

from ..config import get_settings
from ..database import get_db
from ..deps import active_subscription, require_seller
from ..models import Game, Gamepass, OrderItem, Role, User
from ..schemas import GamepassCreate, GamepassOut, GamepassUpdate, GameOut

router = APIRouter(tags=["catalog"])
settings = get_settings()


def to_pass_out(gp: Gamepass) -> GamepassOut:
    return GamepassOut(
        id=gp.id,
        game_id=gp.game_id,
        game_name_en=gp.game.name_en,
        game_name_th=gp.game.name_th,
        seller_id=gp.seller_id,
        seller_name=gp.seller.shop_name or gp.seller.display_name,
        name_en=gp.name_en,
        name_th=gp.name_th,
        description=gp.description,
        price=gp.price,
        badge=gp.badge,
        is_active=gp.is_active,
        created_at=gp.created_at,
    )


def _pass_query():
    return select(Gamepass).options(joinedload(Gamepass.game), joinedload(Gamepass.seller))


@router.get("/games", response_model=list[GameOut])
def list_games(db: Session = Depends(get_db)):
    counts = dict(
        db.execute(
            select(Gamepass.game_id, func.count(Gamepass.id)).where(Gamepass.is_active.is_(True)).group_by(Gamepass.game_id)
        ).all()
    )
    games = db.scalars(select(Game).order_by(Game.id)).all()
    return [
        GameOut(
            id=g.id, name_en=g.name_en, name_th=g.name_th, category_en=g.category_en,
            category_th=g.category_th, accent=g.accent, pass_count=counts.get(g.id, 0),
        )
        for g in games
        if counts.get(g.id, 0) > 0
    ]


@router.get("/gamepasses", response_model=list[GamepassOut])
def list_gamepasses(
    game_id: int | None = None,
    q: str | None = Query(default=None, max_length=80),
    limit: int = Query(default=100, ge=1, le=200),
    offset: int = Query(default=0, ge=0),
    db: Session = Depends(get_db),
):
    stmt = _pass_query().where(Gamepass.is_active.is_(True))
    if game_id is not None:
        stmt = stmt.where(Gamepass.game_id == game_id)
    if q:
        like = f"%{q.strip()}%"
        stmt = stmt.where(or_(Gamepass.name_en.ilike(like), Gamepass.name_th.ilike(like)))
    rows = db.scalars(stmt.order_by(Gamepass.id).limit(limit).offset(offset)).unique().all()
    return [to_pass_out(r) for r in rows]


@router.get("/gamepasses/mine", response_model=list[GamepassOut])
def my_gamepasses(user: User = Depends(require_seller), db: Session = Depends(get_db)):
    rows = db.scalars(_pass_query().where(Gamepass.seller_id == user.id).order_by(Gamepass.id.desc())).unique().all()
    return [to_pass_out(r) for r in rows]


@router.get("/gamepasses/{pass_id}", response_model=GamepassOut)
def get_gamepass(pass_id: int, db: Session = Depends(get_db)):
    gp = db.scalars(_pass_query().where(Gamepass.id == pass_id, Gamepass.is_active.is_(True))).unique().first()
    if not gp:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Gamepass not found")
    return to_pass_out(gp)


@router.post("/gamepasses", response_model=GamepassOut, status_code=status.HTTP_201_CREATED)
def create_gamepass(data: GamepassCreate, user: User = Depends(require_seller), db: Session = Depends(get_db)):
    # --- feature gating: listing limit comes from the seller's active plan ---
    if user.role != Role.admin:
        sub = active_subscription(db, user)
        if sub is None:
            raise HTTPException(status.HTTP_403_FORBIDDEN, "An active subscription is required to create listings")
        limit = sub.plan.max_listings
        if limit is not None:
            active_count = db.scalar(
                select(func.count(Gamepass.id)).where(Gamepass.seller_id == user.id, Gamepass.is_active.is_(True))
            )
            if active_count >= limit:
                raise HTTPException(
                    status.HTTP_403_FORBIDDEN,
                    f"Listing limit reached for plan {sub.plan.name} ({limit}). Upgrade to add more.",
                )

    if data.game_id is None and not data.new_game_name:
        raise HTTPException(status.HTTP_422_UNPROCESSABLE_ENTITY, "Provide game_id or new_game_name")

    if data.game_id is not None:
        game = db.get(Game, data.game_id)
        if not game:
            raise HTTPException(status.HTTP_404_NOT_FOUND, "Game not found")
    else:
        name = data.new_game_name.strip()
        game = db.scalar(select(Game).where(func.lower(Game.name_en) == name.lower()))
        if not game:
            game = Game(
                name_en=name, name_th=name, accent=(db.scalar(select(func.count(Game.id))) or 0) % 6, created_by=user.id
            )
            db.add(game)
            db.flush()

    gp = Gamepass(
        game_id=game.id,
        seller_id=user.id,
        name_en=data.name_en.strip(),
        name_th=(data.name_th or data.name_en).strip(),
        description=data.description.strip(),
        price=data.price,
        badge=data.badge,
    )
    db.add(gp)
    db.commit()
    return to_pass_out(db.scalars(_pass_query().where(Gamepass.id == gp.id)).unique().one())


def _owned_or_admin(db: Session, pass_id: int, user: User) -> Gamepass:
    gp = db.get(Gamepass, pass_id)
    if not gp:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Gamepass not found")
    if gp.seller_id != user.id and user.role != Role.admin:
        raise HTTPException(status.HTTP_403_FORBIDDEN, "You can only modify your own listings")
    return gp


@router.patch("/gamepasses/{pass_id}", response_model=GamepassOut)
def update_gamepass(pass_id: int, data: GamepassUpdate, user: User = Depends(require_seller), db: Session = Depends(get_db)):
    gp = _owned_or_admin(db, pass_id, user)
    if data.is_active is True and not gp.is_active and gp.seller_id == user.id and user.role != Role.admin:
        # re-activating counts against the plan limit too (prevents bypassing feature gating)
        sub = active_subscription(db, user)
        limit = sub.plan.max_listings if sub else 0
        active_count = db.scalar(
            select(func.count(Gamepass.id)).where(Gamepass.seller_id == user.id, Gamepass.is_active.is_(True))
        )
        if limit is not None and active_count >= limit:
            raise HTTPException(status.HTTP_403_FORBIDDEN, "Listing limit reached for your plan")
    for field, value in data.model_dump(exclude_unset=True).items():
        if value is not None or field == "badge":
            setattr(gp, field, value.strip() if isinstance(value, str) else value)
    db.commit()
    return to_pass_out(db.scalars(_pass_query().where(Gamepass.id == gp.id)).unique().one())


@router.delete("/gamepasses/{pass_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_gamepass(pass_id: int, user: User = Depends(require_seller), db: Session = Depends(get_db)):
    gp = _owned_or_admin(db, pass_id, user)
    has_sales = db.scalar(select(func.count(OrderItem.id)).where(OrderItem.gamepass_id == gp.id))
    if has_sales:
        gp.is_active = False  # keep history for orders/analytics
    else:
        db.delete(gp)
    db.commit()
    return Response(status_code=status.HTTP_204_NO_CONTENT)
