import pytest
from sqlalchemy.orm import Session
from app.models.user import User
from app.models.channel import Channel
from app.models.message import Message
from app.models.reaction import Reaction
from fastapi.testclient import TestClient
from datetime import datetime, UTC

@pytest.fixture
def test_message_with_reaction(test_db: Session, test_user: User) -> tuple[Message, Reaction]:
    """Create a test message with a reaction for testing."""
    # Create channel
    channel = Channel(
        name="test-channel",
        description="Test channel description",
        is_direct_message=False,
        created_by_id=test_user.id,
        members=[test_user]
    )
    test_db.add(channel)
    test_db.commit()

    # Create message
    message = Message(
        content="Test message",
        channel_id=channel.id,
        sender_id=test_user.id
    )
    test_db.add(message)
    test_db.commit()

    # Create reaction
    reaction = Reaction(
        emoji="👍",
        message_id=message.id,
        user_id=test_user.id
    )
    test_db.add(reaction)
    test_db.commit()
    
    return message, reaction

def test_add_reaction(
    test_client: TestClient,
    test_user: User,
    test_user_token: str,
    test_channel_with_messages: tuple[Channel, list[Message]]
):
    """Test adding a reaction to a message."""
    channel, messages = test_channel_with_messages
    message = messages[0]
    headers = {"Authorization": f"Bearer {test_user_token}"}
    
    response = test_client.post(
        f"/api/messages/{message.id}/reactions",
        headers=headers,
        json={"emoji": "👍"}
    )
    
    assert response.status_code == 200
    data = response.json()
    assert data["emoji"] == "👍"
    assert data["message_id"] == message.id
    assert data["user_id"] == test_user.id

def test_add_duplicate_reaction(
    test_client: TestClient,
    test_user: User,
    test_user_token: str,
    test_message_with_reaction: tuple[Message, Reaction]
):
    """Test adding a duplicate reaction to a message."""
    message, reaction = test_message_with_reaction
    headers = {"Authorization": f"Bearer {test_user_token}"}
    
    response = test_client.post(
        f"/api/messages/{message.id}/reactions",
        headers=headers,
        json={"emoji": "👍"}  # Same emoji as in fixture
    )
    
    assert response.status_code == 400
    assert "Already reacted with this emoji" in response.json()["detail"]

def test_remove_reaction(
    test_client: TestClient,
    test_user: User,
    test_user_token: str,
    test_message_with_reaction: tuple[Message, Reaction]
):
    """Test removing a reaction from a message."""
    message, reaction = test_message_with_reaction
    headers = {"Authorization": f"Bearer {test_user_token}"}
    
    response = test_client.delete(
        f"/api/messages/{message.id}/reactions/{reaction.id}",
        headers=headers
    )
    
    assert response.status_code == 204

    # Verify reaction is deleted
    response = test_client.get(f"/api/messages/{message.id}/reactions", headers=headers)
    assert response.status_code == 200
    data = response.json()
    assert len(data) == 0

def test_remove_nonexistent_reaction(
    test_client: TestClient,
    test_user: User,
    test_user_token: str,
    test_message_with_reaction: tuple[Message, Reaction]
):
    """Test removing a nonexistent reaction."""
    message, _ = test_message_with_reaction
    headers = {"Authorization": f"Bearer {test_user_token}"}
    
    response = test_client.delete(
        f"/api/messages/{message.id}/reactions/999",  # Nonexistent reaction ID
        headers=headers
    )
    
    assert response.status_code == 404
    assert "Reaction not found" in response.json()["detail"]

def test_get_message_reactions(
    test_client: TestClient,
    test_user: User,
    test_user_token: str,
    test_message_with_reaction: tuple[Message, Reaction]
):
    """Test getting all reactions for a message."""
    message, reaction = test_message_with_reaction
    headers = {"Authorization": f"Bearer {test_user_token}"}
    
    response = test_client.get(
        f"/api/messages/{message.id}/reactions",
        headers=headers
    )
    
    assert response.status_code == 200
    data = response.json()
    assert len(data) == 1
    assert data[0]["emoji"] == "👍"
    assert data[0]["message_id"] == message.id
    assert data[0]["user_id"] == test_user.id

def test_get_reactions_unauthorized(
    test_client: TestClient,
    test_user: User,
    test_user_token: str,
    test_db: Session,
    test_message_with_reaction: tuple[Message, Reaction]
):
    """Test getting reactions without channel membership."""
    message, _ = test_message_with_reaction
    
    # Create another user not in the channel
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

    # Create token for other user
    from app.auth.security import create_access_token
    other_token = create_access_token({"sub": str(other_user.id)})
    headers = {"Authorization": f"Bearer {other_token}"}
    
    response = test_client.get(
        f"/api/messages/{message.id}/reactions",
        headers=headers
    )
    
    assert response.status_code == 403
    assert "Not authorized" in response.json()["detail"]

def test_add_reaction_to_nonexistent_message(
    test_client: TestClient,
    test_user: User,
    test_user_token: str
):
    """Test adding a reaction to a nonexistent message."""
    headers = {"Authorization": f"Bearer {test_user_token}"}
    
    response = test_client.post(
        "/api/messages/999/reactions",  # Nonexistent message ID
        headers=headers,
        json={"emoji": "👍"}
    )
    
    assert response.status_code == 404
    assert "Message not found" in response.json()["detail"] 