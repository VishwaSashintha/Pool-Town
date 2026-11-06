# Pool Town ERP

Pool Town ERP is a billiard hall management and accounting system built for Pool Town, operated by Akash, Pasan, and Vishwa. It handles pool table rentals, PS4 gaming sessions, drinks sales and inventory, operational expenses, cash and bank accounts, partner profit allocations, and double-entry accounting.

---

## Windows Desktop Application (For Accountants & End Users)

For daily business use by accountants and hall managers, Pool Town ERP is distributed as a standalone Windows desktop application located in the `Pool Town ERP Setup` folder:

- **Ready-to-Use Package**: The `Pool Town ERP Setup` folder contains the installer `PoolTownERP-Setup.exe`, `INSTALLATION_GUIDE.txt`, and `VERSION.txt`.
- **No Developer Tools Required**: Accountants do not need to install Python, Node.js, npm, Git, or run command-line scripts.
- **Single-File Setup**: Double-click `PoolTownERP-Setup.exe` to install the complete application in seconds.
- **Desktop & Start Menu Shortcuts**: Double-click the Pool Town ERP shortcut to launch the app in its own dedicated window.
- **Safe Data Storage**: Business databases are stored in `%LOCALAPPDATA%\PoolTownERP\data\billiard.db`. Reinstalling or updating the application will never overwrite or erase your company records.
- **Backups**: Backups are saved in `%LOCALAPPDATA%\PoolTownERP\backups\` and can be created or restored directly from the application interface.
- **Accountant Guide**: Refer to [`INSTALLATION_GUIDE.txt`](INSTALLATION_GUIDE.txt) or `Pool Town ERP Setup/INSTALLATION_GUIDE.txt` for simple, step-by-step instructions.

### Building the Desktop Installer (Developers)

To compile the standalone Windows installer from source:

```bat
cd installer
build.bat
```

This builds the production React frontend, bundles the FastAPI backend using PyInstaller, compiles the native Windows launcher, and produces `PoolTownERP-Setup.exe` via Inno Setup.

---

## Main Features

- **Pool Table Sessions**: Start and stop session timers, calculate table charges automatically using fixed rate tiers, and collect payments in cash or bank transfer.
- **PS4 Gaming Sessions**: Hourly billing for single-player and two-player gaming, player tracking, and payment collection.
- **Soft Drinks & Inventory**: Track bottle inventory, record sales, calculate cost of goods and gross profit, and log stock shortages or overages.
- **Operational Expenses**: Record utility and operational bills, split payments between cash and bank, and track vendor accounts.
- **Cash & Bank Balances**: Real-time balance tracking for Cash in Hand and the Main Bank Account, with support for internal cash transfers.
- **Business Savings Reserve**: Automated 40% monthly net profit allocation to emergency savings, split between physical cash and bank savings.
- **Partner Distributions**: Monthly profit distribution for the three equal partners (60% net profit split equally into 20% each), tracking partner drawings, advances, and remaining balances.
- **Loans & Capital**: Record opening capital contributions, external family or third-party loans, and loan repayment records.
- **Equipment & Damage Recovery**: Track equipment maintenance expenses and log player damage incidents with recovery collection status.
- **Double-Entry General Ledger**: Automated journal entries that enforce debit-equal-credit balance invariants for all financial operations.
- **Reports & Excel Exports**: Daily, weekly, and monthly business summaries with formatted `.xlsx` downloads for all major tables.
- **Database Snapshots**: Create and restore SQLite database backups directly from the administrative interface.

---

## Technology Stack

- **Backend**: Python 3.11+, FastAPI 0.115, Uvicorn 0.32, SQLAlchemy 2.0, Alembic 1.14, Pydantic v2
- **Database**: SQLite with Write-Ahead Logging (`PRAGMA journal_mode=WAL`) and foreign key enforcement (`PRAGMA foreign_keys=ON`)
- **Frontend**: React 18, TypeScript 5.7, Vite 6, Tailwind CSS 3.4
- **State & Data Fetching**: TanStack React Query v5, React Router v6
- **UI Components & Icons**: Lucide React, Recharts
- **Excel Generation**: openpyxl 3.1
- **Authentication**: Token-based authentication using hashed passwords (passlib/bcrypt) and JWT (python-jose)
- **Testing**: pytest 8.3, pytest-asyncio, HTTPX

---

## Project Structure

```text
Pool-Town/
├── backend/
│   ├── alembic/             # Database migration scripts
│   ├── app/
│   │   ├── main.py          # FastAPI application entry point
│   │   ├── config.py        # Configuration settings (reads .env)
│   │   ├── database.py      # SQLAlchemy engine, session maker, and pragmas
│   │   ├── models/          # SQLAlchemy ORM models
│   │   ├── routers/         # API endpoint handlers
│   │   ├── schemas/         # Pydantic request and response schemas
│   │   ├── services/        # Business logic, journal engine, and Excel exporter
│   │   └── utils/           # Monetary and reference code helpers
│   ├── data/                # Local SQLite database files (gitignored)
│   ├── backups/             # Database backup files (gitignored)
│   ├── tests/               # Pytest test suite
│   └── requirements.txt     # Python backend dependencies
├── frontend/
│   ├── public/              # Static assets and images
│   ├── src/
│   │   ├── api/             # Backend API client
│   │   ├── components/      # Reusable UI components and application layout
│   │   ├── lib/             # Utility and money formatting helpers
│   │   ├── pages/           # Application views and dashboards
│   │   ├── types/           # TypeScript type definitions
│   │   ├── App.tsx          # Route definitions and query client provider
│   │   ├── main.tsx         # Frontend entry point
│   │   └── index.css        # Global CSS and typography rules
│   ├── index.html           # HTML entry point with Poppins and Montserrat fonts
│   ├── package.json         # Frontend dependencies and scripts
│   ├── tailwind.config.js   # Tailwind CSS configuration
│   └── vite.config.ts       # Vite build configuration
├── installer/
│   ├── launcher/            # C# Windows GUI launcher source (Program.cs)
│   ├── PoolTownERP.iss      # Inno Setup 6 installer compilation script
│   ├── build.bat            # One-click Windows installer build script
│   ├── icon.ico             # Application icon (multi-resolution .ico)
│   └── icon.png             # Application logo image
├── Pool Town ERP Setup/     # Ready-to-distribute package for accountant
│   ├── PoolTownERP-Setup.exe # Standalone Windows desktop installer
│   ├── INSTALLATION_GUIDE.txt # Plain-English accountant installation guide
│   └── VERSION.txt          # Release version and compatibility details
├── data/                    # Root database storage folder (gitignored)
├── backups/                 # Root database backup folder (gitignored)
├── start.bat                # Windows one-click launcher (backend + frontend)
├── start-backend.bat        # Windows launcher for backend only
├── start-frontend.bat       # Windows launcher for frontend only
├── .env.example             # Template for local environment variables
├── .gitignore               # Excludes private databases, secrets, and caches
└── README.md                # Project documentation
```

---

## Requirements

To run this project on Windows, you will need:

1. **Python 3.11 or higher** — [python.org](https://www.python.org/downloads/) (make sure to check "Add python.exe to PATH" during installation)
2. **Node.js 18 or higher** (with npm) — [nodejs.org](https://nodejs.org/)
3. **Git** — [git-scm.com](https://git-scm.com/)

---

## Setup and Installation

Follow these steps to set up the project on a new Windows computer.

### 1. Clone the Repository

Open Command Prompt or PowerShell:

```bash
git clone https://github.com/VishwaSashintha/Pool-Town.git
cd Pool-Town
```

### 2. Set Up the Backend

Open a terminal in the `backend` folder:

```bash
cd backend

# Create a virtual environment
python -m venv .venv

# Activate the virtual environment
.venv\Scripts\activate

# Install dependencies
pip install -r requirements.txt
```

### 3. Configure Environment Variables

From the project root:

```bash
copy .env.example .env
```

If you plan to run commands directly inside the `backend` folder, you can also copy `.env.example` into `backend/.env`:

```bash
copy .env.example backend\.env
```

The default values in `.env.example` are preconfigured to work immediately for local development.

### 4. Set Up the Frontend

Open a new terminal window, navigate to the `frontend` folder, and install the Node packages:

```bash
cd frontend
npm install
```

### 5. Start the Application

You can start the system using either the one-click launcher or separate terminals.

#### Option A: One-Click Launcher (Recommended for Windows)

From the project root, double-click `start.bat` or run:

```bash
start.bat
```

This script:
- Automatically detects the Python virtual environment
- Verifies that ports 8000 and 5173 are free
- Starts the FastAPI backend in one window
- Starts the Vite frontend in another window
- Opens your browser to `http://localhost:5173` once both services are ready

#### Option B: Start Services Manually

**Terminal 1 (Backend):**
```bash
cd backend
.venv\Scripts\activate
uvicorn app.main:app --host 127.0.0.1 --port 8000 --reload
```
The backend API will start at `http://127.0.0.1:8000`. You can inspect interactive API documentation at `http://127.0.0.1:8000/docs`.

**Terminal 2 (Frontend):**
```bash
cd frontend
npm run dev
```
The frontend dev server will start at `http://localhost:5173`.

### 6. Access the Application

Open your browser and navigate to:

```text
http://localhost:5173
```

---

## Configuration

Settings are managed in `backend/app/config.py` and can be overridden using environment variables in `.env`:

| Variable | Description | Default |
|---|---|---|
| `DATABASE_URL` | SQLite database connection string | `sqlite:///./data/billiard.db` |
| `SECRET_KEY` | Key used to sign JWT session tokens | `CHANGE_ME_IN_PRODUCTION` |
| `DEBUG` | Enable verbose SQL and debug output | `false` |
| `ENVIRONMENT` | Application mode (`development` or `production`) | `production` |
| `ALLOWED_ORIGINS` | Permitted frontend origins for CORS | `http://localhost:5173` |
| `BACKUP_DIR` | Directory for automated and manual database backups | `./backups` |

---

## Database and Business Data

- **Automatic Schema Creation**: You do not need to run manual database migrations for a fresh install. On application startup, the backend automatically creates all required tables (`Base.metadata.create_all()`) and seeds master accounts, partner profiles, and initial settings idempotently.
- **Database Storage**: The SQLite database is created locally at `backend/data/billiard.db` or `./data/billiard.db`.
- **Database Migrations**: Alembic is configured if you need to run schema migrations on an existing database:
  ```bash
  cd backend
  alembic upgrade head
  ```
- **Initial Administrator Setup**: On first launch, the backend seeds an initial administrative account so you can log in and begin setup. Immediately after logging in for the first time, navigate to **Settings -> Security** to change your administrative username, password, and transaction authorization PIN.
- **Protecting Private Data**: Live database files (`*.db`), write-ahead log files (`*.db-wal`, `*.db-shm`), and backup snapshots (`backups/*.db`) contain business records and financial data. These files are excluded by `.gitignore` and must never be committed to Git.

---

## Security and Privacy

- **Do Not Commit Secrets**: Never commit `.env`, private keys, passwords, or session tokens to version control. Always keep `.env.example` populated with placeholder values.
- **Protect Business Records**: Real financial transactions, partner payouts, and player contact details must stay in the local database and should never be pushed to a public repository.
- **Production Precautions**: This application is built for on-premise operation on a local business network. If deploying to a public server:
  - Generate a strong, random 64-character `SECRET_KEY`.
  - Set `ENVIRONMENT=production` and `DEBUG=false`.
  - Use a reverse proxy (such as Nginx or Caddy) with SSL/TLS encryption.
  - Restrict CORS `ALLOWED_ORIGINS` to your verified production domain.
  - Implement regular off-site backup storage.

---

## Troubleshooting

- **`npm install` fails or hangs**:
  - Verify your Node.js version is 18+ (`node -v`).
  - Clear the npm cache: `npm cache clean --force`, then re-run `npm install`.
- **Backend fails with `ModuleNotFoundError`**:
  - Ensure your virtual environment is active before starting the backend: `.venv\Scripts\activate`.
  - Verify dependencies were installed: `pip install -r requirements.txt`.
- **Frontend shows "Cannot connect to backend"**:
  - Confirm the backend terminal is running and listening on `http://127.0.0.1:8000`.
  - Check `http://127.0.0.1:8000/api/health` in your browser. If it does not respond, inspect the backend terminal for startup errors.
- **Port 8000 or 5173 already in use**:
  - Another instance of Uvicorn or Vite may already be running in the background.
  - In PowerShell, locate and terminate lingering Python processes:
    ```powershell
    Get-Process python -ErrorAction SilentlyContinue | Stop-Process -Force
    ```
- **SQLite "database is locked" error**:
  - SQLite allows one writer at a time. This error occurs if another process or external database tool holds an open write lock on `billiard.db`. Close any external database inspection tools and restart the backend.

---

## Development Notes

### Running Backend Tests

The project includes an automated test suite verifying accounting invariants, journal balance checks, reports, and API endpoints:

```bash
cd backend
python -m pytest tests/ -v
```

Tests run against an in-memory SQLite database and do not affect your local business data.

### Building Frontend for Production

To test or generate the production frontend build:

```bash
cd frontend
npm run build
```

This runs TypeScript type checking (`tsc`) followed by Vite bundling. Production assets are output to `frontend/dist/`.

### Typography Rules

The application uses two primary typefaces:
- **Poppins**: Applied globally to all text, labels, buttons, navigation items, dialogs, and table headers.
- **Montserrat Bold**: Applied with tabular figures (`tabular-nums`) to all financial totals, session timers, rates, and quantities to ensure clear numerical alignment.

---

## License

No license has been specified. This is private software for the Pool Town billiard hall.
