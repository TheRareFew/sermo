from fastapi import APIRouter, Depends, HTTPException
from typing import List, Optional, Tuple
from pydantic import BaseModel, Field
from langchain_openai import ChatOpenAI
from langchain_pinecone import PineconeVectorStore
from langchain_community.embeddings import OpenAIEmbeddings
from ..deps import get_current_user, get_db
from app.models.user import User
from app.models.message import Message
from app.models.bot_message_score import BotMessageScore
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
from ...ai.context_generator import (
    generate_lain_context,
    generate_user_bot_context,
    get_bot_scored_messages,
    generate_bot_prompt
)
from ...ai.profile_generator import check_and_update_profile

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
    message: str
    channel_id: int
    parent_message_id: Optional[int] = None
    target_user: Optional[str] = None

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

# Add Pydantic model for scored messages
class ScoredMessage(BaseModel):
    message_id: int
    message_content: str
    parent_message_content: Optional[str]
    score: float
    created_at: datetime

    class Config:
        from_attributes = True

class BotScoredMessages(BaseModel):
    highest_scored: Optional[ScoredMessage]
    lowest_scored: Optional[ScoredMessage]
    bot_username: str

@router.post("/message", response_model=MessageResponse)
async def send_message_to_bot(
    request: MessageRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    logger.info(f"Received message: {request.message} for channel: {request.channel_id}")
    
    # If target_user is specified, create or get bot user for that user
    bot_user = None
    if request.target_user:
        target_username = request.target_user
        
        # Special case for Lain - always accessible
        if target_username.lower() == "lain":
            bot_user = db.query(User).filter(User.username == "lain").first()
            if not bot_user:
                bot_user = User(
                    username="lain",
                    email="lain@sermo.ai",
                    status="online",
                    is_bot=True,
                    full_name="Lain Iwakura",
                    hashed_password=None
                )
                db.add(bot_user)
                db.commit()
                db.refresh(bot_user)
        else:
            # For other users, check if they're offline first
            target_user = db.query(User).filter(User.username == target_username).first()
            if not target_user:
                raise HTTPException(status_code=404, detail="Target user not found")
            
            if target_user.status != "offline":
                raise HTTPException(
                    status_code=400, 
                    detail="Cannot interact with user's bot while they are online"
                )
            
            # Try to find existing bot for this user
            bot_username = f"{target_username}<bot>"
            bot_user = db.query(User).filter(User.username == bot_username).first()
            if not bot_user:
                # Create new bot user
                bot_user = User(
                    username=bot_username,
                    email=f"{target_username}.bot@sermo.ai",
                    status="online",
                    is_bot=True,
                    full_name=f"{target_username}'s Bot",
                    hashed_password=None
                )
                db.add(bot_user)
                db.commit()
                db.refresh(bot_user)
            
            # Generate/update profile for offline user
            await check_and_update_profile(db, target_user.id)
    else:
        # Default to Lain bot if no target user specified
        bot_user = db.query(User).filter(User.username == "lain").first()
        if not bot_user:
            bot_user = User(
                username="lain",
                email="lain@sermo.ai",
                status="online",
                is_bot=True,
                full_name="Lain Iwakura",
                hashed_password=None
            )
            db.add(bot_user)
            db.commit()
            db.refresh(bot_user)

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

    # Generate prompt with context
    prompt_with_context = await generate_bot_prompt(
        db=db,
        current_user=current_user,
        request_message=request.message,
        target_user=None if request.target_user and request.target_user.lower() == "lain" else request.target_user,
        message_docs_sorted=message_docs_sorted,
        file_chunks=file_chunks,
        file_descriptions=file_descriptions
    )
    logger.info(f"Final prompt length: {len(prompt_with_context)}")
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
    bot_message = Message(
        content=results.content,
        channel_id=request.channel_id,
        sender_id=bot_user.id,
        created_at=datetime.now(UTC),
        is_bot=True,
        parent_id=request.parent_message_id
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

@router.get("/bot/{bot_user_id}/scored-messages", response_model=BotScoredMessages)
async def get_bot_scored_messages_endpoint(
    bot_user_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Get the highest and lowest scored messages for a bot user.
    This endpoint is useful for analyzing bot performance and response quality.
    """
    # Verify bot user exists
    bot_user = db.query(User).filter(User.id == bot_user_id, User.is_bot == True).first()
    if not bot_user:
        raise HTTPException(status_code=404, detail="Bot user not found")

    highest_message, lowest_message = await get_bot_scored_messages(db, bot_user_id)

    # Convert to response model
    def convert_to_scored_message(msg_dict: Optional[dict]) -> Optional[ScoredMessage]:
        if not msg_dict:
            return None
        return ScoredMessage(
            message_id=msg_dict.get('message_id', 0),
            message_content=msg_dict['message'],
            parent_message_content=msg_dict.get('parent_message'),
            score=msg_dict['score'],
            created_at=msg_dict['created_at']
        )

    return BotScoredMessages(
        highest_scored=convert_to_scored_message(highest_message),
        lowest_scored=convert_to_scored_message(lowest_message),
        bot_username=bot_user.username
    ) 