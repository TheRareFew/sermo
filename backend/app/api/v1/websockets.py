from fastapi import APIRouter, WebSocket, WebSocketDisconnect, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import Dict, Set, Optional
import json
import logging
from datetime import datetime
from pydantic import BaseModel, Field, ValidationError
import asyncio

from ...models.user import User
from ...models.channel import Channel
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
    
    async def connect(self, websocket: WebSocket, user_id: int):
        await websocket.accept()
        self.active_connections[user_id] = websocket
    
    def disconnect(self, user_id: int):
        if user_id in self.active_connections:
            del self.active_connections[user_id]
        # Remove user from all channels
        for members in self.channel_members.values():
            members.discard(user_id)
    
    def join_channel(self, channel_id: int, user_id: int):
        if channel_id not in self.channel_members:
            self.channel_members[channel_id] = set()
        self.channel_members[channel_id].add(user_id)
    
    def leave_channel(self, channel_id: int, user_id: int):
        if channel_id in self.channel_members:
            self.channel_members[channel_id].discard(user_id)
            # If channel is empty, clean it up
            if not self.channel_members[channel_id]:
                del self.channel_members[channel_id]
    
    async def broadcast_to_channel(self, channel_id: int, message: dict):
        if channel_id in self.channel_members:
            for user_id in self.channel_members[channel_id]:
                if user_id in self.active_connections:
                    await self.active_connections[user_id].send_json(message)
    
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
    try:
        # Authenticate user
        user = await get_current_user_ws(token, db)
        if not user:
            await websocket.close(code=4001)
            return

        await manager.connect(websocket, user.id)
        logger.info(f"User {user.id} connected to chat websocket")
        
        try:
            while True:
                data = await websocket.receive_json()
                logger.info(f"Received chat message from user {user.id}: {data}")
                
                try:
                    if data.get("type") == "join_channel":
                        msg = ChannelJoinMessage(**data)
                        channel = db.query(Channel).filter(Channel.id == msg.channel_id).first()
                        if not channel:
                            await websocket.send_json({
                                "type": "error",
                                "message": "Channel not found"
                            })
                            continue
                        if user.id not in [m.id for m in channel.members]:
                            await websocket.send_json({
                                "type": "error",
                                "message": "You are not authorized to join this channel"
                            })
                            continue
                        manager.join_channel(msg.channel_id, user.id)
                        await websocket.send_json({
                            "type": "channel_joined",
                            "channel_id": msg.channel_id
                        })
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
                        if len(content) > MAX_MESSAGE_LENGTH:
                            await websocket.send_json({
                                "type": "error",
                                "message": f"Message too long. Maximum length is {MAX_MESSAGE_LENGTH} characters"
                            })
                            continue
                        
                        try:
                            msg = ChatMessage(**data)
                        except ValidationError as e:
                            await websocket.send_json({
                                "type": "error",
                                "message": "Invalid message format"
                            })
                            continue
                        
                        # Validate channel access
                        channel = db.query(Channel).filter(Channel.id == msg.channel_id).first()
                        if not channel:
                            await websocket.send_json({
                                "type": "error",
                                "message": "Channel not found"
                            })
                            continue
                        if user.id not in [m.id for m in channel.members]:
                            await websocket.send_json({
                                "type": "error",
                                "message": "You are not authorized to send messages in this channel"
                            })
                            continue
                        
                        # Create and save message
                        message = MessageCreate(content=msg.content)
                        db_message = await create_message(msg.channel_id, message, db, user)
                        
                        # Broadcast to channel members
                        await manager.broadcast_to_channel(msg.channel_id, {
                            "type": "new_message",
                            "message": {
                                "id": db_message.id,
                                "content": db_message.content,
                                "sender_id": db_message.sender_id,
                                "created_at": db_message.created_at.isoformat()
                            }
                        })
                        logger.info(f"User {user.id} sent message to channel {msg.channel_id}")
                    else:
                        await websocket.send_json({
                            "type": "error",
                            "message": "Unknown message type"
                        })

                except ValidationError as e:
                    error_msg = "Invalid message format"
                    if "max_length" in str(e):
                        error_msg = f"Message too long. Maximum length is {MAX_MESSAGE_LENGTH} characters"
                    await websocket.send_json({
                        "type": "error",
                        "message": error_msg
                    })
                    logger.error(f"Validation error for user {user.id}: {e}")
        
        except WebSocketDisconnect:
            logger.info(f"User {user.id} disconnected from chat websocket")
            manager.disconnect(user.id)
    
    except Exception as e:
        logger.error(f"Error in chat_websocket: {e}")
        await websocket.close(code=4000)

async def get_current_user_ws(token: str, db: Session) -> Optional[User]:
    """Helper function to authenticate WebSocket connections"""
    try:
        from ...auth.security import decode_token
        from ...models.user import User

        # Verify token and get user ID
        payload = decode_token(token)
        user_id = int(payload.get("sub"))
        
        # Get user from database
        user = db.query(User).filter(User.id == user_id).first()
        if not user:
            return None
            
        return user
    except Exception as e:
        logger.error(f"Authentication error: {e}")
        return None 