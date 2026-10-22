# DECISIONS.md — Architecture and Business Decisions

*Record every significant technical or business decision here. Include date, decision ID, context, options considered, decision made, and rationale.*

---

## D-001 — Pool Session Pricing Rules (Corrected & Authoritative)

**Date:** 2026-10-22
**Status:** Resolved (Authoritative Owner Correction)

**Context:**
The original documentation noted an apparent ambiguity between Rs. 1,500 and Rs. 1,700 for 3 hours. The owners provided the authoritative, system-wide pricing schedule and formula:
- 1 hour = Rs. 500
- 1 hour 30 minutes = Rs. 800
- 2 hours = Rs. 1,000
- 2 hours 30 minutes = Rs. 1,300
- 3 hours = Rs. 1,500
- 3 hours 30 minutes = Rs. 1,800
- 4 hours = Rs. 2,000

**Formula:**
- The first 1 hour costs Rs. 500.
- Every full hour is charged at Rs. 500 / hr.
- An additional 30 minutes beyond a full hour costs Rs. 300.
- Therefore:
  - 1 hr = Rs. 500
  - 1.5 hr = 500 + 300 = Rs. 800
  - 2 hr = 2 × 500 = Rs. 1,000
  - 2.5 hr = 1,000 + 300 = Rs. 1,300
  - 3 hr = 3 × 500 = Rs. 1,500
  - 3.5 hr = 1,500 + 300 = Rs. 1,800
  - 4 hr = 4 × 500 = Rs. 2,000
- Any duration beyond full hours exceeding 30 minutes rounds up to the next full hour (Rs. 500).

**Historical Data Safety:**
All existing and completed sessions in the database preserve their originally recorded charges and payments. Historical session data is never modified by pricing formula updates. Manual price overrides and discounts remain fully supported.

---

## D-002 — Integer Paise Storage for Monetary Values

**Date:** 2026-10-22
**Status:** Resolved

**Context:**
Need a reliable monetary representation that avoids floating-point errors.

**Decision:**
Store all monetary amounts as `INTEGER` in the database representing **paise** (1 LKR = 100 paise).
- Rs. 500.00 → stored as `50000`
- Rs. 1,700.00 → stored as `170000`

Use Python `Decimal` with `ROUND_HALF_UP` for all intermediate arithmetic. Convert to `int` (paise) for storage.

The frontend receives paise from the API and displays using a shared `formatLKR(paise: number): string` utility.

**Rationale:**
Eliminates all floating-point representation errors. Consistent with accounting industry practice of storing smallest currency units.

---

## D-003 — SQLite with Foreign Keys Enabled

**Date:** 2026-10-22
**Status:** Resolved

**Context:**
Database selection for local-first deployment.

**Decision:**
Use SQLite as the initial database. Enable foreign keys on every connection via:
```python
@event.listens_for(Engine, "connect")
def set_sqlite_pragma(dbapi_connection, connection_record):
    cursor = dbapi_connection.cursor()
    cursor.execute("PRAGMA foreign_keys=ON")
    cursor.close()
```

**Rationale:**
SQLite is lightweight, zero-configuration, and appropriate for a single-location local business. Foreign key enforcement prevents orphaned records.

---

## D-004 — Weighted-Average Cost for Inventory Valuation

**Date:** 2026-10-22
**Status:** Resolved

**Context:**
Need a documented, consistent inventory cost method.

**Decision:**
Use **Weighted Average Cost** (also called Moving Average Cost). Average cost is recalculated on each purchase and applied to all subsequent sales until the next purchase.

**Rationale:**
Simpler to implement correctly than FIFO for a business with small product catalogue. Produces fair COGS matching typical purchase patterns.

---

## D-005 — Distributable Profit Definition

**Date:** 2026-10-22
**Status:** Pending Owner Confirmation

**Context:**
The requirements state that final allocation approval must be explicit and not automatic. The exact definition of "distributable profit" has not been confirmed by the owners.

**Current Assumption:**
```
Distributable Profit = Net Profit
    = Revenue − COGS − Operating Expenses − Interest Expense
```

Owner loans to the business are liabilities (not expenses), so their repayment does not reduce distributable profit.

**Action Required:**
Owners (Akash, Pasan, Vishwa) must confirm:
1. Whether any adjustments are made before profit distribution (e.g., reinvestment reserve)
2. Whether the 40% savings allocation is from net profit or some adjusted figure

Until confirmed, the system will calculate and display proposed allocations but will NOT post them without explicit owner approval.

---

## D-006 — Pool Table Service: No Table Selection Required

**Date:** 2026-10-22
**Status:** Resolved

**Context:**
The business operates pool tables but the requirements explicitly state: "The application must not require selection of Table 1 or Table 2."

**Decision:**
The Pool Table is treated as a single service type. Sessions are not associated with a specific physical table number. If future table tracking is required, this can be added as a non-mandatory field.

---

## D-007 — Opening Balance Date

**Date:** 2026-10-22
**Status:** Resolved

**Context:**
Historical data entry starts from 1 January 2026.

**Decision:**
The opening balance effective date is **31 December 2025** (day before operations begin). This allows the balance sheet to be correct from day 1 of operations (1 January 2026) without the opening balance entry appearing within the first operating period.

**Alternative considered:** Using 1 January 2026 as the opening date. This was rejected because it would mean the opening balance and first-day transactions share the same date, potentially causing confusion in period reports.

---

## D-008 — Technology Stack Confirmation

**Date:** 2026-10-22
**Status:** Resolved

**Context:**
The requirements specify a particular technology stack.

**Decision:**
Using the specified stack:
- Frontend: React + TypeScript + Vite + Tailwind CSS + shadcn/ui + TanStack Query + React Hook Form + Zod + Recharts
- Backend: Python + FastAPI + Pydantic + SQLAlchemy 2.x + Alembic
- Database: SQLite

No deviations from the specified stack were necessary.

---

## D-009 — Profit Allocation Rounding

**Date:** 2026-10-22
**Status:** Resolved

**Context:**
When allocating profit by percentage, paise rounding may leave a 1-paise discrepancy.

**Decision:**
Calculate each owner's share using `ROUND_HALF_UP`. The last recipient in the allocation list receives the remainder (net profit minus sum of all others' calculated shares). This ensures the total always equals the exact net profit with zero rounding error.

The order for "last recipient" purposes: Savings → Akash → Pasan → **Vishwa** (Vishwa receives the remainder paise).

---

## D-010 — No Automatic Overpayment Acceptance

**Date:** 2026-10-22
**Status:** Resolved

**Context:**
The requirements state: "Prevent overpayment by default."

**Decision:**
If a payment amount would cause the session outstanding balance to go below zero:
- The backend rejects the payment with a clear error message
- If owners intentionally accept an advance, they must explicitly record it as a "Customer Advance" via a separate workflow
- Customer advances are recorded as a liability (Customer Advances account 2020), not as revenue

---
