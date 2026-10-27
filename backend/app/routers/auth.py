"""
Authentication router — login, verify password, change password.
Credentials are stored hashed in AppSetting table.
Default: admin / admin123
Edit-auth PIN: stored as 'edit_auth_pin' in AppSetting (default: 123).
"""
from __future__ import annotations

import hashlib
import secrets
import os
import time
from collections import defaultdict
from datetime import datetime, timezone
from fastapi import APIRouter, Depends, HTTPException, Header
from sqlalchemy.orm import Session
from pydantic import BaseModel
from typing import Optional

from app.database import get_db
from app.models.audit import AppSetting, AuditLog

router = APIRouter(prefix="/api/auth", tags=["Authentication"])

# In-memory session tokens (simple local-only approach; no JWT needed for local app)
_active_tokens: dict[str, str] = {}  # token -> username

# ---------------------------------------------------------------------------
# Login rate limiter — 5 failed attempts per 5-minute window per IP
# ---------------------------------------------------------------------------
_RATE_LIMIT_WINDOW = 300   # seconds (5 minutes)
_RATE_LIMIT_MAX = 5        # max failures before lockout
_failed_attempts: dict[str, list[float]] = defaultdict(list)  # ip -> [timestamps]


def _check_rate_limit(ip: str) -> None:
    """Raise 429 if IP has too many recent failed attempts."""
    now = time.monotonic()
    attempts = [t for t in _failed_attempts.get(ip, []) if now - t < _RATE_LIMIT_WINDOW]
    _failed_attempts[ip] = attempts  # prune old entries
    if len(attempts) >= _RATE_LIMIT_MAX:
        retry_after = int(_RATE_LIMIT_WINDOW - (now - attempts[0]))
        raise HTTPException(
            status_code=429,
            detail=f"Too many failed login attempts. Please wait {retry_after} seconds before trying again.",
            headers={"Retry-After": str(retry_after)},
        )


def _record_failure(ip: str) -> None:
    _failed_attempts[ip].append(time.monotonic())


def _clear_failures(ip: str) -> None:
    _failed_attempts.pop(ip, None)


# ---------------------------------------------------------------------------
# Auth dependency — protects write endpoints from unauthenticated HTTP access
# ---------------------------------------------------------------------------
def get_current_user(x_auth_token: Optional[str] = Header(default=None)) -> str:
    """
    FastAPI dependency for write-endpoint protection.
    Validates the X-Auth-Token header against active session tokens.
    Returns the authenticated username or raises 401.
    """
    if not x_auth_token or x_auth_token not in _active_tokens:
        raise HTTPException(
            status_code=401,
            detail="Authentication required. Please log in to perform this action.",
        )
    return _active_tokens[x_auth_token]


def _hash_password(password: str, salt: str | None = None) -> tuple[str, str]:
    """Hash a password with a random salt using SHA-256."""
    if salt is None:
        salt = secrets.token_hex(16)
    digest = hashlib.sha256(f"{salt}:{password}".encode()).hexdigest()
    return digest, salt


def _verify_password(password: str, stored_hash: str, salt: str) -> bool:
    digest, _ = _hash_password(password, salt)
    return secrets.compare_digest(digest, stored_hash)


def _get_setting(db: Session, key: str) -> AppSetting | None:
    return db.query(AppSetting).filter(AppSetting.key == key).first()


def _set_setting(db: Session, key: str, value: str, description: str = "") -> None:
    existing = _get_setting(db, key)
    if existing:
        existing.value = value
        existing.updated_at = datetime.now(timezone.utc)
    else:
        db.add(AppSetting(key=key, value=value, description=description, updated_by="system"))


def ensure_default_credentials(db: Session) -> None:
    """Create default admin credentials if they don't exist."""
    if not _get_setting(db, "admin_password_hash"):
        pw_hash, salt = _hash_password("admin123")
        _set_setting(db, "admin_username", '"admin"', "Admin login username")
        _set_setting(db, "admin_password_hash", f'"{pw_hash}"', "Admin password hash")
        _set_setting(db, "admin_password_salt", f'"{salt}"', "Admin password salt")
    if not _get_setting(db, "edit_auth_pin_hash"):
        pin_hash, pin_salt = _hash_password("123")
        _set_setting(db, "edit_auth_pin_hash", f'"{pin_hash}"', "Edit authorization PIN hash")
        _set_setting(db, "edit_auth_pin_salt", f'"{pin_salt}"', "Edit authorization PIN salt")
    db.commit()


class LoginRequest(BaseModel):
    username: str
    password: str


class LoginResponse(BaseModel):
    token: str
    username: str
    message: str


class ChangePasswordRequest(BaseModel):
    current_password: str
    new_password: str
    new_username: str | None = None


class VerifyPinRequest(BaseModel):
    pin: str


@router.post("/login", response_model=LoginResponse)
def login(payload: LoginRequest, db: Session = Depends(get_db), x_forwarded_for: Optional[str] = Header(default=None)):
    """Authenticate with username and password. Rate limited to 5 failures per 5 minutes."""
    ensure_default_credentials(db)

    # Use X-Forwarded-For or fallback identifier for rate limiting
    client_ip = x_forwarded_for or "local"
    _check_rate_limit(client_ip)

    import json
    username_setting = _get_setting(db, "admin_username")
    hash_setting = _get_setting(db, "admin_password_hash")
    salt_setting = _get_setting(db, "admin_password_salt")

    if not username_setting or not hash_setting or not salt_setting:
        raise HTTPException(status_code=500, detail="Auth configuration missing")

    stored_username = json.loads(username_setting.value)
    stored_hash = json.loads(hash_setting.value)
    stored_salt = json.loads(salt_setting.value)

    if payload.username != stored_username or not _verify_password(payload.password, stored_hash, stored_salt):
        _record_failure(client_ip)
        raise HTTPException(status_code=401, detail="Invalid username or password")

    # Success — clear failure history
    _clear_failures(client_ip)

    # Issue a session token
    token = secrets.token_urlsafe(32)
    _active_tokens[token] = stored_username

    # Audit log
    db.add(AuditLog(
        entity_type="auth",
        entity_id=0,
        action="login",
        description=f"User '{stored_username}' logged in",
        user=stored_username,
    ))
    db.commit()

    return LoginResponse(token=token, username=stored_username, message="Login successful")


@router.post("/logout")
def logout(token: str, db: Session = Depends(get_db)):
    """Invalidate session token."""
    _active_tokens.pop(token, None)
    return {"message": "Logged out"}


@router.post("/verify")
def verify_token(token: str):
    """Check if a session token is valid."""
    if token in _active_tokens:
        return {"valid": True, "username": _active_tokens[token]}
    return {"valid": False}


@router.post("/verify-pin")
def verify_edit_pin(payload: VerifyPinRequest, db: Session = Depends(get_db)):
    """Verify the edit-authorisation PIN."""
    ensure_default_credentials(db)
    import json
    hash_s = _get_setting(db, "edit_auth_pin_hash")
    salt_s = _get_setting(db, "edit_auth_pin_salt")
    if not hash_s or not salt_s:
        raise HTTPException(status_code=500, detail="PIN configuration missing")
    stored_hash = json.loads(hash_s.value)
    stored_salt = json.loads(salt_s.value)
    if _verify_password(payload.pin, stored_hash, stored_salt):
        return {"valid": True}
    raise HTTPException(status_code=403, detail="Incorrect PIN")


@router.post("/change-password")
def change_password(payload: ChangePasswordRequest, db: Session = Depends(get_db)):
    """Change admin username and/or password after verifying current password."""
    ensure_default_credentials(db)
    import json
    hash_s = _get_setting(db, "admin_password_hash")
    salt_s = _get_setting(db, "admin_password_salt")
    user_s = _get_setting(db, "admin_username")

    if not hash_s or not salt_s or not user_s:
        raise HTTPException(status_code=500, detail="Auth configuration missing")

    stored_hash = json.loads(hash_s.value)
    stored_salt = json.loads(salt_s.value)

    if not _verify_password(payload.current_password, stored_hash, stored_salt):
        raise HTTPException(status_code=403, detail="Current password is incorrect")

    if len(payload.new_password) < 6:
        raise HTTPException(status_code=400, detail="New password must be at least 6 characters")

    new_hash, new_salt = _hash_password(payload.new_password)
    _set_setting(db, "admin_password_hash", f'"{new_hash}"', "Admin password hash")
    _set_setting(db, "admin_password_salt", f'"{new_salt}"', "Admin password salt")

    if payload.new_username and payload.new_username.strip():
        _set_setting(db, "admin_username", f'"{payload.new_username.strip()}"', "Admin login username")
        username = payload.new_username.strip()
    else:
        username = json.loads(user_s.value)

    # Invalidate all existing tokens
    _active_tokens.clear()

    db.add(AuditLog(
        entity_type="auth",
        entity_id=0,
        action="change_password",
        description=f"Password changed for '{username}'",
        user=username,
    ))
    db.commit()
    return {"message": "Password changed successfully. Please log in again."}


class ChangePinRequest(BaseModel):
    current_pin: str
    new_pin: str


@router.post("/change-pin")
def change_edit_pin(
    payload: Optional[ChangePinRequest] = None,
    current_pin: Optional[str] = None,
    new_pin: Optional[str] = None,
    db: Session = Depends(get_db),
):
    """Change the edit-authorisation PIN. Supports either JSON body or query params."""
    cur_pin = (payload.current_pin if payload else current_pin) or ""
    n_pin = (payload.new_pin if payload else new_pin) or ""
    if not cur_pin or not n_pin:
        raise HTTPException(status_code=400, detail="current_pin and new_pin are required")

    ensure_default_credentials(db)
    import json
    hash_s = _get_setting(db, "edit_auth_pin_hash")
    salt_s = _get_setting(db, "edit_auth_pin_salt")
    if not hash_s or not salt_s:
        raise HTTPException(status_code=500, detail="PIN configuration missing")

    if not _verify_password(cur_pin, json.loads(hash_s.value), json.loads(salt_s.value)):
        raise HTTPException(status_code=403, detail="Current PIN is incorrect")

    new_hash, new_salt = _hash_password(n_pin)
    _set_setting(db, "edit_auth_pin_hash", f'"{new_hash}"', "Edit authorization PIN hash")
    _set_setting(db, "edit_auth_pin_salt", f'"{new_salt}"', "Edit authorization PIN salt")
    db.commit()
    return {"message": "PIN changed successfully"}

