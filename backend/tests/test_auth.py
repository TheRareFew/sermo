import pytest
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from fastapi.testclient import TestClient
from backend.models import Base, User, get_db
from backend.main import app
from .test_config import TEST_DATABASE_URL

# Test database setup
engine = create_engine(TEST_DATABASE_URL)
TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

# Create test database tables
Base.metadata.create_all(bind=engine)

@pytest.fixture(scope="session", autouse=True)
def setup_test_database():
    # Create tables
    Base.metadata.create_all(bind=engine)
    yield
    # Drop tables after all tests
    Base.metadata.drop_all(bind=engine)

@pytest.fixture(autouse=True)
def cleanup_tables():
    # Setup - nothing needed
    yield
    # Cleanup after each test
    db = TestingSessionLocal()
    try:
        db.query(User).delete()
        db.commit()
    finally:
        db.close()

def override_get_db():
    db = TestingSessionLocal()
    try:
        yield db
    finally:
        db.close()

app.dependency_overrides[get_db] = override_get_db
client = TestClient(app)

def test_password_hashing():
    password = "testpassword123"
    hashed = User.hash_password(password)
    assert hashed != password
    assert len(hashed) > 0

def test_user_registration():
    response = client.post(
        "/api/auth/register",
        json={
            "username": "testuser",
            "password": "testpass123",
            "displayName": "Test User"
        }
    )
    assert response.status_code == 200
    data = response.json()
    assert data["username"] == "testuser"
    assert data["displayName"] == "Test User"

def test_user_login():
    # First register a user
    client.post(
        "/api/auth/register",
        json={
            "username": "logintest",
            "password": "testpass123"
        }
    )
    
    # Test successful login
    response = client.post(
        "/api/auth/login",
        json={
            "username": "logintest",
            "password": "testpass123"
        }
    )
    assert response.status_code == 200
    
    # Test failed login
    response = client.post(
        "/api/auth/login",
        json={
            "username": "logintest",
            "password": "wrongpassword"
        }
    )
    assert response.status_code == 401 