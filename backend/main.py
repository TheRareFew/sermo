from fastapi import FastAPI, Depends, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from starlette.websockets import WebSocket, WebSocketDisconnect
from typing import List, Dict
import json
from datetime import datetime
from sqlalchemy.orm import Session
from backend.models import get_db, Message as DBMessage, User

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
        if message.get('action') == 'delete':
            # Handle delete message broadcasting without saving to DB
            if channel_id in self.active_connections["channels"]:
                for connection in self.active_connections["channels"][channel_id].values():
                    await connection.send_text(json.dumps(message))
            return

        # Save message to database
        db_message = DBMessage(
            content=message["content"],
            sender=message["sender"],
            account_name=message["accountName"],
            timestamp=datetime.fromisoformat(message["timestamp"]),
            channel_id=channel_id,
            message_type=message.get("type", "message")
        )
        db.add(db_message)
        db.commit()
        db.refresh(db_message)

        # Update message with database ID
        message["id"] = str(db_message.id)

        # Broadcast to all connected clients
        if channel_id in self.active_connections["channels"]:
            for connection in self.active_connections["channels"][channel_id].values():
                await connection.send_text(json.dumps(message))

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
        if to_id in self.active_connections["direct_messages"]:
            for connection in self.active_connections["direct_messages"][to_id].values():
                await connection.send_text(json.dumps(message))
        if from_id in self.active_connections["direct_messages"]:
            for connection in self.active_connections["direct_messages"][from_id].values():
                await connection.send_text(json.dumps(message))

manager = ConnectionManager()

# Add endpoints to fetch message history
@app.get("/api/messages/channel/{channel_id}")
async def get_channel_messages(channel_id: str, db: Session = Depends(get_db)):
    messages = db.query(DBMessage).filter(
        DBMessage.channel_id == channel_id
    ).order_by(DBMessage.timestamp.asc()).all()  # Add ordering
    
    # Add debug logging
    print(f"Fetching messages for channel {channel_id}")
    print(f"Found {len(messages)} messages")
    
    result = [
        {
            "id": str(m.id),
            "content": m.content,
            "sender": m.sender,
            "accountName": m.account_name,
            "timestamp": m.timestamp.isoformat(),
            "type": m.message_type or "message"  # Ensure type is never null
        } for m in messages
    ]
    
    print("Returning messages:", result)
    return result

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
async def delete_message(message_id: str, account_name: str = None, db: Session = Depends(get_db)):
    if not account_name:
        return {"status": "error", "message": "Account name is required"}
        
    try:
        # Convert string ID to integer for database query
        message = db.query(DBMessage).filter(
            DBMessage.id == int(message_id),
            DBMessage.account_name == account_name
        ).first()
        
        if message:
            db.delete(message)
            db.commit()
            return {"status": "success"}
        return {"status": "message not found or unauthorized"}
    except Exception as e:
        print(f"Error deleting message: {e}")
        return {"status": "error", "message": str(e)}

@app.websocket("/ws/{connection_type}/{client_id}/{target_id}")
async def websocket_endpoint(
    websocket: WebSocket,
    connection_type: str,
    client_id: str,
    target_id: str,
    db: Session = Depends(get_db)
):
    try:
        await manager.connect(websocket, client_id, connection_type, target_id)
        while True:
            data = await websocket.receive_text()
            message_data = json.loads(data)
            
            if message_data.get('action') == 'delete':
                # Handle delete action
                delete_message = {
                    "action": "delete",
                    "messageId": message_data["messageId"],
                    "timestamp": datetime.now().isoformat()
                }
                if connection_type == "channel":
                    await manager.broadcast_to_channel(delete_message, target_id, db)
                continue

            # Regular message handling (no system messages)
            message = {
                "id": message_data.get("id", str(datetime.now().timestamp())),
                "content": message_data["content"],
                "sender": message_data["sender"],
                "accountName": message_data["accountName"],
                "timestamp": message_data.get("timestamp", datetime.now().isoformat()),
                "type": message_data.get("type", "message")
            }
            
            if connection_type == "channel":
                await manager.broadcast_to_channel(message, target_id, db)
            else:
                await manager.send_direct_message(message, client_id, target_id, db)
                
    except WebSocketDisconnect:
        manager.disconnect(client_id, connection_type, target_id)
        # No system message on disconnect

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

