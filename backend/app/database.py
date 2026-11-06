from __future__ import annotations

from sqlalchemy import create_engine, event, text
from sqlalchemy.orm import sessionmaker, Session
from typing import Generator

from app.config import settings


def _set_sqlite_pragma(dbapi_connection, connection_record):

    cursor = dbapi_connection.cursor()
    cursor.execute("PRAGMA foreign_keys=ON")
    cursor.execute("PRAGMA journal_mode=WAL")
    cursor.close()


def create_db_engine(database_url: str):

    engine = create_engine(
        database_url,
        connect_args={"check_same_thread": False},
        echo=settings.debug,
    )
    event.listen(engine, "connect", _set_sqlite_pragma)
    return engine


engine = create_db_engine(settings.resolved_database_url)

SessionLocal = sessionmaker(
    autocommit=False,
    autoflush=False,
    bind=engine,
)


def get_db() -> Generator[Session, None, None]:

    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
