from fastapi import APIRouter, WebSocket, WebSocketDisconnect, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import Dict, Set, Optional
import json
import logging
from datetime import datetime, UTC
from pydantic import BaseModel, Field, ValidationError
import asyncio

from ...models.user import User
from ...models.channel import Channel
from ...models.message import Message as MessageModel
from ..deps import get_db, get_current_user
from ...schemas.message import MessageCreate
from .messages import create_message

router = APIRouter()
logger = logging.getLogger(__name__)

# Constants
MAX_MESSAGE_LENGTH = 4096  # 4KB max message length
VALID_STATUS_VALUES = {"online", "offline", "away", "busy"}

# Pydantic models for WebSocket messages
class StatusUpdateMessage(BaseModel):
    type: str = Field("status_update")
    status: str

class ChannelJoinMessage(BaseModel):
    type: str = Field("join_channel")
    channel_id: int

class ChannelLeaveMessage(BaseModel):
    type: str = Field("leave_channel")
    channel_id: int

class ChatMessage(BaseModel):
    type: str = Field("message")
    channel_id: int
    content: str = Field(..., max_length=MAX_MESSAGE_LENGTH)

class ConnectionManager:
    def __init__(self):
        # user_id -> WebSocket
        self.active_connections: Dict[int, WebSocket] = {}
        # channel_id -> Set[user_id]
        self.channel_members: Dict[int, Set[int]] = {}
        # channel_id -> Dict[user_id, WebSocket]
        self.channel_connections: Dict[int, Dict[int, WebSocket]] = {}
        logger.debug("ConnectionManager initialized")
    
    async def connect(self, websocket: WebSocket, user_id: int):
        try:
            logger.debug(f"Accepting WebSocket connection for user {user_id}")
            await websocket.accept()
            logger.debug(f"WebSocket connection accepted for user {user_id}")
            
            # If user already has a connection, close it and clean up
            if user_id in self.active_connections:
                logger.debug(f"User {user_id} already has an active connection, cleaning up old connection")
                old_ws = self.active_connections[user_id]
                try:
                    await old_ws.close()
                except Exception as e:
                    logger.error(f"Error closing existing connection for user {user_id}: {str(e)}")
                
                # Remove old connection from all channels
                for channel_id, connections in self.channel_connections.items():
                    if user_id in connections:
                        del connections[user_id]
            
            self.active_connections[user_id] = websocket
            logger.debug(f"User {user_id} added to active connections")
        except Exception as e:
            logger.error(f"Error in connect for user {user_id}: {str(e)}")
            raise
    
    def disconnect(self, user_id: int):
        try:
            if user_id in self.active_connections:
                logger.debug(f"Removing user {user_id} from active connections")
                del self.active_connections[user_id]
            
            # Remove user from all channels
            for channel_id in list(self.channel_members.keys()):
                if user_id in self.channel_members[channel_id]:
                    logger.debug(f"Removing user {user_id} from channel {channel_id}")
                    self.channel_members[channel_id].discard(user_id)
                    if channel_id in self.channel_connections and user_id in self.channel_connections[channel_id]:
                        del self.channel_connections[channel_id][user_id]
                    
                    # Clean up empty channels
                    if not self.channel_members[channel_id]:
                        del self.channel_members[channel_id]
                        if channel_id in self.channel_connections:
                            del self.channel_connections[channel_id]
        except Exception as e:
            logger.error(f"Error in disconnect for user {user_id}: {str(e)}")
    
    async def join_channel(self, channel_id: int, user_id: int, websocket: WebSocket):
        """Add a user to a channel"""
        try:
            logger.debug(f"Adding user {user_id} to channel {channel_id}")
            
            # Add to channel members
            if channel_id not in self.channel_members:
                self.channel_members[channel_id] = set()
            self.channel_members[channel_id].add(user_id)
            
            # Add to channel connections
            if channel_id not in self.channel_connections:
                self.channel_connections[channel_id] = {}
            self.channel_connections[channel_id][user_id] = websocket
            
            await websocket.send_json({
                "type": "channel_joined",
                "channel_id": channel_id
            })
            logger.debug(f"User {user_id} successfully joined channel {channel_id}")
        except Exception as e:
            logger.error(f"Error joining channel {channel_id} for user {user_id}: {str(e)}")
            raise
    
    async def broadcast_to_channel(self, channel_id: int, message: dict):
        """Send a message to all users in a channel"""
        try:
            if channel_id in self.channel_connections:
                # Create a list of users to remove if their connection is stale
                users_to_remove = []
                
                # Try to send to each connection
                for user_id, ws in self.channel_connections[channel_id].items():
                    try:
                        await ws.send_json(message)
                    except Exception as e:
                        logger.error(f"Error sending message to user {user_id} in channel {channel_id}: {str(e)}")
                        users_to_remove.append(user_id)
                
                # Clean up stale connections
                for user_id in users_to_remove:
                    logger.debug(f"Removing stale connection for user {user_id} from channel {channel_id}")
                    if user_id in self.channel_connections[channel_id]:
                        del self.channel_connections[channel_id][user_id]
                    if user_id in self.channel_members[channel_id]:
                        self.channel_members[channel_id].discard(user_id)
        except Exception as e:
            logger.error(f"Error broadcasting to channel {channel_id}: {str(e)}")

    def leave_channel(self, channel_id: int, user_id: int):
        try:
            if channel_id in self.channel_members:
                self.channel_members[channel_id].discard(user_id)
                if channel_id in self.channel_connections and user_id in self.channel_connections[channel_id]:
                    del self.channel_connections[channel_id][user_id]
                
                # Clean up empty channels
                if not self.channel_members[channel_id]:
                    del self.channel_members[channel_id]
                    if channel_id in self.channel_connections:
                        del self.channel_connections[channel_id]
        except Exception as e:
            logger.error(f"Error in leave_channel for user {user_id}, channel {channel_id}: {str(e)}")
    
    async def broadcast_presence(self, user_id: int, status: str):
        message = {
            "type": "presence_update",
            "user_id": user_id,
            "status": status,
            "timestamp": datetime.utcnow().isoformat()
        }
        for connection in self.active_connections.values():
            await connection.send_json(message)

manager = ConnectionManager()

@router.websocket("/presence")
async def presence_websocket(
    websocket: WebSocket,
    token: str,
    db: Session = Depends(get_db)
):
    """WebSocket endpoint for presence updates"""
    try:
        # Authenticate user
        user = await get_current_user_ws(token, db)
        if not user:
            await websocket.close(code=4001)
            return

        # Update user's status to online using the provided session
        user.status = "online"
        user.last_seen = datetime.utcnow()
        db.commit()
        db.refresh(user)

        # Connect and broadcast initial status
        await manager.connect(websocket, user.id)
        await manager.broadcast_presence(user.id, "online")
        
        try:
            while True:
                # Wait for presence updates
                data = await websocket.receive_json()
                try:
                    status_msg = StatusUpdateMessage(**data)
                    if status_msg.status in VALID_STATUS_VALUES:
                        # Update status in database using the provided session
                        user.status = status_msg.status
                        user.last_seen = datetime.utcnow()
                        db.commit()
                        db.refresh(user)
                        
                        # Then broadcast the update
                        await manager.broadcast_presence(user.id, status_msg.status)
                    else:
                        await websocket.send_json({
                            "type": "error",
                            "message": f"Invalid status value. Must be one of: {', '.join(VALID_STATUS_VALUES)}"
                        })
                except ValidationError as e:
                    await websocket.send_json({
                        "type": "error",
                        "message": "Invalid status update message format"
                    })
        
        except WebSocketDisconnect as e:
            # Set status to offline on any disconnect
            user.status = "offline"
            user.last_seen = datetime.utcnow()
            db.commit()
            db.refresh(user)
            await manager.broadcast_presence(user.id, "offline")
            manager.disconnect(user.id)
            # Re-raise the exception with the original code
            raise WebSocketDisconnect(e.code)
        
        except Exception as e:
            # Set status to offline on error
            user.status = "offline"
            user.last_seen = datetime.utcnow()
            db.commit()
            db.refresh(user)
            await manager.broadcast_presence(user.id, "offline")
            manager.disconnect(user.id)
            await websocket.close(code=4000)
            return
    
    except WebSocketDisconnect as e:
        # Re-raise the exception with the original code
        raise
    except Exception as e:
        await websocket.close(code=4000)
        return

@router.websocket("/chat")
async def chat_websocket(
    websocket: WebSocket,
    token: str,
    db: Session = Depends(get_db)
):
    """WebSocket endpoint for chat messages"""
    logger.debug(f"Received WebSocket connection request with token: {token[:10]}...")
    try:
        # Authenticate user
        logger.debug("Attempting to authenticate user...")
        user = await get_current_user_ws(token, db)
        if not user:
            logger.error("WebSocket authentication failed - user not found or invalid token")
            await websocket.close(code=4001)
            return

        logger.debug(f"User {user.id} authenticated successfully")
        try:
            logger.debug(f"Attempting to connect user {user.id} to WebSocket manager")
            await manager.connect(websocket, user.id)
            logger.info(f"User {user.id} connected to chat websocket")
        except Exception as e:
            logger.error(f"Error connecting to WebSocket manager: {str(e)}")
            await websocket.close(code=4000)
            return
        
        while True:
            try:
                data = await websocket.receive_json()
                logger.debug(f"Received chat message from user {user.id}: {data}")
                
                if data.get("type") == "join_channel":
                    msg = ChannelJoinMessage(**data)
                    logger.debug(f"User {user.id} attempting to join channel {msg.channel_id}")
                    channel = db.query(Channel).filter(Channel.id == msg.channel_id).first()
                    if not channel:
                        logger.error(f"Channel {msg.channel_id} not found")
                        await websocket.send_json({
                            "type": "error",
                            "code": "channel_not_found",
                            "message": "Channel not found"
                        })
                        continue

                    # For public channels, automatically add the user as a member
                    if channel.is_public and user.id not in [m.id for m in channel.members]:
                        try:
                            channel.members.append(user)
                            db.commit()
                            db.refresh(channel)
                            logger.info(f"Added user {user.id} to public channel {msg.channel_id}")
                        except Exception as e:
                            logger.error(f"Database error while adding member to public channel: {e}")
                            db.rollback()
                            # Continue anyway - they can still join public channels
                    # For private channels, check if user is a member
                    elif not channel.is_public and user.id not in [m.id for m in channel.members]:
                        await websocket.send_json({
                            "type": "error",
                            "message": "You are not authorized to join this private channel"
                        })
                        continue

                    await manager.join_channel(msg.channel_id, user.id, websocket)
                    logger.info(f"User {user.id} joined channel {msg.channel_id}")
                
                elif data.get("type") == "leave_channel":
                    msg = ChannelLeaveMessage(**data)
                    manager.leave_channel(msg.channel_id, user.id)
                    await websocket.send_json({
                        "type": "channel_left",
                        "channel_id": msg.channel_id
                    })
                    logger.info(f"User {user.id} left channel {msg.channel_id}")
                
                elif data.get("type") == "message":
                    # Validate message length first
                    content = data.get("content", "")
                    if not content or len(content) > MAX_MESSAGE_LENGTH:
                        await websocket.send_json({
                            "type": "error",
                            "message": f"Invalid message. Must be between 1 and {MAX_MESSAGE_LENGTH} characters."
                        })
                        continue

                    try:
                        msg = ChatMessage(**data)
                    except ValidationError as e:
                        await websocket.send_json({
                            "type": "error",
                            "message": "Invalid message format"
                        })
                        logger.error(f"Message validation error: {e}")
                        continue

                    # Validate channel access
                    channel = db.query(Channel).filter(Channel.id == msg.channel_id).first()
                    if not channel:
                        await websocket.send_json({
                            "type": "error",
                            "message": "Channel not found"
                        })
                        continue

                    # Check if user is a member
                    if user.id not in [m.id for m in channel.members]:
                        # For public channels, automatically add the user as a member
                        if channel.is_public:
                            try:
                                channel.members.append(user)
                                db.commit()
                                db.refresh(channel)
                                logger.info(f"Added user {user.id} to public channel {msg.channel_id}")
                            except Exception as e:
                                logger.error(f"Database error while adding member to public channel: {e}")
                                db.rollback()
                                await websocket.send_json({
                                    "type": "error",
                                    "message": "Failed to join channel"
                                })
                                continue
                        else:
                            await websocket.send_json({
                                "type": "error",
                                "message": "Not a member of this channel"
                            })
                            continue
                    
                    # Create and save message
                    try:
                        # Create message model with UTC timestamp
                        current_time = datetime.now(UTC)
                        db_message = MessageModel(
                            content=content,
                            channel_id=msg.channel_id,
                            sender_id=user.id,
                            created_at=current_time,
                            updated_at=current_time
                        )
                        db.add(db_message)
                        db.commit()
                        db.refresh(db_message)
                        
                        # Use the same timestamp for broadcasting
                        message_data = {
                            "type": "message",
                            "message": {
                                "id": str(db_message.id),
                                "content": db_message.content,
                                "channel_id": str(db_message.channel_id),
                                "sender_id": str(db_message.sender_id),
                                "created_at": current_time.isoformat()
                            }
                        }
                        
                        # First send confirmation to the sender
                        await websocket.send_json({
                            "type": "message_sent",
                            "message": message_data["message"]
                        })
                        
                        # Then broadcast to other channel members
                        await manager.broadcast_to_channel(msg.channel_id, message_data)
                        logger.info(f"Message created and broadcast: {db_message.id}")
                    except Exception as e:
                        logger.error(f"Error creating/broadcasting message: {str(e)}")
                        db.rollback()
                        await websocket.send_json({
                            "type": "error",
                            "message": "Failed to save message to database"
                        })
                else:
                    await websocket.send_json({
                        "type": "error",
                        "message": "Unknown message type"
                    })
            except WebSocketDisconnect:
                logger.info(f"User {user.id} disconnected from chat websocket")
                manager.disconnect(user.id)
                break
            except Exception as e:
                logger.error(f"Error in chat websocket loop: {str(e)}")
                continue
    except Exception as e:
        logger.error(f"Error in chat_websocket: {str(e)}")
        await websocket.close(code=4000)

async def get_current_user_ws(token: str, db: Session) -> Optional[User]:
    """Helper function to authenticate WebSocket connections"""
    try:
        from ...auth.security import decode_token
        from ...models.user import User

        logger.debug("Attempting to decode token...")
        # Verify token and get user ID
        try:
            payload = decode_token(token)
            user_id = int(payload.get("sub"))
            logger.debug(f"Token decoded successfully for user_id: {user_id}")
        except Exception as e:
            logger.error(f"Error decoding token: {str(e)}")
            return None
            
        # Get user from database
        try:
            user = db.query(User).filter(User.id == user_id).first()
            if not user:
                logger.error(f"User {user_id} not found in database")
                return None
            logger.debug(f"Found user {user.username} in database")
            return user
        except Exception as e:
            logger.error(f"Database error while fetching user: {str(e)}")
            return None
    except Exception as e:
        logger.error(f"Authentication error: {str(e)}")
        return None 