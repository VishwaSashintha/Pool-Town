"""
SQLAlchemy database engine and session configuration.
Foreign keys are enabled on every SQLite connection.
"""
from __future__ import annotations

from sqlalchemy import create_engine, event, text
from sqlalchemy.orm import sessionmaker, Session
from typing import Generator

from app.config import settings


def _set_sqlite_pragma(dbapi_connection, connection_record):
    """Enable foreign key enforcement on every SQLite connection."""
    cursor = dbapi_connection.cursor()
    cursor.execute("PRAGMA foreign_keys=ON")
    cursor.execute("PRAGMA journal_mode=WAL")  # Better concurrent read performance
    cursor.close()


def create_db_engine(database_url: str):
    """Create and configure the SQLAlchemy engine."""
    engine = create_engine(
        database_url,
        connect_args={"check_same_thread": False},  # Required for SQLite with threading
        echo=settings.debug,
    )
    event.listen(engine, "connect", _set_sqlite_pragma)
    return engine


engine = create_db_engine(settings.database_url)

SessionLocal = sessionmaker(
    autocommit=False,
    autoflush=False,
    bind=engine,
)


def get_db() -> Generator[Session, None, None]:
    """FastAPI dependency: yield a database session, always close it after use."""
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
