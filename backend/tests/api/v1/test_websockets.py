import pytest
from fastapi import WebSocket, WebSocketDisconnect
from datetime import datetime, UTC
from unittest.mock import AsyncMock, patch, MagicMock
import asyncio
from app.api.v1.websockets import ConnectionManager, presence_websocket, chat_websocket
from app.models.user import User
from app.models.channel import Channel
import time
import logging
from fastapi.security import OAuth2PasswordRequestForm
from app.auth.security import create_access_token
from httpx import AsyncClient
from sqlalchemy.orm import Session
from app.api.v1.websockets import logger, presence_websocket

class MockWebSocket:
    """Mock WebSocket class for testing"""
    def __init__(self):
        self.messages = []  # Outgoing messages
        self.message_queue = []  # Incoming messages
        self.message_received = asyncio.Event()
        self.connected = False
        self.closed = False
        self.close_code = None
        self.receive_side_effect = None
        self.disconnect_after_connect = False
        self.disconnect_after_message = False
        self._logger = logging.getLogger("MockWebSocket")

    @property
    def accepted(self):
        """Alias for connected property"""
        return self.connected

    @property
    def sent_messages(self):
        """Alias for messages property"""
        return self.messages

    async def accept(self):
        self._logger.info("Accepting connection")
        self.connected = True
        if self.disconnect_after_connect:
            self._logger.info("Disconnecting after connect")
            await self.close(1000)
            raise WebSocketDisconnect(code=1000)

    async def close(self, code=1000):
        self._logger.info(f"Closing connection with code {code}")
        self.connected = False
        self.closed = True
        self.close_code = code

    async def send_json(self, data: dict):
        self._logger.info(f"Sending JSON: {data}")
        if not self.connected:
            self._logger.warning("Attempting to send on closed connection")
            raise WebSocketDisconnect(code=1000)
        self.messages.append(data)
        self.message_received.set()
        if self.disconnect_after_message:
            self._logger.info("Disconnecting after message")
            await self.close(1000)
            raise WebSocketDisconnect(code=1000)

    async def receive_json(self):
        self._logger.info("Receiving JSON")
        if not self.connected:
            self._logger.warning("Attempting to receive on closed connection")
            raise WebSocketDisconnect(code=1000)
            
        # If there are messages in the queue, return them first
        if self.message_queue:
            msg = self.message_queue.pop(0)
            self._logger.info(f"Returning queued message: {msg}")
            if self.disconnect_after_message:
                self._logger.info("Disconnecting after message")
                await self.close(1000)
                raise WebSocketDisconnect(code=1000)
            return msg
        
        # Then handle the side effect
        if self.receive_side_effect is not None:
            self._logger.info("Handling receive side effect")
            if isinstance(self.receive_side_effect, Exception):
                raise self.receive_side_effect
            if asyncio.iscoroutine(self.receive_side_effect):
                return await self.receive_side_effect
            return self.receive_side_effect
        
        # Default behavior - disconnect after a few pings to avoid infinite loops
        self._logger.info("No more messages, disconnecting")
        await self.close(1000)
        raise WebSocketDisconnect(code=1000)

    def add_message(self, message):
        """Add a message to the incoming message queue"""
        self._logger.info(f"Adding message to queue: {message}")
        self.message_queue.append(message)

    def set_receive_side_effect(self, effect):
        """Set a side effect (return value or exception) for receive_json"""
        self._logger.info(f"Setting receive side effect: {effect}")
        self.receive_side_effect = effect

    def set_disconnect_after_connect(self, value: bool):
        """Set whether the websocket should disconnect after initial connection"""
        self._logger.info(f"Setting disconnect_after_connect: {value}")
        self.disconnect_after_connect = value

    def set_disconnect_after_message(self, value: bool):
        """Set whether the websocket should disconnect after sending a message"""
        self._logger.info(f"Setting disconnect_after_message: {value}")
        self.disconnect_after_message = value

    async def wait_for_message(self, timeout=1.0):
        """Wait for a message to be received with a timeout"""
        self._logger.info(f"Waiting for message with timeout {timeout}")
        try:
            await asyncio.wait_for(self.message_received.wait(), timeout)
            self.message_received.clear()
            return True
        except asyncio.TimeoutError:
            self._logger.warning("Timeout waiting for message")
            return False

    def get_messages_by_type(self, message_type: str) -> list[dict]:
        """Get all messages of a specific type"""
        messages = [msg for msg in self.messages if msg.get("type") == message_type]
        self._logger.info(f"Getting messages of type {message_type}: {messages}")
        return messages

    async def wait_for_connection(self, timeout=1.0):
        """Wait for the WebSocket connection to be established"""
        self._logger.info(f"Waiting for connection with timeout {timeout}")
        start_time = time.time()
        while not self.connected and time.time() - start_time < timeout:
            await asyncio.sleep(0.1)
        if not self.connected:
            self._logger.warning("Connection timeout")
            raise TimeoutError("WebSocket connection not established")

@pytest.fixture
def manager():
    """Create a new connection manager for each test"""
    return ConnectionManager()

@pytest.fixture
def mock_websocket():
    """Create a mock websocket for testing"""
    return MockWebSocket()

@pytest.fixture
def test_channel(test_db, test_user):
    """Create a test channel with the test user as a member"""
    channel = Channel(
        name="Test Channel",
        description="Test Channel Description",
        created_at=datetime.now(UTC),
        updated_at=datetime.now(UTC)
    )
    channel.members.append(test_user)
    test_db.add(channel)
    test_db.commit()
    test_db.refresh(channel)
    return channel

@pytest.fixture(autouse=True)
def mock_get_current_user_ws():
    """Mock the get_current_user_ws function"""
    async def mock_get_user(token: str, db):
        if token == "invalid_token":
            return None
        # Get the test user from the database
        user = db.query(User).filter(User.is_active == True).first()
        return user

    with patch("app.api.v1.websockets.get_current_user_ws", side_effect=mock_get_user):
        yield

@pytest.mark.asyncio
async def test_connection_manager_connect(manager: ConnectionManager, mock_websocket: MockWebSocket):
    """Test connecting a user to the connection manager"""
    user_id = 1
    await manager.connect(mock_websocket, user_id)

    assert mock_websocket.accepted
    assert user_id in manager.active_connections
    assert manager.active_connections[user_id] == mock_websocket

@pytest.mark.asyncio
async def test_connection_manager_disconnect(manager: ConnectionManager, mock_websocket: MockWebSocket):
    """Test disconnecting a user from the connection manager"""
    user_id = 1
    await manager.connect(mock_websocket, user_id)
    manager.disconnect(user_id)

    assert user_id not in manager.active_connections
    # Check that user is removed from all channels
    for members in manager.channel_members.values():
        assert user_id not in members

@pytest.mark.asyncio
async def test_connection_manager_channel_operations(manager: ConnectionManager, mock_websocket: MockWebSocket):
    """Test channel join and leave operations"""
    user_id = 1
    channel_id = 1

    # Test joining channel
    manager.join_channel(channel_id, user_id)
    assert channel_id in manager.channel_members
    assert user_id in manager.channel_members[channel_id]

    # Test leaving channel
    manager.leave_channel(channel_id, user_id)
    # Channel should be removed since it's empty
    assert channel_id not in manager.channel_members

@pytest.mark.asyncio
async def test_connection_manager_broadcast_to_channel(
    manager: ConnectionManager,
    mock_websocket: MockWebSocket
):
    """Test broadcasting messages to channel members"""
    user_id = 1
    channel_id = 1
    message = {"type": "message", "content": "test"}

    # Connect user and join channel
    await manager.connect(mock_websocket, user_id)
    manager.join_channel(channel_id, user_id)

    # Test broadcasting
    await manager.broadcast_to_channel(channel_id, message)
    assert len(mock_websocket.sent_messages) == 1
    assert mock_websocket.sent_messages[0] == message

@pytest.mark.asyncio
async def test_connection_manager_broadcast_presence(
    manager: ConnectionManager,
    mock_websocket: MockWebSocket
):
    """Test broadcasting presence updates"""
    user_id = 1
    status = "online"

    # Connect user
    await manager.connect(mock_websocket, user_id)

    # Test broadcasting presence
    await manager.broadcast_presence(user_id, status)
    assert len(mock_websocket.sent_messages) == 1
    presence_msg = mock_websocket.sent_messages[0]
    assert presence_msg["type"] == "presence_update"
    assert presence_msg["user_id"] == user_id
    assert presence_msg["status"] == status
    assert "timestamp" in presence_msg

@pytest.mark.asyncio
async def test_connection_manager_multiple_users(
    manager: ConnectionManager
):
    """Test handling multiple user connections"""
    # Create multiple mock websockets
    ws1 = MockWebSocket()
    ws2 = MockWebSocket()
    user1_id = 1
    user2_id = 2
    channel_id = 1

    # Connect both users
    await manager.connect(ws1, user1_id)
    await manager.connect(ws2, user2_id)

    # Join same channel
    manager.join_channel(channel_id, user1_id)
    manager.join_channel(channel_id, user2_id)

    # Test broadcasting to channel
    message = {"type": "message", "content": "test"}
    await manager.broadcast_to_channel(channel_id, message)

    # Verify both users received the message
    assert len(ws1.sent_messages) == 1
    assert len(ws2.sent_messages) == 1
    assert ws1.sent_messages[0] == message
    assert ws2.sent_messages[0] == message 

@pytest.mark.asyncio
async def test_presence_websocket_connect(
    test_client: AsyncClient,
    test_db: Session,
    mock_websocket: MockWebSocket,
    test_user: User,
    caplog
):
    """Test that a user can connect to the presence websocket"""
    caplog.set_level(logging.INFO)
    
    # Set initial status
    test_user.status = "offline"
    test_db.commit()
    test_db.refresh(test_user)
    
    # Configure mock websocket to disconnect after receiving the first message
    mock_websocket.set_disconnect_after_message = True
    
    # Connect to websocket
    token = create_access_token({"sub": str(test_user.id)})
    try:
        await presence_websocket(mock_websocket, token, test_db)
    except WebSocketDisconnect:
        pass  # Expected behavior
    
    # Verify connection was successful and status was updated
    presence_msgs = mock_websocket.get_messages_by_type("presence_update")
    assert len(presence_msgs) >= 1
    assert presence_msgs[0]["status"] == "online"
    assert mock_websocket.closed
    assert mock_websocket.close_code == 1000
    
    # Verify final status is offline after disconnect
    test_db.refresh(test_user)
    assert test_user.status == "offline"

@pytest.mark.asyncio
async def test_presence_websocket_status_update(
    test_db,
    test_user: User,
    test_user_token: str,
    mock_websocket: MockWebSocket
):
    """Test updating status through presence websocket"""
    # Start with offline status
    test_user.status = "offline"
    test_db.commit()
    test_db.flush()
    test_db.refresh(test_user)

    # Set up mock to send status update then disconnect
    mock_websocket.add_message({"type": "status_update", "status": "away"})
    
    # Set up a delayed disconnect
    async def delayed_disconnect():
        await asyncio.sleep(0.1)  # Wait for status update to be processed
        raise WebSocketDisconnect(code=1000)
    
    mock_websocket.set_receive_side_effect(delayed_disconnect())

    try:
        # Start the websocket connection
        await presence_websocket(mock_websocket, test_user_token, test_db)
    except WebSocketDisconnect:
        pass

    # Verify status was updated
    presence_msgs = mock_websocket.get_messages_by_type("presence_update")
    assert len(presence_msgs) >= 2  # Initial "online" and then "away"
    assert presence_msgs[0]["status"] == "online"  # First message should be online
    assert presence_msgs[1]["status"] == "away"  # Second message should be away
    assert presence_msgs[2]["status"] == "offline"  # Third message should be offline

    # Verify database was updated to offline (final state after disconnect)
    test_db.refresh(test_user)  # Refresh the existing user object
    assert test_user.status == "offline"

@pytest.mark.asyncio
async def test_presence_websocket_disconnect(
    test_db,
    test_user: User,
    test_user_token: str,
    mock_websocket: MockWebSocket
):
    """Test disconnecting from presence websocket"""
    # Start with offline status
    test_user.status = "offline"
    test_db.commit()
    test_db.refresh(test_user)
    
    # Set up mock to disconnect with error code
    mock_websocket.set_receive_side_effect(WebSocketDisconnect(code=4000))
    
    try:
        # Start the websocket connection
        await presence_websocket(mock_websocket, test_user_token, test_db)
    except WebSocketDisconnect:
        pass
    
    # Verify presence updates were broadcast
    presence_msgs = mock_websocket.get_messages_by_type("presence_update")
    assert len(presence_msgs) == 2  # Initial "online" and then "offline"
    assert presence_msgs[0]["status"] == "online"
    assert presence_msgs[1]["status"] == "offline"
    
    # Verify user status was updated
    test_db.refresh(test_user)  # Refresh the existing user object
    assert test_user.status == "offline"

@pytest.mark.asyncio
async def test_chat_websocket_connect(
    test_db,
    test_user: User,
    test_user_token: str,
    mock_websocket: MockWebSocket
):
    """Test connecting to chat websocket"""
    # Set up mock to disconnect after connection
    mock_websocket.set_receive_side_effect(WebSocketDisconnect())
    
    try:
        # Connect to websocket
        await chat_websocket(mock_websocket, test_user_token, test_db)
    except WebSocketDisconnect:
        pass
    
    assert mock_websocket.accepted
    assert not mock_websocket.closed

@pytest.mark.asyncio
async def test_chat_websocket_join_channel(
    test_db,
    test_user: User,
    test_channel: Channel,
    test_user_token: str,
    mock_websocket: MockWebSocket
):
    """Test joining a channel through chat websocket"""
    # Add messages to queue
    mock_websocket.add_message({"type": "join_channel", "channel_id": test_channel.id})
    mock_websocket.set_receive_side_effect(WebSocketDisconnect())
    
    try:
        # Start the websocket connection
        await chat_websocket(mock_websocket, test_user_token, test_db)
    except WebSocketDisconnect:
        pass
    
    # Verify join was successful
    join_msgs = mock_websocket.get_messages_by_type("channel_joined")
    assert len(join_msgs) == 1
    assert join_msgs[0]["channel_id"] == test_channel.id

@pytest.mark.asyncio
async def test_chat_websocket_send_message(
    test_db,
    test_user: User,
    test_channel: Channel,
    test_user_token: str,
    mock_websocket: MockWebSocket
):
    """Test sending a message through chat websocket"""
    message_content = "Hello, world!"
    
    # Add messages to queue
    mock_websocket.add_message({"type": "join_channel", "channel_id": test_channel.id})
    mock_websocket.add_message({
        "type": "message",
        "channel_id": test_channel.id,
        "content": message_content
    })
    mock_websocket.set_receive_side_effect(WebSocketDisconnect())
    
    try:
        # Start the websocket connection
        await chat_websocket(mock_websocket, test_user_token, test_db)
    except WebSocketDisconnect:
        pass
    
    # Verify message was broadcast
    chat_msgs = mock_websocket.get_messages_by_type("new_message")
    assert len(chat_msgs) == 1
    assert chat_msgs[0]["message"]["content"] == message_content
    assert chat_msgs[0]["message"]["sender_id"] == test_user.id

@pytest.mark.asyncio
async def test_chat_websocket_unauthorized_channel(
    test_db,
    test_user: User,
    test_channel: Channel,
    test_user_token: str,
    mock_websocket: MockWebSocket
):
    """Test attempting to join an unauthorized channel"""
    # Remove user from channel members
    test_channel.members.remove(test_user)
    test_db.commit()
    
    # Add messages to queue
    mock_websocket.add_message({"type": "join_channel", "channel_id": test_channel.id})
    mock_websocket.set_receive_side_effect(WebSocketDisconnect())
    
    try:
        # Start the websocket connection
        await chat_websocket(mock_websocket, test_user_token, test_db)
    except WebSocketDisconnect:
        pass
    
    # Verify error was received
    error_msgs = mock_websocket.get_messages_by_type("error")
    assert len(error_msgs) == 1
    assert "not authorized" in error_msgs[0]["message"].lower()

@pytest.mark.asyncio
async def test_presence_websocket_invalid_status(
    test_db,
    test_user: User,
    test_user_token: str,
    mock_websocket: MockWebSocket
):
    """Test sending invalid status through presence websocket"""
    # Add invalid status update message
    mock_websocket.add_message({"type": "status_update", "status": "invalid_status"})
    mock_websocket.set_receive_side_effect(WebSocketDisconnect())
    
    try:
        # Start the websocket connection
        await presence_websocket(mock_websocket, test_user_token, test_db)
    except WebSocketDisconnect:
        pass
    
    # Verify error was received
    error_msgs = mock_websocket.get_messages_by_type("error")
    assert len(error_msgs) > 0
    
    # Verify status was not updated to invalid value
    test_db.refresh(test_user)
    assert test_user.status != "invalid_status"

@pytest.mark.asyncio
async def test_chat_websocket_malformed_message(
    test_db,
    test_user: User,
    test_user_token: str,
    mock_websocket: MockWebSocket
):
    """Test sending malformed message through chat websocket"""
    # Add malformed message
    mock_websocket.add_message({"type": "message"})  # Missing required fields
    mock_websocket.set_receive_side_effect(WebSocketDisconnect())
    
    try:
        # Start the websocket connection
        await chat_websocket(mock_websocket, test_user_token, test_db)
    except WebSocketDisconnect:
        pass
    
    # Verify error was received
    error_msgs = mock_websocket.get_messages_by_type("error")
    assert len(error_msgs) > 0

@pytest.mark.asyncio
async def test_chat_websocket_leave_channel(
    test_db,
    test_user: User,
    test_channel: Channel,
    test_user_token: str,
    mock_websocket: MockWebSocket
):
    """Test leaving a channel through chat websocket"""
    # Add join and leave messages
    mock_websocket.add_message({"type": "join_channel", "channel_id": test_channel.id})
    mock_websocket.add_message({"type": "leave_channel", "channel_id": test_channel.id})
    mock_websocket.set_receive_side_effect(WebSocketDisconnect())
    
    try:
        # Start the websocket connection
        await chat_websocket(mock_websocket, test_user_token, test_db)
    except WebSocketDisconnect:
        pass
    
    # Verify join and leave were successful
    join_msgs = mock_websocket.get_messages_by_type("channel_joined")
    leave_msgs = mock_websocket.get_messages_by_type("channel_left")
    assert len(join_msgs) == 1
    assert len(leave_msgs) == 1
    assert join_msgs[0]["channel_id"] == test_channel.id
    assert leave_msgs[0]["channel_id"] == test_channel.id

@pytest.mark.asyncio
async def test_chat_websocket_message_too_long(
    test_db,
    test_user: User,
    test_channel: Channel,
    test_user_token: str,
    mock_websocket: MockWebSocket
):
    """Test sending a message that exceeds length limit"""
    # Create a message that's too long (10KB)
    long_message = "x" * 10240
    
    # Add messages to queue
    mock_websocket.add_message({"type": "join_channel", "channel_id": test_channel.id})
    mock_websocket.add_message({
        "type": "message",
        "channel_id": test_channel.id,
        "content": long_message
    })
    mock_websocket.set_receive_side_effect(WebSocketDisconnect())
    
    try:
        # Start the websocket connection
        await chat_websocket(mock_websocket, test_user_token, test_db)
    except WebSocketDisconnect:
        pass
    
    # Verify error was received
    error_msgs = mock_websocket.get_messages_by_type("error")
    assert len(error_msgs) == 1
    assert any("too long" in msg["message"].lower() for msg in error_msgs)

@pytest.mark.asyncio
async def test_chat_websocket_multiple_channels(
    test_db,
    test_user: User,
    test_channel: Channel,
    test_user_token: str,
    mock_websocket: MockWebSocket
):
    """Test joining and interacting with multiple channels"""
    # Create second channel
    channel2 = Channel(
        name="Test Channel 2",
        description="Second test channel",
        created_at=datetime.now(UTC),
        updated_at=datetime.now(UTC)
    )
    channel2.members.append(test_user)
    test_db.add(channel2)
    test_db.commit()
    test_db.refresh(channel2)
    
    # Add messages for both channels
    mock_websocket.add_message({"type": "join_channel", "channel_id": test_channel.id})
    mock_websocket.add_message({"type": "join_channel", "channel_id": channel2.id})
    mock_websocket.add_message({
        "type": "message",
        "channel_id": test_channel.id,
        "content": "Message to channel 1"
    })
    mock_websocket.add_message({
        "type": "message",
        "channel_id": channel2.id,
        "content": "Message to channel 2"
    })
    mock_websocket.set_receive_side_effect(WebSocketDisconnect())
    
    try:
        # Start the websocket connection
        await chat_websocket(mock_websocket, test_user_token, test_db)
    except WebSocketDisconnect:
        pass
    
    # Verify joins were successful
    join_msgs = mock_websocket.get_messages_by_type("channel_joined")
    assert len(join_msgs) == 2
    
    # Verify messages were sent
    chat_msgs = mock_websocket.get_messages_by_type("new_message")
    assert len(chat_msgs) == 2
    assert any(msg["message"]["content"] == "Message to channel 1" for msg in chat_msgs)
    assert any(msg["message"]["content"] == "Message to channel 2" for msg in chat_msgs)

@pytest.mark.asyncio
async def test_chat_websocket_reconnection(
    test_db,
    test_user: User,
    test_channel: Channel,
    test_user_token: str,
    mock_websocket: MockWebSocket
):
    """Test websocket reconnection behavior"""
    # First connection
    mock_websocket.add_message({"type": "join_channel", "channel_id": test_channel.id})
    mock_websocket.set_disconnect_after_message = True
    
    try:
        # Start first connection
        await chat_websocket(mock_websocket, test_user_token, test_db)
    except WebSocketDisconnect:
        pass
    
    # Verify first connection was successful
    join_msgs = mock_websocket.get_messages_by_type("channel_joined")
    assert len(join_msgs) == 1
    assert join_msgs[0]["channel_id"] == test_channel.id
    
    # Create new mock websocket for reconnection
    mock_websocket2 = MockWebSocket()
    mock_websocket2.add_message({"type": "join_channel", "channel_id": test_channel.id})
    mock_websocket2.set_disconnect_after_message = True
    
    try:
        # Reconnect
        await chat_websocket(mock_websocket2, test_user_token, test_db)
    except WebSocketDisconnect:
        pass
    
    # Verify second connection was successful
    join_msgs2 = mock_websocket2.get_messages_by_type("channel_joined")
    assert len(join_msgs2) == 1
    assert join_msgs2[0]["channel_id"] == test_channel.id 