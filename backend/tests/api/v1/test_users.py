import pytest
from sqlalchemy.orm import Session
from app.models.user import User
from fastapi.testclient import TestClient
from datetime import datetime, UTC
from app.main import app
from app.api.deps import get_current_user, get_db
import io

@pytest.fixture
def test_client(test_user: User, test_db: Session):
    """Create a test client with the current user dependency overridden."""
    # Ensure test_user is attached to the session
    test_db.add(test_user)
    test_db.flush()

    async def override_get_current_user():
        return test_user

    async def override_get_db():
        return test_db

    app.dependency_overrides[get_current_user] = override_get_current_user
    app.dependency_overrides[get_db] = override_get_db
    client = TestClient(app)
    yield client
    app.dependency_overrides.clear()

@pytest.fixture
def test_other_user(test_db: Session) -> User:
    """Create another test user."""
    user = User(
        username="otheruser",
        email="other@example.com",
        full_name="Other User",
        hashed_password="dummyhash",
        is_active=True,
        created_at=datetime.now(UTC),
        updated_at=datetime.now(UTC)
    )
    test_db.add(user)
    test_db.commit()
    test_db.refresh(user)
    return user

def test_get_current_user_info(
    test_client: TestClient,
    test_user: User,
    test_user_token: str
):
    """Test getting current user information."""
    headers = {"Authorization": f"Bearer {test_user_token}"}
    response = test_client.get("/api/users/me", headers=headers)
    
    assert response.status_code == 200
    data = response.json()
    assert data["id"] == test_user.id
    assert data["email"] == test_user.email
    assert data["username"] == test_user.username
    assert data["full_name"] == test_user.full_name

def test_update_current_user_info(
    test_client: TestClient,
    test_user: User,
    test_user_token: str
):
    """Test updating current user information."""
    headers = {"Authorization": f"Bearer {test_user_token}"}
    update_data = {
        "full_name": "Updated Name",
        "email": "updated@example.com"
    }
    
    response = test_client.put("/api/users/me", headers=headers, json=update_data)
    
    assert response.status_code == 200
    data = response.json()
    assert data["full_name"] == update_data["full_name"]
    assert data["email"] == update_data["email"]

def test_update_user_duplicate_email(
    test_client: TestClient,
    test_user: User,
    test_user_token: str,
    test_other_user: User
):
    """Test updating user with duplicate email."""
    headers = {"Authorization": f"Bearer {test_user_token}"}
    update_data = {
        "email": test_other_user.email  # Try to use other user's email
    }
    
    response = test_client.put("/api/users/me", headers=headers, json=update_data)
    
    assert response.status_code == 400
    assert "Email already registered" in response.json()["detail"]

def test_get_user_by_id(
    test_client: TestClient,
    test_user: User,
    test_user_token: str,
    test_other_user: User
):
    """Test getting user by ID."""
    headers = {"Authorization": f"Bearer {test_user_token}"}
    
    # Test getting existing user
    response = test_client.get(f"/api/users/{test_other_user.id}", headers=headers)
    assert response.status_code == 200
    data = response.json()
    assert data["id"] == test_other_user.id
    assert data["email"] == test_other_user.email
    
    # Test getting non-existent user
    response = test_client.get("/api/users/999", headers=headers)
    assert response.status_code == 404
    assert "User not found" in response.json()["detail"]

def test_get_users_list(
    test_client: TestClient,
    test_user: User,
    test_user_token: str,
    test_other_user: User
):
    """Test getting list of users."""
    headers = {"Authorization": f"Bearer {test_user_token}"}
    
    # Test without pagination
    response = test_client.get("/api/users/", headers=headers)
    assert response.status_code == 200
    data = response.json()
    assert len(data) >= 2  # At least test_user and test_other_user
    assert any(user["id"] == test_user.id for user in data)
    assert any(user["id"] == test_other_user.id for user in data)
    
    # Test with pagination
    response = test_client.get("/api/users/?skip=0&limit=1", headers=headers)
    assert response.status_code == 200
    data = response.json()
    assert len(data) == 1

def test_update_profile_picture(
    test_client: TestClient,
    test_user: User,
    test_user_token: str
):
    """Test updating user profile picture."""
    headers = {"Authorization": f"Bearer {test_user_token}"}
    
    # Create a test image file
    file_content = b"fake image content"
    files = {
        "file": ("test.jpg", io.BytesIO(file_content), "image/jpeg")
    }
    
    response = test_client.put("/api/users/me/profile-picture", headers=headers, files=files)
    
    assert response.status_code == 200
    data = response.json()
    assert "profile_picture_url" in data
    assert str(test_user.id) in data["profile_picture_url"]

def test_update_profile_picture_invalid_type(
    test_client: TestClient,
    test_user: User,
    test_user_token: str
):
    """Test updating profile picture with invalid file type."""
    headers = {"Authorization": f"Bearer {test_user_token}"}
    
    # Create a test text file
    file_content = b"not an image"
    files = {
        "file": ("test.txt", io.BytesIO(file_content), "text/plain")
    }
    
    response = test_client.put("/api/users/me/profile-picture", headers=headers, files=files)
    
    assert response.status_code == 400
    assert "File must be an image" in response.json()["detail"]

def test_update_user_status(
    test_client: TestClient,
    test_user: User,
    test_user_token: str
):
    """Test updating user status."""
    headers = {"Authorization": f"Bearer {test_user_token}"}
    
    # Test valid status
    for status in ["online", "offline", "away", "busy"]:
        update_data = {"status": status}
        response = test_client.put("/api/users/me/status", headers=headers, json=update_data)
        assert response.status_code == 200
        data = response.json()
        assert data["status"] == status
    
    # Test invalid status
    update_data = {"status": "invalid"}
    response = test_client.put("/api/users/me/status", headers=headers, json=update_data)
    assert response.status_code == 400
    assert "Status must be one of" in response.json()["detail"]

def test_get_users_presence(
    test_client: TestClient,
    test_user: User,
    test_user_token: str,
    test_other_user: User
):
    """Test getting users presence information."""
    headers = {"Authorization": f"Bearer {test_user_token}"}
    
    response = test_client.get("/api/users/presence", headers=headers)
    print("Response content:", response.content)
    
    assert response.status_code == 200
    data = response.json()
    assert len(data) >= 2  # At least test_user and test_other_user
    
    # Verify presence info structure
    for presence in data:
        assert "user_id" in presence
        assert "username" in presence
        assert "status" in presence
        assert "last_seen" in presence 