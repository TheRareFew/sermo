import pytest
from fastapi.testclient import TestClient
from app.models.channel import Channel
from app.models.user import User

def test_create_channel(test_client: TestClient):
    """Test creating a new channel."""
    response = test_client.post("/api/v1/channels/", json={"name": "test-channel", "description": "Test channel"})
    assert response.status_code == 201
    data = response.json()
    assert data["name"] == "test-channel"
    assert data["description"] == "Test channel"

def test_get_channels(test_client: TestClient):
    """Test retrieving all channels."""
    response = test_client.get("/api/v1/channels/")
    assert response.status_code == 200
    data = response.json()
    assert isinstance(data, list)

def test_get_channel(test_client: TestClient):
    """Test retrieving a specific channel."""
    # First create a channel
    create_response = test_client.post("/api/v1/channels/", json={"name": "test-channel", "description": "Test channel"})
    channel_id = create_response.json()["id"]

    # Then retrieve it
    response = test_client.get(f"/api/v1/channels/{channel_id}")
    assert response.status_code == 200
    data = response.json()
    assert data["id"] == channel_id
    assert data["name"] == "test-channel"

def test_update_channel(test_client: TestClient):
    """Test updating a channel."""
    # First create a channel
    create_response = test_client.post("/api/v1/channels/", json={"name": "test-channel", "description": "Test channel"})
    channel_id = create_response.json()["id"]

    # Then update it
    response = test_client.put(
        f"/api/v1/channels/{channel_id}",
        json={"name": "updated-channel", "description": "Updated description"}
    )
    assert response.status_code == 200
    data = response.json()
    assert data["name"] == "updated-channel"
    assert data["description"] == "Updated description"

def test_delete_channel(test_client: TestClient):
    """Test deleting a channel."""
    # First create a channel
    create_response = test_client.post("/api/v1/channels/", json={"name": "test-channel", "description": "Test channel"})
    channel_id = create_response.json()["id"]

    # Then delete it
    response = test_client.delete(f"/api/v1/channels/{channel_id}")
    assert response.status_code == 204

    # Verify it's deleted
    get_response = test_client.get(f"/api/v1/channels/{channel_id}")
    assert get_response.status_code == 404

def test_add_channel_member(test_client: TestClient):
    """Test adding a member to a channel."""
    # First create a channel
    create_response = test_client.post("/api/v1/channels/", json={"name": "test-channel", "description": "Test channel"})
    channel_id = create_response.json()["id"]

    # Add a member
    response = test_client.post(f"/api/v1/channels/{channel_id}/members", json={"user_id": 2})
    assert response.status_code == 201

def test_remove_channel_member(test_client: TestClient):
    """Test removing a member from a channel."""
    # First create a channel
    create_response = test_client.post("/api/v1/channels/", json={"name": "test-channel", "description": "Test channel"})
    channel_id = create_response.json()["id"]

    # Add a member
    test_client.post(f"/api/v1/channels/{channel_id}/members", json={"user_id": 2})

    # Remove the member
    response = test_client.delete(f"/api/v1/channels/{channel_id}/members/2")
    assert response.status_code == 204

def test_get_channel_members(test_client: TestClient):
    """Test retrieving channel members."""
    # First create a channel
    create_response = test_client.post("/api/v1/channels/", json={"name": "test-channel", "description": "Test channel"})
    channel_id = create_response.json()["id"]

    # Add a member
    test_client.post(f"/api/v1/channels/{channel_id}/members", json={"user_id": 2})

    # Get members
    response = test_client.get(f"/api/v1/channels/{channel_id}/members")
    assert response.status_code == 200
    data = response.json()
    assert isinstance(data, list)
    assert len(data) > 0

def test_get_nonexistent_channel(test_client: TestClient):
    """Test retrieving a nonexistent channel."""
    response = test_client.get("/api/v1/channels/999999")
    assert response.status_code == 404

def test_update_channel_unauthorized(test_client: TestClient):
    """Test updating a channel without proper authorization."""
    # First create a channel
    create_response = test_client.post("/api/v1/channels/", json={"name": "test-channel", "description": "Test channel"})
    channel_id = create_response.json()["id"]

    # Try to update it with a different user
    # TODO: Implement proper authentication in tests
    response = test_client.put(
        f"/api/v1/channels/{channel_id}",
        json={"name": "updated-channel", "description": "Updated description"},
        headers={"X-User-ID": "999"}  # Different user ID
    )
    assert response.status_code == 403 