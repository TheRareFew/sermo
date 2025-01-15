from fastapi import APIRouter, WebSocket, WebSocketDisconnect, Depends, HTTPException, Query
from typing import Dict, Set, Optional
from pydantic import BaseModel
import json
import logging
from ..deps import get_current_user, get_user_from_token
from app.models.user import User

router = APIRouter()

# Logging setup
logger = logging.getLogger(__name__)

# Types
class VoiceState(BaseModel):
    speaking: bool
    muted: bool

# Connection manager for voice channels
class VoiceConnectionManager:
    def __init__(self):
        # channel_id -> {user_id -> WebSocket}
        self.active_connections: Dict[str, Dict[str, WebSocket]] = {}
        # channel_id -> {user_id -> User}
        self.channel_participants: Dict[str, Dict[str, User]] = {}
        # channel_id -> {user_id -> VoiceState}
        self.voice_states: Dict[str, Dict[str, VoiceState]] = {}
    
    async def connect(self, websocket: WebSocket, channel_id: str, user: User):
        await websocket.accept()
        user_id = str(user.id)
        logger.info(f"User {user_id} connecting to channel {channel_id}")
        
        # Clean up any existing connection for this user in this channel
        if channel_id in self.active_connections and user_id in self.active_connections[channel_id]:
            try:
                old_ws = self.active_connections[channel_id][user_id]
                await old_ws.close()
            except:
                pass
            
        if channel_id not in self.active_connections:
            self.active_connections[channel_id] = {}
            self.channel_participants[channel_id] = {}
            self.voice_states[channel_id] = {}
            
        self.active_connections[channel_id][user_id] = websocket
        self.channel_participants[channel_id][user_id] = user
        self.voice_states[channel_id][user_id] = VoiceState(speaking=False, muted=False)
        
        # Send current participants list to the new user
        participants_list = {
            "type": "participants_list",
            "from_user_id": "server",
            "channel_id": channel_id,
            "payload": {
                "participants": [
                    {
                        "id": str(u.id),
                        "username": u.username,
                        "status": u.status,
                        "isSpeaking": self.voice_states[channel_id][str(u.id)].speaking,
                        "isMuted": self.voice_states[channel_id][str(u.id)].muted
                    } for u in self.channel_participants[channel_id].values()
                ]
            }
        }
        logger.info(f"Sending participants list to user {user_id}: {participants_list}")
        await websocket.send_json(participants_list)
        
        # Notify others in the channel about the new participant
        join_message = {
            "type": "join",
            "from_user_id": user_id,
            "channel_id": channel_id,
            "payload": {
                "user": {
                    "id": str(user.id),
                    "username": user.username,
                    "status": user.status,
                    "isSpeaking": False,
                    "isMuted": False
                }
            }
        }
        logger.info(f"Broadcasting join message: {join_message}")
        await self.broadcast_to_channel(channel_id, join_message, exclude_user_id=user_id)
    
    def disconnect(self, channel_id: str, user_id: str):
        if channel_id in self.active_connections:
            if user_id in self.active_connections[channel_id]:
                del self.active_connections[channel_id][user_id]
            
            if user_id in self.channel_participants[channel_id]:
                del self.channel_participants[channel_id][user_id]
            
            if user_id in self.voice_states[channel_id]:
                del self.voice_states[channel_id][user_id]
            
            # Clean up empty channels
            if not self.active_connections[channel_id]:
                del self.active_connections[channel_id]
                del self.channel_participants[channel_id]
                del self.voice_states[channel_id]
    
    async def broadcast_voice_data(self, channel_id: str, sender_id: str, data: bytes):
        """Broadcast voice data to all users in the channel except the sender"""
        if channel_id in self.active_connections:
            voice_state = self.voice_states[channel_id].get(sender_id)
            if not voice_state or voice_state.muted:
                logger.debug(f"Not broadcasting voice data: user {sender_id} is muted or has no voice state")
                return

            logger.debug(f"Broadcasting voice data from user {sender_id}: {len(data)} bytes")
            broadcast_count = 0
            error_count = 0
            for user_id, connection in self.active_connections[channel_id].items():
                if user_id != sender_id:
                    try:
                        await connection.send_bytes(data)
                        broadcast_count += 1
                        logger.debug(f"Sent voice data to user {user_id}")
                    except Exception as e:
                        error_count += 1
                        logger.error(f"Error broadcasting voice data to user {user_id}: {str(e)}")
            
            logger.debug(f"Voice data broadcast complete: {broadcast_count} successful, {error_count} failed")
    
    async def broadcast_to_channel(self, channel_id: str, message: dict, exclude_user_id: Optional[str] = None):
        if channel_id in self.active_connections:
            logger.info(f"Broadcasting to channel {channel_id}: {message}")
            for user_id, connection in self.active_connections[channel_id].items():
                if user_id != exclude_user_id:
                    try:
                        await connection.send_json(message)
                    except Exception as e:
                        logger.error(f"Error broadcasting to user {user_id}: {str(e)}")
    
    def update_voice_state(self, channel_id: str, user_id: str, speaking: Optional[bool] = None, muted: Optional[bool] = None):
        if channel_id in self.voice_states and user_id in self.voice_states[channel_id]:
            state = self.voice_states[channel_id][user_id]
            if speaking is not None:
                state.speaking = speaking
            if muted is not None:
                state.muted = muted

# Create a connection manager instance
manager = VoiceConnectionManager()

@router.websocket("/voice/{channel_id}")
async def voice_websocket(
    websocket: WebSocket,
    channel_id: str,
    token: str = Query(...),
):
    try:
        # Get user from token
        user = await get_user_from_token(token)
        if not user:
            await websocket.close(code=4001, reason="Invalid authentication token")
            return

        await manager.connect(websocket, channel_id, user)
        user_id = str(user.id)
        logger.info(f"User {user_id} connected to channel {channel_id}")
        
        try:
            while True:
                try:
                    message = await websocket.receive()
                    logger.debug(f"Received message type: {message.get('type', 'unknown')}")
                    
                    if "bytes" in message:
                        # Handle binary voice data
                        data = message.get("bytes")
                        if not isinstance(data, bytes):
                            logger.error(f"Invalid voice data type: {type(data)}")
                            continue
                            
                        logger.debug(f"Received voice data from user {user_id}: {len(data)} bytes")
                        await manager.broadcast_voice_data(channel_id, user_id, data)
                    elif "text" in message:
                        try:
                            data = json.loads(message["text"])
                            msg_type = data.get("type")
                            logger.info(f"Received message from user {user_id}: {data}")
                            
                            if msg_type == "voice_state":
                                # Update voice state (mute/speaking status)
                                payload = data.get("payload", {})
                                manager.update_voice_state(
                                    channel_id,
                                    user_id,
                                    speaking=payload.get("speaking"),
                                    muted=payload.get("muted")
                                )
                                # Broadcast voice state update
                                state_message = {
                                    "type": "voice_state",
                                    "from_user_id": user_id,
                                    "channel_id": channel_id,
                                    "payload": payload
                                }
                                await manager.broadcast_to_channel(channel_id, state_message)
                        except json.JSONDecodeError:
                            logger.error(f"Invalid JSON message from user {user_id}")
                        except Exception as e:
                            logger.error(f"Error processing message from user {user_id}: {str(e)}")
                except Exception as e:
                    logger.error(f"Error receiving message: {str(e)}")
                    continue
        
        except WebSocketDisconnect:
            manager.disconnect(channel_id, user_id)
            # Notify others about the disconnection
            leave_message = {
                "type": "leave",
                "from_user_id": user_id,
                "channel_id": channel_id,
                "payload": { "user_id": user_id }
            }
            logger.info(f"User {user_id} disconnected, broadcasting: {leave_message}")
            await manager.broadcast_to_channel(channel_id, leave_message)
    
    except Exception as e:
        logger.error(f"Error in voice websocket: {str(e)}")
        if websocket.client_state.value:  # Check if websocket is still connected
            await websocket.close(code=1011)  # Internal error
        raise HTTPException(status_code=500, detail="Internal server error") 