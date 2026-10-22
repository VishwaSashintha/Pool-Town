# Billiard Hall Management and Accounting System
## Complete Business Requirements

*Source: Master Development Prompt — October 2026*
*Status: Authoritative — Do not replace with a summary*

---

## 1. Business Context

A real Billiard Hall business with three owners:
- **Akash** — 20% profit share
- **Pasan** — 20% profit share
- **Vishwa** — 20% profit share
- **Savings** — 40% of distributable profit

Historical start date: **1 January 2026**

Currency: **Sri Lankan Rupees (LKR / Rs.)**

---

## 2. Services

### 2.1 Pool Table

Single service category — "Pool Table" (no table 1 / table 2 distinction required).

**Pricing (authoritative):**
| Duration | Charge |
|---|---|
| 1 hour (60 minutes) | Rs. 500 |
| 1 hour 30 minutes (90 minutes) | Rs. 800 (500 + 300) |
| 2 hours (120 minutes) | Rs. 1,000 (2 × 500) |
| 2 hours 30 minutes (150 minutes) | Rs. 1,300 (1,000 + 300) |
| 3 hours (180 minutes) | Rs. 1,500 (3 × 500) |
| 3 hours 30 minutes (210 minutes) | Rs. 1,800 (1,500 + 300) |
| 4 hours (240 minutes) | Rs. 2,000 (4 × 500) |

**Formula:** Rs. 500 for the first 1 hour; every full hour is charged at Rs. 500/hr, plus Rs. 300 for an additional 30-minute block. Durations beyond 30 minutes round up to the next full hour.

**Standard duration choices:** 30 min, 1 hr, 1.5 hr, 2 hr, 2.5 hr, 3 hr, 3.5 hr, 4 hr, 5 hr. Longer durations allowed with the same formula applied consistently and manual price override available.

**Session fields:**
- Session reference (auto-generated)
- Playing date
- Player (linked to player record)
- Actual playing duration (minutes)
- Chargeable duration (minutes)
- Standard calculated charge
- Discount / adjustment amount
- Final charge (standard − discount)
- Initial payment (optional)
- Notes
- Created by / created at / updated at

### 2.2 PS4

Separate service named "PS4".

**Pricing (initial):**
- 1 player: Rs. 400 per hour
- 2 players: Rs. 500 per hour

**Session fields:**
- Session reference
- Playing date
- Number of players (1 or 2)
- Player record(s) linked
- Playing duration (minutes)
- Standard charge
- Discount
- Final charge
- Initial payment (optional)
- Notes
- Created by / created at / updated at

Future pricing changes must not alter historical sessions.

---

## 3. Player Management

- Reusable player records with autocomplete
- Create new player inline when no match selected
- Duplicate detection using normalized name comparison and similarity matching
- Do NOT auto-merge duplicates; authorized owners may manually merge
- Merge preserves all linked sessions, payments, aliases, and audit history

**Player report includes:**
- Total sessions, playing hours, chargeable hours
- Total charges, discounts, payments, outstanding balance
- Average session duration
- Activity by day / week / month / custom range

---

## 4. Payments and Receivables

Each session has one charge and zero or more linked payments.

**Payment fields:**
- Unique reference
- Linked session
- Collection date (actual, may differ from session date)
- Amount
- Payment method (Cash / Bank Transfer / etc.)
- Destination account
- Reference / notes
- Created by / created at

**Outstanding = Final charge − valid payments − approved adjustments**

**Payment status:**
- Pending (nothing paid)
- Partially Paid (balance > 0, at least one payment)
- Paid (balance = 0)
- Cancelled / Adjusted

Rules:
- Partial payments allowed
- Multiple payment methods allowed
- Prevent overpayment by default
- Intentional advance → customer credit / advance liability (not negative revenue)
- Never delete a valid earlier payment when a new payment arrives
- Outstanding-payments screen: player search, session date, original charge, payments received, remaining balance, Receive Payment action
- Reports must distinguish date earned vs. date collected

---

## 5. Inventory and Product Sales

### 5.1 Product Catalogue

Initial products:
| Product | Purchase Price | Selling Price |
|---|---|---|
| MY Cola | Rs. 80 | Rs. 100 |
| Berry | Rs. 80 | Rs. 100 |
| Cream Soda | Rs. 80 | Rs. 100 |

Configurable: product name, size, unit, category, purchase price, selling price, minimum stock level.

### 5.2 Stock Movement Ledger

All stock changes are recorded as individual movements. Types:
- Opening stock
- Purchase / receipt
- Sale
- Damaged
- Complimentary / Internal consumption
- Supplier return
- Stock correction
- Physical count result

**Never overwrite previous stock quantity.** Calculate expected stock from opening balance + all movements.

Record both event date and data-entry date.

Support backdated movements and historical counts.

Incomplete historical data → mark as "unverified", not zero.

### 5.3 Product Sales and Weekly Collections

Workflow distinguishes:
- Quantities sold
- Expected sales revenue
- Cost of sales (actual unit cost)
- Gross profit
- Amount collected
- Amount awaiting collection
- Differences requiring investigation

Arbitrary date ranges. Sales date ≠ collection date (tracked separately).

If information is insufficient to determine sales reliably → flag period for review.

### 5.4 Inventory Valuation

- Weighted-average cost method
- Keep purchases separate from cost of sales
- Unsold products remain as inventory asset (not automatic COGS)
- COGS calculated only when sale is recorded
- Low-stock and negative-stock warnings
- Negative stock NOT silently accepted

---

## 6. Expenses

### 6.1 Expense Categories (initial)
- Electricity
- Water
- Rent
- Pool equipment and maintenance
- Building maintenance and repairs
- PS4 games and equipment
- Salaries
- Fuel and travelling
- Bank charges
- Events and openings
- Other expenses

### 6.2 Expense Fields
- Date
- Category
- Description
- Amount
- Payee
- Payment status (Unpaid / Partially Paid / Paid)
- Account used for payment
- References
- Notes
- Audit information

### 6.3 Rules
- Support unpaid bills and multiple partial payments
- Recording payment ≠ creating new expense
- Distinguish: expense incurred / payment made / outstanding payable / payment against prior-period bill
- Suitable asset classification for durable equipment (not forced to operating expense)
- Warn about duplicate expenses

---

## 7. Cash, Bank, and Savings

### 7.1 Initial Accounts
- Cash in hand
- Main business bank account
- Savings account
- Other configured accounts

Account balances = opening balance + posted transactions (never a single editable field).

### 7.2 Reconciliation

**Cash:** Actual counted cash vs. calculated expected cash → display difference.

**Bank:** Actual bank statement balance vs. calculated expected balance → display difference.

Never silently change a recorded balance to eliminate a discrepancy. History of discrepancy investigations preserved.

---

## 8. Profit and Savings Allocation

**Initial allocation percentages:**
| Recipient | Share |
|---|---|
| Savings | 40% |
| Akash | 20% |
| Pasan | 20% |
| Vishwa | 20% |

Percentages configurable; must total 100%.

Profit is calculated from accounting records, not from bank balance or gross revenue.

**Profit hierarchy:**
1. Revenue
2. Cost of Sales
3. Gross Profit
4. Operating Expenses
5. Other income / expenses
6. Net Profit
7. Verified Distributable Profit
8. Calculated Allocation
9. Actual Transfer / Distribution

**Keep distinct:**
- Profit allocated to savings
- Money actually transferred into savings
- Savings expenditure
- Money transferred out of savings
- Remaining savings balance

Spending from savings → recorded by nature of transaction, not double-deducted from profit.

Final allocation approval must be explicit (not automatic).

---

## 9. Owner Capital and Distributions

Track each owner (Akash, Pasan, Vishwa) independently.

Supported transaction types:
- Initial capital
- Additional capital
- Return of capital
- Owner loan to business
- Profit allocation
- Actual profit distribution
- Withdrawal
- Reimbursement
- Correction / reclassification

Every transaction: date, amount, type, account, description, audit information.

Owner loan → recorded as liability (not equity) when repayment is owed.

Owner withdrawal ≠ automatic profit distribution.

**Individual owner report:** contributions, allocations, withdrawals, distributions paid, outstanding distributions, balances.

---

## 10. Loan Management

Supported lender types: bank, external lender, owner.

**Loan fields:**
- Lender name / type
- Original principal
- Start date
- Interest rate
- Opening outstanding balance
- Repayment terms
- Status (Active / Settled)

**Supported transactions:**
- Loan receipt
- Principal repayment
- Interest payment
- Fees
- Additional borrowing
- Correction
- Full settlement

**Mixed repayment rule:** Rs. 10,000 payment = Rs. 8,000 principal + Rs. 2,000 interest →
- Cash / Bank: −Rs. 10,000
- Loan liability: −Rs. 8,000
- Interest expense: +Rs. 2,000
- Journal must balance.

**Reports:** loan balance, principal repaid, interest paid, repayment history, upcoming repayments.

---

## 11. Dashboard

Date-range selector with clearly displayed reporting period.

**Summary cards:**
- Revenue, Gross Profit, Net Profit
- Cash Collected, Bank Collections, Outstanding Receivables
- Cash Balance, Bank Balance, Savings Balance
- Outstanding Loan Principal

**Operational summaries:**
- Pool sessions and hours
- PS4 sessions and hours
- Product sales
- Low stock, stock discrepancies
- Unpaid sessions, unpaid supplier bills
- Reconciliation warnings

**Charts:** revenue, expenses, service performance, historical trends.

Every figure → traceable to underlying report or transaction list.

No fake charts or hardcoded sample totals. Empty state when no transactions exist.

---

## 12. Reports

### Daily Report
Sessions, charges, discounts, collections, expenses, payments against older sessions, stock movements, closing balances.

### Weekly Report
Pool + PS4 activity, product sales, stock reconciliation, collections, expenses, account movements, outstanding amounts.

### Monthly Income Statement
Revenue by service, COGS, gross profit, operating expenses, other income/expenses, net profit. Profit allocations shown separately.

### Other Reports
- Player history and outstanding receivables
- Supplier payables
- Product sales and gross profit
- Stock movement history
- Stock reconciliation
- Cash and bank reconciliation
- Savings history
- Owner capital and distribution reports
- Loan reports
- General ledger
- Trial balance
- Audit history
- Migration reconciliation

CSV exports and printable reports for all reports.

Reports use correct transaction dates (not data-entry dates) for period assignment.

All figures reconcile to underlying accounting records.

---

## 13. Month-End Closing

Calendar months (correct month lengths and leap years).

**Closing checklist:**
1. Pool and PS4 sessions verified
2. Unpaid / partially paid sessions reviewed
3. Cash reconciliation complete
4. Bank reconciliation complete
5. Physical stock counts entered
6. Stock discrepancies investigated
7. Expenses and outstanding bills reviewed
8. Loans, repayments, and interest reconciled
9. Savings allocations and owner transactions confirmed
10. Final income statement and reports generated

Cannot mark period "fully reconciled" if mandatory checks are incomplete (unless authorized override with documented reason).

Closed periods: preserve original closing report and balances. Require authorization + reason to reopen. History of original and corrected reports maintained.

---

## 14. Security and Auditability

- Individual user identities and configurable permissions
- Audit log: who created / modified / reversed / approved / closed each transaction
- Protected operations require explicit authorization: opening-balance changes, payment reversals, large adjustments, owner distributions, period reopening, financial corrections, backup restoration
- Explanations required for corrections
- Never silently delete posted transactions — use reversals or approved correcting entries
- Passwords stored hashed (bcrypt or Argon2), never plain text
- Database credentials and internal error traces never exposed to client responses

---

## 15. Backup and Restore

- Safe database backup process
- Timestamps and results recorded per backup
- Backups stored separately from active database
- Backup integrity validation
- Restoration from verified backup
- Protection against accidental overwrite of active database
- Test backup and restore procedures
- Documented retention policy before any automatic deletion
- Document what is and is not included in each backup

---

## 16. Historical Data

- Start date: 1 January 2026
- Support backdated entry of all transaction types
- Preserve original event date AND data-entry date
- Do NOT fabricate: payment methods, stock quantities, transaction dates, opening balances
- Unknown / unverified status supported
- Opening balances via controlled accounting entries with defined effective date
- Opening balances and historical transactions must not duplicate each other
- Reconciliation reports: entered records vs. original physical books
- Do NOT auto-correct to zero a reconciliation difference

---

## 17. UI/UX Requirements

### Visual Design
- Professional, modern business application
- Consistent spacing and typography
- Readable financial figures
- Subtle borders and shadows
- Consistent icons (Lucide)
- Accessible color contrast (WCAG AA)
- Consistent button styles
- Confirmation dialogs for consequential actions
- Warning indicators for financial discrepancies
- No clutter, excessive gradients, or decorative elements

### Status Colors (consistent across app)
- Paid → Green
- Partially Paid → Amber/Yellow
- Pending → Gray / Blue
- Cancelled → Red/Strikethrough
- Reconciled → Green
- Needs Review → Orange/Warning

Never rely on color alone — always include text label.

### Navigation Sidebar
- Dashboard
- Daily Operations: Pool Sessions, PS4 Sessions, Players, Outstanding Payments
- Inventory: Products, Purchases, Stock Counts, Sales & Weekly Collections, Stock Reconciliation
- Finance: Expenses, Cash & Bank, Savings, Owner Accounts, Loans, Accounting Ledger
- Reports: Daily, Weekly, Monthly, Player Reports, Inventory Reports, Financial Reports
- Month-End Closing
- Transaction History
- Settings
- Backup & Restore

### Daily Entry Speed
1. Select date
2. Select Pool Table or PS4
3. Enter player and duration
4. Review calculated charge
5. Enter discount / adjustment
6. Record initial payment (optional)
7. Save
8. Immediately enter next session (date preserved)

Keyboard navigation, default values, player autocomplete, clear validation, minimal fields.

### Tables
All major lists: search, date filter, status filter, sorting, pagination, totals, row actions, detail view, export.

### Forms
Labels, validation messages, helpful defaults, marked optional fields.

After save: confirmation displayed, form ready for next entry (date preserved), form NOT silently cleared on failure.
