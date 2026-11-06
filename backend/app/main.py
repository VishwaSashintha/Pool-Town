from __future__ import annotations

import os
import sys
from contextlib import asynccontextmanager
from datetime import datetime, timezone
from fastapi import FastAPI, Depends
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.orm import Session

from app.config import settings
from app.database import engine, get_db, SessionLocal
from app.models.base import Base
import app.models  # noqa: F401
from app.services.seed import seed_master_data


@asynccontextmanager
async def lifespan(app: FastAPI):

    data_dir = settings.resolved_data_dir
    backup_dir = settings.resolved_backup_dir
    os.makedirs(data_dir, exist_ok=True)
    os.makedirs(backup_dir, exist_ok=True)


    Base.metadata.create_all(bind=engine)


    with SessionLocal() as db:
        seed_master_data(db)


    from app.routers.auth import ensure_default_credentials
    with SessionLocal() as db:
        ensure_default_credentials(db)

    yield


app = FastAPI(
    title="Pool Town — Billiard Hall Management and Accounting ERP",
    description="Professional management and accounting system for Pool Town (Akash, Pasan, and Vishwa).",
    version="1.0.0",
    docs_url="/docs",
    redoc_url="/redoc",
    lifespan=lifespan,
)


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

    import json
    from app.models.owners import Owner
    from app.models.accounts import FinancialAccount
    from app.models.audit import AppSetting

    owners = db.query(Owner).filter(Owner.is_active == True).all()
    accounts_count = db.query(FinancialAccount).count()

    bn_setting = db.query(AppSetting).filter(AppSetting.key == "business_name").first()
    business_name = settings.business_name
    if bn_setting and bn_setting.value:
        try:
            parsed = json.loads(bn_setting.value)
            if parsed:
                business_name = str(parsed)
        except Exception:
            business_name = bn_setting.value

    return {
        "business_name": business_name,
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


from app.routers import pricing, players, sessions, payments, inventory, expenses, accounts, auth, drinks, owners, backup, reports, equipment, admin, settings as settings_router

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
app.include_router(admin.router)
app.include_router(settings_router.router)

from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles

_frontend_dir = os.environ.get("POOL_TOWN_FRONTEND_DIR")
if not _frontend_dir and getattr(sys, "frozen", False):
    _base_dir = getattr(sys, "_MEIPASS", os.path.dirname(sys.executable))
    _c1 = os.path.join(_base_dir, "frontend_dist")
    _c2 = os.path.join(os.path.dirname(sys.executable), "frontend_dist")
    _frontend_dir = _c1 if os.path.isdir(_c1) else (_c2 if os.path.isdir(_c2) else None)
if not _frontend_dir:
    _dev_path = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..", "frontend", "dist"))
    if os.path.isdir(_dev_path):
        _frontend_dir = _dev_path

if _frontend_dir and os.path.isdir(_frontend_dir):
    _assets_dir = os.path.join(_frontend_dir, "assets")
    if os.path.isdir(_assets_dir):
        app.mount("/assets", StaticFiles(directory=_assets_dir), name="assets")

    @app.get("/{full_path:path}", tags=["Frontend"])
    def serve_spa(full_path: str):
        target = os.path.join(_frontend_dir, full_path)
        if full_path and os.path.isfile(target):
            return FileResponse(target)
        return FileResponse(os.path.join(_frontend_dir, "index.html"))
