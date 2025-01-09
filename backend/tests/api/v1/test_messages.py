import pytest
from sqlalchemy.orm import Session
from app.models.user import User
from app.models.channel import Channel
from app.models.message import Message
from fastapi.testclient import TestClient
from datetime import datetime, UTC

@pytest.fixture
def test_channel_with_messages(test_db: Session, test_user: User) -> tuple[Channel, list[Message]]:
    """Create a test channel with multiple messages for testing."""
    channel = Channel(
        name="test-channel",
        description="Test channel description",
        is_direct_message=False,
        created_by_id=test_user.id,
        members=[test_user]
    )
    test_db.add(channel)
    test_db.commit()

    messages = []
    for i in range(3):
        message = Message(
            content=f"Test message {i}",
            channel_id=channel.id,
            sender_id=test_user.id
        )
        test_db.add(message)
        messages.append(message)
    test_db.commit()
    
    return channel, messages

def test_get_channel_messages(
    test_client: TestClient,
    test_user: User,
    test_user_token: str,
    test_channel_with_messages: tuple[Channel, list[Message]]
):
    """Test getting messages from a channel."""
    channel, messages = test_channel_with_messages
    headers = {"Authorization": f"Bearer {test_user_token}"}
    
    response = test_client.get(f"/api/channels/{channel.id}/messages", headers=headers)
    assert response.status_code == 200
    data = response.json()
    
    assert len(data) == 3
    assert all(msg["channel_id"] == channel.id for msg in data)
    assert all(msg["sender_id"] == test_user.id for msg in data)

def test_get_channel_messages_pagination(
    test_client: TestClient,
    test_user: User,
    test_user_token: str,
    test_db: Session,
    test_channel_with_messages: tuple[Channel, list[Message]]
):
    """Test pagination in get_channel_messages endpoint."""
    channel, _ = test_channel_with_messages
    
    # Create additional messages for pagination testing
    for i in range(5):
        message = Message(
            content=f"Pagination test message {i}",
            channel_id=channel.id,
            sender_id=test_user.id
        )
        test_db.add(message)
    test_db.commit()

    headers = {"Authorization": f"Bearer {test_user_token}"}
    
    # Test first page
    response = test_client.get(
        f"/api/channels/{channel.id}/messages?skip=0&limit=3",
        headers=headers
    )
    assert response.status_code == 200
    data = response.json()
    assert len(data) == 3
    
    # Test second page
    response = test_client.get(
        f"/api/channels/{channel.id}/messages?skip=3&limit=3",
        headers=headers
    )
    assert response.status_code == 200
    data = response.json()
    assert len(data) == 3

def test_create_message(
    test_client: TestClient,
    test_user: User,
    test_user_token: str,
    test_channel_with_messages: tuple[Channel, list[Message]]
):
    """Test creating a new message in a channel."""
    channel, _ = test_channel_with_messages
    headers = {"Authorization": f"Bearer {test_user_token}"}
    
    message_content = "New test message"
    response = test_client.post(
        f"/api/channels/{channel.id}/messages",
        headers=headers,
        json={"content": message_content}
    )
    
    assert response.status_code == 200
    data = response.json()
    assert data["content"] == message_content
    assert data["channel_id"] == channel.id
    assert data["sender_id"] == test_user.id

def test_update_message(
    test_client: TestClient,
    test_user: User,
    test_user_token: str,
    test_channel_with_messages: tuple[Channel, list[Message]]
):
    """Test updating a message."""
    _, messages = test_channel_with_messages
    message = messages[0]
    headers = {"Authorization": f"Bearer {test_user_token}"}
    
    updated_content = "Updated message content"
    response = test_client.put(
        f"/api/messages/{message.id}",
        headers=headers,
        json={"content": updated_content}
    )
    
    assert response.status_code == 200
    data = response.json()
    assert data["content"] == updated_content
    assert data["id"] == message.id

def test_delete_message(
    test_client: TestClient,
    test_user: User,
    test_user_token: str,
    test_channel_with_messages: tuple[Channel, list[Message]]
):
    """Test deleting a message."""
    _, messages = test_channel_with_messages
    message = messages[0]
    headers = {"Authorization": f"Bearer {test_user_token}"}
    
    response = test_client.delete(f"/api/messages/{message.id}", headers=headers)
    assert response.status_code == 204
    
    # Verify message is deleted
    response = test_client.get(f"/api/messages/{message.id}", headers=headers)
    assert response.status_code == 404

def test_get_message_replies(
    test_client: TestClient,
    test_user: User,
    test_user_token: str,
    test_db: Session,
    test_channel_with_messages: tuple[Channel, list[Message]]
):
    """Test getting replies to a message."""
    channel, messages = test_channel_with_messages
    parent_message = messages[0]
    
    # Create some reply messages
    replies = []
    for i in range(3):
        reply = Message(
            content=f"Reply message {i}",
            channel_id=channel.id,
            sender_id=test_user.id,
            parent_id=parent_message.id
        )
        test_db.add(reply)
        replies.append(reply)
    test_db.commit()

    headers = {"Authorization": f"Bearer {test_user_token}"}
    response = test_client.get(f"/api/messages/{parent_message.id}/replies", headers=headers)
    
    assert response.status_code == 200
    data = response.json()
    assert len(data) == 3
    assert all(reply["parent_id"] == parent_message.id for reply in data)

def test_create_message_reply(
    test_client: TestClient,
    test_user: User,
    test_user_token: str,
    test_channel_with_messages: tuple[Channel, list[Message]]
):
    """Test creating a reply to a message."""
    channel, messages = test_channel_with_messages
    parent_message = messages[0]
    headers = {"Authorization": f"Bearer {test_user_token}"}
    
    reply_content = "Test reply message"
    response = test_client.post(
        f"/api/messages/{parent_message.id}/replies",
        headers=headers,
        json={"content": reply_content}
    )
    
    assert response.status_code == 200
    data = response.json()
    assert data["content"] == reply_content
    assert data["parent_id"] == parent_message.id
    assert data["channel_id"] == channel.id
    assert data["sender_id"] == test_user.id

def test_get_message_thread(
    test_client: TestClient,
    test_user: User,
    test_user_token: str,
    test_db: Session,
    test_channel_with_messages: tuple[Channel, list[Message]]
):
    """Test getting a message thread (parent message and all replies)."""
    channel, messages = test_channel_with_messages
    parent_message = messages[0]
    
    # Create some reply messages
    for i in range(3):
        reply = Message(
            content=f"Thread reply {i}",
            channel_id=channel.id,
            sender_id=test_user.id,
            parent_id=parent_message.id
        )
        test_db.add(reply)
    test_db.commit()

    headers = {"Authorization": f"Bearer {test_user_token}"}
    response = test_client.get(f"/api/messages/{parent_message.id}/thread", headers=headers)
    
    assert response.status_code == 200
    data = response.json()
    assert len(data) == 4  # Parent message + 3 replies
    assert data[0]["id"] == parent_message.id  # First message should be parent
    assert all(msg["channel_id"] == channel.id for msg in data)

def test_unauthorized_access(
    test_client: TestClient,
    test_user: User,
    test_user_token: str,
    test_db: Session
):
    """Test accessing messages in a channel without being a member."""
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

    # Create a message in the private channel
    message = Message(
        content="Private message",
        channel_id=channel.id,
        sender_id=other_user.id
    )
    test_db.add(message)
    test_db.commit()

    headers = {"Authorization": f"Bearer {test_user_token}"}
    
    # Try to get messages
    response = test_client.get(f"/api/channels/{channel.id}/messages", headers=headers)
    assert response.status_code == 403
    
    # Try to create message
    response = test_client.post(
        f"/api/channels/{channel.id}/messages",
        headers=headers,
        json={"content": "Test message"}
    )
    assert response.status_code == 403

def test_update_message_unauthorized(
    test_client: TestClient,
    test_user: User,
    test_user_token: str,
    test_db: Session
):
    """Test updating a message without proper authorization."""
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
    
    # Create a channel with both users
    channel = Channel(
        name="shared-channel",
        description="Shared channel",
        is_direct_message=False,
        created_by_id=other_user.id,
        members=[other_user, test_user]
    )
    test_db.add(channel)
    test_db.commit()

    # Create a message by other_user
    message = Message(
        content="Other user's message",
        channel_id=channel.id,
        sender_id=other_user.id
    )
    test_db.add(message)
    test_db.commit()

    # Try to update other user's message
    headers = {"Authorization": f"Bearer {test_user_token}"}
    response = test_client.put(
        f"/api/messages/{message.id}",
        headers=headers,
        json={"content": "Modified content"}
    )
    assert response.status_code == 403

def test_delete_message_unauthorized(
    test_client: TestClient,
    test_user: User,
    test_user_token: str,
    test_db: Session
):
    """Test deleting a message without proper authorization."""
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
    
    # Create a channel with both users
    channel = Channel(
        name="shared-channel",
        description="Shared channel",
        is_direct_message=False,
        created_by_id=other_user.id,
        members=[other_user, test_user]
    )
    test_db.add(channel)
    test_db.commit()

    # Create a message by other_user
    message = Message(
        content="Other user's message",
        channel_id=channel.id,
        sender_id=other_user.id
    )
    test_db.add(message)
    test_db.commit()

    # Try to delete other user's message
    headers = {"Authorization": f"Bearer {test_user_token}"}
    response = test_client.delete(f"/api/messages/{message.id}", headers=headers)
    assert response.status_code == 403

def test_create_message_empty_content(
    test_client: TestClient,
    test_user: User,
    test_user_token: str,
    test_channel_with_messages: tuple[Channel, list[Message]]
):
    """Test creating a message with empty content."""
    channel, _ = test_channel_with_messages
    headers = {"Authorization": f"Bearer {test_user_token}"}
    
    response = test_client.post(
        f"/api/channels/{channel.id}/messages",
        headers=headers,
        json={"content": ""}
    )
    assert response.status_code == 422

def test_update_message_empty_content(
    test_client: TestClient,
    test_user: User,
    test_user_token: str,
    test_channel_with_messages: tuple[Channel, list[Message]]
):
    """Test updating a message with empty content."""
    _, messages = test_channel_with_messages
    message = messages[0]
    headers = {"Authorization": f"Bearer {test_user_token}"}
    
    response = test_client.put(
        f"/api/messages/{message.id}",
        headers=headers,
        json={"content": ""}
    )
    assert response.status_code == 422 