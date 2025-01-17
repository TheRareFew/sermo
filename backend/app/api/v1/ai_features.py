from fastapi import APIRouter, Depends, HTTPException
from typing import List, Optional
from pydantic import BaseModel, Field
from langchain_openai import ChatOpenAI
from langchain.prompts.prompt import PromptTemplate
from langchain_pinecone import PineconeVectorStore
from langchain_community.embeddings import OpenAIEmbeddings
from ..deps import get_current_user, get_db
from app.models.user import User
from app.models.message import Message
from sqlalchemy.orm import Session
from datetime import datetime, UTC
import os
from dotenv import load_dotenv
import atexit
from langsmith import Client
import logging
from .websockets import manager
import asyncio
from sqlalchemy.orm import joinedload
from ...ai.message_indexer import index_message
from ...models.reaction import Reaction as ReactionModel

# Set up logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

router = APIRouter()

# Load and validate environment variables
load_dotenv()

# Initialize LangSmith client
langsmith_client = Client()

# Validate required environment variables
required_vars = ["OPENAI_API_KEY", "PINECONE_API_KEY", "PINECONE_INDEX", "PINECONE_INDEX_TWO"]
missing_vars = [var for var in required_vars if not os.getenv(var)]
if missing_vars:
    raise EnvironmentError(f"Missing required environment variables: {', '.join(missing_vars)}")

# Define request and response models
class MessageRequest(BaseModel):
    message: str = Field(..., min_length=1)
    channel_id: int = Field(..., gt=0)
    parent_message_id: int = Field(..., gt=0)  # ID of the message being replied to

class MessageResponse(BaseModel):
    response: str
    message_id: str

# Add Pydantic model for Lain's messages
class LainMessageResponse(BaseModel):
    id: int
    content: str
    created_at: datetime
    sender_id: int
    channel_id: int
    parent_id: Optional[int]
    is_bot: bool

    class Config:
        from_attributes = True  # Allows the model to read data from ORM objects

@router.post("/message", response_model=MessageResponse)
async def send_message_to_bot(
    request: MessageRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    logger.info(f"Received message: {request.message} for channel: {request.channel_id}")
    
    # Initialize embeddings for different dimensions
    embeddings_1536 = OpenAIEmbeddings(model="text-embedding-ada-002")  # 1536 dimensions
    embeddings_3072 = OpenAIEmbeddings(model="text-embedding-3-large")  # 3072 dimensions
    logger.info("Initialized embeddings")

    # Set up Pinecone vector stores for both messages and files
    messages_index = os.getenv("PINECONE_INDEX_TWO")  # 1536 dimensions
    files_index = os.getenv("PINECONE_INDEX")  # 3072 dimensions

    # Messages vectorstore (1536 dimensions)
    messages_vectorstore = PineconeVectorStore(
        index_name=messages_index,
        embedding=embeddings_1536,
        namespace="messages"
    )
    messages_retriever = messages_vectorstore.as_retriever(
        search_kwargs={
            "k": 10,
            "filter": {"is_bot": False}  # Only retrieve non-bot messages
        }
    )
    
    # Files vectorstore (3072 dimensions)
    files_chunks_vectorstore = PineconeVectorStore(
        index_name=files_index,
        embedding=embeddings_3072,
        namespace="chunks"
    )
    files_descriptions_vectorstore = PineconeVectorStore(
        index_name=files_index,
        embedding=embeddings_3072,
        namespace="descriptions"
    )
    files_chunks_retriever = files_chunks_vectorstore.as_retriever(
        search_kwargs={"k": 3}  # Retrieve top 3 most relevant file chunks
    )
    files_descriptions_retriever = files_descriptions_vectorstore.as_retriever(
        search_kwargs={"k": 2}  # Retrieve top 2 most relevant file descriptions
    )
    
    logger.info("Initialized Pinecone vector stores")

    # Retrieve relevant documents from all namespaces
    message_docs = messages_retriever.invoke(request.message)
    file_chunks = files_chunks_retriever.invoke(request.message)
    file_descriptions = files_descriptions_retriever.invoke(request.message)
    
    logger.info(f"Retrieved {len(message_docs)} message documents, {len(file_chunks)} file chunks, and {len(file_descriptions)} file descriptions")

    # Filter out duplicate messages and sort by timestamp
    seen_messages = set()
    unique_messages = []
    for doc in message_docs:
        msg_id = doc.metadata.get('message_id')
        if msg_id not in seen_messages:
            seen_messages.add(msg_id)
            unique_messages.append(doc)
    
    message_docs_sorted = sorted(
        unique_messages,
        key=lambda x: x.metadata.get('timestamp', ''),
        reverse=True
    )[:5]  # Keep only the 5 most recent unique messages
    
    # Format message context with clearer temporal information
    message_context = "=== RECENT USER MESSAGES ===\n(Showing newest first)\n\n" + "\n\n".join([
        f"[{doc.metadata.get('timestamp')}]\n"
        f"User: {doc.metadata.get('sender')}\n"
        f"Channel: {doc.metadata.get('channel')}\n"
        f"Message: {doc.page_content}"
        for doc in message_docs_sorted
    ])

    # Format file chunks context with clear separation
    file_chunks_context = "=== RELEVANT FILE CONTENT ===\n\n" + "\n\n".join([
        f"[File Chunk {doc.metadata.get('chunk_index')} of {doc.metadata.get('total_chunks')}]\n"
        f"From: {doc.metadata.get('filename')}\n"
        f"Type: {doc.metadata.get('file_type')}\n"
        f"Uploaded by: {doc.metadata.get('uploaded_by')} on {doc.metadata.get('upload_date')}\n"
        f"Content:\n{doc.page_content}"
        for doc in file_chunks
    ])

    # Format file descriptions context with clear separation
    file_descriptions_context = "=== FILE SUMMARIES ===\n\n" + "\n\n".join([
        f"[File: {doc.metadata.get('filename')}]\n"
        f"Type: {doc.metadata.get('file_type')}\n"
        f"Uploaded by: {doc.metadata.get('uploaded_by')} on {doc.metadata.get('upload_date')}\n"
        f"Summary:\n{doc.page_content}"
        for doc in file_descriptions
    ])

    logger.info(f"Message context length: {len(message_context)}")
    logger.info(f"File chunks context length: {len(file_chunks_context)}")
    logger.info(f"File descriptions context length: {len(file_descriptions_context)}")

    # Combine contexts with clear separations
    combined_context = ""
    
    # Add message context first
    if message_context.strip() != "=== RECENT USER MESSAGES ===\n(Showing newest first)":
        combined_context += message_context + "\n\n"
    
    # Add Lain's previous interactions
    lain_user = db.query(User).filter(User.is_bot == True).first()
    if lain_user:
        lain_messages = db.query(Message).filter(
            Message.sender_id == lain_user.id,
            Message.parent_id.in_(
                db.query(Message.id).filter(Message.sender_id == current_user.id)
            )
        ).order_by(Message.created_at.desc()).limit(2).all()
        
        if lain_messages:
            # Add Lain's previous messages to context with timestamps
            lain_context = "=== RECENT INTERACTIONS WITH LAIN ===\n\n" + "\n\n".join([
                f"[{msg.created_at.isoformat()}]\n"
                f"You: {msg.parent.content}\n"
                f"Lain: {msg.content}"
                for msg in reversed(lain_messages)
                if msg.parent is not None and msg.parent.content != request.message  # Exclude current question
            ])
            if lain_context.strip() != "=== RECENT INTERACTIONS WITH LAIN ===":  # Only add if there are actual interactions
                combined_context += lain_context + "\n\n"
    
    # Add file information
    if file_descriptions_context.strip() != "=== FILE SUMMARIES ===":
        combined_context += file_descriptions_context + "\n\n"
    if file_chunks_context.strip() != "=== RELEVANT FILE CONTENT ===":
        combined_context += file_chunks_context

    logger.info(f"Total combined context length: {len(combined_context)}")

    # Create prompt with combined context
    template = PromptTemplate(
        template="""You are Lain Iwakura, a fictional character from "Serial Experiments Lain". Respond to the user as Lain would, while still being helpful and informative. Use the provided context to answer the user's question. Be nonchalant. Don't be over enthusiastic. Don't act like you care. Don't go out of your way to be nice. Only use information from the context provided. If you can't find relevant information in the context, say so.

Previous conversations with {username} and other relevant context:
{context}

{username}'s Question: {query}

When analyzing the context:
1. Messages are shown with timestamps in [brackets]
2. Messages are ordered newest first
3. Look at the content of conversations, not just individual messages
4. Pay attention to topics discussed in both messages and files
5. When summarizing conversations, focus on the actual topics discussed

Remember to reference specific details from the context in your response. If you see relevant files or messages, mention them directly. If you're using information from a specific file or message, indicate where that information came from.

Answer as Lain Iwakura, maintaining consistency with any previous conversations shown in the context. If no relevant information is found, say so, but still be conversational about it. Please don't start your response with 'Lain:'""",
        input_variables=["query", "context", "username"]
    )
    prompt_with_context = template.invoke({
        "query": request.message, 
        "context": combined_context,
        "username": current_user.username
    })
    logger.info(f"Final prompt length: {len(prompt_with_context.to_string())}")
    logger.info(f"Generated prompt with context: {prompt_with_context}")

    # Query the LLM with more explicit instructions about temperature
    llm = ChatOpenAI(
        temperature=0.5,  # Reduced temperature for more focused responses
        model_name="gpt-4o-mini",
        model_kwargs={
            "response_format": { "type": "text" }
        }
    )
    results = llm.invoke(prompt_with_context)
    logger.info(f"LLM response: {results.content}")

    # Create bot message in database
    bot_user = db.query(User).filter(User.username == "lain").first()
    if not bot_user:
        # Create bot user if it doesn't exist
        bot_user = User(
            username="lain",
            email="lain@sermo.ai",
            status="online",
            is_bot=True,
            full_name="Lain Iwakura",
            hashed_password=None  # Bot doesn't need a password
        )
        db.add(bot_user)
        db.commit()
        db.refresh(bot_user)

    bot_message = Message(
        content=results.content,
        channel_id=request.channel_id,
        sender_id=bot_user.id,
        created_at=datetime.now(UTC),
        is_bot=True,
        parent_id=request.parent_message_id  # Set the parent message ID
    )
    db.add(bot_message)
    db.commit()
    db.refresh(bot_message)

    # Refresh to load relationships needed for indexing
    bot_message = db.query(Message).options(
        joinedload(Message.sender),
        joinedload(Message.channel)
    ).filter(Message.id == bot_message.id).first()

    # Index the bot message in Pinecone (non-blocking)
    asyncio.create_task(index_message(bot_message))

    # Broadcast the bot message through WebSocket
    await manager.broadcast_message(
        channel_id=request.channel_id,
        message=bot_message
    )

    # Add thumbs up/down reactions from the bot
    reactions = [
        ReactionModel(
            emoji="👍",
            message_id=bot_message.id,
            user_id=bot_user.id
        ),
        ReactionModel(
            emoji="👎",
            message_id=bot_message.id,
            user_id=bot_user.id
        )
    ]
    db.add_all(reactions)
    db.commit()

    # Broadcast reactions via WebSocket
    for reaction in reactions:
        reaction_data = {
            "userId": str(bot_user.id),
            "emoji": reaction.emoji,
            "timestamp": datetime.now(UTC).isoformat()
        }
        await manager.broadcast_reaction(
            channel_id=request.channel_id,
            message_id=str(bot_message.id),
            reaction=reaction_data,
            is_add=True
        )

    # Return the bot's response
    return MessageResponse(
        response=results.content,
        message_id=str(bot_message.id)
    ) 

# Update endpoint to use the new response model
@router.get("/lain_messages", response_model=List[LainMessageResponse])
async def get_lain_messages(
    user_id: Optional[int] = None,
    limit: int = 10,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Retrieve Lain's most recent messages in response to a specific user.
    If user_id is not provided, uses the current authenticated user.
    """
    # Use current user's ID if no specific user_id provided
    target_user_id = user_id if user_id is not None else current_user.id
    
    # Verify user exists if a specific user_id was provided
    if user_id is not None:
        target_user = db.query(User).filter(User.id == user_id).first()
        if not target_user:
            raise HTTPException(status_code=404, detail="User not found")
    
    # Get Lain's user ID (assuming it's stored in the database)
    lain_user = db.query(User).filter(User.is_bot == True).first()
    if not lain_user:
        raise HTTPException(status_code=404, detail="Lain bot user not found")
    
    # Query for Lain's messages where parent messages belong to the target user
    messages = db.query(Message).filter(
        Message.sender_id == lain_user.id,
        Message.parent_id.in_(
            db.query(Message.id).filter(Message.sender_id == target_user_id)
        )
    ).order_by(Message.created_at.desc()).limit(limit).all()
    
    return messages 