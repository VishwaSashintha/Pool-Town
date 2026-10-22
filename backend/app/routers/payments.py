from datetime import date
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from sqlalchemy import func

from app.database import get_db
from app.models.sessions import PoolSession, PS4Session, SessionStatus
from app.models.payments import SessionPayment, PaymentMethod, PaymentStatus
from app.models.accounts import FinancialAccount
from app.schemas.payments import SessionPaymentCreate, SessionPaymentResponse
from app.services.journal import JournalService, JournalLineInput

router = APIRouter(prefix="/api/payments", tags=["Payments"])


@router.get("/session", response_model=list[SessionPaymentResponse])
def list_session_payments(
    session_type: Optional[str] = None,
    session_id: Optional[int] = None,
    db: Session = Depends(get_db),
):
    query = db.query(SessionPayment)
    if session_type:
        query = query.filter(SessionPayment.session_type == session_type)
    if session_id:
        query = query.filter(SessionPayment.session_id == session_id)

    payments = query.order_by(SessionPayment.collection_date.desc(), SessionPayment.id.desc()).all()
    return payments


@router.get("/outstanding")
def list_outstanding_sessions(
    player_id: Optional[int] = None,
    session_type: Optional[str] = None,
    db: Session = Depends(get_db),
):
    """
    Returns all unpaid or partially paid sessions (Pool and PS4)
    with remaining outstanding receivable balances and player info.
    """
    results = []

    # 1. Pool sessions
    if not session_type or session_type == "pool":
        p_query = db.query(PoolSession).filter(PoolSession.status != SessionStatus.PAID)
        if player_id:
            p_query = p_query.filter(PoolSession.player_id == player_id)
        pool_sessions = p_query.order_by(PoolSession.session_date.desc(), PoolSession.id.desc()).all()

        for s in pool_sessions:
            paid = db.query(func.coalesce(func.sum(SessionPayment.amount_paise), 0)).filter(
                SessionPayment.session_type == "pool",
                SessionPayment.session_id == s.id,
                SessionPayment.status == PaymentStatus.CONFIRMED,
            ).scalar() or 0
            outstanding = max(0, s.final_charge_paise - paid)
            if outstanding > 0:
                results.append({
                    "id": s.id,
                    "session_type": "pool",
                    "reference": s.reference,
                    "session_date": s.session_date.isoformat(),
                    "player_id": s.player_id,
                    "player_name": s.player.name if s.player else "Unknown",
                    "phone": s.player.phone if s.player else None,
                    "chargeable_minutes": s.chargeable_duration_minutes,
                    "final_charge_paise": s.final_charge_paise,
                    "paid_amount_paise": paid,
                    "outstanding_paise": outstanding,
                    "status": s.status.value,
                })

    # 2. PS4 sessions
    if not session_type or session_type == "ps4":
        ps_query = db.query(PS4Session).filter(PS4Session.status != SessionStatus.PAID)
        if player_id:
            ps_query = ps_query.filter(PS4Session.player_id == player_id)
        ps4_sessions = ps_query.order_by(PS4Session.session_date.desc(), PS4Session.id.desc()).all()

        for s in ps4_sessions:
            paid = db.query(func.coalesce(func.sum(SessionPayment.amount_paise), 0)).filter(
                SessionPayment.session_type == "ps4",
                SessionPayment.session_id == s.id,
                SessionPayment.status == PaymentStatus.CONFIRMED,
            ).scalar() or 0
            outstanding = max(0, s.final_charge_paise - paid)
            if outstanding > 0:
                results.append({
                    "id": s.id,
                    "session_type": "ps4",
                    "reference": s.reference,
                    "session_date": s.session_date.isoformat(),
                    "player_id": s.player_id,
                    "player_name": s.player.name if s.player else "Unknown",
                    "phone": s.player.phone if s.player else None,
                    "chargeable_minutes": s.duration_minutes,
                    "final_charge_paise": s.final_charge_paise,
                    "paid_amount_paise": paid,
                    "outstanding_paise": outstanding,
                    "status": s.status.value,
                })

    results.sort(key=lambda x: x["session_date"], reverse=True)
    return results


@router.post("/session", response_model=SessionPaymentResponse, status_code=201)
def record_session_payment(payload: SessionPaymentCreate, db: Session = Depends(get_db)):
    # 1. Fetch target session
    if payload.session_type == "pool":
        session = db.query(PoolSession).filter(PoolSession.id == payload.session_id).first()
        ar_code = "1010"
        ar_name = "Accounts Receivable — Pool"
    else:
        session = db.query(PS4Session).filter(PS4Session.id == payload.session_id).first()
        ar_code = "1011"
        ar_name = "Accounts Receivable — PS4"

    if not session:
        raise HTTPException(status_code=404, detail="Target session not found")

    # 2. Check outstanding balance
    current_paid = db.query(
        func.coalesce(func.sum(SessionPayment.amount_paise), 0)
    ).filter(
        SessionPayment.session_type == payload.session_type,
        SessionPayment.session_id == payload.session_id,
        SessionPayment.status == PaymentStatus.CONFIRMED,
    ).scalar() or 0

    outstanding = session.final_charge_paise - current_paid
    if payload.amount_paise > outstanding:
        raise HTTPException(
            status_code=400,
            detail=f"Payment amount ({payload.amount_paise} paise) exceeds outstanding balance ({outstanding} paise). Overpayment is prevented by default.",
        )

    # 3. Create reference
    date_str = payload.collection_date.strftime("%Y%m%d")
    count = db.query(SessionPayment).filter(SessionPayment.reference.like(f"PAY-{date_str}-%")).count()
    reference = f"PAY-{date_str}-{count + 1:04d}"

    # 4. Determine cash/bank account
    acct_code = "1001"
    acct_name = "Cash in Hand"
    if payload.payment_method == "bank_transfer":
        acct_code = "1002"
        acct_name = "Main Bank Account"

    if payload.account_id:
        fa = db.query(FinancialAccount).filter(FinancialAccount.id == payload.account_id).first()
        if fa:
            acct_code = fa.code
            acct_name = fa.name

    # 5. Insert payment record
    payment = SessionPayment(
        reference=reference,
        session_type=payload.session_type,
        session_id=payload.session_id,
        collection_date=payload.collection_date,
        amount_paise=payload.amount_paise,
        payment_method=PaymentMethod(payload.payment_method),
        account_id=payload.account_id,
        status=PaymentStatus.CONFIRMED,
        notes=payload.notes,
    )
    db.add(payment)
    db.flush()

    # 6. Post double-entry journal: DR Cash/Bank, CR AR
    entry = JournalService.post_entry(
        db,
        entry_date=payload.collection_date,
        description=f"Payment for {session.reference} ({reference})",
        lines=[
            JournalLineInput(acct_code, acct_name, True, payload.amount_paise),
            JournalLineInput(ar_code, ar_name, False, payload.amount_paise),
        ],
        source_type="session_payment",
        source_id=payment.id,
    )
    payment.journal_entry_id = entry.id

    # 7. Update session status
    new_total_paid = current_paid + payload.amount_paise
    if new_total_paid >= session.final_charge_paise:
        session.status = SessionStatus.PAID
    elif new_total_paid > 0:
        session.status = SessionStatus.PARTIAL

    db.commit()
    db.refresh(payment)

    return payment
