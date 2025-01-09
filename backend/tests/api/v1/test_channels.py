import pytest
from sqlalchemy.orm import Session
from app.models.user import User
from app.models.channel import Channel
from fastapi.testclient import TestClient
from datetime import datetime, UTC

def test_create_channel(test_client: TestClient, test_user: User, test_user_token: str):
    """Test creating a new channel."""
    headers = {"Authorization": f"Bearer {test_user_token}"}
    response = test_client.post(
        "/api/channels",
        headers=headers,
        json={
            "name": "test-channel",
            "description": "Test channel description",
            "is_direct_message": False,
            "member_ids": []
        }
    )
    assert response.status_code == 201
    data = response.json()
    assert data["name"] == "test-channel"
    assert data["description"] == "Test channel description"
    assert data["is_direct_message"] == False
    assert data["created_by_id"] == test_user.id

def test_get_channels(test_client: TestClient, test_user: User, test_user_token: str, test_db: Session):
    """Test getting all channels for a user."""
    # Create a test channel
    channel = Channel(
        name="test-channel",
        description="Test channel description",
        is_direct_message=False,
        created_by_id=test_user.id,
        members=[test_user]
    )
    test_db.add(channel)
    test_db.commit()

    headers = {"Authorization": f"Bearer {test_user_token}"}
    response = test_client.get("/api/channels", headers=headers)
    assert response.status_code == 200
    data = response.json()
    assert len(data) > 0
    assert data[0]["name"] == "test-channel"

def test_get_channel(test_client: TestClient, test_user: User, test_user_token: str, test_db: Session):
    """Test getting a specific channel."""
    # Create a test channel
    channel = Channel(
        name="test-channel",
        description="Test channel description",
        is_direct_message=False,
        created_by_id=test_user.id,
        members=[test_user]
    )
    test_db.add(channel)
    test_db.commit()

    headers = {"Authorization": f"Bearer {test_user_token}"}
    response = test_client.get(f"/api/channels/{channel.id}", headers=headers)
    assert response.status_code == 200
    data = response.json()
    assert data["name"] == "test-channel"
    assert data["description"] == "Test channel description"

def test_update_channel(test_client: TestClient, test_user: User, test_user_token: str, test_db: Session):
    """Test updating a channel."""
    # Create a test channel
    channel = Channel(
        name="test-channel",
        description="Test channel description",
        is_direct_message=False,
        created_by_id=test_user.id,
        members=[test_user]
    )
    test_db.add(channel)
    test_db.commit()

    headers = {"Authorization": f"Bearer {test_user_token}"}
    response = test_client.put(
        f"/api/channels/{channel.id}",
        headers=headers,
        json={
            "name": "updated-channel",
            "description": "Updated description"
        }
    )
    assert response.status_code == 200
    data = response.json()
    assert data["name"] == "updated-channel"
    assert data["description"] == "Updated description"

def test_delete_channel(test_client: TestClient, test_user: User, test_user_token: str, test_db: Session):
    """Test deleting a channel."""
    # Create a test channel
    channel = Channel(
        name="test-channel",
        description="Test channel description",
        is_direct_message=False,
        created_by_id=test_user.id,
        members=[test_user]
    )
    test_db.add(channel)
    test_db.commit()

    headers = {"Authorization": f"Bearer {test_user_token}"}
    response = test_client.delete(f"/api/channels/{channel.id}", headers=headers)
    assert response.status_code == 204

    # Verify the channel is deleted
    response = test_client.get(f"/api/channels/{channel.id}", headers=headers)
    assert response.status_code == 404

def test_add_channel_member(test_client: TestClient, test_user: User, test_user_token: str, test_db: Session):
    """Test adding a member to a channel."""
    # Create another user to add to the channel
    new_member = User(
        username="newmember",
        email="newmember@example.com",
        full_name="New Member",
        hashed_password="dummyhash",
        is_active=True,
        created_at=datetime.now(UTC),
        updated_at=datetime.now(UTC)
    )
    test_db.add(new_member)
    test_db.commit()

    # Create a test channel
    channel = Channel(
        name="test-channel",
        description="Test channel description",
        is_direct_message=False,
        created_by_id=test_user.id,
        members=[test_user]
    )
    test_db.add(channel)
    test_db.commit()

    headers = {"Authorization": f"Bearer {test_user_token}"}
    response = test_client.post(
        f"/api/channels/{channel.id}/members",
        headers=headers,
        json={"user_id": new_member.id}
    )
    assert response.status_code == 204

    # Verify the member was added
    response = test_client.get(f"/api/channels/{channel.id}/members", headers=headers)
    assert response.status_code == 200
    data = response.json()
    assert len(data) == 2
    member_ids = [member["id"] for member in data]
    assert new_member.id in member_ids
    assert test_user.id in member_ids

def test_remove_channel_member(test_client: TestClient, test_user: User, test_user_token: str, test_db: Session):
    """Test removing a member from a channel."""
    # Create another user to remove from the channel
    member_to_remove = User(
        username="membertoremove",
        email="membertoremove@example.com",
        full_name="Member To Remove",
        hashed_password="dummyhash",
        is_active=True
    )
    test_db.add(member_to_remove)
    test_db.commit()

    # Create a test channel with both users as members
    channel = Channel(
        name="test-channel",
        description="Test channel description",
        is_direct_message=False,
        created_by_id=test_user.id,
        members=[test_user, member_to_remove]
    )
    test_db.add(channel)
    test_db.commit()

    headers = {"Authorization": f"Bearer {test_user_token}"}
    response = test_client.delete(
        f"/api/channels/{channel.id}/members/{member_to_remove.id}",
        headers=headers
    )
    assert response.status_code == 204

    # Verify the member is removed
    response = test_client.get(f"/api/channels/{channel.id}/members", headers=headers)
    assert response.status_code == 200
    data = response.json()
    member_ids = [member["id"] for member in data]
    assert member_to_remove.id not in member_ids

def test_get_channel_members(test_client: TestClient, test_user: User, test_user_token: str, test_db: Session):
    """Test getting all members of a channel."""
    # Create a test channel
    channel = Channel(
        name="test-channel",
        description="Test channel description",
        is_direct_message=False,
        created_by_id=test_user.id,
        members=[test_user]
    )
    test_db.add(channel)
    test_db.commit()

    headers = {"Authorization": f"Bearer {test_user_token}"}
    response = test_client.get(f"/api/channels/{channel.id}/members", headers=headers)
    assert response.status_code == 200
    data = response.json()
    assert len(data) == 1
    assert data[0]["id"] == test_user.id

def test_get_nonexistent_channel(test_client: TestClient, test_user: User, test_user_token: str):
    """Test getting a channel that doesn't exist."""
    headers = {"Authorization": f"Bearer {test_user_token}"}
    response = test_client.get("/api/channels/999", headers=headers)
    assert response.status_code == 404

def test_update_channel_unauthorized(test_client: TestClient, test_user: User, test_user_token: str, test_db: Session):
    """Test updating a channel without proper authorization."""
    # Create another user as the channel creator
    other_user = User(
        username="otheruser",
        email="other@example.com",
        full_name="Other User",
        hashed_password="dummyhash",
        is_active=True
    )
    test_db.add(other_user)
    test_db.commit()

    # Create a channel owned by the other user
    channel = Channel(
        name="test-channel",
        description="Test channel description",
        is_direct_message=False,
        created_by_id=other_user.id,
        members=[test_user, other_user]
    )
    test_db.add(channel)
    test_db.commit()

    headers = {"Authorization": f"Bearer {test_user_token}"}
    response = test_client.put(
        f"/api/channels/{channel.id}",
        headers=headers,
        json={"name": "updated-channel"}
    )
    assert response.status_code == 403 

def test_create_channel_with_invalid_members(test_client: TestClient, test_user: User, test_user_token: str):
    """Test creating a channel with invalid member IDs."""
    headers = {"Authorization": f"Bearer {test_user_token}"}
    response = test_client.post(
        "/api/channels",
        headers=headers,
        json={
            "name": "test-channel",
            "description": "Test channel description",
            "is_direct_message": False,
            "member_ids": [999]  # Non-existent user ID
        }
    )
    assert response.status_code == 404
    assert "One or more member IDs not found" in response.json()["detail"]

def test_add_existing_member(test_client: TestClient, test_user: User, test_user_token: str, test_db: Session):
    """Test adding a member who is already in the channel."""
    # Create a test channel with test_user as member
    channel = Channel(
        name="test-channel",
        description="Test channel description",
        is_direct_message=False,
        created_by_id=test_user.id,
        members=[test_user]
    )
    test_db.add(channel)
    test_db.commit()

    headers = {"Authorization": f"Bearer {test_user_token}"}
    response = test_client.post(
        f"/api/channels/{channel.id}/members",
        headers=headers,
        json={"user_id": test_user.id}  # Try to add the same user again
    )
    assert response.status_code == 204  # Should be idempotent

def test_get_channels_pagination(test_client: TestClient, test_user: User, test_user_token: str, test_db: Session):
    """Test pagination in get_channels endpoint."""
    # Create multiple test channels
    for i in range(5):
        channel = Channel(
            name=f"test-channel-{i}",
            description=f"Test channel description {i}",
            is_direct_message=False,
            created_by_id=test_user.id,
            members=[test_user]
        )
        test_db.add(channel)
    test_db.commit()

    headers = {"Authorization": f"Bearer {test_user_token}"}
    
    # Test first page
    response = test_client.get("/api/channels?skip=0&limit=2", headers=headers)
    assert response.status_code == 200
    data = response.json()
    assert len(data) == 2
    assert data[0]["name"] == "test-channel-0"
    assert data[1]["name"] == "test-channel-1"

    # Test second page
    response = test_client.get("/api/channels?skip=2&limit=2", headers=headers)
    assert response.status_code == 200
    data = response.json()
    assert len(data) == 2
    assert data[0]["name"] == "test-channel-2"
    assert data[1]["name"] == "test-channel-3"

def test_create_channel_empty_name(test_client: TestClient, test_user: User, test_user_token: str):
    """Test creating a channel with an empty name."""
    headers = {"Authorization": f"Bearer {test_user_token}"}
    response = test_client.post(
        "/api/channels",
        headers=headers,
        json={
            "name": "",  # Empty name
            "description": "Test channel description",
            "is_direct_message": False,
            "member_ids": []
        }
    )
    assert response.status_code == 422  # Validation error
    data = response.json()
    assert "name" in str(data["detail"])  # Error should mention the name field

def test_update_channel_no_changes(test_client: TestClient, test_user: User, test_user_token: str, test_db: Session):
    """Test updating a channel without any changes."""
    # Create a test channel
    channel = Channel(
        name="test-channel",
        description="Test channel description",
        is_direct_message=False,
        created_by_id=test_user.id,
        members=[test_user]
    )
    test_db.add(channel)
    test_db.commit()

    headers = {"Authorization": f"Bearer {test_user_token}"}
    response = test_client.put(
        f"/api/channels/{channel.id}",
        headers=headers,
        json={}  # Empty update
    )
    assert response.status_code == 200
    data = response.json()
    assert data["name"] == "test-channel"  # Name should remain unchanged
    assert data["description"] == "Test channel description"  # Description should remain unchanged 

def test_create_channel_whitespace_name(test_client: TestClient, test_user: User, test_user_token: str):
    """Test creating a channel with a whitespace-only name."""
    headers = {"Authorization": f"Bearer {test_user_token}"}
    response = test_client.post(
        "/api/channels",
        headers=headers,
        json={
            "name": "   ",  # Whitespace-only name
            "description": "Test channel description",
            "is_direct_message": False,
            "member_ids": []
        }
    )
    assert response.status_code == 422  # Validation error
    data = response.json()
    assert "name" in str(data["detail"])  # Error should mention the name field 