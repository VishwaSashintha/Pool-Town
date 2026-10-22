# ACCOUNTING_RULES.md — Billiard Hall Management System

*All agents must consult this document before implementing any financial calculation.*

---

## 1. Monetary Representation

All monetary amounts are stored as **integers in paise** (1 LKR = 100 paise).

| Display | Storage |
|---|---|
| Rs. 500.00 | 50000 |
| Rs. 1,700.00 | 170000 |
| Rs. 80.00 | 8000 |

**Rules:**
- Never use `float` for money in Python — use `int` or `Decimal`
- Never use JavaScript `number` floating-point for money — use integer paise
- All arithmetic on money: integer operations only
- Division (e.g., for percentages): use `Decimal`, round using `ROUND_HALF_UP`, convert to `int`

```python
from decimal import Decimal, ROUND_HALF_UP

def paise_from_decimal(d: Decimal) -> int:
    """Convert Decimal rupees to integer paise, rounding half-up."""
    return int((d * 100).quantize(Decimal('1'), rounding=ROUND_HALF_UP))
```

---

## 2. Chart of Accounts

### Assets (1xxx)
| Code | Account | Type |
|---|---|---|
| 1001 | Cash in Hand | Asset |
| 1002 | Main Bank Account | Asset |
| 1003 | Savings Account | Asset |
| 1010 | Accounts Receivable — Pool | Asset |
| 1011 | Accounts Receivable — PS4 | Asset |
| 1020 | Inventory — Drinks | Asset |
| 1030 | Fixed Assets | Asset |
| 1031 | Accumulated Depreciation | Asset (Contra) |

### Liabilities (2xxx)
| Code | Account | Type |
|---|---|---|
| 2001 | Accounts Payable — Suppliers | Liability |
| 2010 | Loan Payable | Liability |
| 2020 | Customer Advances | Liability |
| 2030 | Owner Loans Payable | Liability |

### Equity (3xxx)
| Code | Account | Type |
|---|---|---|
| 3001 | Owner Capital — Akash | Equity |
| 3002 | Owner Capital — Pasan | Equity |
| 3003 | Owner Capital — Vishwa | Equity |
| 3010 | Retained Earnings | Equity |
| 3011 | Profit Allocation — Savings | Equity |
| 3012 | Profit Allocation — Akash | Equity |
| 3013 | Profit Allocation — Pasan | Equity |
| 3014 | Profit Allocation — Vishwa | Equity |

### Revenue (4xxx)
| Code | Account | Type |
|---|---|---|
| 4001 | Pool Table Revenue | Revenue |
| 4002 | PS4 Revenue | Revenue |
| 4003 | Product Sales Revenue | Revenue |
| 4004 | Other Income | Revenue |

### Cost of Sales (5xxx)
| Code | Account | Type |
|---|---|---|
| 5001 | Cost of Goods Sold — Drinks | COGS |

### Expenses (6xxx)
| Code | Account | Type |
|---|---|---|
| 6001 | Electricity | Expense |
| 6002 | Water | Expense |
| 6003 | Rent | Expense |
| 6004 | Pool Equipment & Maintenance | Expense |
| 6005 | Building Maintenance & Repairs | Expense |
| 6006 | PS4 Games & Equipment | Expense |
| 6007 | Salaries | Expense |
| 6008 | Fuel & Travelling | Expense |
| 6009 | Bank Charges | Expense |
| 6010 | Events & Openings | Expense |
| 6011 | Other Expenses | Expense |
| 6020 | Interest Expense | Expense |

### Distributions (7xxx)
| Code | Account | Type |
|---|---|---|
| 7001 | Owner Distribution — Akash | Distribution |
| 7002 | Owner Distribution — Pasan | Distribution |
| 7003 | Owner Distribution — Vishwa | Distribution |

---

## 3. Pool Session Pricing Rules

**Formula:** Base charge Rs. 500 for the first 60 minutes. For each additional 30-minute block (or part thereof) beyond 60 minutes: add Rs. 300.

**Verified test cases:**
| Duration (min) | Extra blocks | Charge (Rs.) | Charge (paise) |
|---|---|---|---|
| 30 | 0 | 500 | 50000 |
| 60 | 0 | 500 | 50000 |
| 61–90 | 1 | 800 | 80000 |
| 91–120 | 2 | 1,100 | 110000 |
| 121–150 | 3 | 1,400 | 140000 |
| 151–180 | 4 | 1,700 | 170000 |
| 181–210 | 5 | 2,000 | 200000 |
| 211–240 | 6 | 2,300 | 230000 |

**Python implementation:**
```python
def calculate_pool_charge(duration_minutes: int, base_paise: int = 50000, block_paise: int = 30000) -> int:
    """Calculate pool session charge in paise."""
    if duration_minutes <= 0:
        raise ValueError("Duration must be positive")
    if duration_minutes <= 60:
        return base_paise
    extra_minutes = duration_minutes - 60
    extra_blocks = (extra_minutes + 29) // 30  # ceiling division
    return base_paise + extra_blocks * block_paise
```

**Important:** The requirements document mentions a 3-hour example at Rs. 1,500. This conflicts with the formula (Rs. 1,700). **The formula is authoritative for new sessions.** See `docs/DECISIONS.md` entry D-001.

---

## 4. PS4 Session Pricing Rules

**Formula:** Hourly rate × (duration_minutes / 60), rounded up to nearest 30 minutes.

**Rates:**
- 1 player: Rs. 400/hour = 40000 paise/hour
- 2 players: Rs. 500/hour = 50000 paise/hour

**Python implementation:**
```python
def calculate_ps4_charge(duration_minutes: int, num_players: int, 
                          rate_1p_paise: int = 40000, rate_2p_paise: int = 50000) -> int:
    """Calculate PS4 session charge in paise."""
    if num_players not in (1, 2):
        raise ValueError("Number of players must be 1 or 2")
    rate = rate_1p_paise if num_players == 1 else rate_2p_paise
    # Rate is per hour; convert to per 30 min block
    # Charge = ceil(duration / 60) hours × rate
    from math import ceil
    hours = ceil(duration_minutes / 60)
    return hours * rate
```

---

## 5. Outstanding Balance Formula

```
Outstanding Balance = Final Charge − Sum(Valid Payments) − Sum(Approved Adjustments)
```

- Final Charge = Standard Charge − Discount
- Valid Payments = all payments with status CONFIRMED (not REVERSED)
- Approved Adjustments = write-offs, formal corrections (each with audit trail)
- Outstanding ≥ 0 (overpayment → customer credit, not negative outstanding)

---

## 6. Journal Entry Rules

Every journal entry must satisfy:
```
Sum(Debit Lines) = Sum(Credit Lines)
```

The application must reject unbalanced entries at the service layer.

### Common Journal Patterns

**6.1 Recording a session (when charge is created):**
```
DR  Accounts Receivable   [final_charge]
CR  Service Revenue       [final_charge]
```

**6.2 Receiving payment (cash):**
```
DR  Cash in Hand          [amount]
CR  Accounts Receivable   [amount]
```

**6.3 Receiving payment (bank):**
```
DR  Main Bank Account     [amount]
CR  Accounts Receivable   [amount]
```

**6.4 Recording a purchase (accounts payable):**
```
DR  Inventory             [total_cost]
CR  Accounts Payable      [total_cost]
```

**6.5 Paying a supplier bill (cash):**
```
DR  Accounts Payable      [amount]
CR  Cash in Hand          [amount]
```

**6.6 Recording a sale (product):**
```
DR  Accounts Receivable   [selling_price × qty]   (or Cash if paid immediately)
CR  Product Sales Revenue [selling_price × qty]

DR  Cost of Goods Sold    [avg_cost × qty]
CR  Inventory             [avg_cost × qty]
```

**6.7 Recording an expense (unpaid):**
```
DR  Expense Account       [amount]
CR  Accounts Payable      [amount]
```

**6.8 Paying an expense (cash):**
```
DR  Accounts Payable      [amount]
CR  Cash in Hand          [amount]
```

**6.9 Account transfer (cash to bank):**
```
DR  Main Bank Account     [amount]
CR  Cash in Hand          [amount]
```

**6.10 Loan received:**
```
DR  Cash / Bank           [amount]
CR  Loan Payable          [amount]
```
(This is NOT revenue.)

**6.11 Loan repayment (principal + interest):**
```
DR  Loan Payable          [principal]
DR  Interest Expense      [interest]
CR  Cash / Bank           [total_payment]
```

**6.12 Profit allocation:**
```
DR  Retained Earnings     [net_profit]
CR  Profit Alloc—Savings  [savings_share]
CR  Profit Alloc—Akash    [akash_share]
CR  Profit Alloc—Pasan    [pasan_share]
CR  Profit Alloc—Vishwa   [vishwa_share]
```

**6.13 Owner distribution (actual payment):**
```
DR  Profit Alloc—[Owner]  [amount]
CR  Cash / Bank           [amount]
```

**6.14 Opening balance entry:**
```
DR  [Asset Accounts]      [amounts]
CR  [Liability Accounts]  [amounts]
CR  Retained Earnings     [balancing amount]
```
(Opening balance entry must be on the defined opening date and not duplicated by historical transactions.)

---

## 7. Inventory Valuation — Weighted Average Cost

**Formula:**
```
Average Cost = (Total Inventory Value) / (Total Units on Hand)
```

Updated on every purchase:
```
New Average Cost = (Old Qty × Old Avg Cost + Purchase Qty × Purchase Cost) / (Old Qty + Purchase Qty)
```

COGS when a unit is sold:
```
COGS = Qty Sold × Current Average Cost (at time of sale)
```

**Python implementation:**
```python
from decimal import Decimal, ROUND_HALF_UP

def update_weighted_average_cost(
    current_qty: int,
    current_avg_cost_paise: int,
    purchase_qty: int,
    purchase_cost_paise: int
) -> int:
    """Return new weighted average cost in paise per unit."""
    total_units = current_qty + purchase_qty
    if total_units == 0:
        return 0
    total_value = Decimal(current_qty * current_avg_cost_paise + purchase_qty * purchase_cost_paise)
    avg = total_value / Decimal(total_units)
    return int(avg.quantize(Decimal('1'), rounding=ROUND_HALF_UP))
```

---

## 8. Profit and Savings Allocation

**Initial percentages:**
```
Savings: 40%   (= 4000 basis points)
Akash:   20%   (= 2000 basis points)
Pasan:   20%   (= 2000 basis points)
Vishwa:  20%   (= 2000 basis points)
Total:  100%
```

**Validation:** percentages must sum to exactly 100% (10000 basis points) before any allocation is posted.

**Distributable Profit:**
```
Distributable Profit = Net Profit
    (after all operating expenses, COGS, and other applicable items)
    (excludes previous period allocations already posted)
```

**Allocation calculation:**
```python
def calculate_allocation(net_profit_paise: int, percentages: dict) -> dict:
    """Calculate profit allocation. Handles rounding by assigning remainder to last recipient."""
    from decimal import Decimal, ROUND_HALF_UP
    total = sum(percentages.values())
    assert total == 10000, f"Percentages must sum to 10000 basis points, got {total}"
    
    allocations = {}
    allocated = 0
    recipients = list(percentages.items())
    for i, (recipient, bps) in enumerate(recipients[:-1]):
        amount = int((Decimal(net_profit_paise) * Decimal(bps) / Decimal(10000))
                     .quantize(Decimal('1'), rounding=ROUND_HALF_UP))
        allocations[recipient] = amount
        allocated += amount
    # Last recipient gets remainder to avoid rounding errors
    last_recipient = recipients[-1][0]
    allocations[last_recipient] = net_profit_paise - allocated
    return allocations
```

---

## 9. What Does NOT Count as Revenue

These events must NOT create revenue journal entries:
- Receiving loan proceeds → Loan Liability increase
- Transfer from Cash to Bank → internal transfer only
- Transfer to Savings → internal transfer only
- Owner capital contribution → Equity increase
- Receipt of customer advance → Customer Advance Liability
- Stock correction (upward) → may be COGS reversal or Inventory adjustment, depending on nature
- Physical count (no actual movement) → inventory adjustment entry only

---

## 10. What Does NOT Count as an Expense

- Loan principal repayments → Liability reduction
- Owner profit distributions → Equity reduction
- Savings transfers → internal account transfer
- Capital returns to owners → Equity reduction
- Purchase of inventory → Asset (Inventory) increase

---

## 11. Cash Reconciliation Formula

```
Expected Cash = Opening Balance + Cash Receipts − Cash Payments − Transfers Out + Transfers In
Counted Cash  = Actual physical count by user
Difference    = Counted Cash − Expected Cash
```

If Difference > 0: excess cash (unrecorded receipt or error)
If Difference < 0: cash shortage (unrecorded payment or theft concern)

**Never** auto-adjust expected cash to match counted cash. Record difference as "Cash Discrepancy" for investigation.

---

## 12. Bank Reconciliation Formula

```
Expected Bank Balance = Opening Balance + Deposits − Withdrawals − Fees
Statement Balance     = Amount per actual bank statement
Difference           = Statement Balance − Expected Balance
```

Differences may represent: outstanding cheques, deposits in transit, bank errors, unrecorded fees.

Record and investigate; do not auto-correct.

---

## 13. Period Locking Rules

Once a period is marked **Closed**:
- No new transactions may be posted to that period
- Corrections require: authorization, documented reason, correcting entry (not deletion)
- Original closing report preserved alongside any revised report
- Audit log records: who reopened, when, why, what was changed

---

## 14. Reversals

When reversing a transaction:
1. Create a new journal entry with all debit/credit lines reversed
2. Link the reversal entry to the original entry (`reverses_entry_id`)
3. Mark the original entry as `REVERSED`
4. Optionally post a correcting entry after the reversal
5. Never delete the original entry

---

## 15. Testable Invariants

These must always hold in a correctly operating system:

1. `Sum(all debit lines) = Sum(all credit lines)` across all posted journal entries
2. `Account balance = Opening balance + Sum(debits) − Sum(credits)` for debit-normal accounts
3. `Pool charge ≥ 500 paise × 100 = Rs. 5` (minimum Rs. 500 after formula)
4. `Outstanding balance ≥ 0` for any session (overpayment goes to advance liability)
5. `Sum(profit allocations) = Net profit` (within rounding tolerance of 1 paise)
6. `Inventory on hand ≥ 0` (warn if negative, do not silently accept)
7. `Sum(owner allocation percentages) = 10000` basis points
8. `Loan outstanding = Loan received − Principal repaid` (per loan)
