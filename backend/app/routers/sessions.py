from datetime import date
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from sqlalchemy import func

from app.database import get_db
from app.models.players import Player
from app.models.sessions import PoolSession, PS4Session, SessionStatus
from app.models.payments import SessionPayment, PaymentMethod, PaymentStatus
from app.models.accounts import FinancialAccount
from app.schemas.sessions import (
    PoolSessionCreate,
    PoolSessionResponse,
    PS4SessionCreate,
    PS4SessionResponse,
)
from app.schemas.players import PlayerResponse
from app.services.pricing import calculate_pool_charge, calculate_ps4_charge, apply_discount
from app.services.journal import JournalService, JournalLineInput

router = APIRouter(prefix="/api/sessions", tags=["Sessions"])


def _normalize_name(name: str) -> str:
    return " ".join(name.strip().lower().split())


def _get_or_create_player(db: Session, name: str) -> Player:
    norm = _normalize_name(name)
    player = db.query(Player).filter(Player.name_normalized == norm).first()
    if not player:
        player = Player(
            name=name.strip(),
            name_normalized=norm,
            is_active=True,
        )
        db.add(player)
        db.flush()
    return player


def _get_paid_paise(db: Session, session_type: str, session_id: int) -> int:
    paid = db.query(
        func.coalesce(func.sum(SessionPayment.amount_paise), 0)
    ).filter(
        SessionPayment.session_type == session_type,
        SessionPayment.session_id == session_id,
        SessionPayment.status == PaymentStatus.CONFIRMED,
    ).scalar()
    return paid or 0


# ── Pool Sessions ─────────────────────────────────────────────────────────────

@router.get("/pool", response_model=list[PoolSessionResponse])
def list_pool_sessions(
    session_date: Optional[date] = Query(None, alias="date"),
    status: Optional[str] = None,
    db: Session = Depends(get_db),
):
    query = db.query(PoolSession)
    if session_date:
        query = query.filter(PoolSession.session_date == session_date)
    if status:
        query = query.filter(PoolSession.status == status)

    sessions = query.order_by(PoolSession.session_date.desc(), PoolSession.id.desc()).all()

    result = []
    for s in sessions:
        paid = _get_paid_paise(db, "pool", s.id)
        outstanding = max(0, s.final_charge_paise - paid)

        player_data = None
        if s.player:
            player_data = PlayerResponse(
                id=s.player.id,
                name=s.player.name,
                phone=s.player.phone,
                is_active=s.player.is_active,
                created_at=s.player.created_at,
                updated_at=s.player.updated_at,
            )

        result.append(
            PoolSessionResponse(
                id=s.id,
                reference=s.reference,
                session_date=s.session_date,
                player_id=s.player_id,
                player=player_data,
                customer_name=s.player.name if s.player else None,
                actual_minutes=s.actual_duration_minutes,
                chargeable_minutes=s.chargeable_duration_minutes,
                standard_charge_paise=s.standard_charge_paise,
                discount_paise=s.discount_paise,
                final_charge_paise=s.final_charge_paise,
                paid_amount_paise=paid,
                outstanding_paise=outstanding,
                status=s.status.value if hasattr(s.status, "value") else str(s.status),
                notes=s.notes,
                created_at=s.created_at,
            )
        )
    return result


@router.post("/pool", response_model=PoolSessionResponse, status_code=201)
def create_pool_session(payload: PoolSessionCreate, db: Session = Depends(get_db)):
    # 1. Determine player
    if payload.player_id:
        player = db.query(Player).filter(Player.id == payload.player_id).first()
        if not player:
            raise HTTPException(status_code=404, detail="Selected player not found")
    elif payload.customer_name and payload.customer_name.strip():
        player = _get_or_create_player(db, payload.customer_name)
    else:
        player = _get_or_create_player(db, "Walk-in Guest")

    # 2. Compute charges
    actual_min = payload.actual_minutes or payload.chargeable_minutes
    if payload.custom_standard_charge_paise is not None:
        standard_paise = max(0, payload.custom_standard_charge_paise)
    else:
        standard_paise = calculate_pool_charge(payload.chargeable_minutes)
    final_paise = apply_discount(standard_paise, payload.discount_paise)

    # Validate payment does not exceed charge (Decision D-010)
    if payload.initial_payment_paise > final_paise:
        raise HTTPException(
            status_code=400,
            detail=f"Payment amount ({payload.initial_payment_paise} paise) exceeds final charge ({final_paise} paise). Overpayments are not allowed.",
        )

    # 3. Generate reference POOL-YYYYMMDD-XXXX
    date_str = payload.session_date.strftime("%Y%m%d")
    count = db.query(PoolSession).filter(PoolSession.reference.like(f"POOL-{date_str}-%")).count()
    reference = f"POOL-{date_str}-{count + 1:04d}"

    # 4. Determine initial status
    initial_status = SessionStatus.PENDING
    if payload.initial_payment_paise >= final_paise and final_paise > 0:
        initial_status = SessionStatus.PAID
    elif payload.initial_payment_paise > 0:
        initial_status = SessionStatus.PARTIAL

    # 5. Create Session
    session = PoolSession(
        reference=reference,
        session_date=payload.session_date,
        player_id=player.id,
        actual_duration_minutes=actual_min,
        chargeable_duration_minutes=payload.chargeable_minutes,
        standard_charge_paise=standard_paise,
        discount_paise=payload.discount_paise,
        final_charge_paise=final_paise,
        status=initial_status,
        notes=payload.notes,
    )
    db.add(session)
    db.flush()

    # 6. Post accounting revenue entry: DR 1010 AR Pool, CR 4001 Pool Revenue
    if final_paise > 0:
        rev_entry = JournalService.post_entry(
            db,
            entry_date=payload.session_date,
            description=f"Pool session {reference} charge ({player.name})",
            lines=[
                JournalLineInput("1010", "Accounts Receivable — Pool", True, final_paise),
                JournalLineInput("4001", "Pool Table Revenue", False, final_paise),
            ],
            source_type="pool_session",
            source_id=session.id,
        )
        session.journal_entry_id = rev_entry.id

    # 7. Record initial payment if provided
    paid_paise = 0
    if payload.initial_payment_paise > 0:
        # Determine account
        acct_code = "1001"
        acct_name = "Cash in Hand"
        acct_id = payload.initial_payment_account_id

        if payload.initial_payment_method == "bank_transfer":
            acct_code = "1002"
            acct_name = "Main Bank Account"

        if acct_id:
            fa = db.query(FinancialAccount).filter(FinancialAccount.id == acct_id).first()
            if fa:
                acct_code = fa.code
                acct_name = fa.name

        pay_ref = f"PAY-{reference}-01"
        payment = SessionPayment(
            reference=pay_ref,
            session_type="pool",
            session_id=session.id,
            collection_date=payload.session_date,
            amount_paise=payload.initial_payment_paise,
            payment_method=PaymentMethod(payload.initial_payment_method),
            account_id=acct_id,
            status=PaymentStatus.CONFIRMED,
            notes=f"Initial payment for {reference}",
        )
        db.add(payment)
        db.flush()

        # Post payment journal entry: DR Account, CR 1010 AR Pool
        pay_entry = JournalService.post_entry(
            db,
            entry_date=payload.session_date,
            description=f"Payment for {reference} via {payload.initial_payment_method}",
            lines=[
                JournalLineInput(acct_code, acct_name, True, payload.initial_payment_paise),
                JournalLineInput("1010", "Accounts Receivable — Pool", False, payload.initial_payment_paise),
            ],
            source_type="session_payment",
            source_id=payment.id,
        )
        payment.journal_entry_id = pay_entry.id
        paid_paise = payload.initial_payment_paise

    db.commit()
    db.refresh(session)

    player_data = PlayerResponse(
        id=player.id,
        name=player.name,
        phone=player.phone,
        is_active=player.is_active,
        created_at=player.created_at,
        updated_at=player.updated_at,
    )

    return PoolSessionResponse(
        id=session.id,
        reference=session.reference,
        session_date=session.session_date,
        player_id=session.player_id,
        player=player_data,
        customer_name=player.name,
        actual_minutes=session.actual_duration_minutes,
        chargeable_minutes=session.chargeable_duration_minutes,
        standard_charge_paise=session.standard_charge_paise,
        discount_paise=session.discount_paise,
        final_charge_paise=session.final_charge_paise,
        paid_amount_paise=paid_paise,
        outstanding_paise=final_paise - paid_paise,
        status=session.status.value,
        notes=session.notes,
        created_at=session.created_at,
    )


# ── PS4 Sessions ──────────────────────────────────────────────────────────────

@router.get("/ps4", response_model=list[PS4SessionResponse])
def list_ps4_sessions(
    session_date: Optional[date] = Query(None, alias="date"),
    status: Optional[str] = None,
    db: Session = Depends(get_db),
):
    query = db.query(PS4Session)
    if session_date:
        query = query.filter(PS4Session.session_date == session_date)
    if status:
        query = query.filter(PS4Session.status == status)

    sessions = query.order_by(PS4Session.session_date.desc(), PS4Session.id.desc()).all()

    result = []
    for s in sessions:
        paid = _get_paid_paise(db, "ps4", s.id)
        outstanding = max(0, s.final_charge_paise - paid)

        p1_data = None
        if s.player1:
            p1_data = PlayerResponse(
                id=s.player1.id,
                name=s.player1.name,
                phone=s.player1.phone,
                is_active=s.player1.is_active,
                created_at=s.player1.created_at,
                updated_at=s.player1.updated_at,
            )

        p2_data = None
        if s.player2:
            p2_data = PlayerResponse(
                id=s.player2.id,
                name=s.player2.name,
                phone=s.player2.phone,
                is_active=s.player2.is_active,
                created_at=s.player2.created_at,
                updated_at=s.player2.updated_at,
            )

        result.append(
            PS4SessionResponse(
                id=s.id,
                reference=s.reference,
                session_date=s.session_date,
                player_count=s.num_players,
                player1_id=s.player1_id,
                player1=p1_data,
                player2_id=s.player2_id,
                player2=p2_data,
                customer_name=s.player1.name if s.player1 else None,
                minutes=s.actual_duration_minutes,
                standard_charge_paise=s.standard_charge_paise,
                discount_paise=s.discount_paise,
                final_charge_paise=s.final_charge_paise,
                paid_amount_paise=paid,
                outstanding_paise=outstanding,
                status=s.status.value if hasattr(s.status, "value") else str(s.status),
                notes=s.notes,
                created_at=s.created_at,
            )
        )
    return result


@router.post("/ps4", response_model=PS4SessionResponse, status_code=201)
def create_ps4_session(payload: PS4SessionCreate, db: Session = Depends(get_db)):
    if payload.player1_id:
        player1 = db.query(Player).filter(Player.id == payload.player1_id).first()
        if not player1:
            raise HTTPException(status_code=404, detail="Player 1 not found")
    elif payload.customer_name and payload.customer_name.strip():
        player1 = _get_or_create_player(db, payload.customer_name)
    else:
        player1 = _get_or_create_player(db, "Walk-in Guest")

    player2 = None
    if payload.player_count == 2:
        if payload.player2_id:
            player2 = db.query(Player).filter(Player.id == payload.player2_id).first()
        else:
            player2 = _get_or_create_player(db, "Player 2")

    standard_paise = calculate_ps4_charge(payload.minutes, payload.player_count)
    final_paise = apply_discount(standard_paise, payload.discount_paise)

    if payload.initial_payment_paise > final_paise:
        raise HTTPException(
            status_code=400,
            detail=f"Payment amount exceeds final charge. Overpayment not permitted.",
        )

    date_str = payload.session_date.strftime("%Y%m%d")
    count = db.query(PS4Session).filter(PS4Session.reference.like(f"PS4-{date_str}-%")).count()
    reference = f"PS4-{date_str}-{count + 1:04d}"

    initial_status = SessionStatus.PENDING
    if payload.initial_payment_paise >= final_paise and final_paise > 0:
        initial_status = SessionStatus.PAID
    elif payload.initial_payment_paise > 0:
        initial_status = SessionStatus.PARTIAL

    session = PS4Session(
        reference=reference,
        session_date=payload.session_date,
        num_players=payload.player_count,
        player1_id=player1.id,
        player2_id=player2.id if player2 else None,
        actual_duration_minutes=payload.minutes,
        standard_charge_paise=standard_paise,
        discount_paise=payload.discount_paise,
        final_charge_paise=final_paise,
        status=initial_status,
        notes=payload.notes,
    )
    db.add(session)
    db.flush()

    # Post revenue entry: DR 1011 AR PS4, CR 4002 PS4 Revenue
    if final_paise > 0:
        rev_entry = JournalService.post_entry(
            db,
            entry_date=payload.session_date,
            description=f"PS4 session {reference} charge ({player1.name})",
            lines=[
                JournalLineInput("1011", "Accounts Receivable — PS4", True, final_paise),
                JournalLineInput("4002", "PS4 Revenue", False, final_paise),
            ],
            source_type="ps4_session",
            source_id=session.id,
        )
        session.journal_entry_id = rev_entry.id

    paid_paise = 0
    if payload.initial_payment_paise > 0:
        acct_code = "1001"
        acct_name = "Cash in Hand"
        if payload.initial_payment_method == "bank_transfer":
            acct_code = "1002"
            acct_name = "Main Bank Account"

        pay_ref = f"PAY-{reference}-01"
        payment = SessionPayment(
            reference=pay_ref,
            session_type="ps4",
            session_id=session.id,
            collection_date=payload.session_date,
            amount_paise=payload.initial_payment_paise,
            payment_method=PaymentMethod(payload.initial_payment_method),
            account_id=payload.initial_payment_account_id,
            status=PaymentStatus.CONFIRMED,
            notes=f"Initial payment for {reference}",
        )
        db.add(payment)
        db.flush()

        pay_entry = JournalService.post_entry(
            db,
            entry_date=payload.session_date,
            description=f"Payment for {reference} via {payload.initial_payment_method}",
            lines=[
                JournalLineInput(acct_code, acct_name, True, payload.initial_payment_paise),
                JournalLineInput("1011", "Accounts Receivable — PS4", False, payload.initial_payment_paise),
            ],
            source_type="session_payment",
            source_id=payment.id,
        )
        payment.journal_entry_id = pay_entry.id
        paid_paise = payload.initial_payment_paise

    db.commit()
    db.refresh(session)

    p1_data = PlayerResponse(
        id=player1.id,
        name=player1.name,
        phone=player1.phone,
        is_active=player1.is_active,
        created_at=player1.created_at,
        updated_at=player1.updated_at,
    )

    p2_data = None
    if player2:
        p2_data = PlayerResponse(
            id=player2.id,
            name=player2.name,
            phone=player2.phone,
            is_active=player2.is_active,
            created_at=player2.created_at,
            updated_at=player2.updated_at,
        )

    return PS4SessionResponse(
        id=session.id,
        reference=session.reference,
        session_date=session.session_date,
        player_count=session.num_players,
        player1_id=session.player1_id,
        player1=p1_data,
        player2_id=session.player2_id,
        player2=p2_data,
        customer_name=player1.name,
        minutes=session.actual_duration_minutes,
        standard_charge_paise=session.standard_charge_paise,
        discount_paise=session.discount_paise,
        final_charge_paise=session.final_charge_paise,
        paid_amount_paise=paid_paise,
        outstanding_paise=final_paise - paid_paise,
        status=session.status.value,
        notes=session.notes,
        created_at=session.created_at,
    )
