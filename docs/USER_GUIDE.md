# Billiard Hall Management & Accounting System — User Guide

## Welcome

Welcome to the **Billiard Hall Management and Accounting System**, designed and built specifically for **Akash**, **Pasan**, and **Vishwa**.

This system is a local-first, production-grade management and double-entry accounting software for your billiard hall and gaming lounge. All money is tracked in **Sri Lankan Rupees (LKR / Rs.)** with zero-imbalance double-entry accounting.

---

## 1. Quick Start & Launching the Application

### Option A: One-Click Windows Launcher (Recommended)
1. Double-click the **`start.bat`** file in the project root folder.
2. The launcher will automatically start the FastAPI backend service (port 8000), launch the frontend web interface (port 5173), and open your default browser directly to:
   - **http://localhost:5173**

### Option B: Manual Command Line
Open two PowerShell or terminal windows:
- **Backend:**
  ```powershell
  cd backend
  uvicorn app.main:app --host 127.0.0.1 --port 8000
  ```
- **Frontend:**
  ```powershell
  cd frontend
  npm run dev
  ```

---

## 2. Authentication & Security

- **Default Administrator Credentials:**
  - **Username:** `admin`
  - **Password:** `admin123`
  - **Quick PIN:** `1234`
- You can change your password or security settings anytime in the **Settings** view.

---

## 3. Daily Operations

### Pool Board Sessions (`/pool-sessions`)
- **Authoritative Pricing Rule:**
  - First 60 minutes (1 hour) = **Rs. 500** (base charge)
  - Every additional 30-minute block = **Rs. 300**
  - *Standard pricing schedule:*
    - 30 min = Rs. 500
    - 60 min (1 hr) = Rs. 500
    - 90 min (1.5 hr) = Rs. 800
    - 120 min (2 hr) = Rs. 1,100
    - 150 min (2.5 hr) = Rs. 1,400
    - 180 min (3 hr) = Rs. 1,700
    - 210 min (3.5 hr) = Rs. 2,000
    - 240 min (4 hr) = Rs. 2,300
- **Live Session Timer:** Click **Start Session** when players begin. The system tracks elapsed minutes in real-time.
- **Settlement & Collection:** When play ends, click **End Session**. You can record immediate payment (Cash or Commercial Bank transfer) or record it as outstanding accounts receivable against a registered player.

### PS4 Gaming Sessions (`/ps4-sessions`)
- **Hourly Pricing:**
  - **1 Player:** Rs. 400 per hour
  - **2 Players:** Rs. 500 per hour
- Durations are calculated pro-rata per 30-minute gaming block.

---

## 4. Soft Drinks Inventory & Point-of-Sale (`/inventory`)

- **Weighted-Average Cost (WAC):** The system automatically computes moving average cost whenever you purchase inventory from suppliers.
- **Stock Movement Types:**
  - **Purchase:** Increases stock and records accounts payable or cash outflow.
  - **Sale / Issue:** Decreases stock, logs revenue to *4003 Soft Drinks Revenue*, and posts Cost of Goods Sold (*5001 COGS - Drinks*).
  - **Adjustment:** For stock count corrections or breakages.

---

## 5. Debtors & Outstanding Payments (`/outstanding-payments`)

- View every session with an unpaid or partially paid balance in one centralized ledger.
- Settle customer balances with a single click, recording payments into Cash in Drawer (1001) or Bank Account (1002).
- Automatic customer debt tracking by player name and phone number.

---

## 6. Reserve Fund & Savings Model (`/savings`)

- **40% Net Profit Rule:**
  - Every month, 40% of distributable net operational profit is transferred to **Account 1003 — Commercial Bank Savings Account**.
  - **Target:** Accumulate **Rs. 100,000/month** in reserve funds for future capital expenditures, business resilience, and table expansions.
- **Reserve Fund Dashboard:** Shows current savings balance, progress toward target, allocation previews, and inter-account transfers.

---

## 7. Partner Equity & Loans (`/loans`)

- **Three Partners:**
  - **Akash:** 20% profit share
  - **Pasan:** 20% profit share
  - **Vishwa:** 20% + rounding remainder paise
- **Capital Injections & Drawings:** Record owner investments into the business or personal withdrawals.
- **Loan Liabilities (2001 / 2002):**
  - Record loans from partners or commercial lenders.
  - Record repayments with strict separation between **Principal** (reduces liability) and **Interest** (books to *6020 Interest Expense*).

---

## 8. Equipment & Damage Recovery (`/equipment` & `/damage-charges`)

- **Equipment Asset Register (`/equipment`):**
  - Record purchases of cue sticks, table felts, balls, chalk, PS4 consoles, and controllers.
- **Customer Damage Tracking (`/damage-charges`):**
  - When equipment is damaged (e.g., broken cue tip, torn cloth), record a damage charge against the customer.
  - Collect payments over time or waive charges with documented manager authorization.

---

## 9. Cash Drawer & Bank Reconciliations (`/accounts`)

- **Daily Cash Drawer Count:**
  - Count physical cash notes and coins in the drawer.
  - Compare counted cash with expected ledger balance in Account 1001.
  - Log any variance with notes and an investigator signature.
- **Monthly Bank Statement Reconciliation:**
  - Enter the closing balance from Commercial Bank statement.
  - Verify match with Account 1002 before period closing.

---

## 10. Month-End Closing & Period Locking (`/month-end`)

- **7-Point Accounting Checklist:**
  1. Cash Drawer Reconciled (1001)
  2. Commercial Bank Statement Reconciled (1002)
  3. Soft Drinks Physical Stock Count
  4. All Expense Bills Recorded
  5. Damage Recoveries Reviewed
  6. 40% Profit Allocated to Reserve (1003)
  7. Partner Review & Sign-Off (Akash, Pasan, Vishwa)
- **Period Lock:** Lock the accounting month to prevent accidental backdating or edits to historical financial data.
- **Authorized Reopening:** To adjust a locked month, a documented business reason must be entered for the permanent audit trail.

---

## 11. Reports & General Ledger (`/reports/*` & `/transactions`)

- **Daily Report (`/reports/daily`):** Day's revenue, pool vs. PS4 hours, cash collected, unpaid expenses, drinks sold, and net income.
- **Weekly Report (`/reports/weekly`):** 7-day rolling revenue and operational summary.
- **Monthly Report (`/reports/monthly`):** Complete monthly P&L and 40/20/20/20 profit share calculations.
- **General Ledger (`/transactions`):** Complete double-entry audit trail with expandable DR/CR journal lines and CSV export.

---

## 12. Database Backup & Safeguard Recovery (`/backup`)

- **Online SQLite Snapshot API:**
  - Click **Create Backup Snapshot** at any time. The database is backed up safely without disrupting active games.
  - Each backup runs `PRAGMA quick_check` to guarantee 100% database file integrity.
- **Point-in-Time Restore:**
  - Restore previous snapshots with confidence. The system automatically takes a **pre-restore safeguard backup** so active transactions are never lost.
- **File Downloads:** Download `.db` backup files to an external drive or USB stick for safe off-site storage.

---

## Support & Ownership

- **Business:** Billiard Hall Management & Accounting System
- **Owners:** Akash, Pasan, and Vishwa
- **Start Date:** 1 January 2026
