# ARCHITECTURE.md — Billiard Hall Management System

*Last updated: 2026-10-22*

---

## 1. System Overview

```
┌─────────────────────────────────────────────────────────────┐
│                     User's Computer                          │
│                                                             │
│  ┌─────────────────┐         ┌────────────────────────┐    │
│  │   React Frontend│◄───────►│   FastAPI Backend       │    │
│  │   (Vite)        │  HTTP   │   (Python)              │    │
│  │   Port 5173     │  REST   │   Port 8000             │    │
│  └─────────────────┘         └──────────┬─────────────┘    │
│                                          │                   │
│                                          ▼                   │
│                               ┌──────────────────┐          │
│                               │  SQLite Database  │          │
│                               │  data/billiard.db │          │
│                               └──────────────────┘          │
└─────────────────────────────────────────────────────────────┘
```

**Architecture type:** Local-first monolith with clear frontend/backend separation.

**Communication:** REST API over HTTP. Frontend is a Single Page Application (SPA).

---

## 2. Directory Structure

```
Pool Board/
├── AGENTS.md                   # AI agent instructions (mandatory read)
├── task.md                     # Project task tracker
├── README.md                   # Setup and launch instructions
├── .gitignore
├── .env.example
│
├── docs/
│   ├── REQUIREMENTS.md         # Complete business requirements
│   ├── ARCHITECTURE.md         # This file
│   ├── DATABASE_SCHEMA.md      # Entity definitions and relationships
│   ├── ACCOUNTING_RULES.md     # Formulas, rules, testable examples
│   ├── TESTING.md              # Test strategy and specifications
│   ├── DECISIONS.md            # Architecture decisions with rationale
│   └── USER_GUIDE.md           # End-user documentation
│
├── backend/
│   ├── pyproject.toml          # Python project config (uv/pip)
│   ├── requirements.txt        # Python dependencies
│   ├── alembic.ini             # Alembic configuration
│   ├── alembic/
│   │   ├── env.py
│   │   └── versions/           # Migration files
│   ├── app/
│   │   ├── main.py             # FastAPI application entry point
│   │   ├── config.py           # Configuration (env vars, settings)
│   │   ├── database.py         # SQLAlchemy engine and session
│   │   ├── dependencies.py     # FastAPI dependency injection
│   │   ├── models/             # SQLAlchemy ORM models
│   │   │   ├── __init__.py
│   │   │   ├── base.py
│   │   │   ├── players.py
│   │   │   ├── sessions.py
│   │   │   ├── payments.py
│   │   │   ├── inventory.py
│   │   │   ├── expenses.py
│   │   │   ├── accounts.py
│   │   │   ├── loans.py
│   │   │   ├── owners.py
│   │   │   ├── journal.py
│   │   │   ├── periods.py
│   │   │   └── audit.py
│   │   ├── schemas/            # Pydantic request/response models
│   │   │   ├── __init__.py
│   │   │   └── ... (mirrors models/)
│   │   ├── routers/            # FastAPI route handlers
│   │   │   ├── __init__.py
│   │   │   ├── sessions.py
│   │   │   ├── payments.py
│   │   │   ├── players.py
│   │   │   ├── inventory.py
│   │   │   ├── expenses.py
│   │   │   ├── accounts.py
│   │   │   ├── reports.py
│   │   │   ├── settings.py
│   │   │   └── backup.py
│   │   ├── services/           # Business logic layer
│   │   │   ├── pricing.py      # Pool and PS4 charge calculations
│   │   │   ├── sessions.py
│   │   │   ├── payments.py
│   │   │   ├── inventory.py
│   │   │   ├── journal.py      # Accounting journal service
│   │   │   ├── reports.py
│   │   │   └── backup.py
│   │   └── utils/
│   │       ├── money.py        # Monetary arithmetic helpers
│   │       ├── dates.py        # Date utilities (LKR timezone)
│   │       └── audit.py        # Audit logging helpers
│   └── tests/
│       ├── conftest.py         # Pytest fixtures (temp DB, test client)
│       ├── test_pricing.py     # Pool and PS4 pricing tests
│       ├── test_sessions.py    # Session CRUD tests
│       ├── test_payments.py    # Payment and balance tests
│       ├── test_inventory.py   # Stock movement tests
│       ├── test_accounting.py  # Journal and balance tests
│       └── test_reports.py     # Report calculation tests
│
├── frontend/
│   ├── package.json
│   ├── vite.config.ts
│   ├── tsconfig.json
│   ├── tailwind.config.ts
│   ├── index.html
│   ├── public/
│   └── src/
│       ├── main.tsx
│       ├── App.tsx
│       ├── router.tsx          # React Router configuration
│       ├── api/                # Typed API client functions
│       │   ├── client.ts       # Base HTTP client
│       │   └── ...             # Per-domain API modules
│       ├── components/         # Reusable UI components
│       │   ├── ui/             # shadcn/ui components
│       │   ├── layout/         # Sidebar, header, breadcrumbs
│       │   └── shared/         # App-specific shared components
│       ├── pages/              # Route-level page components
│       │   ├── Dashboard/
│       │   ├── Sessions/
│       │   ├── Players/
│       │   ├── Inventory/
│       │   ├── Finance/
│       │   └── Reports/
│       ├── hooks/              # Custom React hooks
│       ├── lib/                # Utilities
│       │   ├── money.ts        # Currency formatting
│       │   ├── dates.ts        # Date helpers
│       │   └── utils.ts
│       ├── types/              # TypeScript type definitions
│       └── stores/             # Client state (if needed beyond React Query)
│
├── data/
│   ├── .gitkeep
│   └── billiard.db             # Live database (NOT committed to git)
│
├── backups/
│   └── .gitkeep
│
└── scripts/
    ├── start.ps1               # Windows: start both frontend and backend
    ├── setup.ps1               # Windows: initial setup
    └── backup.py               # Database backup utility
```

---

## 3. Backend Architecture

### 3.1 Layered Architecture

```
HTTP Request
     │
     ▼
┌─────────────┐
│   Router    │  Route handler — validates HTTP, calls service, returns response
└──────┬──────┘
       │
       ▼
┌─────────────┐
│   Service   │  Business logic — pricing, accounting rules, validations
└──────┬──────┘
       │
       ▼
┌─────────────┐
│  Repository │  Database access — SQLAlchemy queries (simple cases: inline in service)
└──────┬──────┘
       │
       ▼
┌─────────────┐
│   Models    │  SQLAlchemy ORM models (source of truth for DB structure)
└─────────────┘
```

### 3.2 Key Design Decisions

- **No business logic in routers.** Routers call services only.
- **All monetary inputs validated** by Pydantic schemas (integer paise, ≥ 0).
- **Journal service** is the authoritative path for all financial postings. No direct balance modifications.
- **Database sessions** use context managers; explicit commit/rollback.
- **Foreign keys pragma** set via SQLAlchemy event listener on every connection.

### 3.3 Configuration

Environment variables via `.env`:
```
DATABASE_URL=sqlite:///./data/billiard.db
SECRET_KEY=<random-secret>
DEBUG=false
ALLOWED_ORIGINS=http://localhost:5173
BACKUP_DIR=./backups
```

---

## 4. Frontend Architecture

### 4.1 State Management Strategy

| State Type | Solution |
|---|---|
| Server state (API data) | TanStack Query |
| Form state | React Hook Form + Zod |
| UI state (modals, etc.) | Local React state (`useState`) |
| Global app state | React Context (minimal) |

### 4.2 API Client

Centralized typed API client in `src/api/client.ts`:
- Base URL from environment variable
- Response type inference
- Error normalization
- All amounts returned as integers (paise) from API
- `formatLKR(paise: number): string` used at display layer only

### 4.3 Route Structure

```
/ → Dashboard
/sessions → Daily Operations (Pool + PS4)
/sessions/pool → Pool Sessions
/sessions/ps4 → PS4 Sessions
/players → Players
/payments → Outstanding Payments
/inventory/products → Products
/inventory/purchases → Purchases
/inventory/stock-counts → Stock Counts
/inventory/sales → Sales & Collections
/inventory/reconciliation → Stock Reconciliation
/finance/expenses → Expenses
/finance/accounts → Cash & Bank
/finance/savings → Savings
/finance/owners → Owner Accounts
/finance/loans → Loans
/finance/ledger → Accounting Ledger
/reports/daily → Daily Report
/reports/weekly → Weekly Report
/reports/monthly → Monthly Report
/reports/players → Player Reports
/reports/inventory → Inventory Reports
/reports/financial → Financial Reports
/month-end → Month-End Closing
/history → Transaction History
/settings → Settings
/backup → Backup & Restore
```

---

## 5. Database Architecture

See `docs/DATABASE_SCHEMA.md` for full entity definitions.

### 5.1 Key Principles

1. Balances are always calculated from transaction history, never stored as a single editable field.
2. Every monetary operation creates journal entry lines.
3. Operational records (sessions, expenses) are linked to their journal entries.
4. Audit log is append-only.
5. Soft deletes where deletion would lose business history.

### 5.2 Transaction Isolation

For multi-step financial operations (e.g., recording a session + creating journal entry):
```python
async with db.begin():
    # All operations here commit together or roll back together
    session = create_session(...)
    journal_entry = create_journal_entry(...)
    db.add_all([session, journal_entry, ...])
# Automatic commit on success, rollback on exception
```

---

## 6. Security Architecture

- **Authentication:** Simple username/password (bcrypt hashed) for initial version
- **Authorization:** Role-based (Admin/Owner/Staff) checked per endpoint
- **Passwords:** Never stored plain text; never logged
- **Secrets:** In `.env` file, never committed to Git
- **CORS:** Restricted to `localhost` origins only
- **SQL injection:** Prevented by SQLAlchemy parameterized queries
- **Audit trail:** All financial operations log user ID, timestamp, IP

---

## 7. Backup Architecture

Database: Single SQLite file at `data/billiard.db`.

Backup process:
1. Use SQLite `backup` API (or WAL checkpoint + file copy)
2. Verify backup file with integrity check (`PRAGMA integrity_check`)
3. Record timestamp, file path, size, checksum in backup log
4. Store in `backups/` directory
5. Backup filename format: `billiard_YYYYMMDD_HHMMSS.db`

Restore process:
1. Verify backup file integrity
2. Confirm with user before overwriting active database
3. Replace `data/billiard.db` with backup
4. Run migrations to ensure schema is current
5. Verify restored database integrity

---

## 8. Development Environment

### Prerequisites
- Python 3.11+
- Node.js 18+
- Git

### Initial Setup
```powershell
# Backend
cd backend
pip install -r requirements.txt
alembic upgrade head
uvicorn app.main:app --reload

# Frontend (separate terminal)
cd frontend
npm install
npm run dev
```

### Testing
```powershell
# Backend tests
cd backend
pytest tests/ -v

# Frontend tests
cd frontend
npm run test
```

---

## 9. Phase Implementation Order

| Phase | Description | Status |
|---|---|---|
| 0 | Project discovery and planning | ✅ In Progress |
| 1 | Foundation (project structure, deps, DB config) | ⬜ Pending |
| 2 | Database models and accounting foundation | ⬜ Pending |
| 3 | Core operational features | ⬜ Pending |
| 4 | Financial management | ⬜ Pending |
| 5 | Dashboard and reports | ⬜ Pending |
| 6 | Historical migration and month closing | ⬜ Pending |
| 7 | Reliability and delivery | ⬜ Pending |
