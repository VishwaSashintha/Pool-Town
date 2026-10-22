from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from sqlalchemy import func

from app.database import get_db
from app.models.players import Player
from app.models.sessions import PoolSession, PS4Session
from app.models.payments import SessionPayment, PaymentStatus
from app.schemas.players import PlayerCreate, PlayerResponse, PlayerUpdate

router = APIRouter(prefix="/api/players", tags=["Players"])


def _normalize_name(name: str) -> str:
    return " ".join(name.strip().lower().split())


def _get_player_financials(db: Session, player_id: int) -> tuple[int, int, int]:
    """Return (total_sessions, total_charges_paise, total_paid_paise) for a player."""
    # Pool sessions
    pool_stats = db.query(
        func.count(PoolSession.id),
        func.coalesce(func.sum(PoolSession.final_charge_paise), 0),
    ).filter(PoolSession.player_id == player_id).first()

    pool_count = pool_stats[0] or 0
    pool_charges = pool_stats[1] or 0

    pool_paid = db.query(
        func.coalesce(func.sum(SessionPayment.amount_paise), 0)
    ).join(
        PoolSession, (SessionPayment.session_type == "pool") & (SessionPayment.session_id == PoolSession.id)
    ).filter(
        PoolSession.player_id == player_id,
        SessionPayment.status == PaymentStatus.CONFIRMED,
    ).scalar() or 0

    # PS4 sessions
    ps4_stats = db.query(
        func.count(PS4Session.id),
        func.coalesce(func.sum(PS4Session.final_charge_paise), 0),
    ).filter(
        (PS4Session.player1_id == player_id) | (PS4Session.player2_id == player_id)
    ).first()

    ps4_count = ps4_stats[0] or 0
    ps4_charges = ps4_stats[1] or 0

    ps4_paid = db.query(
        func.coalesce(func.sum(SessionPayment.amount_paise), 0)
    ).join(
        PS4Session, (SessionPayment.session_type == "ps4") & (SessionPayment.session_id == PS4Session.id)
    ).filter(
        (PS4Session.player1_id == player_id) | (PS4Session.player2_id == player_id),
        SessionPayment.status == PaymentStatus.CONFIRMED,
    ).scalar() or 0

    total_sessions = pool_count + ps4_count
    total_charges = pool_charges + ps4_charges
    total_paid = pool_paid + ps4_paid

    return total_sessions, total_charges, total_paid


@router.get("", response_model=list[PlayerResponse])
def list_players(
    search: Optional[str] = Query(None, description="Search by name or phone"),
    include_inactive: bool = False,
    db: Session = Depends(get_db),
):
    query = db.query(Player)
    if not include_inactive:
        query = query.filter(Player.is_active == True)

    if search:
        term = f"%{_normalize_name(search)}%"
        query = query.filter(
            (Player.name_normalized.like(term)) | (Player.phone.like(f"%{search}%"))
        )

    players = query.order_by(Player.name.asc()).all()

    result = []
    for p in players:
        total_sessions, total_charges, total_paid = _get_player_financials(db, p.id)
        outstanding = max(0, total_charges - total_paid)

        result.append(
            PlayerResponse(
                id=p.id,
                name=p.name,
                phone=p.phone,
                email=None,
                notes=p.notes,
                is_active=p.is_active,
                total_sessions=total_sessions,
                total_charges_paise=total_charges,
                total_paid_paise=total_paid,
                outstanding_balance_paise=outstanding,
                created_at=p.created_at,
                updated_at=p.updated_at,
            )
        )

    return result


@router.post("", response_model=PlayerResponse, status_code=201)
def create_player(payload: PlayerCreate, db: Session = Depends(get_db)):
    normalized = _normalize_name(payload.name)
    if not normalized:
        raise HTTPException(status_code=400, detail="Player name cannot be empty")

    player = Player(
        name=payload.name.strip(),
        name_normalized=normalized,
        phone=payload.phone.strip() if payload.phone else None,
        notes=payload.notes,
        is_active=True,
    )
    db.add(player)
    db.commit()
    db.refresh(player)

    return PlayerResponse(
        id=player.id,
        name=player.name,
        phone=player.phone,
        email=None,
        notes=player.notes,
        is_active=player.is_active,
        total_sessions=0,
        total_charges_paise=0,
        total_paid_paise=0,
        outstanding_balance_paise=0,
        created_at=player.created_at,
        updated_at=player.updated_at,
    )


@router.get("/{player_id}", response_model=PlayerResponse)
def get_player(player_id: int, db: Session = Depends(get_db)):
    p = db.query(Player).filter(Player.id == player_id).first()
    if not p:
        raise HTTPException(status_code=404, detail="Player not found")

    total_sessions, total_charges, total_paid = _get_player_financials(db, p.id)
    outstanding = max(0, total_charges - total_paid)

    return PlayerResponse(
        id=p.id,
        name=p.name,
        phone=p.phone,
        email=None,
        notes=p.notes,
        is_active=p.is_active,
        total_sessions=total_sessions,
        total_charges_paise=total_charges,
        total_paid_paise=total_paid,
        outstanding_balance_paise=outstanding,
        created_at=p.created_at,
        updated_at=p.updated_at,
    )
