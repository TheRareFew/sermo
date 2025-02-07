# Project AI Features Overview

## Table of Contents

- [Introduction](#introduction)
- [Architecture](#architecture)
- [AI Components](#ai-components)
  - [Message Retrieval and Embedding](#message-retrieval-and-embedding)
  - [AI Message Endpoint](#ai-message-endpoint)
  - [Lain Message History](#lain-message-history)
  - [WebSocket Integration](#websocket-integration)
- [AI Assistant Behavior](#ai-assistant-behavior)
- [Technologies Used](#technologies-used)
- [File Structure](#file-structure)
- [Detailed Component Breakdown](#detailed-component-breakdown)
  - [Message Retrieval and Embedding Script](#message-retrieval-and-embedding-script)
  - [AI Message API Endpoint](#ai-message-api-endpoint)
  - [Lain Message History Endpoint](#lain-message-history-endpoint)
  - [WebSocket Manager Enhancements](#websocket-manager-enhancements)
- [Future Improvements](#future-improvements)
- [Conclusion](#conclusion)

## Introduction

The project incorporates advanced AI features to provide an intelligent chatbot that interacts with users within the chat application. The AI assistant, modeled after the character **Lain Iwakura** from *Serial Experiments Lain*, generates responses based on the conversation context, previous interactions with the user, and the entire message history stored in the application.

## Architecture

The AI features are built upon a **Retrieval-Augmented Generation (RAG)** architecture, utilizing gpt-4o-mini for response generation and two separate Pinecone indexes for vector storage:

1. **PINECONE_INDEX** (3072 dimensions): Used for storing file descriptions and metadata
2. **PINECONE_INDEX_TWO** (1536 dimensions): Used for storing message embeddings

The system combines three types of context:
1. Historical context from previous conversations between Lain and the user
2. Relevant messages from across all channels retrieved via vector similarity search (1536d embeddings)
3. Relevant file descriptions and metadata retrieved via vector similarity search (3072d embeddings)

This multi-context approach allows Lain to maintain conversation consistency while drawing upon both message history and file knowledge.

## AI Components

### Message and File Retrieval System

The system uses two different embedding models and Pinecone indexes for optimal performance:

1. **Message Embeddings**
   - Model: text-embedding-ada-002 (1536 dimensions)
   - Index: PINECONE_INDEX_TWO
   - Used for: Chat messages and conversation history

2. **File Embeddings**
   - Model: text-embedding-3-large (3072 dimensions)
   - Index: PINECONE_INDEX
   - Used for: File descriptions, summaries, and metadata
   - Additional metadata stored:
     - File type
     - Associated message content (if uploaded with a message)
     - Upload information (user, timestamp)

### File Processing and Embedding

The file processing system (`backend/app/ai/file_handler.py`) handles various file types and generates embeddings for vector search:

**Key Functions:**

- **`process_file()`**: Main function that processes different file types
  - Handles text files, PDFs, and images
  - For PDFs and text files:
    - Splits content into chunks using RecursiveCharacterTextSplitter
    - Generates summaries for each chunk
    - Stores both raw chunks and summaries in 3072d index
  - For images:
    - Generates a single description
    - Stores in 3072d index

- **`upload_to_pinecone_with_model()`**: Uploads documents to Pinecone
  - Uses text-embedding-3-large model for 3072d embeddings
  - Includes comprehensive metadata:
    - File ID and name
    - File type
    - Upload information
    - Associated message content (if any)
    - Content type (raw_chunk/description/image_description)
    - Chunk information (index, total chunks) for PDF/text files

**Example Metadata Format for PDF Chunks:**
```json
{
    "file_id": "123",
    "filename": "document.pdf",
    "uploaded_by": "user123",
    "file_type": "application/pdf",
    "message_text": "Here's the documentation we discussed",
    "upload_date": "2024-01-15T10:30:00Z",
    "chunk_index": 0,
    "total_chunks": 5,
    "content_type": "raw_chunk"
}
```

**Example Metadata Format for Descriptions:**
```json
{
    "file_id": "123",
    "filename": "document.pdf",
    "uploaded_by": "user123",
    "file_type": "application/pdf",
    "message_text": "Here's the documentation we discussed",
    "upload_date": "2024-01-15T10:30:00Z",
    "chunk_index": 0,
    "total_chunks": 5,
    "content_type": "description"
}
```

### Message Retrieval and Embedding

The script responsible for retrieving and embedding messages is `messages_to_rag.py`. It fetches all messages from the database, processes them, and uploads them to Pinecone.

**File Path:** `backend/ai/messages_to_rag.py`

**Key Functions:**

- **`load_environment()`**: Loads and validates the required environment variables.
- **`fetch_messages(database_url)`**: Fetches all messages from the database.
- **`prepare_documents(messages)`**: Converts messages to LangChain `Document` objects.
- **`split_documents(documents)`**: Splits documents into smaller chunks for efficient embedding.
- **`upload_to_pinecone(documents, index_name)`**: Uploads the processed documents to Pinecone.

**Example Usage:**

[CODE START]
messages = fetch_messages(env_vars["DATABASE_URL"])
documents = prepare_documents(messages)
split_docs = split_documents(documents)
upload_to_pinecone(split_docs, env_vars["PINECONE_INDEX_TWO"])
[CODE END]

### Lain Message History

The system maintains conversation history between Lain and individual users to ensure consistent and contextually aware responses. This is implemented through two main components:

**1. Lain Messages Endpoint**

**File Path:** `backend/app/api/v1/ai_features.py`

**Endpoint Details:**
- **Method:** `GET`
- **Path:** `/api/v1/ai/lain_messages`
- **Query Parameters:**
  - `user_id` (optional): ID of the prompting user. If not provided, uses the current authenticated user.
  - `limit` (optional): Number of messages to retrieve (default: 10)

**Response Format:**
```json
[
  {
    "id": 123,
    "content": "Message content",
    "created_at": "2024-03-19T12:00:00Z",
    "sender_id": 1,
    "channel_id": 1,
    "parent_id": 456,
    "is_bot": true
  }
]
```

**2. Context Integration**

The message history is integrated into Lain's responses through:
- Retrieving the 10 most recent conversations between Lain and the user
- Including both the user's messages and Lain's responses in chronological order
- Prepending this history to the vector-retrieved context
- Updating the prompt template to maintain consistency with previous conversations

**Example Context Format:**
```
Previous Conversation:
User: How do you feel about technology?
Lain: Technology is not just a tool, it's becoming part of who we are. The line between the real and virtual is blurring... What interests you about technology?

User: What programming languages do you know?
Lain: I'm familiar with many... Python fascinates me the most. It's elegant, like the patterns in the Wired. What draws you to ask about programming?

[Additional vector-retrieved context follows...]
```

### AI Message Endpoint

The API endpoint `/api/v1/ai/message` allows users to send messages to the AI assistant. The assistant processes the user's message, retrieves relevant context from Pinecone, generates a response using gpt-4o-mini, and sends the response back to the user via a WebSocket broadcast.

**File Path:** `backend/app/api/v1/ai_features.py`

**Key Functions:**

- **`send_message_to_bot(request, current_user, db)`**: Handles incoming messages to the AI assistant.
  - Initializes embeddings and sets up the Pinecone vector store.
  - Retrieves relevant documents based on the user's message.
  - Constructs a prompt with context for the AI assistant.
  - Queries the gpt-4o-mini model for a response.
  - Creates a bot user if not already present in the system.
  - Saves the bot's message to the database.
  - Broadcasts the bot's response to all connected clients in the channel.

**Example Usage:**

[CODE START]
@router.post("/message", response_model=MessageResponse)
async def send_message_to_bot(
    request: MessageRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    # ... function implementation ...
[CODE END]

### WebSocket Integration

The WebSocket manager (`backend/app/api/v1/websockets.py`) is enhanced to handle broadcasting messages from the AI assistant to all connected clients.

**Key Functions:**

- **`broadcast_message(channel_id, message, exclude_user_id)`**: Broadcasts a message to all users in a channel.
- **Handling of bot messages**: Ensures that messages sent by the bot user are correctly formatted and sent to clients.

**Example:**

[CODE START]
await manager.broadcast_message(
    channel_id=request.channel_id,
    message=bot_message
)
[CODE END]

## AI Assistant Behavior

The AI assistant is designed to:

- **Respond as Lain Iwakura**, maintaining the character's persona.
- Utilize context from relevant past messages to provide informed responses.
- Interact with users seamlessly within the chat application.
- Only use information from the provided context and indicate when information is not available.

**Prompt Template Example:**

[CODE START]
template = PromptTemplate(
    template="""You are Lain Iwakura, a fictional character from "Serial Experiments Lain". Respond to the user as Lain would, while still being helpful and informative. Use the provided context to answer the user's question. Only use information from the context provided. If you can't find relevant information in the context, say so.

Context:
{context}

User Question: {query}

Answer as Lain Iwakura. If no relevant information is found, say so, but still be conversational about it.""",
    input_variables=["query", "context"]
)
[CODE END]

## Technologies Used

- **Python**
- **FastAPI**: For building API endpoints.
- **SQLAlchemy**: For ORM and database interactions.
- **LangChain**: For LLM orchestration and prompt management.
- **Pinecone**: For vector storage of message embeddings.
- **gpt-4o-mini**: For generating AI responses.
- **WebSockets**: For real-time communication with clients.

## File Structure

[CODE START]
backend/
├── ai/
│   └── messages_to_rag.py
├── app/
│   ├── api/
│   │   └── v1/
│   │       ├── ai_features.py
│   │       ├── websockets.py
│   │       └── ... other API modules ...
│   ├── auth/
│   │   └── models.py
│   ├── models/
│   │   ├── message.py
│   │   └── ... other models ...
│   └── ... other directories ...
└── ... other files and directories ...
[CODE END]

## Detailed Component Breakdown

### Message Retrieval and Embedding Script

**Path:** `backend/ai/messages_to_rag.py`

This script performs the following steps:

1. **Environment Setup**: Loads environment variables such as API keys and database URLs.
2. **Fetching Messages**: Connects to the database and retrieves all messages along with metadata (sender, channel, timestamp).
3. **Document Preparation**: Converts messages into LangChain `Document` objects, including metadata for context.
4. **Document Splitting**: Utilizes a text splitter to handle long messages and ensure they fit within token limits.
5. **Embedding and Upload**: Uses OpenAI embeddings to encode messages and uploads them to Pinecone for vector storage.

**Important Functions:**

- **`load_environment()`**
- **`fetch_messages(database_url)`**
- **`prepare_documents(messages)`**
- **`split_documents(documents)`**
- **`upload_to_pinecone(documents, index_name)`**

### AI Message API Endpoint

**Path:** `backend/app/api/v1/ai_features.py`

This API endpoint allows users to interact with the AI assistant by sending messages.

**Workflow:**

1. **Receive Message**: The endpoint receives a message from the user, including the channel ID and, if applicable, the parent message ID for threaded replies.
2. **Context Retrieval**: Retrieves the top 5 most relevant messages from Pinecone based on the user's input.
3. **Prompt Construction**: Generates a prompt for the AI assistant, incorporating the retrieved context.
4. **AI Response Generation**: Calls the gpt-4o-mini model to generate a response.
5. **Bot Message Creation**: Saves the AI assistant's response as a message in the database.
6. **WebSocket Broadcast**: Uses the WebSocket manager to broadcast the bot's message to all clients in the channel.

**Key Classes and Functions:**

- **`MessageRequest`**: Pydantic model for incoming requests.
- **`MessageResponse`**: Pydantic model for responses.
- **`send_message_to_bot()`**: Main function handling the message processing.

### Lain Message History Endpoint

**Path:** `backend/app/api/v1/ai_features.py`

This endpoint retrieves the 10 most recent conversations between Lain and the user.

**Endpoint Details:**
- **Method:** `GET`
- **Path:** `/api/v1/ai/lain_messages`
- **Query Parameters:**
  - `user_id` (optional): ID of the prompting user. If not provided, uses the current authenticated user.
  - `limit` (optional): Number of messages to retrieve (default: 10)

**Response Format:**
```json
[
  {
    "id": 123,
    "content": "Message content",
    "created_at": "2024-03-19T12:00:00Z",
    "sender_id": 1,
    "channel_id": 1,
    "parent_id": 456,
    "is_bot": true
  }
]
```

### WebSocket Manager Enhancements

**Path:** `backend/app/api/v1/websockets.py`

The WebSocket connection manager is responsible for real-time communication between the server and clients.

**Enhancements for AI Integration:**

- Ensures that messages from the AI assistant are formatted correctly and include necessary metadata.
- Handles broadcasting of messages, including those sent by bot users.
- Manages connections and disconnections, keeping track of active users.

**Key Functions:**

- **`broadcast_message()`**
- **`broadcast_presence()`**
- **`connect()`**
- **`disconnect()`**

## Future Improvements

- **Enhanced Context Retrieval**: Implement more sophisticated retrieval methods to include a wider range of relevant messages.
- **Persona Customization**: Allow dynamic selection of AI assistant personas.
- **Improved Error Handling**: Enhance exception handling to cover edge cases and provide more informative feedback.
- **Scalability**: Optimize performance for handling a large number of concurrent users and messages.

## Conclusion

The AI features integrated into the project provide a dynamic and interactive experience for users, leveraging state-of-the-art NLP technologies. By combining message retrieval, context-aware prompt generation, and seamless real-time communication, the AI assistant enriches the chat application and offers opportunities for further development and enhancement.