from fastapi import APIRouter, WebSocket, WebSocketDisconnect, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import Dict, Set, Optional
import json
import logging
from datetime import datetime

from ...models.user import User
from ...models.channel import Channel
from ..deps import get_db, get_current_user
from ...schemas.message import MessageCreate
from .messages import create_message

router = APIRouter()
logger = logging.getLogger(__name__)

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
        # Authenticate user (implement get_current_user_ws for WebSocket)
        user = await get_current_user_ws(token, db)
        if not user:
            await websocket.close(code=4001)
            return

        await manager.connect(websocket, user.id)
        
        # Update user's status to online
        user.status = "online"
        user.last_seen = datetime.utcnow()
        db.commit()
        
        # Broadcast presence update
        await manager.broadcast_presence(user.id, "online")
        
        try:
            while True:
                # Wait for presence updates
                data = await websocket.receive_json()
                if data.get("type") == "status_update":
                    new_status = data.get("status")
                    if new_status in ["online", "offline", "away", "busy"]:
                        user.status = new_status
                        user.last_seen = datetime.utcnow()
                        db.commit()
                        await manager.broadcast_presence(user.id, new_status)
        
        except WebSocketDisconnect:
            manager.disconnect(user.id)
            user.status = "offline"
            user.last_seen = datetime.utcnow()
            db.commit()
            await manager.broadcast_presence(user.id, "offline")
    
    except Exception as e:
        logger.error(f"Error in presence_websocket: {e}")
        await websocket.close(code=4000)

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
        
        try:
            while True:
                data = await websocket.receive_json()
                
                if data.get("type") == "join_channel":
                    channel_id = data.get("channel_id")
                    channel = db.query(Channel).filter(Channel.id == channel_id).first()
                    if channel and user.id in [m.id for m in channel.members]:
                        manager.join_channel(channel_id, user.id)
                        await websocket.send_json({
                            "type": "channel_joined",
                            "channel_id": channel_id
                        })
                
                elif data.get("type") == "leave_channel":
                    channel_id = data.get("channel_id")
                    manager.leave_channel(channel_id, user.id)
                
                elif data.get("type") == "message":
                    channel_id = data.get("channel_id")
                    content = data.get("content")
                    
                    # Validate channel access
                    channel = db.query(Channel).filter(Channel.id == channel_id).first()
                    if not channel or user.id not in [m.id for m in channel.members]:
                        continue
                    
                    # Create and save message
                    message = MessageCreate(content=content)
                    db_message = await create_message(channel_id, message, db, user)
                    
                    # Broadcast to channel members
                    await manager.broadcast_to_channel(channel_id, {
                        "type": "new_message",
                        "message": {
                            "id": db_message.id,
                            "content": db_message.content,
                            "sender_id": db_message.sender_id,
                            "created_at": db_message.created_at.isoformat()
                        }
                    })
        
        except WebSocketDisconnect:
            manager.disconnect(user.id)
    
    except Exception as e:
        logger.error(f"Error in chat_websocket: {e}")
        await websocket.close(code=4000)

async def get_current_user_ws(token: str, db: Session) -> Optional[User]:
    """Helper function to authenticate WebSocket connections"""
    try:
        # Implement token verification and user retrieval
        # This should be similar to your HTTP authentication
        pass
    except Exception as e:
        logger.error(f"Authentication error: {e}")
        return None 