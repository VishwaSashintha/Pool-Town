from datetime import datetime, timezone
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from sqlalchemy import func

from app.database import get_db
from app.models.players import Player, PlayerAlias
from app.models.sessions import PoolSession, PS4Session
from app.models.payments import SessionPayment, PaymentStatus
from app.models.audit import AuditLog
from app.routers.auth import get_current_user
from app.schemas.players import (
    PlayerCreate,
    PlayerResponse,
    PlayerUpdate,
    PlayerMergeRequest,
    PlayerMergeResponse,
)

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


@router.put("/{player_id}", response_model=PlayerResponse)
def update_player(player_id: int, payload: PlayerUpdate, db: Session = Depends(get_db)):
    """
    Edit a player's name, phone, and notes.
    Checks for duplicate normalized name (excluding the player being edited).
    Financial history is always preserved.
    """
    p = db.query(Player).filter(Player.id == player_id).first()
    if not p:
        raise HTTPException(status_code=404, detail="Player not found")

    if payload.name is not None:
        normalized = _normalize_name(payload.name)
        if not normalized:
            raise HTTPException(status_code=400, detail="Player name cannot be empty")
        # Check for duplicate
        duplicate = db.query(Player).filter(
            Player.name_normalized == normalized,
            Player.id != player_id,
        ).first()
        if duplicate:
            raise HTTPException(
                status_code=409,
                detail=f"Another player with a similar name already exists: '{duplicate.name}'"
            )
        p.name = payload.name.strip()
        p.name_normalized = normalized

    if payload.phone is not None:
        p.phone = payload.phone.strip() if payload.phone.strip() else None

    if payload.notes is not None:
        p.notes = payload.notes if payload.notes.strip() else None

    if payload.is_active is not None:
        p.is_active = payload.is_active

    db.commit()
    db.refresh(p)

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


@router.delete("/{player_id}", status_code=200)
def delete_player(
    player_id: int,
    db: Session = Depends(get_db),
    current_user: str = Depends(get_current_user),
):
    """
    Permanently delete a player profile.
    Only allowed if the player has ZERO sessions recorded and ZERO financial history.
    This prevents accidental deletion of players with outstanding balances or history.
    Requires administrator authentication and logs to AuditLog.
    """
    p = db.query(Player).filter(Player.id == player_id).first()
    if not p:
        raise HTTPException(status_code=404, detail="Player not found")

    total_sessions, total_charges, total_paid = _get_player_financials(db, p.id)
    if total_sessions > 0:
        raise HTTPException(
            status_code=400,
            detail=f"Cannot delete '{p.name}': this player has {total_sessions} recorded session(s). "
                   f"Deactivate the player instead to preserve financial history."
        )

    player_name = p.name
    # Audit log
    db.add(AuditLog(
        entity_type="player",
        entity_id=p.id,
        action="delete",
        description=f"Administrator '{current_user}' deleted player profile '{player_name}' (0 sessions)",
        user=current_user,
    ))
    db.delete(p)
    db.commit()
    return {"message": f"Player '{player_name}' has been permanently deleted.", "deleted": True}


@router.post("/merge", response_model=PlayerMergeResponse)
def merge_players(
    payload: PlayerMergeRequest,
    db: Session = Depends(get_db),
    current_user: str = Depends(get_current_user),
):
    """
    Merge a duplicate player profile into a primary player profile.
    - Moves all pool sessions and PS4 sessions to primary player.
    - Moves damage charges to primary player.
    - Preserves duplicate's name as an alias under the primary player.
    - Marks duplicate player as inactive and links merged_into_id.
    - Preserves complete financial history and audit trail.
    """
    if payload.primary_player_id == payload.duplicate_player_id:
        raise HTTPException(status_code=400, detail="Cannot merge a player into itself.")

    primary = db.query(Player).filter(Player.id == payload.primary_player_id).first()
    duplicate = db.query(Player).filter(Player.id == payload.duplicate_player_id).first()

    if not primary:
        raise HTTPException(status_code=404, detail="Primary player not found.")
    if not duplicate:
        raise HTTPException(status_code=404, detail="Duplicate player not found.")

    # Move pool sessions
    pool_moved = db.query(PoolSession).filter(
        PoolSession.player_id == duplicate.id
    ).update({PoolSession.player_id: primary.id}, synchronize_session=False)

    # Move PS4 sessions player 1
    ps4_p1_moved = db.query(PS4Session).filter(
        PS4Session.player1_id == duplicate.id
    ).update({PS4Session.player1_id: primary.id}, synchronize_session=False)

    # Move PS4 sessions player 2
    ps4_p2_moved = db.query(PS4Session).filter(
        PS4Session.player2_id == duplicate.id
    ).update({PS4Session.player2_id: primary.id}, synchronize_session=False)

    # Move damage charges if table exists
    from app.models.equipment import DamageCharge
    damage_moved = db.query(DamageCharge).filter(
        DamageCharge.player_id == duplicate.id
    ).update({DamageCharge.player_id: primary.id}, synchronize_session=False)

    # Record alias on primary player
    alias = PlayerAlias(
        player_id=primary.id,
        alias=duplicate.name,
        alias_normalized=duplicate.name_normalized,
        reason=f"Merged duplicate #{duplicate.id} into #{primary.id}",
    )
    db.add(alias)

    # Mark duplicate as merged and inactive
    duplicate.is_active = False
    duplicate.merged_into_id = primary.id
    merge_note = f"[Merged into #{primary.id} ({primary.name}) on {datetime.now(timezone.utc).strftime('%Y-%m-%d')}]"
    duplicate.notes = f"{duplicate.notes}\n{merge_note}" if duplicate.notes else merge_note

    total_sessions_moved = pool_moved + ps4_p1_moved + ps4_p2_moved

    # Audit log
    db.add(AuditLog(
        entity_type="player",
        entity_id=primary.id,
        action="merge",
        description=f"Merged duplicate player '{duplicate.name}' (#{duplicate.id}) into '{primary.name}' (#{primary.id}). {total_sessions_moved} session(s) reassigned.",
        user=current_user,
    ))

    db.commit()
    db.refresh(primary)

    total_sessions, total_charges, total_paid = _get_player_financials(db, primary.id)
    outstanding = max(0, total_charges - total_paid)

    primary_resp = PlayerResponse(
        id=primary.id,
        name=primary.name,
        phone=primary.phone,
        email=None,
        notes=primary.notes,
        is_active=primary.is_active,
        total_sessions=total_sessions,
        total_charges_paise=total_charges,
        total_paid_paise=total_paid,
        outstanding_balance_paise=outstanding,
        created_at=primary.created_at,
        updated_at=primary.updated_at,
    )

    return PlayerMergeResponse(
        success=True,
        message=f"Successfully merged '{duplicate.name}' into '{primary.name}'. {total_sessions_moved} session(s) consolidated.",
        primary_player=primary_resp,
        sessions_moved=total_sessions_moved,
    )


