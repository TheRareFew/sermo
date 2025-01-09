import pytest
from sqlalchemy.orm import Session
from app.models.user import User
from app.models.channel import Channel
from app.models.message import Message
from app.models.file import File
from fastapi.testclient import TestClient
from datetime import datetime, UTC
from app.main import app
from app.api.deps import get_current_user

@pytest.fixture
def test_client(test_user: User):
    """Create a test client with the current user dependency overridden."""
    async def override_get_current_user():
        return test_user

    app.dependency_overrides[get_current_user] = override_get_current_user
    client = TestClient(app)
    yield client
    app.dependency_overrides.clear()

@pytest.fixture
def test_search_data(test_db: Session, test_user: User):
    """Create test data for search testing including channels, messages, and files."""
    # Create channels
    channels = []
    for i in range(2):
        channel = Channel(
            name=f"test-channel-{i}",
            description=f"Test channel {i} description",
            is_direct_message=False,
            created_by_id=test_user.id,
            members=[test_user]
        )
        test_db.add(channel)
        channels.append(channel)
    test_db.commit()

    # Create messages with different content
    messages = []
    for channel in channels:
        for i in range(2):
            message = Message(
                content=f"Test message {i} in {channel.name}",
                channel_id=channel.id,
                sender_id=test_user.id
            )
            test_db.add(message)
            messages.append(message)
    test_db.commit()

    # Create files with different names and types
    files = []
    for message in messages:
        file = File(
            filename=f"test_file_{message.id}.txt",
            file_type="text/plain",
            file_path=f"/files/test_file_{message.id}.txt",
            file_size=100,
            message_id=message.id,
            uploaded_by_id=test_user.id,
            created_at=datetime.now(UTC),
            updated_at=datetime.now(UTC)
        )
        test_db.add(file)
        files.append(file)
    test_db.commit()

    return {"channels": channels, "messages": messages, "files": files}

def test_search_messages(
    test_client: TestClient,
    test_user: User,
    test_user_token: str,
    test_search_data: dict
):
    """Test searching messages."""
    headers = {"Authorization": f"Bearer {test_user_token}"}
    
    # Test searching for a specific message
    response = test_client.get(
        "/api/search/messages?query=test-channel-0",
        headers=headers
    )
    
    assert response.status_code == 200
    results = response.json()
    assert len(results) > 0
    assert all("test-channel-0" in result["content"] for result in results)
    assert all(result["channel_name"] == "test-channel-0" for result in results)

def test_search_messages_pagination(
    test_client: TestClient,
    test_user: User,
    test_user_token: str,
    test_search_data: dict
):
    """Test message search pagination."""
    headers = {"Authorization": f"Bearer {test_user_token}"}
    
    # Test with limit
    response = test_client.get(
        "/api/search/messages?query=Test&limit=1",
        headers=headers
    )
    
    assert response.status_code == 200
    results = response.json()
    assert len(results) == 1
    first_message = results[0]

    # Test with skip
    response = test_client.get(
        "/api/search/messages?query=Test&skip=1&limit=1",
        headers=headers
    )
    
    assert response.status_code == 200
    results = response.json()
    assert len(results) == 1
    second_message = results[0]
    assert first_message["content"] != second_message["content"]  # Different message content due to skip

def test_search_files(
    test_client: TestClient,
    test_user: User,
    test_user_token: str,
    test_search_data: dict
):
    """Test searching files."""
    headers = {"Authorization": f"Bearer {test_user_token}"}
    
    # Test searching by filename
    response = test_client.get(
        "/api/search/files?query=test_file",
        headers=headers
    )
    
    assert response.status_code == 200
    results = response.json()
    assert len(results) > 0
    assert all("test_file" in result["filename"] for result in results)
    
    # Test searching by file type
    response = test_client.get(
        "/api/search/files?query=text/plain",
        headers=headers
    )
    
    assert response.status_code == 200
    results = response.json()
    assert len(results) > 0
    assert all(result["file_type"] == "text/plain" for result in results)

def test_search_files_pagination(
    test_client: TestClient,
    test_user: User,
    test_user_token: str,
    test_search_data: dict
):
    """Test file search pagination."""
    headers = {"Authorization": f"Bearer {test_user_token}"}
    
    # Test with limit
    response = test_client.get(
        "/api/search/files?query=test&limit=1",
        headers=headers
    )
    
    assert response.status_code == 200
    results = response.json()
    assert len(results) == 1
    first_file = results[0]

    # Test with skip
    response = test_client.get(
        "/api/search/files?query=test&skip=1&limit=1",
        headers=headers
    )
    
    assert response.status_code == 200
    results = response.json()
    assert len(results) == 1
    second_file = results[0]
    assert first_file["filename"] != second_file["filename"]  # Different filename due to skip

def test_search_channels(
    test_client: TestClient,
    test_user: User,
    test_user_token: str,
    test_search_data: dict
):
    """Test searching channels."""
    headers = {"Authorization": f"Bearer {test_user_token}"}
    
    # Test searching by channel name
    response = test_client.get(
        "/api/search/channels?query=test-channel",
        headers=headers
    )
    
    assert response.status_code == 200
    results = response.json()
    assert len(results) > 0
    assert all("test-channel" in result["name"] for result in results)
    
    # Test searching by description
    response = test_client.get(
        "/api/search/channels?query=description",
        headers=headers
    )
    
    assert response.status_code == 200
    results = response.json()
    assert len(results) > 0
    assert all("description" in result["description"] for result in results)

def test_search_channels_pagination(
    test_client: TestClient,
    test_user: User,
    test_user_token: str,
    test_search_data: dict
):
    """Test channel search pagination."""
    headers = {"Authorization": f"Bearer {test_user_token}"}
    
    # Test with limit
    response = test_client.get(
        "/api/search/channels?query=test&limit=1",
        headers=headers
    )
    
    assert response.status_code == 200
    results = response.json()
    assert len(results) == 1
    first_channel = results[0]

    # Test with skip
    response = test_client.get(
        "/api/search/channels?query=test&skip=1&limit=1",
        headers=headers
    )
    
    assert response.status_code == 200
    results = response.json()
    assert len(results) == 1
    second_channel = results[0]
    assert first_channel["name"] != second_channel["name"]  # Different channel name due to skip

def test_search_unauthorized(
    test_client: TestClient,
    test_user: User,
    test_db: Session,
    test_search_data: dict
):
    """Test search endpoints with unauthorized user."""
    # Create another user not in any channels
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

    # Override the get_current_user dependency for this test
    async def override_get_current_user():
        return other_user

    app.dependency_overrides[get_current_user] = override_get_current_user
    
    try:
        # Test message search
        response = test_client.get("/api/search/messages?query=test")
        assert response.status_code == 200
        assert len(response.json()) == 0  # No messages found for unauthorized user

        # Test file search
        response = test_client.get("/api/search/files?query=test")
        assert response.status_code == 200
        assert len(response.json()) == 0  # No files found for unauthorized user

        # Test channel search
        response = test_client.get("/api/search/channels?query=test")
        assert response.status_code == 200
        assert len(response.json()) == 0  # No channels found for unauthorized user
    finally:
        # Clean up the override
        app.dependency_overrides.clear()

def test_search_empty_query(
    test_client: TestClient,
    test_user: User,
    test_user_token: str,
    test_search_data: dict
):
    """Test search endpoints with empty query."""
    headers = {"Authorization": f"Bearer {test_user_token}"}
    
    # Test message search with empty query
    response = test_client.get("/api/search/messages?query=", headers=headers)
    assert response.status_code == 200
    assert len(response.json()) == 0

    # Test file search with empty query
    response = test_client.get("/api/search/files?query=", headers=headers)
    assert response.status_code == 200
    assert len(response.json()) == 0

    # Test channel search with empty query
    response = test_client.get("/api/search/channels?query=", headers=headers)
    assert response.status_code == 200
    assert len(response.json()) == 0 