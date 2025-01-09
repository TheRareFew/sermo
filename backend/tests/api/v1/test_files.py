import pytest
import os
from sqlalchemy.orm import Session
from app.models.user import User
from app.models.file import File
from app.models.message import Message
from app.models.channel import Channel
from fastapi.testclient import TestClient
from datetime import datetime, UTC
from pathlib import Path

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
def test_channel_with_message(test_db: Session, test_user: User) -> tuple[Channel, Message]:
    """Create a test channel with a message for file testing."""
    channel = Channel(
        name="test-channel",
        description="Test channel description",
        is_direct_message=False,
        created_by_id=test_user.id,
        members=[test_user]
    )
    test_db.add(channel)
    test_db.commit()

    message = Message(
        content="Test message",
        channel_id=channel.id,
        sender_id=test_user.id
    )
    test_db.add(message)
    test_db.commit()
    
    return channel, message

def test_upload_file(
    test_client: TestClient,
    test_user: User,
    test_user_token: str,
    test_upload_file: Path,
    test_channel_with_message: tuple[Channel, Message]
):
    """Test uploading a file."""
    _, message = test_channel_with_message
    headers = {"Authorization": f"Bearer {test_user_token}"}
    
    with open(test_upload_file, "rb") as f:
        files = {"file": ("test_file.txt", f, "text/plain")}
        response = test_client.post(
            f"/api/files/upload?message_id={message.id}",
            headers=headers,
            files=files
        )
    
    assert response.status_code == 200
    data = response.json()
    assert data["filename"].endswith(".txt")
    assert data["file_type"] == "text/plain"
    assert data["message_id"] == message.id
    
    # Cleanup uploaded file
    if os.path.exists(data["file_path"]):
        os.remove(data["file_path"])

def test_upload_file_too_large(
    test_client: TestClient,
    test_user: User,
    test_user_token: str,
    test_channel_with_message: tuple[Channel, Message]
):
    """Test uploading a file that exceeds size limit."""
    _, message = test_channel_with_message
    headers = {"Authorization": f"Bearer {test_user_token}"}
    
    # Create a temporary large file
    large_file = Path("large_test_file.txt")
    with open(large_file, "wb") as f:
        f.write(b"0" * (51 * 1024 * 1024))  # 51MB file
    
    try:
        with open(large_file, "rb") as f:
            files = {"file": ("large_file.txt", f, "text/plain")}
            response = test_client.post(
                f"/api/files/upload?message_id={message.id}",
                headers=headers,
                files=files
            )
        
        assert response.status_code == 413
        assert "File too large" in response.json()["detail"]
    
    finally:
        if large_file.exists():
            large_file.unlink()

def test_upload_invalid_file_type(
    test_client: TestClient,
    test_user: User,
    test_user_token: str,
    test_channel_with_message: tuple[Channel, Message]
):
    """Test uploading a file with unsupported type."""
    _, message = test_channel_with_message
    headers = {"Authorization": f"Bearer {test_user_token}"}
    
    # Create a temporary file with invalid type
    invalid_file = Path("test.xyz")
    with open(invalid_file, "w") as f:
        f.write("test content")
    
    try:
        with open(invalid_file, "rb") as f:
            files = {"file": ("test.xyz", f, "application/xyz")}
            response = test_client.post(
                f"/api/files/upload?message_id={message.id}",
                headers=headers,
                files=files
            )
        
        assert response.status_code == 415
        assert "File type not supported" in response.json()["detail"]
    
    finally:
        if invalid_file.exists():
            invalid_file.unlink()

def test_get_file(
    test_client: TestClient,
    test_user: User,
    test_user_token: str,
    test_db: Session,
    test_channel_with_message: tuple[Channel, Message]
):
    """Test getting a file by ID."""
    channel, message = test_channel_with_message
    
    # Create a test file in the database
    file = File(
        filename="test_file.txt",
        file_type="text/plain",
        file_size=100,
        file_path="/uploads/test_file.txt",
        message_id=message.id,
        uploaded_by_id=test_user.id
    )
    test_db.add(file)
    test_db.commit()

    headers = {"Authorization": f"Bearer {test_user_token}"}
    response = test_client.get(f"/api/files/{file.id}", headers=headers)
    
    assert response.status_code == 200
    data = response.json()
    assert data["filename"] == "test_file.txt"
    assert data["file_type"] == "text/plain"
    assert data["message_id"] == message.id

def test_get_nonexistent_file(
    test_client: TestClient,
    test_user: User,
    test_user_token: str
):
    """Test getting a file that doesn't exist."""
    headers = {"Authorization": f"Bearer {test_user_token}"}
    response = test_client.get("/api/files/999", headers=headers)
    
    assert response.status_code == 404
    assert "File not found" in response.json()["detail"]

def test_delete_file(
    test_client: TestClient,
    test_user: User,
    test_user_token: str,
    test_db: Session,
    test_channel_with_message: tuple[Channel, Message]
):
    """Test deleting a file."""
    channel, message = test_channel_with_message
    
    # Create a test file
    test_file_path = Path("uploads/test_delete.txt")
    os.makedirs(test_file_path.parent, exist_ok=True)
    with open(test_file_path, "w") as f:
        f.write("Test content")
    
    file = File(
        filename="test_delete.txt",
        file_type="text/plain",
        file_size=100,
        file_path="/uploads/test_delete.txt",
        message_id=message.id,
        uploaded_by_id=test_user.id
    )
    test_db.add(file)
    test_db.commit()

    headers = {"Authorization": f"Bearer {test_user_token}"}
    response = test_client.delete(f"/api/files/{file.id}", headers=headers)
    
    assert response.status_code == 204
    assert not test_file_path.exists()
    
    # Verify file is deleted from database
    response = test_client.get(f"/api/files/{file.id}", headers=headers)
    assert response.status_code == 404

def test_delete_file_unauthorized(
    test_client: TestClient,
    test_user: User,
    test_user_token: str,
    test_db: Session
):
    """Test deleting a file without proper authorization."""
    # Create another user
    other_user = User(
        username="otheruser",
        email="other@example.com",
        full_name="Other User",
        hashed_password="dummyhash",
        is_active=True,
        created_at=datetime.now(UTC),
        updated_at=datetime.now(UTC)
    )
    test_db.add(other_user)
    test_db.commit()

    # Create a channel owned by other user
    channel = Channel(
        name="private-channel",
        description="Private channel",
        is_direct_message=False,
        created_by_id=other_user.id,
        members=[other_user]  # Only other_user is a member
    )
    test_db.add(channel)
    test_db.commit()

    # Create a message by other user
    message = Message(
        content="Other user's message",
        channel_id=channel.id,
        sender_id=other_user.id
    )
    test_db.add(message)
    test_db.commit()

    # Create a file attached to other user's message
    file = File(
        filename="test_file.txt",
        file_type="text/plain",
        file_size=100,
        file_path="/uploads/test_file.txt",
        message_id=message.id,
        uploaded_by_id=other_user.id
    )
    test_db.add(file)
    test_db.commit()

    headers = {"Authorization": f"Bearer {test_user_token}"}
    response = test_client.delete(f"/api/files/{file.id}", headers=headers)

    assert response.status_code == 403
    assert "Not authorized to delete this file" in response.json()["detail"]

def test_get_channel_files(
    test_client: TestClient,
    test_user: User,
    test_user_token: str,
    test_db: Session,
    test_channel_with_message: tuple[Channel, Message]
):
    """Test getting all files in a channel."""
    channel, message = test_channel_with_message
    
    # Create multiple test files
    for i in range(3):
        file = File(
            filename=f"test_file_{i}.txt",
            file_type="text/plain",
            file_size=100,
            file_path=f"/uploads/test_file_{i}.txt",
            message_id=message.id,
            uploaded_by_id=test_user.id
        )
        test_db.add(file)
    test_db.commit()

    headers = {"Authorization": f"Bearer {test_user_token}"}
    response = test_client.get(f"/api/files/channels/{channel.id}/files", headers=headers)
    
    assert response.status_code == 200
    data = response.json()
    assert len(data) == 3
    assert all(file["file_type"] == "text/plain" for file in data)
    assert all(file["message_id"] == message.id for file in data)

def test_get_channel_files_pagination(
    test_client: TestClient,
    test_user: User,
    test_user_token: str,
    test_db: Session,
    test_channel_with_message: tuple[Channel, Message]
):
    """Test pagination in get_channel_files endpoint."""
    channel, message = test_channel_with_message
    
    # Create multiple test files
    for i in range(5):
        file = File(
            filename=f"test_file_{i}.txt",
            file_type="text/plain",
            file_size=100,
            file_path=f"/uploads/test_file_{i}.txt",
            message_id=message.id,
            uploaded_by_id=test_user.id
        )
        test_db.add(file)
    test_db.commit()

    headers = {"Authorization": f"Bearer {test_user_token}"}
    
    # Test first page
    response = test_client.get(
        f"/api/files/channels/{channel.id}/files?skip=0&limit=2",
        headers=headers
    )
    assert response.status_code == 200
    data = response.json()
    assert len(data) == 2
    
    # Test second page
    response = test_client.get(
        f"/api/files/channels/{channel.id}/files?skip=2&limit=2",
        headers=headers
    )
    assert response.status_code == 200
    data = response.json()
    assert len(data) == 2

def test_get_channel_files_unauthorized(
    test_client: TestClient,
    test_user: User,
    test_user_token: str,
    test_db: Session
):
    """Test getting files from a channel without being a member."""
    # Create another user
    other_user = User(
        username="otheruser",
        email="other@example.com",
        full_name="Other User",
        hashed_password="dummyhash",
        is_active=True,
        created_at=datetime.now(UTC),
        updated_at=datetime.now(UTC)
    )
    test_db.add(other_user)
    
    # Create a channel without test_user as member
    channel = Channel(
        name="private-channel",
        description="Private channel",
        is_direct_message=False,
        created_by_id=other_user.id,
        members=[other_user]
    )
    test_db.add(channel)
    test_db.commit()

    headers = {"Authorization": f"Bearer {test_user_token}"}
    response = test_client.get(f"/api/files/channels/{channel.id}/files", headers=headers)
    
    assert response.status_code == 403
    assert "Not authorized to access this channel" in response.json()["detail"] 