# API Endpoints Documentation

This document provides a comprehensive overview of all available API endpoints in the backend service.

## Table of Contents
- [Running Locally](#running-locally)
- [Authentication](#authentication)
- [Users](#users)
- [Channels](#channels)
- [Messages](#messages)
- [Files](#files)
- [Reactions](#reactions)
- [Search](#search)
- [WebSocket Connections](#websocket-connections)

## Running Locally

To run the backend server locally:

1. Make sure you're in the backend directory:
```bash
cd backend
```

2. Set up Python virtual environment (first time only):
```bash
# Create virtual environment
python -m venv venv

# Activate virtual environment
# On Windows:
.\venv\Scripts\activate
# On macOS/Linux:
source venv/bin/activate
```

3. Install dependencies (first time only):
```bash
pip install -r requirements.txt
```

4. Start the server with uvicorn:
```bash
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

The server will be available at `http://localhost:8000`

Key uvicorn options:
- `--reload`: Enable auto-reload on code changes (development only)
- `--host 0.0.0.0`: Make server accessible from other devices on the network
- `--port 8000`: Set the port number (can be changed if needed)

Interactive API documentation will be available at:
- Swagger UI: `http://localhost:8000/docs`
- ReDoc: `http://localhost:8000/redoc`

To deactivate the virtual environment when you're done:
```bash
deactivate
```

## Base URL
All HTTP endpoints are prefixed with `/api/`

## Authentication
Authentication is required for all endpoints. Send the JWT token in the Authorization header:
```
Authorization: Bearer <your_jwt_token>
```

## Users

### Get Current User
- **GET** `/users/me`
- Returns information about the currently authenticated user
- Response: User object

### Update Current User
- **PUT** `/users/me`
- Update current user's information
- Request Body:
  ```json
  {
    "full_name": "string",
    "email": "string"
  }
  ```
- Response: Updated User object

### Get Users List
- **GET** `/users`
- Returns list of all active users
- Query Parameters:
  - `skip`: number (default: 0)
  - `limit`: number (default: 50)
- Response: Array of User objects

### Get User Presence
- **GET** `/users/presence`
- Returns presence information for all active users
- Response: Array of UserPresence objects
  ```json
  {
    "user_id": "number",
    "username": "string",
    "status": "string",
    "last_seen": "datetime"
  }
  ```

### Get User by ID
- **GET** `/users/{user_id}`
- Returns information about a specific user
- Response: User object

### Update Profile Picture
- **PUT** `/users/me/profile-picture`
- Update user's profile picture
- Request: Form data with image file
- Response: Updated User object

### Update Status
- **PUT** `/users/me/status`
- Update user's status
- Request Body:
  ```json
  {
    "status": "string" // "online", "offline", "away", "busy"
  }
  ```
- Response: Updated User object

## Channels

### Get Channels
- **GET** `/channels`
- Returns channels the current user has access to (public channels and private channels where user is a member)
- Query Parameters:
  - `skip`: number (default: 0)
  - `limit`: number (default: 100)
  - `show_public`: boolean (default: true) - If true, includes public channels in addition to member channels
- Response: Array of Channel objects
  ```json
  {
    "id": "number",
    "name": "string",
    "description": "string",
    "is_direct_message": "boolean",
    "is_public": "boolean",
    "created_at": "datetime",
    "created_by_id": "number",
    "members": ["number"]
  }
  ```

### Create Channel
- **POST** `/channels`
- Create a new channel
- Request Body:
  ```json
  {
    "name": "string",
    "description": "string",
    "is_direct_message": "boolean",
    "is_public": "boolean",
    "member_ids": ["number"] // Required for private channels
  }
  ```
- Notes:
  - For private channels (`is_public: false`), `member_ids` must be provided
  - For public channels (`is_public: true`), `member_ids` is optional
  - The creator is automatically added as a member
- Response: Created Channel object

### Get Channel
- **GET** `/channels/{channel_id}`
- Get information about a specific channel
- Access Control:
  - Public channels: Accessible by all users
  - Private channels: Only accessible by channel members
- Response: Channel object

### Update Channel
- **PUT** `/channels/{channel_id}`
- Update channel information
- Access Control:
  - Only the channel creator can update channel settings
- Request Body:
  ```json
  {
    "name": "string",
    "description": "string",
    "is_public": "boolean"
  }
  ```
- Response: Updated Channel object

### Delete Channel
- **DELETE** `/channels/{channel_id}`
- Delete a channel
- Access Control:
  - Only the channel creator can delete the channel
- Response: 204 No Content

### Channel Members

#### Add Member
- **POST** `/channels/{channel_id}/members`
- Add a member to a channel
- Access Control:
  - Only available for private channels
  - Only current members can add new members
- Request Body:
  ```json
  {
    "user_id": "number"
  }
  ```
- Response: 204 No Content

#### Remove Member
- **DELETE** `/channels/{channel_id}/members/{user_id}`
- Remove a member from a channel
- Access Control:
  - Only available for private channels
  - Only the channel creator can remove members
  - Members can remove themselves
- Response: 204 No Content

#### Get Members
- **GET** `/channels/{channel_id}/members`
- Get list of channel members
- Access Control:
  - Only available for private channels
  - Only current members can view the member list
- Response: Array of User objects

## Messages

### Get Channel Messages
- **GET** `/channels/{channel_id}/messages`
- Get messages in a channel
- Query Parameters:
  - `skip`: number (default: 0)
  - `limit`: number (default: 50)
- Response: Array of Message objects

### Create Message
- **POST** `/channels/{channel_id}/messages`
- Create a new message in a channel
- Request Body:
  ```json
  {
    "content": "string"
  }
  ```
- Response: Created Message object

### Get Message
- **GET** `/messages/{message_id}`
- Get a specific message
- Response: Message object

### Update Message
- **PUT** `/messages/{message_id}`
- Update a message
- Request Body:
  ```json
  {
    "content": "string"
  }
  ```
- Response: Updated Message object

### Delete Message
- **DELETE** `/messages/{message_id}`
- Delete a message
- Response: 204 No Content

### Message Replies

#### Get Replies
- **GET** `/messages/{message_id}/replies`
- Get replies to a message
- Response: Array of Message objects

#### Create Reply
- **POST** `/messages/{message_id}/replies`
- Create a reply to a message
- Request Body:
  ```json
  {
    "content": "string"
  }
  ```
- Response: Created Message object

#### Get Thread
- **GET** `/messages/{message_id}/thread`
- Get entire message thread (parent message and all replies)
- Response: Array of Message objects

## Files

### Upload File
- **POST** `/files/upload`
- Upload a file
- Query Parameters:
  - `message_id`: number (optional)
- Request: Form data with file
- Response: File object
- Limitations:
  - Max file size: 50MB
  - Supported types: jpg, png, gif, pdf, txt

### Get File
- **GET** `/files/{file_id}`
- Get file information
- Response: File object

### Delete File
- **DELETE** `/files/{file_id}`
- Delete a file
- Response: 204 No Content

### Get Channel Files
- **GET** `/files/channels/{channel_id}/files`
- Get files in a channel
- Query Parameters:
  - `skip`: number (default: 0)
  - `limit`: number (default: 50)
- Response: Array of File objects

## Reactions

### Add Reaction
- **POST** `/messages/{message_id}/reactions`
- Add a reaction to a message
- Request Body:
  ```json
  {
    "emoji": "string"
  }
  ```
- Response: Reaction object

### Remove Reaction
- **DELETE** `/messages/{message_id}/reactions/{reaction_id}`
- Remove a reaction from a message
- Response: 204 No Content

### Get Reactions
- **GET** `/messages/{message_id}/reactions`
- Get reactions for a message
- Response: Array of Reaction objects

## Search

### Search Messages
- **GET** `/search/messages`
- Search messages across all accessible channels
- Query Parameters:
  - `query`: string
  - `skip`: number (default: 0)
  - `limit`: number (default: 20)
- Response: Array of MessageSearchResult objects

### Search Files
- **GET** `/search/files`
- Search files across all accessible channels
- Query Parameters:
  - `query`: string
  - `skip`: number (default: 0)
  - `limit`: number (default: 20)
- Response: Array of FileSearchResult objects

### Search Channels
- **GET** `/search/channels`
- Search accessible channels
- Query Parameters:
  - `query`: string
  - `skip`: number (default: 0)
  - `limit`: number (default: 20)
- Response: Array of ChannelSearchResult objects

## WebSocket Connections

### Presence WebSocket
- **WS** `/ws/presence`
- Real-time user presence updates
- Query Parameters:
  - `token`: string (JWT token)
- Messages:
  - Client -> Server:
    ```json
    {
      "type": "status_update",
      "status": "string" // "online", "offline", "away", "busy"
    }
    ```
  - Server -> Client:
    ```json
    {
      "type": "presence_update",
      "user_id": "number",
      "status": "string",
      "timestamp": "datetime"
    }
    ```

### Chat WebSocket
- **WS** `/ws/chat`
- Real-time chat messaging
- Query Parameters:
  - `token`: string (JWT token)
- Messages:
  - Join Channel:
    ```json
    {
      "type": "join_channel",
      "channel_id": "number"
    }
    ```
  - Leave Channel:
    ```json
    {
      "type": "leave_channel",
      "channel_id": "number"
    }
    ```
  - Send Message:
    ```json
    {
      "type": "message",
      "channel_id": "number",
      "content": "string"
    }
    ```
  - New Message (Server -> Client):
    ```json
    {
      "type": "new_message",
      "message": {
        "id": "number",
        "content": "string",
        "sender_id": "number",
        "created_at": "datetime"
      }
    }
    ```

### Channel Events
The WebSocket connection handles various channel-related events:

#### Message Events
- `message`: New message in a channel
- `channel_access_denied`: User doesn't have access to the channel
- `error`: General error message

#### Channel Access Events
- `join_channel`: User joins a channel
- `leave_channel`: User leaves a channel

#### Error Codes
- `4001`: Channel access denied
- `4002`: Authentication failed
- `1003`: Unsupported operation

### WebSocket Message Format
```json
{
  "type": "message",
  "message": {
    "id": "string",
    "content": "string",
    "channel_id": "string",
    "sender_id": "string",
    "created_at": "string"
  }
}
```

## Error Responses
All endpoints may return the following error responses:
- 400 Bad Request: Invalid input
- 401 Unauthorized: Missing or invalid authentication
- 403 Forbidden: Insufficient permissions
- 404 Not Found: Resource not found
- 500 Internal Server Error: Server error

Error response format:
```json
{
  "detail": "Error message"
}
``` 