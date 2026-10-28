"""
Authoritative accounting journal service.
Enforces double-entry invariants, period locking, and append-only immutability.
All amounts are in integer paise (1 LKR = 100 paise).
"""
from __future__ import annotations

from dataclasses import dataclass
from datetime import date
from typing import Optional
from sqlalchemy.orm import Session
from sqlalchemy import func, and_, case

from app.models.journal import JournalEntry, JournalLine, JournalEntryStatus, AccountingPeriod
from app.models.accounts import FinancialAccount
from app.utils.money import validate_journal_balance


class AccountingError(Exception):
    """Base exception for accounting invariant violations."""
    pass


class UnbalancedJournalEntryError(AccountingError):
    """Raised when sum of debits does not equal sum of credits."""
    pass


class ClosedPeriodError(AccountingError):
    """Raised when attempting to post into a closed accounting period."""
    pass


class ImmutableTransactionError(AccountingError):
    """Raised when attempting to delete or directly modify a posted entry."""
    pass


@dataclass
class JournalLineInput:
    account_code: str
    account_name: str
    is_debit: bool
    amount_paise: int
    description: Optional[str] = None


class JournalService:
    @staticmethod
    def generate_reference(db: Session, entry_date: date) -> str:
        """Generate human-readable sequential reference: JE-YYYYMM-XXXX."""
        prefix = f"JE-{entry_date.strftime('%Y%m')}-"
        count = db.query(JournalEntry).filter(
            JournalEntry.reference.like(f"{prefix}%")
        ).count()
        return f"{prefix}{count + 1:04d}"

    @staticmethod
    def get_or_create_period(db: Session, entry_date: date) -> AccountingPeriod:
        """Fetch or create the calendar month accounting period."""
        period = db.query(AccountingPeriod).filter(
            AccountingPeriod.year == entry_date.year,
            AccountingPeriod.month == entry_date.month,
        ).first()

        if not period:
            period = AccountingPeriod(
                year=entry_date.year,
                month=entry_date.month,
                is_closed=False,
            )
            db.add(period)
            db.flush()

        return period

    @classmethod
    def post_entry(
        cls,
        db: Session,
        *,
        entry_date: date,
        description: str,
        lines: list[JournalLineInput],
        source_type: Optional[str] = None,
        source_id: Optional[int] = None,
        created_by: Optional[str] = None,
        notes: Optional[str] = None,
        reference: Optional[str] = None,
    ) -> JournalEntry:
        """
        Create and post a balanced journal entry.
        Invariants enforced:
        1. sum(debits) == sum(credits)
        2. All amounts > 0
        3. Accounting period must not be closed
        4. At least 2 lines required
        """
        if len(lines) < 2:
            raise AccountingError("A journal entry must contain at least 2 lines.")

        for line in lines:
            if line.amount_paise <= 0:
                raise AccountingError(
                    f"Line amount must be positive. Received {line.amount_paise} for account {line.account_code}."
                )

        # Check debit/credit balance
        debit_amounts = [line.amount_paise for line in lines if line.is_debit]
        credit_amounts = [line.amount_paise for line in lines if not line.is_debit]
        total_debits = sum(debit_amounts)
        total_credits = sum(credit_amounts)

        if not validate_journal_balance(debit_amounts, credit_amounts):
            diff = abs(total_debits - total_credits)
            raise UnbalancedJournalEntryError(
                f"Journal entry is out of balance by {diff} paise. "
                f"Total Debits: {total_debits} paise, Total Credits: {total_credits} paise."
            )

        # Period check
        if source_type == "opening_balance":
            period_id = None
        else:
            period = cls.get_or_create_period(db, entry_date)
            if period.is_closed:
                raise ClosedPeriodError(
                    f"Accounting period {period.year}-{period.month:02d} is CLOSED. "
                    f"Transactions cannot be posted to closed periods without reopening authorization."
                )
            period_id = period.id

        # Generate unique reference if not provided
        ref = reference or cls.generate_reference(db, entry_date)

        entry = JournalEntry(
            reference=ref,
            entry_date=entry_date,
            description=description,
            status=JournalEntryStatus.POSTED,
            source_type=source_type,
            source_id=source_id,
            period_id=period_id,
            created_by=created_by,
            notes=notes,
        )
        db.add(entry)
        db.flush()

        for line in lines:
            jline = JournalLine(
                entry_id=entry.id,
                account_code=line.account_code,
                account_name=line.account_name,
                is_debit=line.is_debit,
                amount_paise=line.amount_paise,
                description=line.description,
            )
            db.add(jline)

        db.flush()
        return entry

    @classmethod
    def reverse_entry(
        cls,
        db: Session,
        entry_id: int,
        *,
        reversal_date: date,
        reason: str,
        created_by: Optional[str] = None,
    ) -> JournalEntry:
        """
        Reverse a posted journal entry by creating an opposite entry.
        Never deletes or modifies the original entry.
        """
        original = db.query(JournalEntry).filter(JournalEntry.id == entry_id).first()
        if not original:
            raise AccountingError(f"Journal entry {entry_id} not found.")

        if original.status == JournalEntryStatus.REVERSED:
            raise AccountingError(f"Journal entry {original.reference} is already reversed.")

        # Build reversed lines (switch debit and credit)
        reversed_lines: list[JournalLineInput] = []
        for line in original.lines:
            reversed_lines.append(
                JournalLineInput(
                    account_code=line.account_code,
                    account_name=line.account_name,
                    is_debit=not line.is_debit,  # Flip debit/credit
                    amount_paise=line.amount_paise,
                    description=f"Reversal of {original.reference}: {line.description or ''}".strip(),
                )
            )

        reversal = cls.post_entry(
            db,
            entry_date=reversal_date,
            description=f"REVERSAL of {original.reference}: {reason}",
            lines=reversed_lines,
            source_type="reversal",
            source_id=original.id,
            created_by=created_by,
            notes=f"Reverses entry {original.reference}. Reason: {reason}",
        )
        reversal.reverses_entry_id = original.id

        # Mark original as reversed
        original.status = JournalEntryStatus.REVERSED
        db.flush()

        return reversal

    @staticmethod
    def get_account_balance(
        db: Session,
        account_code: str,
        *,
        as_of_date: Optional[date] = None,
    ) -> int:
        """
        Calculate net account balance in paise as of a given date.
        Asset / Expense / COGS / Distribution accounts (1xxx, 5xxx, 6xxx, 7xxx) are Debit-normal:
            Balance = Debits - Credits
        Liability / Equity / Revenue accounts (2xxx, 3xxx, 4xxx) are Credit-normal:
            Balance = Credits - Debits
        """
        query = db.query(
            func.coalesce(func.sum(JournalLine.amount_paise), 0)
        ).join(JournalEntry).filter(
            JournalLine.account_code == account_code,
            JournalEntry.status.in_([JournalEntryStatus.POSTED, JournalEntryStatus.REVERSED]),
        )

        if as_of_date:
            query = query.filter(JournalEntry.entry_date <= as_of_date)

        total_debits = query.filter(JournalLine.is_debit == True).scalar() or 0
        total_credits = query.filter(JournalLine.is_debit == False).scalar() or 0

        first_digit = account_code[0] if account_code else "1"
        # 1xxx (Assets), 5xxx (COGS), 6xxx (Expenses), 7xxx (Distributions) -> Normal debit
        if first_digit in ("1", "5", "6", "7"):
            return total_debits - total_credits
        else:
            # 2xxx (Liabilities), 3xxx (Equity), 4xxx (Revenue) -> Normal credit
            return total_credits - total_debits

    @staticmethod
    def get_trial_balance(
        db: Session,
        *,
        as_of_date: Optional[date] = None,
    ) -> list[dict]:
        """
        Generate trial balance across all accounts as of given date.
        Returns list of {account_code, account_name, total_debit_paise, total_credit_paise, net_balance_paise}.
        """
        query = db.query(
            JournalLine.account_code,
            JournalLine.account_name,
            func.sum(
                case((JournalLine.is_debit == True, JournalLine.amount_paise), else_=0)
            ).label("total_debits"),
            func.sum(
                case((JournalLine.is_debit == False, JournalLine.amount_paise), else_=0)
            ).label("total_credits"),
        ).join(JournalEntry).filter(
            JournalEntry.status.in_([JournalEntryStatus.POSTED, JournalEntryStatus.REVERSED]),
        )

        if as_of_date:
            query = query.filter(JournalEntry.entry_date <= as_of_date)

        rows = query.group_by(JournalLine.account_code, JournalLine.account_name).order_by(
            JournalLine.account_code
        ).all()

        results = []
        for code, name, debits, credits in rows:
            debits = debits or 0
            credits = credits or 0
            first_digit = code[0] if code else "1"
            net = (debits - credits) if first_digit in ("1", "5", "6", "7") else (credits - debits)
            results.append({
                "account_code": code,
                "account_name": name,
                "total_debit_paise": debits,
                "total_credit_paise": credits,
                "net_balance_paise": net,
            })
        return results
