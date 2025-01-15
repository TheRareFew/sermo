# Sermo - Vintage-Styled Chat Application with AI Integration

Welcome to **Sermo**, a vintage-styled chat application enhanced with AI features. This overview is designed to help new developers understand the project's architecture, features, and key components. Below you'll find summaries of the backend and frontend implementations, including references to important files and their paths.

---

## Table of Contents

- [Project Structure](#project-structure)
- [Backend Overview](#backend-overview)
  - [API Endpoints](#api-endpoints)
  - [Database Models](#database-models)
  - [AI Features](#ai-features)
  - [Voice Communication](#voice-communication)
- [Frontend Overview](#frontend-overview)
  - [State Management](#state-management)
  - [Services](#services)
  - [Components](#components)
- [Additional Resources](#additional-resources)

---

## Project Structure

The project is divided into two main directories:

- **Backend**: Located in `backend/`, containing the FastAPI server, database models, and AI integration.
- **Frontend**: Located in `frontend/`, containing the React application, state management, and UI components.

---

## Backend Overview

### API Endpoints

The API is structured using FastAPI and is located in `backend/app/api/v1/`. Key endpoint files include:

- `ai_features.py`: Handles AI assistant interactions.
- `channels.py`: Manages channel creation, updates, and membership.
- `messages.py`: Handles message creation, retrieval, and deletion.
- `users.py`: Manages user registration, authentication, and profiles.
- `voice.py`: Manages voice communication via WebSockets.
- `websockets.py`: Manages real-time messaging and voice WebSocket connections.

**Example from `backend/app/api/v1/messages.py`:**

[CODE START]
@router.post("/{channel_id}/messages", response_model=Message)
async def create_message(
    channel_id: int,
    message: MessageCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """
    Create a new message in a channel.
    """
    # Implementation details...
[CODE END]

### Database Models

Models are defined using SQLAlchemy and can be found in `backend/app/models/`. Key models include:

- `channel.py`: Defines the `Channel` model and relationships.
- `message.py`: Defines the `Message` model, including replies and reactions.
- `user.py`: Defines the `User` model with authentication details.
- `reaction.py`: Defines the `Reaction` model for message reactions.
- `file.py`: Defines the `File` model for file uploads.

**Example from `backend/app/models/message.py`:**

[CODE START]
class Message(Base):
    __tablename__ = "messages"
    id = Column(Integer, primary_key=True, index=True)
    content = Column(Text)
    sender_id = Column(Integer, ForeignKey("users.id"))
    channel_id = Column(Integer, ForeignKey("channels.id"))
    timestamp = Column(DateTime, default=datetime.utcnow)
    # Relationships
    sender = relationship("User", back_populates="messages")
    channel = relationship("Channel", back_populates="messages")
    replies = relationship("Message", backref=backref("parent", remote_side=[id]))
[CODE END]

### AI Features

The AI assistant enhances user interactions by providing intelligent responses.

Key files:

- `backend/ai/messages_to_rag.py`: Integrates messages into a Retrieval-Augmented Generation system using Pinecone and OpenAI embeddings.
- `backend/app/api/v1/ai_features.py`: API endpoints for AI assistant interactions.

**Example from `backend/app/api/v1/ai_features.py`:**

[CODE START]
@router.post("/message", response_model=MessageResponse)
async def send_message_to_bot(
    request: MessageRequest,
    db: Session = Depends(get_db)
):
    """
    Handle messages sent to the AI assistant and generate responses.
    """
    # Implementation details...
[CODE END]

### Voice Communication

Enables real-time voice chat between users.

Key files:

- `backend/app/api/v1/voice.py`: Manages voice WebSocket connections and communication.
- `backend/app/api/v1/websockets.py`: Additional WebSocket handling for voice channels.

**Example from `backend/app/api/v1/voice.py`:**

[CODE START]
@router.websocket("/voice/{channel_id}")
async def voice_websocket(
    websocket: WebSocket,
    channel_id: int,
    token: str = Query(None)
):
    """
    WebSocket endpoint for voice communication in a channel.
    """
    # Implementation details...
[CODE END]

---

## Frontend Overview

### State Management

State is managed using Redux Toolkit, located in `frontend/src/store/`.

Key slices:

- `authSlice.ts`: Authentication state.
- `channelsSlice.ts`: Channels data.
- `messagesSlice.ts`: Messages data.
- `usersSlice.ts`: Users' presence and profiles.

**Example from `frontend/src/store/messages/messagesSlice.ts`:**

[CODE START]
const messagesSlice = createSlice({
  name: 'messages',
  initialState,
  reducers: {
    addMessage(state, action: PayloadAction<Message>) {
      // Adds a new message to the state
    },
    // Other reducers...
  },
});
[CODE END]

### Services

Located in `frontend/src/services/`, handling API requests and real-time communication.

- `api/`: API request functions.
- `websocket/`: WebSocket connections for chat.
- `voice/` and `webrtc/`: Voice communication services.

**Example from `frontend/src/services/api/chat.ts`:**

[CODE START]
export const getChannelMessages = async (
  channelId: string,
): Promise<Message[]> => {
  const response = await apiRequest(`/channels/${channelId}/messages`, {
    method: 'GET',
  });
  return response.data;
};
[CODE END]

### Components

Components are located in `frontend/src/components/`.

- `chat/`: Components related to chat functionality.
  - `Message`: Displays individual messages.
  - `MessageInput`: Input field for sending messages.
  - `ChannelListItem`: Displays individual channels.
- `common/`: Reusable components.
  - `Button`: Styled button component.
  - `Modal`: Modal dialog component.
  - `Input`: Styled input fields.
- `layout/`: Layout components.
  - `MainLayout`: Main application layout.
  - `Sidebar`: Navigation sidebar.

**Example from `frontend/src/components/chat/Message/index.tsx`:**

[CODE START]
const ChatMessage: React.FC<ChatMessageProps> = ({
  id,
  content,
  sender,
  timestamp,
}) => {
  return (
    <MessageContainer>
      <MessageHeader>
        <SenderName>{sender.username}</SenderName>
        <Timestamp>{formatTimestamp(timestamp)}</Timestamp>
      </MessageHeader>
      <MessageContent>{content}</MessageContent>
    </MessageContainer>
  );
};
[CODE END]

---

## Additional Resources

- **Documentation**: Additional overviews are available in `docs/overviews/`.
- **Scripts**: Setup and utility scripts are in `backend/app/scripts/`.
  - `generate_test_data.py`: Generates test data for development.
- **Environment Variables**: Sample configuration in `.env.example`.

---

## Welcome Aboard!

We hope this overview helps you get started with Sermo. If you have any questions or need further assistance, feel free to reach out to the team.

---

**Note**: When working with the codebase, remember to replace `[CODE START]` and `[CODE END]` with appropriate code blocks in your editor for better readability.
