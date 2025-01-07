from fastapi import FastAPI, Depends, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from starlette.websockets import WebSocket, WebSocketDisconnect
from typing import List, Dict
import json
from datetime import datetime
from sqlalchemy.orm import Session
from backend.models import get_db, Message as DBMessage, User, Channel
import asyncio
from pydantic import BaseModel
from fastapi.responses import JSONResponse

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

class ConnectionManager:
    def __init__(self):
        self.active_connections: Dict[str, Dict[str, WebSocket]] = {
            "channels": {},
            "direct_messages": {}
        }
        
    async def connect(self, websocket: WebSocket, client_id: str, connection_type: str, target_id: str):
        await websocket.accept()
        if connection_type == "channel":
            if target_id not in self.active_connections["channels"]:
                self.active_connections["channels"][target_id] = {}
            self.active_connections["channels"][target_id][client_id] = websocket
            
        else:  # direct message
            if target_id not in self.active_connections["direct_messages"]:
                self.active_connections["direct_messages"][target_id] = {}
            self.active_connections["direct_messages"][target_id][client_id] = websocket

    def disconnect(self, client_id: str, connection_type: str, target_id: str):
        if connection_type == "channel":
            if target_id in self.active_connections["channels"]:
                self.active_connections["channels"][target_id].pop(client_id, None)
        else:  # direct message
            if target_id in self.active_connections["direct_messages"]:
                self.active_connections["direct_messages"][target_id].pop(client_id, None)

    async def broadcast_to_channel(self, message: dict, channel_id: str, db: Session):
        print(f"\n=== Broadcasting message to channel {channel_id} ===")
        print(f"Message content: {message}")
        
        if message.get('action') == 'delete':
            # Handle delete message broadcasting without saving to DB
            if channel_id in self.active_connections["channels"]:
                for connection in self.active_connections["channels"][channel_id].values():
                    try:
                        await connection.send_text(json.dumps(message))
                    except Exception as e:
                        print(f"Error broadcasting delete message: {e}")
            return

        try:
            channel_id_int = int(channel_id)
            
            # Debug the message creation
            db_message = DBMessage(
                content=message.get('content'),
                sender=message.get('sender'),
                channel_id=channel_id_int,
                account_name=message.get('accountName'),
                timestamp=datetime.now(),
                message_type=message.get('type', 'message')
            )
            
            print(f"Created message: {db_message.__dict__}")
            
            db.add(db_message)
            db.commit()
            db.refresh(db_message)
            
            print(f"Saved message with ID: {db_message.id}")
            
            # Verify message was saved
            saved_message = db.query(DBMessage).get(db_message.id)
            print(f"Retrieved saved message: {saved_message.__dict__}")
            
            # Update the message with database info
            message['id'] = str(db_message.id)
            message['channelId'] = str(channel_id_int)
            
            # Debug websocket connections
            print(f"Active connections for channel {channel_id}: {self.active_connections['channels'].get(channel_id, {})}")
            
            if channel_id in self.active_connections["channels"]:
                for connection in self.active_connections["channels"][channel_id].values():
                    try:
                        await connection.send_text(json.dumps(message))
                        print(f"Successfully sent message to connection")
                    except Exception as e:
                        print(f"Error sending to connection: {e}")
        except Exception as e:
            print(f"Error in broadcast_to_channel: {str(e)}")
            import traceback
            print(f"Traceback: {traceback.format_exc()}")
            db.rollback()

    async def send_direct_message(self, message: dict, from_id: str, to_id: str, db: Session):
        # Save message to database
        db_message = DBMessage(
            content=message["content"],
            sender=message["sender"],
            account_name=message.get("accountName", from_id),
            timestamp=datetime.fromisoformat(message["timestamp"]),
            recipient_id=to_id,
            message_type="direct"
        )
        db.add(db_message)
        db.commit()

        # Update message with database ID
        message["id"] = str(db_message.id)

        # Send to connected clients
        if to_id in self.active_connections:
            for connection in self.active_connections[to_id]:
                await connection.send_text(json.dumps(message))
        if from_id in self.active_connections:
            for connection in self.active_connections[from_id]:
                await connection.send_text(json.dumps(message))

    async def update_user_status(self, channel: str, username: str, status: str):
        if channel in self.user_statuses:
            self.user_statuses[channel][username] = status
            await self.broadcast_user_list(channel)

manager = ConnectionManager()

# Add endpoints to fetch message history
@app.get("/api/messages/channel/{channel_id}")
def get_channel_messages(
    channel_id: str, 
    page: int = 0,
    db: Session = Depends(get_db)
):
    print(f"\n=== Fetching messages for channel {channel_id} ===")
    
    try:
        channel_id_int = int(channel_id)
        print(f"Looking for channel with ID: {channel_id_int}")
        
        # Debug: Print all channels
        all_channels = db.query(Channel).all()
        print("\nAll channels:")
        for ch in all_channels:
            print(f"- Channel {ch.id}: {ch.name}")
        
        # Get the channel
        channel = db.query(Channel).get(channel_id_int)
        if not channel:
            print(f"Channel {channel_id} not found")
            return JSONResponse(
                status_code=404,
                content={"error": f"Channel {channel_id} not found"}
            )
            
        print(f"\nFound channel: {channel.name} (ID: {channel.id})")
        
        # Debug: Print all messages in database
        all_messages = db.query(DBMessage).all()
        print("\nAll messages in database:")
        for msg in all_messages:
            print(f"- Message {msg.id}: channel_id={msg.channel_id}, content={msg.content[:30]}")
        
        # Get messages for this channel
        messages = db.query(DBMessage)\
            .filter(DBMessage.channel_id == channel.id)\
            .order_by(DBMessage.timestamp.asc())\
            .all()
            
        print(f"\nFound {len(messages)} messages for channel {channel_id}")
        for msg in messages:
            print(f"- Message {msg.id}: {msg.content[:30]}")
        
        result = {
            "messages": [
                {
                    "id": str(m.id),
                    "content": m.content,
                    "sender": m.sender,
                    "accountName": m.account_name,
                    "timestamp": m.timestamp.isoformat(),
                    "type": m.message_type or "message",
                    "channelId": str(m.channel_id)
                } for m in messages
            ],
            "totalMessages": len(messages),
            "hasMore": False,
            "channelId": str(channel.id)
        }
        
        print(f"\nReturning result: {result}")
        return JSONResponse(content=result)
        
    except ValueError:
        return JSONResponse(
            status_code=400,
            content={"error": "Invalid channel ID format"}
        )
    except Exception as e:
        print(f"Error: {str(e)}")
        import traceback
        print(traceback.format_exc())
        return JSONResponse(
            status_code=500,
            content={"error": str(e)}
        )

@app.get("/api/messages/direct/{user_id}")
async def get_direct_messages(user_id: str, db: Session = Depends(get_db)):
    messages = db.query(DBMessage).filter(
        DBMessage.recipient_id == user_id,
        DBMessage.message_type == "direct"
    ).all()
    # Convert SQLAlchemy objects to dictionaries with snake_case to camelCase conversion
    return [
        {
            "id": str(m.id),
            "content": m.content,
            "sender": m.sender,
            "accountName": m.account_name,
            "timestamp": m.timestamp.isoformat(),
            "type": m.message_type
        } for m in messages
    ]

@app.delete("/api/messages/{message_id}")
async def delete_message(
    message_id: str,
    account_name: str,
    db: Session = Depends(get_db)
):
    message = db.query(DBMessage).filter(
        DBMessage.id == message_id,
        DBMessage.account_name == account_name
    ).first()
    
    if not message:
        raise HTTPException(status_code=404, detail="Message not found")
        
    db.delete(message)
    db.commit()
    
    return {"status": "success"}

@app.websocket("/ws/{connection_type}/{client_id}/{target_id}")
async def websocket_endpoint(
    websocket: WebSocket,
    connection_type: str,
    client_id: str,
    target_id: str,
    db: Session = Depends(get_db)
):
    try:
        print(f"New WebSocket connection: {connection_type}/{client_id}/{target_id}")
        await manager.connect(websocket, client_id, connection_type, target_id)
        while True:
            data = await websocket.receive_text()
            print(f"Received WebSocket message: {data}")
            message_data = json.loads(data)
            
            # Handle regular messages
            if message_data.get('content'):
                print(f"Processing message with content: {message_data}")
                await manager.broadcast_to_channel(message_data, target_id, db)
            # Handle delete action
            elif message_data.get('action') == 'delete':
                delete_message = {
                    "action": "delete",
                    "messageId": message_data["messageId"],
                    "timestamp": datetime.now().isoformat()
                }
                await manager.broadcast_to_channel(delete_message, target_id, db)
                
    except Exception as e:
        print(f"Error in websocket endpoint: {e}")
        manager.disconnect(client_id, connection_type, target_id)

@app.get("/")
async def root():
    return {"message": "Welcome to Sermo API"}

@app.post("/api/auth/login")
async def login(credentials: dict, db: Session = Depends(get_db)):
    user = db.query(User).filter(User.username == credentials["username"]).first()
    
    if not user or not user.verify_password(credentials["password"]):
        raise HTTPException(
            status_code=401,
            detail="Invalid username or password"
        )
    
    return {
        "username": user.username,
        "displayName": user.display_name,
        "status": user.status
    }

@app.post("/api/auth/register")
async def register(user_data: dict, db: Session = Depends(get_db)):
    if db.query(User).filter(User.username == user_data["username"]).first():
        raise HTTPException(status_code=400, detail="Username already registered")
    
    # Create new user with hashed password
    user = User(
        username=user_data["username"],
        password_hash=User.hash_password(user_data["password"]),
        display_name=user_data.get("displayName", user_data["username"]),
        status="online"
    )
    
    try:
        db.add(user)
        db.commit()
        db.refresh(user)
        
        return {
            "username": user.username,
            "displayName": user.display_name,
            "status": user.status
        }
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail="Error creating user")

@app.get("/health")
async def health_check():
    return {"status": "ok"}

# Add Pydantic model for channel
class ChannelCreate(BaseModel):
    name: str

class ChannelResponse(BaseModel):
    id: int
    name: str
    
    class Config:
        orm_mode = True

# Add endpoints for channels
@app.post("/api/channels", response_model=ChannelResponse)
async def create_channel(channel: ChannelCreate, db: Session = Depends(get_db)):
    # Check if channel already exists
    if db.query(Channel).filter(Channel.name == channel.name).first():
        raise HTTPException(status_code=400, detail="Channel already exists")
    
    # Create new channel
    db_channel = Channel(name=channel.name)
    try:
        db.add(db_channel)
        db.commit()
        db.refresh(db_channel)
        return db_channel
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/channels", response_model=List[ChannelResponse])
async def get_channels(db: Session = Depends(get_db)):
    channels = db.query(Channel).all()
    return channels

