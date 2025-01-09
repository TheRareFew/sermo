import pytest
from typing import Generator
from fastapi import FastAPI
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from app.database import Base
from app.main import app
from app.dependencies import get_db

# Create an in-memory SQLite database for testing
SQLALCHEMY_DATABASE_URL = "sqlite:///:memory:"

engine = create_engine(
    SQLALCHEMY_DATABASE_URL,
    connect_args={"check_same_thread": False},
    poolclass=StaticPool,
)
TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

@pytest.fixture(scope="function")
def test_app() -> Generator[FastAPI, None, None]:
    """Create a fresh database on each test case."""
    Base.metadata.create_all(bind=engine)  # Create tables for test
    
    def override_get_db():
        db = TestingSessionLocal()
        try:
            yield db
        finally:
            db.close()
    
    app.dependency_overrides[get_db] = override_get_db
    yield app
    Base.metadata.drop_all(bind=engine)

@pytest.fixture(scope="function")
def test_client(test_app: FastAPI) -> Generator[TestClient, None, None]:
    """Create a test client using the test application."""
    with TestClient(test_app) as client:
        yield client 