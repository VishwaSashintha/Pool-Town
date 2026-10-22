# Billiard Hall Management System

A complete, professional, local-first Billiard Hall Management and Accounting System for Akash, Pasan, and Vishwa's business.

**Currency:** Sri Lankan Rupees (LKR / Rs.)
**Data start date:** 1 January 2026

---

## Prerequisites

- **Python 3.11+** — [python.org](https://python.org)
- **Node.js 18+** — [nodejs.org](https://nodejs.org)
- **Git** — [git-scm.com](https://git-scm.com)

---

## First-Time Setup

### 1. Backend Setup

```powershell
cd backend
pip install -r requirements.txt
alembic upgrade head
```

### 2. Frontend Setup

```powershell
cd frontend
npm install
```

---

## Running the Application

Open **two PowerShell windows**.

### Window 1 — Backend

```powershell
cd backend
uvicorn app.main:app --reload --host 127.0.0.1 --port 8000
```

### Window 2 — Frontend

```powershell
cd frontend
npm run dev
```

Open your browser at: **http://localhost:5173**

---

## Running Tests

```powershell
cd backend
pytest tests/ -v
```

---

## Database Location

The live database is stored at: `data/billiard.db`

**Important:** This file is not committed to Git. Back it up regularly using the Backup & Restore feature in the application.

---

## Backup and Restore

Use the **Backup & Restore** screen in the application.

Backups are stored in the `backups/` directory.

---

## Project Documentation

- [Requirements](docs/REQUIREMENTS.md)
- [Architecture](docs/ARCHITECTURE.md)
- [Accounting Rules](docs/ACCOUNTING_RULES.md)
- [Decisions Log](docs/DECISIONS.md)
- [Task Tracker](task.md)
- [User Guide](docs/USER_GUIDE.md)

---

## For Developers / AI Agents

Read [AGENTS.md](AGENTS.md) and [task.md](task.md) before making any changes.
