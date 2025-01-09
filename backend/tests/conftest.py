import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker, scoped_session
from sqlalchemy.pool import StaticPool
from datetime import datetime, UTC
import asyncio
from pathlib import Path

from app.database import Base
from app.main import app
from app.models.user import User
from app.auth.security import create_access_token, get_password_hash
from app.api.deps import get_current_user, get_db

@pytest.fixture(scope="session")
def event_loop():
    """Create an instance of the default event loop for the test session."""
    loop = asyncio.get_event_loop_policy().new_event_loop()
    yield loop
    loop.close()

@pytest.fixture(scope="function")
def test_db():
    """Create a test database."""
    engine = create_engine(
        "sqlite:///:memory:",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )
    TestingSessionLocal = sessionmaker(
        autocommit=False,
        autoflush=False,
        bind=engine,
        expire_on_commit=False  # This prevents detached instance errors
    )
    session_factory = scoped_session(TestingSessionLocal)
    Base.metadata.create_all(bind=engine)

    def override_get_db():
        db = session_factory()
        try:
            yield db
        finally:
            pass  # Don't close the session here

    app.dependency_overrides[get_db] = override_get_db
    db = session_factory()
    yield db
    db.close()
    session_factory.remove()
    Base.metadata.drop_all(bind=engine)

@pytest.fixture
def test_app(test_db):
    """Create a test FastAPI application."""
    def override_get_db():
        try:
            yield test_db
        finally:
            test_db.close()

    app.dependency_overrides[get_db] = override_get_db
    
    # Create a new TestClient with the overridden dependencies
    with TestClient(app) as client:
        yield client
    
    app.dependency_overrides.clear()

@pytest.fixture
def test_client(test_app):
    """Create a test client."""
    return test_app

@pytest.fixture
def test_user(test_db):
    """Create a test user."""
    user = User(
        username="testuser",
        email="test@example.com",
        full_name="Test User",
        hashed_password=get_password_hash("testpassword"),
        is_active=True,
        status="online",
        last_seen=datetime.now(UTC),
        created_at=datetime.now(UTC),
        updated_at=datetime.now(UTC)
    )
    test_db.add(user)
    test_db.commit()
    test_db.refresh(user)
    return user

@pytest.fixture
def test_user_token(test_user):
    """Create a test user token."""
    return create_access_token({"sub": str(test_user.id)}) 

@pytest.fixture
def test_upload_file():
    """Create a test file for upload testing."""
    file_path = Path("test_upload.txt")
    with open(file_path, "w") as f:
        f.write("Test file content")
    yield file_path
    if file_path.exists():
        file_path.unlink() 

@pytest.fixture
def test_other_user(test_db) -> User:
    """Create another test user."""
    user = User(
        username="otheruser",
        email="other@example.com",
        full_name="Other User",
        hashed_password="dummyhash",
        is_active=True,
        status="offline",
        last_seen=datetime.now(UTC),
        created_at=datetime.now(UTC),
        updated_at=datetime.now(UTC)
    )
    test_db.add(user)
    test_db.commit()
    test_db.refresh(user)
    return user 