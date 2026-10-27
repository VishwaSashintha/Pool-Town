# 🎱 Pool Town — Billiard Hall Management & Accounting ERP

A full-featured business management and double-entry accounting system for **Pool Town**, the billiard hall owned by **Akash, Pasan, and Vishwa**.

---

## 📋 Features

| Feature | Description |
|---|---|
| **Pool Sessions** | Record table rentals, time-based billing, payments |
| **PS4 Sessions** | Record PS4 gaming sessions (1 or 2 players) |
| **Soft Drinks** | Inventory, sales, stock counts, stock adjustments |
| **Expenses** | Record operating bills, partial payments, supplier tracking |
| **Cash & Bank** | Live balances, money transfers between accounts |
| **Savings** | Business savings management (cash + bank split) |
| **Partners** | Monthly profit distributions (40% savings / 60% partners) |
| **Partner Advances** | Track advances against monthly allocations |
| **Money Collected** | Record which partner collected money, pending/confirmed |
| **Capital Contributions** | Record additional capital from each partner |
| **Business Loans** | Track external loans and repayments |
| **Equipment** | Record equipment purchases and damage charges |
| **Reports** | Daily, weekly, monthly business and accounting reports |
| **Export to Excel** | Download `.xlsx` for all major reports |
| **General Ledger** | Full double-entry accounting, trial balance, period closing |
| **Backups** | One-click database backup and restore |

---

## 🛠 Technology Stack

| Layer | Technology |
|---|---|
| **Backend** | Python 3.11+, FastAPI, SQLAlchemy 2.0, SQLite |
| **Migrations** | Alembic |
| **Accounting** | Custom double-entry journal engine (no third-party accounting lib) |
| **Excel Export** | openpyxl |
| **Frontend** | React 18, TypeScript, Vite, TailwindCSS |
| **Charts** | Recharts |
| **Auth** | JWT tokens via python-jose + passlib/bcrypt |
| **Tests** | Pytest + HTTPX |

---

## 📁 Folder Structure

```
Pool Board/
├── backend/
│   ├── app/
│   │   ├── main.py          # FastAPI app entry point
│   │   ├── config.py        # App settings (reads .env)
│   │   ├── database.py      # SQLAlchemy engine + session
│   │   ├── models/          # SQLAlchemy ORM models
│   │   ├── routers/         # FastAPI route handlers
│   │   ├── schemas/         # Pydantic request/response models
│   │   ├── services/        # Business logic (journal, pricing, excel export)
│   │   └── utils/           # Helpers (money, refs)
│   ├── alembic/             # Database migration scripts
│   ├── data/                # SQLite database file (gitignored)
│   ├── backups/             # Database backups (gitignored)
│   ├── tests/               # Pytest test suite
│   └── requirements.txt     # Python dependencies
├── frontend/
│   ├── src/
│   │   ├── pages/           # All application pages
│   │   ├── components/      # Reusable UI components
│   │   ├── api/client.ts    # Backend API client
│   │   ├── types/index.ts   # TypeScript type definitions
│   │   └── lib/             # Helpers (money formatting, etc.)
│   ├── public/              # Static assets
│   ├── package.json
│   └── vite.config.ts
├── start.bat                # One-click launch (backend + frontend)
├── start-backend.bat        # Launch backend only
├── start-frontend.bat       # Launch frontend only
├── .env.example             # Environment variable template
└── README.md
```

---

## ✅ Prerequisites

1. **Python 3.11 or higher** — [python.org/downloads](https://www.python.org/downloads/)
2. **Node.js 18 or higher + npm** — [nodejs.org](https://nodejs.org/)
3. **Git** — [git-scm.com](https://git-scm.com/)

---

## 🚀 First-Time Setup

### 1. Clone the Repository

```bash
git clone https://github.com/VishwaSashintha/Pool-Town.git
cd "Pool-Town"
```

### 2. Set Up the Backend

```bash
cd backend

# Create a virtual environment
python -m venv .venv

# Activate it (Windows)
.venv\Scripts\activate

# Install Python dependencies
pip install -r requirements.txt
```

### 3. Configure Environment Variables

```bash
# In the project root (Pool Board/):
copy .env.example .env
```

Open `.env` and change `SECRET_KEY` to a random 64-character string. Everything else can remain as-is for local development.

> ⚠️ **Never commit your `.env` file.** It is already in `.gitignore`.

### 4. Set Up the Frontend

```bash
cd frontend
npm install
```

---

## ▶️ Starting the Application

### Option A — One-click start (Windows)

Double-click **`start.bat`** in the project root.

This will:
- Detect and activate your Python virtual environment automatically
- Start the backend on `http://localhost:8000`
- Start the frontend on `http://localhost:5173`
- Open the browser automatically when both are ready

### Option B — Start separately

**Backend:**
```bash
# In Pool Board/backend/, with virtual environment active:
uvicorn app.main:app --host 127.0.0.1 --port 8000 --reload
```

**Frontend:**
```bash
# In Pool Board/frontend/:
npm run dev
```

Then open `http://localhost:5173` in your browser.

---

## 🔐 Authentication

The app uses a simple token-based login.

**Default credentials** are created automatically on first startup if none exist:

| Setting | Default |
|---|---|
| Username | `admin` |
| Password | `admin123` |

> ⚠️ Change the admin password immediately in **Settings → Security** before using in production.

The default credentials are seeded from the `ensure_default_credentials()` function in `backend/app/routers/auth.py`. No real credentials are stored in the repository.

---

## 🗄️ Database

The application uses **SQLite** stored at `backend/data/billiard.db`.

The database is **created automatically** on first startup. Tables are created by `Base.metadata.create_all()` and master data (accounts, owners, settings) is seeded by `seed_master_data()`.

### Database Initialization

You do **not** need to run Alembic migrations for a fresh install. The app auto-creates all tables on startup.

Alembic is available if you need to apply incremental schema changes to an existing database:

```bash
cd backend
alembic upgrade head
```

---

## 🧪 Running Backend Tests

```bash
cd backend
python -m pytest tests/ -v
```

All 132+ tests should pass. Tests use an in-memory SQLite database and do not touch the production database.

---

## 📦 Building the Frontend

For a production-optimized static build:

```bash
cd frontend
npm run build
```

Output goes to `frontend/dist/`. Serve it with any static file server or configure the backend to serve it directly.

---

## 📊 Exporting Reports to Excel

Every major page has an **Export to Excel (.xlsx)** button that downloads a formatted spreadsheet.

Available export endpoints:

| Report | URL |
|---|---|
| Daily Report | `GET /api/reports/export/daily?report_date=YYYY-MM-DD` |
| Weekly Report | `GET /api/reports/export/weekly?report_date=YYYY-MM-DD` |
| Monthly Report | `GET /api/reports/export/monthly?year=YYYY&month=MM` |
| Transactions | `GET /api/reports/export/transactions` |
| Expenses | `GET /api/reports/export/expenses` |
| Cash & Bank | `GET /api/reports/export/cash-bank` |
| Savings | `GET /api/reports/export/savings` |
| Partners | `GET /api/reports/export/partners?year=YYYY&month=MM` |
| Loans | `GET /api/reports/export/loans` |
| Soft Drinks | `GET /api/reports/export/drinks` |

---

## 💾 Database Backups

### Create a Backup

Go to **Backup** page in the application and click **Create Backup**.

Or via API:

```bash
curl -X POST http://localhost:8000/api/backup/create \
  -H "X-Auth-Token: YOUR_TOKEN"
```

Backups are saved to `backend/backups/` as timestamped `.db` files.

### Restore a Backup

On the Backup page, click **Restore** next to the backup you want.

> ⚠️ Restoring overwrites the current live database. A pre-restore backup is automatically saved first.

---

## 🔧 Troubleshooting Common Errors

| Problem | Solution |
|---|---|
| `uvicorn: command not found` | Activate your Python virtual environment: `.venv\Scripts\activate` |
| `ModuleNotFoundError` | Run `pip install -r requirements.txt` inside `backend/` |
| `npm: command not found` | Install Node.js from [nodejs.org](https://nodejs.org) |
| Backend on port 8000 already running | Stop the existing process or use `start.bat` (it detects duplicates) |
| Frontend shows "Cannot connect to backend" | Ensure backend is running on port 8000 |
| Database locked error | Stop all running app instances before making a backup |
| Tests fail with import errors | Run tests from inside the `backend/` directory |

---

## 🌐 Environment Variables

| Variable | Description | Default |
|---|---|---|
| `DATABASE_URL` | SQLite database path | `sqlite:///./data/billiard.db` |
| `SECRET_KEY` | JWT signing key — **change this!** | *(must be set)* |
| `DEBUG` | Enable debug mode | `false` |
| `ENVIRONMENT` | `development` or `production` | `production` |
| `ALLOWED_ORIGINS` | Frontend URL for CORS | `http://localhost:5173` |
| `BACKUP_DIR` | Directory for database backups | `./backups` |

---

## 🏭 Deploying to Production

1. Set `ENVIRONMENT=production` and `DEBUG=false` in `.env`.
2. Set `SECRET_KEY` to a strong, unique random value (minimum 64 characters).
3. Set `ALLOWED_ORIGINS` to your production frontend domain.
4. Run the backend with a production ASGI server (e.g., `uvicorn app.main:app --host 0.0.0.0 --port 8000`).
5. Build the frontend (`npm run build`) and serve `frontend/dist/` via Nginx or a CDN.
6. Use scheduled backups or a managed database for production data safety.

---

## 🔒 Security Notes

- **Never commit `.env`** — it is in `.gitignore`.
- **Never commit the live database** (`backend/data/*.db`) — it is in `.gitignore`.
- **Change the default admin password** immediately on first login.
- The `SECRET_KEY` is used to sign JWT tokens. If it is compromised, rotate it and invalidate all sessions by restarting the backend.
- The application has **not been tested in production**. Conduct a security review before exposing it to the internet.
- Excel exports do **not** include passwords, tokens, or authentication data.

---

## 📄 License

Private business software for Pool Town. All rights reserved.

---

*Built by the Pool Town partnership — Akash, Pasan, and Vishwa.*
