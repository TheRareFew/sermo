# Chat Application Backend

## Channel API Endpoints

### GET /api/channels/
- Get all channels the current user is a member of
- Query Parameters:
  - skip: int (default: 0) - Number of records to skip
  - limit: int (default: 100) - Maximum number of records to return
- Response: List of Channel objects

### POST /api/channels/
- Create a new channel
- Request Body:
  ```json
  {
    "name": "string",
    "description": "string (optional)",
    "is_direct_message": boolean,
    "member_ids": [int]
  }
  ```
- Response: Created Channel object

### GET /api/channels/{channel_id}
- Get channel by ID
- Path Parameters:
  - channel_id: int
- Response: Channel object

### PUT /api/channels/{channel_id}
- Update channel details
- Path Parameters:
  - channel_id: int
- Request Body:
  ```json
  {
    "name": "string (optional)",
    "description": "string (optional)"
  }
  ```
- Response: Updated Channel object

### DELETE /api/channels/{channel_id}
- Delete a channel
- Path Parameters:
  - channel_id: int
- Response: 204 No Content

### POST /api/channels/{channel_id}/members
- Add a member to a channel
- Path Parameters:
  - channel_id: int
- Request Body:
  ```json
  {
    "user_id": int
  }
  ```
- Response: 204 No Content

### DELETE /api/channels/{channel_id}/members/{user_id}
- Remove a member from a channel
- Path Parameters:
  - channel_id: int
  - user_id: int
- Response: 204 No Content

### GET /api/channels/{channel_id}/members
- Get all members of a channel
- Path Parameters:
  - channel_id: int
- Response: List of user IDs

## Error Handling
All endpoints include proper error handling for:
- 404 Not Found: Resource doesn't exist
- 403 Forbidden: User doesn't have permission
- 500 Internal Server Error: Database or server errors

## Authentication
All endpoints require authentication using JWT tokens. 

## File API Endpoints

### POST /api/files/upload
- Upload a file
- Request:
  - Multipart form data:
    - file: File data
    - message_id: Optional[int] - ID of the message to attach the file to
- Response: File object
- Limitations:
  - Maximum file size: 50MB
  - Supported file types: jpg, png, gif, pdf, txt

### GET /api/files/{file_id}
- Get file by ID
- Path Parameters:
  - file_id: int
- Response: File object

### DELETE /api/files/{file_id}
- Delete file
- Path Parameters:
  - file_id: int
- Response: 204 No Content
- Authorization: Only file uploader or channel admin can delete

### GET /api/channels/{channel_id}/files
- Get files in channel
- Path Parameters:
  - channel_id: int
- Query Parameters:
  - skip: int (default: 0) - Number of records to skip
  - limit: int (default: 50) - Maximum number of records to return
- Response: List of File objects

## File Object Schema
```json
{
  "id": int,
  "filename": string,
  "file_type": string,
  "file_size": int,
  "file_url": string,
  "uploaded_at": datetime,
  "message_id": int
}
```

## File Upload Features
- Secure file handling
- File size validation
- File type validation
- Unique filename generation
- Physical file storage management
- Database tracking
- Access control based on channel membership 

## Reaction API Endpoints

### POST /api/messages/{message_id}/reactions
- Add a reaction to a message
- Path Parameters:
  - message_id: int
- Request Body:
  ```json
  {
    "emoji": string
  }
  ```
- Response: Reaction object

### DELETE /api/messages/{message_id}/reactions/{reaction_id}
- Remove a reaction from a message
- Path Parameters:
  - message_id: int
  - reaction_id: int
- Response: 204 No Content
- Authorization: Only the reaction creator can remove it

### GET /api/messages/{message_id}/reactions
- Get all reactions for a message
- Path Parameters:
  - message_id: int
- Response: List of Reaction objects

## Reaction Object Schema
```json
{
  "id": int,
  "emoji": string,
  "message_id": int,
  "user_id": int
}
```

## Features
- One emoji per user per message
- Access control based on channel membership
- Full CRUD operations
- Error handling for duplicates and permissions 

## Search API Endpoints

### GET /api/search/messages
- Search messages across all accessible channels
- Query Parameters:
  - query: string - Search term
  - skip: int (default: 0) - Number of records to skip
  - limit: int (default: 20) - Maximum number of records to return
- Response: List of MessageSearchResult objects
```json
{
  "id": int,
  "content": string,
  "created_at": datetime,
  "sender_id": int,
  "channel_id": int,
  "channel_name": string
}
```

### GET /api/search/files
- Search files across all accessible channels
- Query Parameters:
  - query: string - Search term (matches filename or file type)
  - skip: int (default: 0) - Number of records to skip
  - limit: int (default: 20) - Maximum number of records to return
- Response: List of FileSearchResult objects
```json
{
  "id": int,
  "filename": string,
  "file_type": string,
  "file_url": string,
  "uploaded_at": datetime,
  "channel_id": int,
  "channel_name": string
}
```

### GET /api/search/channels
- Search accessible channels
- Query Parameters:
  - query: string - Search term (matches name or description)
  - skip: int (default: 0) - Number of records to skip
  - limit: int (default: 20) - Maximum number of records to return
- Response: List of ChannelSearchResult objects
```json
{
  "id": int,
  "name": string,
  "description": string,
  "is_direct_message": boolean,
  "member_count": int
}
```

## Search Features
- Full text search across messages, files, and channels
- Results scoped to user's accessible channels
- Pagination support
- Channel context included in results
- Performance optimized queries
- Error handling and logging 

## User API Endpoints

### GET /api/users/me
- Get current user information
- Response: User object

### PUT /api/users/me
- Update current user information
- Request Body:
  ```json
  {
    "full_name": "string (optional)",
    "email": "string (optional)"
  }
  ```
- Response: Updated User object

### GET /api/users/{user_id}
- Get user by ID
- Path Parameters:
  - user_id: int
- Response: User object

### GET /api/users
- Get list of users
- Query Parameters:
  - skip: int (default: 0)
  - limit: int (default: 50)
- Response: List of User objects

### PUT /api/users/me/profile-picture
- Update user profile picture
- Request: Multipart form data with image file
- Response: Updated User object

### PUT /api/users/me/status
- Update user status
- Request Body:
  ```json
  {
    "status": "string (online|offline|away|busy)"
  }
  ```
- Response: Updated User object

### GET /api/users/presence
- Get users presence information
- Response: List of UserPresence objects
  ```json
  {
    "user_id": int,
    "username": string,
    "status": string,
    "last_seen": datetime
  }
  ```

## User Object Schema
```json
{
  "id": int,
  "username": string,
  "email": string,
  "full_name": string,
  "profile_picture_url": string,
  "status": string,
  "last_seen": datetime,
  "created_at": datetime,
  "is_active": boolean
}
```

## Features
- User profile management
- Status and presence tracking
- Profile picture handling
- Email uniqueness validation
- Active user filtering
- Error handling and logging 

## WebSocket Endpoints

### WebSocket /ws/presence
- Real-time user presence updates
- Connection:
  - Query Parameters:
    - token: JWT authentication token
- Messages:
  - Client to Server:
    ```json
    {
      "type": "status_update",
      "status": "online|offline|away|busy"
    }
    ```
  - Server to Client:
    ```json
    {
      "type": "presence_update",
      "user_id": int,
      "status": string,
      "timestamp": string
    }
    ```

### WebSocket /ws/chat
- Real-time chat messaging
- Connection:
  - Query Parameters:
    - token: JWT authentication token
- Messages:
  - Join Channel:
    ```json
    {
      "type": "join_channel",
      "channel_id": int
    }
    ```
  - Leave Channel:
    ```json
    {
      "type": "leave_channel",
      "channel_id": int
    }
    ```
  - Send Message:
    ```json
    {
      "type": "message",
      "channel_id": int,
      "content": string
    }
    ```
  - New Message (Server to Client):
    ```json
    {
      "type": "new_message",
      "message": {
        "id": int,
        "content": string,
        "sender_id": int,
        "created_at": string
      }
    }
    ```

## WebSocket Features
- Real-time presence updates
- Channel-based messaging
- Authentication using JWT tokens
- Automatic status updates on connect/disconnect
- Channel membership validation
- Error handling and logging
- Connection management 

## Test Data Generation

The application includes a test data generation script located at `app/scripts/generate_test_data.py`. This script uses the Faker library to generate realistic test data for all models in the application.

### Generated Data Includes:
- Users with randomized usernames, emails, and profile information
- Channels (both regular and direct message channels)
- Messages with realistic content and threaded replies
- File attachments with various types (images, PDFs, text files)
- User presence information

### Usage
To generate test data, run:
```bash
python -m app.scripts.generate_test_data
```

### Default Generation Parameters:
- 10 users (all with password "testpassword123")
- 5 channels
- 20 messages per channel (with 30% chance of having 1-3 replies)
- File attachments on 20% of messages
- Presence records for all users

### Data Characteristics:
- Users have realistic names, emails, and usernames
- Channels have a mix of regular and direct message types
- Messages include paragraphs of realistic text
- Files have appropriate extensions and size ranges
- Timestamps are distributed over the last 30 days
- User statuses randomly set to online/offline/away/busy

The generated data maintains referential integrity and follows all model constraints. 