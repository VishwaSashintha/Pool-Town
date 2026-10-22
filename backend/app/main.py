"""
FastAPI application entry point for the Billiard Hall Management and Accounting System.
"""
from __future__ import annotations

import os
from contextlib import asynccontextmanager
from datetime import datetime, timezone
from fastapi import FastAPI, Depends
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.orm import Session

from app.config import settings
from app.database import engine, get_db, SessionLocal
from app.models.base import Base
import app.models  # noqa: F401 — register all models with Base.metadata
from app.services.seed import seed_master_data


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Lifespan context manager for startup and shutdown events."""
    # Ensure local storage directories exist
    os.makedirs("./data", exist_ok=True)
    os.makedirs("./backups", exist_ok=True)

    # Create tables if they do not exist
    Base.metadata.create_all(bind=engine)

    # Seed core metadata (accounts, owners, categories, settings) idempotently
    with SessionLocal() as db:
        seed_master_data(db)

    # Ensure default admin credentials exist (hashed)
    from app.routers.auth import ensure_default_credentials
    with SessionLocal() as db:
        ensure_default_credentials(db)

    yield
    # Cleanup on shutdown (if needed)


app = FastAPI(
    title="Billiard Hall Management and Accounting System",
    description="Professional, local-first management and accounting system for Akash, Pasan, and Vishwa.",
    version="1.0.0",
    docs_url="/docs",
    redoc_url="/redoc",
    lifespan=lifespan,
)

# CORS configuration
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.allowed_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/health", tags=["System"])
@app.get("/api/health", tags=["System"])
def health_check():
    """Health check endpoint for frontend connection check and uptime monitoring."""
    return {
        "status": "healthy",
        "app": settings.business_name,
        "version": "1.0.0",
        "environment": settings.environment,
        "server_time": datetime.now(timezone.utc).isoformat(),
        "database": "connected",
    }


@app.get("/api/info", tags=["System"])
def system_info(db: Session = Depends(get_db)):
    """System information including business owners and database stats."""
    from app.models.owners import Owner
    from app.models.accounts import FinancialAccount

    owners = db.query(Owner).filter(Owner.is_active == True).all()
    accounts_count = db.query(FinancialAccount).count()

    return {
        "business_name": settings.business_name,
        "currency": "LKR",
        "currency_symbol": "Rs.",
        "owners": [
            {
                "id": o.id,
                "name": o.name,
                "profit_share_bps": o.profit_share_bps,
                "profit_share_percent": f"{o.profit_share_bps / 100:.1f}%",
            }
            for o in owners
        ],
        "accounts_configured": accounts_count,
        "historical_start_date": "2026-01-01",
    }


# Include business domain routers
from app.routers import pricing, players, sessions, payments, inventory, expenses, accounts, auth, drinks, owners, backup, reports, equipment

app.include_router(auth.router)
app.include_router(pricing.router)
app.include_router(players.router)
app.include_router(sessions.router)
app.include_router(payments.router)
app.include_router(inventory.router)
app.include_router(expenses.router)
app.include_router(accounts.router)
app.include_router(drinks.router)
app.include_router(owners.router)
app.include_router(backup.router)
app.include_router(reports.router)
app.include_router(equipment.router)
