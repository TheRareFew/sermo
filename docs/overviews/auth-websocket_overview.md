# Authentication and WebSocket Features Overview

This document provides an overview of the authentication and WebSocket features of the project. It covers the key components, their interactions, and important functions to be aware of.

## Authentication

The authentication system is implemented using JWT tokens and includes features such as user registration, login, token refreshing, and secure password hashing.

### Key Files

- **`backend/app/auth/models.py`**: Defines the Pydantic models for authentication tokens.
- **`backend/app/auth/security.py`**: Contains security-related functions for password hashing, token creation, and verification.
- **`backend/app/auth/router.py`**: Implements the API endpoints for authentication actions.

### Important Components

#### Token Models (`backend/app/auth/models.py`)

Defines the token structures used in authentication.

[CODE START]
class Token(BaseModel):
    access_token: str
    token_type: str
    refresh_token: str

class TokenData(BaseModel):
    user_id: str | None = None
[CODE END]

#### Security Functions (`backend/app/auth/security.py`)

Handles password hashing and token operations.

- **Password Hashing**

  Uses `passlib` to hash and verify passwords securely.

  [CODE START]
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto", bcrypt__rounds=12)

def get_password_hash(password: str) -> str:
    return pwd_context.hash(password)

def verify_password(plain_password: str, hashed_password: str) -> bool:
    return pwd_context.verify(plain_password, hashed_password)
[CODE END]

- **Token Creation and Verification**

  Creates JWT access and refresh tokens and decodes them for verification.

  [CODE START]
def create_access_token(data: dict):
    to_encode = data.copy()
    expire = datetime.now(UTC) + timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    to_encode.update({"exp": expire, "jti": str(uuid.uuid4())})
    return jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)

def decode_token(token: str) -> dict:
    payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
    return payload
[CODE END]

- **Refresh Token Management**

  Stores, verifies, and rotates refresh tokens in the database.

  [CODE START]
class RefreshToken(Base):
    __tablename__ = "refresh_tokens"
    id = Column(Integer, primary_key=True)
    user_id = Column(Integer, ForeignKey("users.id"))
    token = Column(String, unique=True)
    expires_at = Column(DateTime)
    revoked = Column(Boolean, default=False)

async def store_refresh_token(user_id: int, token: str, db: Session):
    # Implementation
[CODE END]

#### Authentication Routes (`backend/app/auth/router.py`)

Defines API endpoints for registration, login, logout, and token refresh.

- **User Registration**

  Endpoint: `/register`

  Registers a new user and returns authentication tokens.

- **User Login**

  Endpoint: `/login`

  Authenticates a user and issues new access and refresh tokens.

- **Token Refresh**

  Endpoint: `/refresh`

  Generates a new access token using a valid refresh token.

- **User Logout**

  Endpoint: `/logout`

  Revokes the user's refresh token and clears authentication cookies.

## WebSockets

WebSockets are utilized for real-time communication features such as messaging, reactions, and voice channels.

### Key Files

- **`backend/app/api/v1/websockets.py`**: Manages WebSocket connections and real-time events on the server side.
- **`backend/app/api/v1/voice.py`**: Handles voice communication over WebSockets.
- **`frontend/src/services/websocket/index.ts`**: Implements the WebSocket client logic on the frontend.

### Important Components

#### WebSocket Server (`backend/app/api/v1/websockets.py`)

Manages connections and real-time messaging.

- **Connection Handling**

  Authenticates WebSocket connections using JWT tokens.

  [CODE START]
async def get_current_user_ws(token: str, db: Session) -> Optional[User]:
    payload = decode_token(token)
    user_id = int(payload.get("sub"))
    user = db.query(User).filter(User.id == user_id).first()
    return user
[CODE END]

- **Message Broadcasting**

  Broadcasts messages to all clients connected to a channel.

  [CODE START]
async def broadcast_message(channel_id: int, message: MessageModel):
    for connection in connections.get(channel_id, {}).values():
        await connection.send_json({
            "type": "NEW_MESSAGE",
            "channelId": str(channel_id),
            "message": message_data,
        })
[CODE END]

- **Event Handling**

  Supports events like joining/leaving channels, updating statuses, and sending reactions.

#### Voice Communication (`backend/app/api/v1/voice.py`)

Handles real-time voice communication between users.

- **VoiceConnectionManager**

  Manages voice channel connections and user voice states.

  [CODE START]
class VoiceConnectionManager:
    def __init__(self):
        self.active_connections: Dict[str, Dict[str, WebSocket]] = {}
        self.channel_participants: Dict[str, Dict[str, User]] = {}
        self.voice_states: Dict[str, Dict[str, VoiceState]] = {}
[CODE END]

- **WebSocket Endpoint**

  Endpoint: `/ws/voice/{channel_id}`

  Manages WebSocket connections for voice channels.

  [CODE START]
@router.websocket("/ws/voice/{channel_id}")
async def websocket_endpoint(websocket: WebSocket, channel_id: str, token: str = Query(...)):
    user = await get_current_user_ws(token, db)
    await manager.connect(websocket, channel_id, user)
    # ...
[CODE END]

#### WebSocket Client (`frontend/src/services/websocket/index.ts`)

Manages the WebSocket connection on the frontend.

- **Connection Management**

  Establishes and maintains the WebSocket connection with automatic reconnection.

  [CODE START]
class WebSocketService {
    private ws: WebSocket | null = null;

    private connect() {
        this.ws = new WebSocket(getWebSocketUrl());
        this.ws.onopen = () => {
            // ...
        };
    }
}
[CODE END]

- **Event Handling**

  Processes incoming WebSocket messages and updates the application state.

  [CODE START]
this.ws.onmessage = (event) => {
    const data = JSON.parse(event.data);
    switch (data.type) {
        case 'NEW_MESSAGE':
            store.dispatch(addMessage(transformedMessage));
            break;
        // ...
    }
}
[CODE END]

### Reactions over WebSockets

Reactions to messages are handled in real-time.

- **Backend Handling**

  Processes reaction events and broadcasts updates to clients.

  [CODE START]
@router.post("/{message_id}/reactions")
async def add_reaction(message_id: int, reaction: ReactionCreate, current_user: User):
    # ...
    await manager.broadcast_json(channel.id, {
        "type": "REACTION_ADDED",
        "payload": reaction_data,
    })
[CODE END]

- **Frontend Handling**

  Sends reaction events and updates the UI when a reaction is added or removed.

  [CODE START]
// Adding a reaction
public addReaction(channelId: string, messageId: string, emoji: string) {
    const message = {
        type: 'add_reaction',
        channelId,
        messageId,
        emoji
    };
    this.ws.send(JSON.stringify(message));
}
[CODE END]

## Conclusion

This overview provides a structured insight into the authentication and WebSocket systems within the project. For more detailed information, refer to the specific files and code snippets outlined above.
