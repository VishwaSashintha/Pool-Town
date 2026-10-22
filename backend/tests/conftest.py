"""
Pytest configuration and shared fixtures.
Uses a SEPARATE temporary database — never touches the real billiard.db.
"""
import pytest
import tempfile
import os
from sqlalchemy import create_engine, event
from sqlalchemy.orm import sessionmaker, Session
from fastapi.testclient import TestClient

from app.models.base import Base
import app.models  # noqa: F401 — ensure all models are registered on Base.metadata


def _set_sqlite_pragma(dbapi_connection, connection_record):
    cursor = dbapi_connection.cursor()
    cursor.execute("PRAGMA foreign_keys=ON")
    cursor.close()


@pytest.fixture(scope="session")
def test_engine():
    """Create an in-memory SQLite database for testing."""
    engine = create_engine(
        "sqlite:///:memory:",
        connect_args={"check_same_thread": False},
    )
    event.listen(engine, "connect", _set_sqlite_pragma)
    
    # Create all tables
    Base.metadata.create_all(bind=engine)
    yield engine
    engine.dispose()


@pytest.fixture(scope="function")
def db(test_engine):
    """
    Provide a database session that rolls back after each test.
    This ensures test isolation without recreating tables.
    """
    connection = test_engine.connect()
    transaction = connection.begin()
    
    TestingSession = sessionmaker(bind=connection)
    session = TestingSession()
    
    yield session
    
    session.close()
    transaction.rollback()
    connection.close()


@pytest.fixture(scope="function")
def client(db):
    """
    FastAPI test client with database override.
    Only needed for API-level tests.
    """
    from app.main import app
    from app.database import get_db
    
    def override_get_db():
        try:
            yield db
        finally:
            pass
    
    app.dependency_overrides[get_db] = override_get_db
    with TestClient(app) as c:
        yield c
    app.dependency_overrides.clear()
