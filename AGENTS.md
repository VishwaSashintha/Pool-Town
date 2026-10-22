# AGENTS.md — Billiard Hall Management and Accounting System

## Purpose

This file contains mandatory instructions for every AI agent (or developer) that works on this project. Read this file completely before making any changes.

---

## Application Purpose

A complete, professional, local-first Billiard Hall Management and Accounting System for a real business owned by three partners: **Akash**, **Pasan**, and **Vishwa**.

This is a real production application used for daily business operations and accurate financial record-keeping. It is not a demo, mockup, or prototype.

---

## Technology Stack

### Frontend
- React + TypeScript (strict mode)
- Vite
- Tailwind CSS
- shadcn/ui component system
- React Router v6
- TanStack Query (React Query)
- React Hook Form + Zod
- Recharts
- Lucide icons
- date-fns

### Backend
- Python 3.11+
- FastAPI
- Pydantic v2
- SQLAlchemy 2.x (async-compatible)
- Alembic (migrations)
- Pytest (testing)

### Database
- SQLite (local deployment)
- Foreign keys MUST be enabled on every connection (`PRAGMA foreign_keys = ON`)
- Integer monetary storage (smallest currency unit = LKR paise, i.e., store Rs. 1.50 as 150)
- NO floating-point arithmetic for money — use Python `Decimal` or integer arithmetic only
- All amounts stored as integers (LKR × 100)

### Currency
- Sri Lankan Rupees (LKR / Rs.)
- All monetary values stored as integers representing paise (1 Rs. = 100 paise)
- Display as Rs. X,XXX.XX

---

## Authoritative Business Requirements

See `docs/REQUIREMENTS.md` for the complete specification. That document is the single source of truth.

See `docs/ACCOUNTING_RULES.md` for accounting formulas and rules.

---

## Accounting and Database Safety Rules

1. **Never use floating-point for money.** Store integers in paise. Use Python `Decimal` for intermediate calculations, convert to int for storage.
2. **Every journal entry must balance.** Total debits = total credits. Reject unbalanced entries.
3. **Never delete posted financial transactions.** Use reversals or correcting entries only.
4. **Always use database transactions** for multi-table financial operations. If any step fails, the entire transaction rolls back.
5. **Foreign keys must be enabled** on every SQLite connection.
6. **Never silently accept negative stock.** Warn and require explicit confirmation.
7. **Prices are configured on the backend.** Never trust price totals submitted by the frontend.
8. **Opening balances must not duplicate historical transactions.**
9. **A closed accounting period cannot be modified** without authorization and a documented reason.
10. **Audit logs are append-only.** Never delete or update audit records.

---

## Coding Conventions

### Python / Backend
- Use type hints everywhere (`from __future__ import annotations`)
- Pydantic models for all request/response schemas
- SQLAlchemy 2.x declarative models with typed columns
- Repository pattern for database access
- Service layer for business logic (no business logic in route handlers)
- All monetary amounts: `int` (paise) in models, `Decimal` for intermediate math
- Raise `HTTPException` with meaningful status codes and messages
- Use `async def` for route handlers; use sync SQLAlchemy with connection pooling for SQLite

### TypeScript / Frontend
- Strict TypeScript — no `any` unless absolutely necessary
- All API calls through a typed API client (not raw fetch)
- All forms use React Hook Form + Zod schemas
- All server state through TanStack Query
- Currency display helper: always use `formatLKR(paise: number): string`
- No hardcoded financial values in the frontend
- Empty states must be real empty states, not fake data

### Database
- All tables have `id` (INTEGER PRIMARY KEY AUTOINCREMENT)
- All tables have `created_at` and `updated_at` timestamps (UTC)
- Business event dates stored separately (e.g., `session_date`, `transaction_date`)
- Amounts stored as INTEGER (paise)
- Use `CHECK` constraints where appropriate

---

## Testing Requirements

- **DO NOT** report a test as passing unless you have actually executed it and seen the output.
- Backend tests use Pytest with a **separate temporary SQLite database** — never the real database.
- Frontend tests use Vitest.
- Write tests for: pricing calculations, payment math, inventory movements, accounting invariants, report totals.
- See `docs/TESTING.md` for the complete test specification.

---

## Task Tracking

- `task.md` is the authoritative task tracker.
- Update `task.md` after every meaningful implementation milestone.
- Update `task.md` after every test run (record actual results, not assumed ones).
- Update `task.md` before ending any session.
- Mark tasks complete **only** when they are implemented AND tested.

---

## Prohibited Actions

- Do NOT invent or fabricate business data (transactions, balances, stock quantities).
- Do NOT replace functioning modules with rewrites without a documented reason.
- Do NOT store real business data in temporary directories.
- Do NOT reset the real database when restarting the application.
- Do NOT let test runs touch the real database.
- Do NOT silently omit requirements from `docs/REQUIREMENTS.md`.
- Do NOT mark phases complete when mandatory tests are still failing.
- Do NOT use hardcoded sample totals in the production dashboard.
- Do NOT perform irreversible operations on real data without owner confirmation.

---

## When Switching AI Models

1. Save all valid code changes.
2. Update `task.md` with exact stopping point.
3. Record tests actually executed and their results.
4. Document unresolved bugs in `task.md`.
5. Record important decisions in `docs/DECISIONS.md`.
6. Identify the exact next implementation task.

## Resume Instructions for Next Agent

"Resume development of the Billiard Hall Management and Accounting System.

First read AGENTS.md, task.md, docs/REQUIREMENTS.md, docs/ACCOUNTING_RULES.md, docs/ARCHITECTURE.md, and docs/DECISIONS.md.

Inspect the existing source code, Git status, database migrations, and relevant test results before making changes.

Determine the actual project state from the files, not from assumptions or previous chat messages.

Continue with the exact next pending task recorded in task.md. Preserve working functionality and existing business data. Do not recreate the project or replace functioning modules unnecessarily.

Run the relevant tests after changes, fix regressions, and update task.md with the actual results.

If a business rule is ambiguous, consult the requirements and accounting documentation first. Record any unresolved material decision rather than inventing an answer.

Before stopping, save the implementation state, update the task tracker, and provide the next precise action."
