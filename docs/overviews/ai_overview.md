# Project AI Features Overview

## Table of Contents

- [Introduction](#introduction)
- [Architecture](#architecture)
- [AI Components](#ai-components)
  - [Message Retrieval and Embedding](#message-retrieval-and-embedding)
  - [AI Message Endpoint](#ai-message-endpoint)
  - [WebSocket Integration](#websocket-integration)
- [AI Assistant Behavior](#ai-assistant-behavior)
- [Technologies Used](#technologies-used)
- [File Structure](#file-structure)
- [Detailed Component Breakdown](#detailed-component-breakdown)
  - [Message Retrieval and Embedding Script](#message-retrieval-and-embedding-script)
  - [AI Message API Endpoint](#ai-message-api-endpoint)
  - [WebSocket Manager Enhancements](#websocket-manager-enhancements)
- [Future Improvements](#future-improvements)
- [Conclusion](#conclusion)

## Introduction

The project incorporates advanced AI features to provide an intelligent chatbot that interacts with users within the chat application. The AI assistant, modeled after the character **Lain Iwakura** from *Serial Experiments Lain*, generates responses based on the conversation context and the entire message history stored in the application.

## Architecture

The AI features are built upon a **Retrieval-Augmented Generation (RAG)** architecture, utilizing gpt-4o-mini for response generation and Pinecone for vector storage of message embeddings. The system retrieves relevant messages from the database, embeds them, and stores them in Pinecone to create a rich knowledge base that the AI assistant can draw upon when generating responses.

## AI Components

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
