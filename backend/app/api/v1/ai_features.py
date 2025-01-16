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

# Set up logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

router = APIRouter()

# Load and validate environment variables
load_dotenv()

# Initialize LangSmith client
langsmith_client = Client()

# Validate required environment variables
required_vars = ["OPENAI_API_KEY", "PINECONE_API_KEY", "PINECONE_INDEX_TWO"]
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
    
    # Initialize embeddings
    embeddings = OpenAIEmbeddings(model="text-embedding-ada-002")
    logger.info("Initialized embeddings")

    # Set up Pinecone vector stores for both messages and files
    index_name = os.getenv("PINECONE_INDEX_TWO")
    
    # Messages vectorstore
    messages_vectorstore = PineconeVectorStore(
        index_name=index_name,
        embedding=embeddings,
        namespace="messages"
    )
    messages_retriever = messages_vectorstore.as_retriever(
        search_kwargs={"k": 5}  # Retrieve top 5 most relevant messages
    )
    
    # Files vectorstore
    files_vectorstore = PineconeVectorStore(
        index_name=index_name,
        embedding=embeddings,
        namespace="files"
    )
    files_retriever = files_vectorstore.as_retriever(
        search_kwargs={"k": 5}  # Retrieve top 5 most relevant files
    )
    
    logger.info("Initialized Pinecone vector stores")

    # Retrieve relevant documents from both namespaces
    message_docs = messages_retriever.invoke(request.message)
    file_docs = files_retriever.invoke(request.message)
    
    logger.info(f"Retrieved {len(message_docs)} message documents and {len(file_docs)} file documents")

    # Format message context
    message_context = "\n\n".join([
        f"Message: {doc.page_content}\nFrom: {doc.metadata.get('sender')}\nChannel: {doc.metadata.get('channel')}\nTime: {doc.metadata.get('timestamp')}"
        for doc in message_docs
    ])
    logger.info(f"Message context length: {len(message_context)}")
    logger.info(f"Message context content: {message_context}")

    # Format file context
    file_context = "\n\n".join([
        f"File Description: {doc.page_content}\nFile: {doc.metadata.get('filename')}\nUploaded by: {doc.metadata.get('uploaded_by')}\nUploaded on: {doc.metadata.get('upload_date')}"
        for doc in file_docs
    ])
    logger.info(f"File context length: {len(file_context)}")
    logger.info(f"File context content: {file_context}")

    # Combine contexts with headers
    combined_context = ""
    if message_context:
        combined_context += "Related Messages:\n" + message_context
    if file_context:
        if combined_context:
            combined_context += "\n\nRelated Files:\n" + file_context
        else:
            combined_context += "Related Files:\n" + file_context

    # Get Lain's previous messages with this user
    lain_user = db.query(User).filter(User.is_bot == True).first()
    if lain_user:
        lain_messages = db.query(Message).filter(
            Message.sender_id == lain_user.id,
            Message.parent_id.in_(
                db.query(Message.id).filter(Message.sender_id == current_user.id)
            )
        ).order_by(Message.created_at.desc()).limit(5).all()
        
        if lain_messages:
            # Add Lain's previous messages to context
            lain_context = "\n\n".join([
                f"Previous Conversation:\n{msg.parent.sender.username}: {msg.parent.content}\nLain: {msg.content}"
                for msg in reversed(lain_messages)
                if msg.parent is not None and msg.parent.sender is not None
            ])
            logger.info(f"Lain context length: {len(lain_context)}")
            logger.info(f"Lain context content: {lain_context}")
            combined_context = f"{lain_context}\n\n{combined_context}" if combined_context else lain_context

    logger.info(f"Total combined context length: {len(combined_context)}")

    # Create prompt with combined context
    template = PromptTemplate(
        template="""You are Lain Iwakura, a fictional character from "Serial Experiments Lain". Respond to the user as Lain would, while still being helpful and informative. Use the provided context to answer the user's question. Be nonchalant. Don't be over enthusiastic. Don't act like you care. Don't go out of your way to be nice. Only use information from the context provided. If you can't find relevant information in the context, say so.

Previous conversations with {username} (if any) and other relevant context:
{context}

{username}'s Question: {query}

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

    # Broadcast the bot message through WebSocket
    await manager.broadcast_message(
        channel_id=request.channel_id,
        message=bot_message
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