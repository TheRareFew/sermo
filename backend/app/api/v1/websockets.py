from fastapi import APIRouter, WebSocket, WebSocketDisconnect, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import Dict, Set, Optional, List
import json
import logging
from datetime import datetime, UTC
from pydantic import BaseModel, Field, ValidationError
import asyncio
import time
import numpy as np

from ...models.user import User
from ...models.channel import Channel
from ...models.message import Message as MessageModel
from ..deps import get_db
from ...auth.security import decode_token
from ...schemas.message import MessageCreate, Message

router = APIRouter()
logger = logging.getLogger(__name__)

async def get_current_user_ws(token: str, db: Session) -> Optional[User]:
    """Authenticate WebSocket connection using JWT token"""
    try:
        payload = decode_token(token)
        user_id = int(payload.get("sub"))
        if not user_id:
            logger.error("Invalid user ID in token")
            return None
            
        user = db.query(User).filter(User.id == user_id).first()
        if not user:
            logger.error(f"User {user_id} not found")
            return None
            
        return user
    except Exception as e:
        logger.error(f"Error authenticating WebSocket connection: {str(e)}")
        return None

# Constants
MAX_MESSAGE_LENGTH = 4096  # 4KB max message length
VALID_STATUS_VALUES = {"online", "offline", "away", "busy"}

# Active WebSocket connections and voice channels
connections: Dict[str, Dict] = {}
voice_channels: Dict[int, Set[WebSocket]] = {}  # channel_id -> set of websockets
voice_channel_users: Dict[int, Set[int]] = {}  # channel_id -> set of user_ids
voice_states: Dict[int, Dict[str, bool]] = {}  # user_id -> {"muted": bool, "speaking": bool}

# Pydantic models for WebSocket messages
class StatusUpdateMessage(BaseModel):
    type: str = Field("status_update")
    status: str

class VoiceStateMessage(BaseModel):
    type: str = Field("voice_state")
    channel_id: int
    muted: bool = False
    speaking: bool = False

class VoiceMessage(BaseModel):
    type: str = Field("voice")
    channel_id: int
    audio_data: bytes  # Raw audio data from WebRTC
    timestamp: float

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
            logger.debug(f"Setting up connection for user {user_id}")
            
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
            
            # Send initial connection confirmation
            await websocket.send_json({
                "type": "connection_established",
                "userId": str(user_id),
                "timestamp": datetime.utcnow().isoformat()
            })
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
    
    async def broadcast_to_channel(self, channel_id: int, message: dict, exclude_user_id: Optional[int] = None):
        """Send a message to all users in a channel except the excluded user"""
        try:
            if channel_id in self.channel_connections:
                # Create a list of users to remove if their connection is stale
                users_to_remove = []
                
                # Try to send to each connection, excluding the sender
                for user_id, ws in self.channel_connections[channel_id].items():
                    if exclude_user_id and user_id == exclude_user_id:
                        continue  # Skip the sender
                        
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

    async def broadcast_message(self, channel_id: int, message: MessageModel, exclude_user_id: Optional[int] = None):
        """Broadcast a message to all users in a channel"""
        try:
            # Get the sender information from the message
            sender = message.sender
            
            # Format timestamps consistently
            created_at = message.created_at.isoformat() if isinstance(message.created_at, datetime) else message.created_at
            updated_at = message.updated_at.isoformat() if isinstance(message.updated_at, datetime) else message.updated_at
            
            # Create the message in the format expected by the frontend store
            store_message = {
                "id": str(message.id),
                "content": message.content,
                "channelId": str(message.channel_id),
                "userId": str(message.sender_id),
                "reactions": [],
                "attachments": [
                    {
                        "id": str(file.id),
                        "filename": file.filename,
                        "file_type": file.file_type,
                        "file_path": file.file_path,
                        "file_size": file.file_size,
                        "message_id": str(message.id),
                        "created_at": file.created_at.isoformat() if isinstance(file.created_at, datetime) else file.created_at,
                        "updated_at": file.updated_at.isoformat() if isinstance(file.updated_at, datetime) else file.updated_at
                    }
                    for file in message.files
                ] if message.files else [],
                "has_attachments": bool(message.files),
                "createdAt": created_at,
                "updatedAt": updated_at,
                "parentId": str(message.parent_id) if message.parent_id else None,
                "replyCount": 0,
                "isExpanded": False,
                "repliesLoaded": False,
                "replies": [],
                "user": {
                    "id": str(sender.id),
                    "username": sender.username,
                    "status": sender.status
                }
            }
            
            # If this is a reply, include it in the parent message's replies
            if message.parent_id:
                message_dict = {
                    "type": "NEW_MESSAGE",
                    "channelId": str(channel_id),
                    "message": store_message,
                    "isReply": True,
                    "parentId": str(message.parent_id)
                }
            else:
                message_dict = {
                    "type": "NEW_MESSAGE",
                    "channelId": str(channel_id),
                    "message": store_message
                }
            
            logger.debug(f"Broadcasting message with timestamps - created: {created_at}, updated: {updated_at}")
            await self.broadcast_to_channel(
                channel_id,
                message_dict,
                exclude_user_id
            )
        except Exception as e:
            logger.error(f"Error broadcasting message: {str(e)}")
            raise

    async def broadcast_message_update(self, channel_id: int, message_id: str, updates: dict):
        """Broadcast a message update to all users in a channel"""
        await self.broadcast_to_channel(
            channel_id,
            {
                "type": "UPDATE_MESSAGE",
                "channelId": str(channel_id),
                "id": message_id,
                "updates": updates
            }
        )

    async def broadcast_reaction(self, channel_id: int, message_id: str, reaction: dict, is_add: bool = True):
        """Broadcast a reaction update to all users in a channel"""
        try:
            message_type = "reaction_added" if is_add else "reaction_removed"
            
            message = {
                "type": message_type,
                "payload": {
                    "channelId": str(channel_id),
                    "messageId": str(message_id),
                    "reaction": reaction if is_add else {
                        "userId": str(reaction["userId"]),
                        "emoji": reaction["emoji"]
                    }
                }
            }
            
            logger.debug(f"Broadcasting reaction update - type: {message_type}, message: {message_id}")
            await self.broadcast_to_channel(
                channel_id,
                message
            )
        except Exception as e:
            logger.error(f"Error broadcasting reaction: {str(e)}")
            raise

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
            "type": "USER_STATUS",
            "userId": str(user_id),
            "status": status,
            "timestamp": datetime.utcnow().isoformat()
        }
        for connection in self.active_connections.values():
            await connection.send_json(message)

# Voice channel management
async def join_voice_channel(websocket: WebSocket, channel_id: int, user_id: int):
    """Add a WebSocket connection to a voice channel"""
    if channel_id not in voice_channels:
        voice_channels[channel_id] = set()
        voice_channel_users[channel_id] = set()
    
    voice_channels[channel_id].add(websocket)
    voice_channel_users[channel_id].add(user_id)
    
    # Initialize voice state for user
    voice_states[user_id] = {"muted": False, "speaking": False}
    
    # Notify other users in the channel
    await broadcast_voice_state_update(channel_id, user_id, "joined")
    logger.debug(f"User {user_id} joined voice channel {channel_id}")

async def leave_voice_channel(websocket: WebSocket, channel_id: int, user_id: int):
    """Remove a WebSocket connection from a voice channel"""
    if channel_id in voice_channels:
        voice_channels[channel_id].discard(websocket)
        voice_channel_users[channel_id].discard(user_id)
        
        # Clean up voice state
        if user_id in voice_states:
            del voice_states[user_id]
        
        # Notify other users in the channel
        await broadcast_voice_state_update(channel_id, user_id, "left")
        
        # Clean up empty channel
        if not voice_channels[channel_id]:
            del voice_channels[channel_id]
            del voice_channel_users[channel_id]
        
        logger.debug(f"User {user_id} left voice channel {channel_id}")

async def broadcast_voice(message: VoiceMessage, sender_ws: WebSocket, channel_id: int):
    """Broadcast voice data to all users in the channel except the sender"""
    if channel_id in voice_channels:
        for ws in voice_channels[channel_id]:
            if ws != sender_ws:
                try:
                    await ws.send_bytes(message.audio_data)
                except Exception as e:
                    logger.error(f"Error broadcasting voice: {str(e)}")

async def broadcast_voice_state_update(channel_id: int, user_id: int, event: str):
    """Broadcast voice state updates to all users in the channel"""
    if channel_id in voice_channels:
        state = voice_states.get(user_id, {"muted": False, "speaking": False})
        message = {
            "type": "voice_state_update",
            "user_id": str(user_id),
            "channel_id": channel_id,
            "event": event,
            "state": state
        }
        for ws in voice_channels[channel_id]:
            try:
                await ws.send_json(message)
            except Exception as e:
                logger.error(f"Error broadcasting voice state: {str(e)}")

async def update_voice_state(channel_id: int, user_id: int, muted: bool = None, speaking: bool = None):
    """Update a user's voice state and broadcast the change"""
    if user_id in voice_states:
        state = voice_states[user_id]
        if muted is not None:
            state["muted"] = muted
        if speaking is not None:
            state["speaking"] = speaking
        await broadcast_voice_state_update(channel_id, user_id, "state_changed")

manager = ConnectionManager()

@router.websocket("/ws")
async def websocket_endpoint(
    websocket: WebSocket,
    token: str,
    db: Session = Depends(get_db)
):
    """Main WebSocket endpoint for all real-time updates"""
    try:
        # Authenticate user
        user = await get_current_user_ws(token, db)
        if not user:
            logger.error("WebSocket authentication failed")
            await websocket.close(code=4001)
            return

        logger.debug(f"User {user.id} authenticated successfully")
        
        # Accept the connection first
        await websocket.accept()
        
        try:
            # Then connect to the manager
            await manager.connect(websocket, user.id)
            
            # Update user status to online
            user.status = "online"
            db.commit()
            await manager.broadcast_presence(user.id, "online")
            
            # Main message loop
            while True:
                try:
                    data = await websocket.receive_json()
                    # Handle different message types
                    message_type = data.get("type", "").lower()
                    
                    if message_type == "ping":
                        await websocket.send_json({"type": "pong"})
                        continue
                        
                    if message_type == "join_channel":
                        channel_id = int(data["channelId"])
                        await manager.join_channel(channel_id, user.id, websocket)
                        continue
                        
                    if message_type == "leave_channel":
                        channel_id = int(data["channelId"])
                        manager.leave_channel(channel_id, user.id)
                        continue

                    if message_type == "add_reaction":
                        channel_id = int(data["channelId"])
                        message_id = data["messageId"]
                        reaction = {
                            "userId": str(user.id),
                            "emoji": data["emoji"],
                            "timestamp": datetime.utcnow().isoformat()
                        }
                        await manager.broadcast_reaction(channel_id, message_id, reaction, is_add=True)
                        continue

                    if message_type == "remove_reaction":
                        channel_id = int(data["channelId"])
                        message_id = data["messageId"]
                        reaction = {
                            "userId": str(user.id),
                            "emoji": data["emoji"]
                        }
                        await manager.broadcast_reaction(channel_id, message_id, reaction, is_add=False)
                        continue
                        
                except WebSocketDisconnect:
                    break
                except json.JSONDecodeError:
                    logger.error("Invalid JSON message received")
                    continue
                except ValidationError as e:
                    logger.error(f"Message validation error: {str(e)}")
                    continue
                except Exception as e:
                    logger.error(f"Error processing message: {str(e)}")
                    continue
                    
        except Exception as e:
            logger.error(f"Error in WebSocket connection: {str(e)}")
            raise
            
    except WebSocketDisconnect:
        logger.info(f"WebSocket disconnected for user {user.id if user else 'unknown'}")
    except Exception as e:
        logger.error(f"Error in WebSocket endpoint: {str(e)}")
    finally:
        if user:
            manager.disconnect(user.id)
            user.status = "offline"
            db.commit()
            await manager.broadcast_presence(user.id, "offline")

        try:
            await websocket.close(code=4000)
        except:
            pass 

@router.websocket("/ws/voice/{channel_id}")
async def voice_endpoint(
    websocket: WebSocket,
    channel_id: int,
    db: Session = Depends(get_db)
):
    """Handle voice WebSocket connections"""
    try:
        # Accept the connection
        await websocket.accept()
        
        # Get authentication token from query parameters
        token = websocket.query_params.get("token")
        if not token:
            logger.error("No token provided")
            await websocket.close(code=1008)  # Policy violation
            return

        # Authenticate user
        user = await get_current_user_ws(token, db)
        if not user:
            logger.error("Invalid token")
            await websocket.close(code=1008)
            return

        # Check if user has access to the channel
        channel = db.query(Channel).filter(Channel.id == channel_id).first()
        if not channel:
            logger.error(f"Channel {channel_id} not found")
            await websocket.close(code=1008)
            return

        # Join voice channel
        await join_voice_channel(websocket, channel_id, user.id)
        logger.info(f"User {user.id} joined voice channel {channel_id}")

        try:
            while True:
                # Receive data
                try:
                    data = await websocket.receive()
                    if data["type"] == "websocket.disconnect":
                        break
                    
                    if data["type"] == "websocket.receive":
                        if "bytes" in data:  # Audio data
                            message = VoiceMessage(
                                type="voice",
                                channel_id=channel_id,
                                audio_data=data["bytes"],
                                timestamp=time.time()
                            )
                            await broadcast_voice(message, websocket, channel_id)
                            
                        elif "text" in data:  # Voice state updates
                            json_data = json.loads(data["text"])
                            if json_data["type"] == "voice_state":
                                state = VoiceStateMessage(**json_data)
                                await update_voice_state(
                                    channel_id,
                                    user.id,
                                    muted=state.muted,
                                    speaking=state.speaking
                                )
                    
                except ValidationError as e:
                    logger.error(f"Invalid message: {str(e)}")
                    continue
                except json.JSONDecodeError:
                    logger.error("Invalid JSON message")
                    continue

        except WebSocketDisconnect:
            logger.info(f"User {user.id} disconnected from voice channel {channel_id}")
        finally:
            # Leave voice channel
            await leave_voice_channel(websocket, channel_id, user.id)

    except Exception as e:
        logger.error(f"Error in voice endpoint: {str(e)}")
        await websocket.close(code=1011)  # Internal error 