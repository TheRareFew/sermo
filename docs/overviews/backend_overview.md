# Project Backend Overview

## Directory Structure

backend/
├── alembic/
│   ├── env.py
│   ├── script.py.mako
├── ai/
│   └── messages_to_rag.py
├── api/
│   ├── __init__.py
│   ├── deps.py
│   ├── v1/
│   │   ├── __init__.py
│   │   ├── ai_features.py
│   │   ├── channels.py
│   │   ├── files.py
│   │   ├── messages.py
│   │   ├── reactions.py
│   │   ├── search.py
│   │   ├── users.py
│   │   ├── voice.py
│   │   └── websockets.py
├── auth/
│   ├── models.py
│   ├── router.py
│   └── security.py
├── models/
│   ├── channel.py
│   ├── file.py
│   ├── message.py
│   ├── presence.py
│   ├── reaction.py
│   ├── refresh_token.py
│   └── user.py
├── schemas/
│   ├── channel.py
│   ├── file.py
│   ├── message.py
│   ├── reaction.py
│   ├── search.py
│   └── user.py
├── scripts/
│   └── generate_test_data.py
├── database.py
└── main.py

## Database Schema

The database models are defined in the `backend/models` directory.

### User Model (`models/user.py`)

- **Description**: Represents a user in the system.

- **Fields**:
  - `id`: Integer primary key.
  - `username`: Unique username.
  - `email`: User's email address.
  - `full_name`: Full name of the user.
  - `hashed_password`: Hashed user password.
  - `is_active`: Boolean indicating if the user is active.
  - `is_superuser`: Boolean indicating if the user has admin privileges.
  - `created_at`: Timestamp when the user was created.
  - `updated_at`: Timestamp when the user was last updated.
  - `is_bot`: Boolean indicating if the user is a bot (e.g., AI assistant).

- **Relationships**:
  - `messages`: Messages sent by the user.
  - `channels`: Channels the user is a member of.
  - `created_channels`: Channels created by the user.
  - `files`: Files uploaded by the user.
  - `reactions`: Reactions made by the user.
  - `presence`: Presence status of the user.

### Channel Model (`models/channel.py`)

- **Description**: Represents a communication channel (e.g., chat room, direct message).

- **Fields**:
  - `id`: Integer primary key.
  - `name`: Name of the channel.
  - `description`: Optional description of the channel.
  - `is_direct_message`: Boolean indicating if the channel is a direct message.
  - `is_public`: Boolean indicating if the channel is public.
  - `is_vc`: Boolean indicating if the channel is a voice channel.
  - `created_at`: Timestamp when the channel was created.
  - `updated_at`: Timestamp when the channel was last updated.
  - `created_by_id`: Integer referencing the user who created the channel.

- **Relationships**:
  - `messages`: Messages sent in the channel.
  - `members`: Users who are members of the channel.
  - `created_by`: User who created the channel.

### Message Model (`models/message.py`)

- **Description**: Represents a message sent in a channel.

- **Fields**:
  - `id`: Integer primary key.
  - `content`: Text content of the message.
  - `created_at`: Timestamp when the message was created.
  - `updated_at`: Timestamp when the message was last updated.
  - `sender_id`: Integer referencing the user who sent the message.
  - `channel_id`: Integer referencing the channel the message belongs to.
  - `parent_id`: Integer referencing the parent message for threads/replies.
  - `has_attachments`: Boolean indicating if the message has attachments.
  - `is_bot`: Boolean indicating if the message was sent by a bot.

- **Relationships**:
  - `sender`: User who sent the message.
  - `channel`: Channel the message belongs to.
  - `reactions`: Reactions to the message.
  - `files`: Files attached to the message.
  - `replies`: Replies/threads to the message.

### File Model (`models/file.py`)

- **Description**: Represents a file uploaded to the system.

- **Fields**:
  - `id`: Integer primary key.
  - `filename`: Original name of the file.
  - `file_path`: Path where the file is stored.
  - `file_type`: MIME type of the file.
  - `file_size`: Size of the file in bytes.
  - `uploaded_by_id`: Integer referencing the user who uploaded the file.
  - `message_id`: Integer referencing the message the file is attached to.
  - `created_at`: Timestamp when the file was uploaded.
  - `updated_at`: Timestamp when the file was last updated.

### Presence Model (`models/presence.py`)

- **Description**: Represents a user's presence status.

- **Fields**:
  - `id`: Integer primary key.
  - `user_id`: Integer referencing the user.
  - `status`: Current status (online, offline, away, busy).
  - `last_seen`: Timestamp when the user was last active.

### Reaction Model (`models/reaction.py`)

- **Description**: Represents a reaction to a message.

- **Fields**:
  - `id`: Integer primary key.
  - `emoji`: The emoji used for the reaction.
  - `created_at`: Timestamp when the reaction was created.
  - `user_id`: Integer referencing the user who reacted.
  - `message_id`: Integer referencing the message that was reacted to.

## API Endpoints

The API endpoints are organized in the `backend/api/v1` directory.

### Authentication (`auth/router.py`)

- `/api/auth/register`: Register a new user
- `/api/auth/login`: Login and receive access/refresh tokens
- `/api/auth/refresh`: Refresh access token
- `/api/auth/logout`: Logout and invalidate tokens

### Users (`api/v1/users.py`)

- `/api/users/me`: Get/update current user information
- `/api/users/me/status`: Update user status
- `/api/users/me/profile-picture`: Update profile picture

### Channels (`api/v1/channels.py`)

- `/api/channels/`: Get all accessible channels
- `/api/channels/{channel_id}`: Get/update/delete channel
- `/api/channels/{channel_id}/members`: Manage channel members

### Messages (`api/v1/messages.py`)

- `/api/channels/{channel_id}/messages`: Get channel messages
- `/api/messages/{message_id}`: Get/update/delete message
- `/api/messages/{message_id}/thread`: Get message thread

### Files (`api/v1/files.py`)

- `/api/files/upload`: Upload file
- `/api/files/{file_id}`: Get/delete file
- `/api/files/{file_id}/download`: Download file

### Reactions (`api/v1/reactions.py`)

- `/api/messages/{message_id}/reactions`: Get/add/remove reactions

### Search (`api/v1/search.py`)

- `/api/search/messages`: Search messages
- `/api/search/files`: Search files
- `/api/search/channels`: Search channels

### WebSocket Endpoints (`api/v1/websockets.py`)

- `/ws/chat`: Real-time chat connection
- `/ws/presence`: Real-time presence updates

### Voice Chat (`api/v1/voice.py`)

- `/ws/voice/{channel_id}`: Voice chat WebSocket connection

### AI Features (`api/v1/ai_features.py`)

- `/api/v1/ai/message`: Send message to AI assistant
- `/api/v1/ai/context`: Get context for AI responses

## Data Models (Schemas)

Located in the `backend/schemas` directory, these Pydantic models define the shape of request/response data:

- `channel.py`
- `file.py`
- `message.py`
- `reaction.py`
- `search.py`
- `user.py`

### Database Initialization (`database.py`)

- **Description**: Sets up the database connection and session management.

- **Key Functions**:
  - Connecting to the database.
  - Initializing database models.
  - Providing a dependency (`get_db`) for API routes to access the database session.

### Alembic Migrations (`alembic/`)

- **Files**:
  - `env.py`: Alembic configuration for migrations.
  - `script.py.mako`: Template for generating migration scripts.

- **Purpose**: Manages database schema changes through versioned migrations.

### AI Integration (`ai/messages_to_rag.py`)

- **Description**: Integrates messages into a Retrieval-Augmented Generation (RAG) system using Pinecone and OpenAI embeddings.

- **Key Functions**:
  - Fetching messages from the database.
  - Preparing documents with metadata.
  - Uploading documents to Pinecone for vector storage.

### Test Data Generation (`scripts/generate_test_data.py`)

- **Description**: Generates mock data for testing and development.

- **Key Functions**:
  - Creating test users, channels, messages, files, reactions, and presence data.
  - Populating the database with test data.

### Main Application Entry Point (`main.py`)

- **Description**: Initializes the FastAPI application.

- **Key Components**:
  - Includes middleware for CORS.
  - Mounts all API routers.
  - Defines startup events (e.g., database initialization).

### Dependencies (`api/deps.py`)

- **Description**: Defines common dependencies for API routes.

- **Key Functions**:
  - `get_db`: Provides a database session.
  - `get_current_user`: Retrieves the current authenticated user.
  - `get_user_from_token`: Retrieves a user from a token.

## Conclusion

This overview provides a detailed look into the backend architecture and components of the project. As a new developer, you should now have a solid understanding of the system's structure and how the different parts interact.

We're excited to have you on the team! If you have any questions or need further clarification on any part of the codebase, please don't hesitate to reach out.

Welcome aboard!
