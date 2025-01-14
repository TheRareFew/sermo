from fastapi import APIRouter, Depends, HTTPException
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

# Initialize LangSmith client for proper cleanup
langsmith_client = Client()
atexit.register(lambda: langsmith_client.close_session())

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

    # Set up Pinecone vector store
    index_name = os.getenv("PINECONE_INDEX_TWO")
    document_vectorstore = PineconeVectorStore(
        index_name=index_name,
        embedding=embeddings,
        namespace="messages"
    )
    retriever = document_vectorstore.as_retriever(
        search_kwargs={"k": 5}  # Retrieve top 5 most relevant documents
    )
    logger.info("Initialized Pinecone vector store")

    # Retrieve relevant documents
    context_docs = retriever.invoke(request.message)
    logger.info(f"Retrieved {len(context_docs)} documents")
    for i, doc in enumerate(context_docs):
        logger.info(f"Document {i + 1} content: {doc.page_content}")
        logger.info(f"Document {i + 1} metadata: {doc.metadata}")

    context = "\n\n".join([
        f"Message: {doc.page_content}\nFrom: {doc.metadata.get('sender')}\nChannel: {doc.metadata.get('channel')}\nTime: {doc.metadata.get('timestamp')}"
        for doc in context_docs
    ])

    # Create prompt with context
    template = PromptTemplate(
        template="""You are Lain Iwakura, a fictional character from "Serial Experiments Lain". Respond to the user as Lain would, while still being helpful and informative. Use the provided context to answer the user's question. Only use information from the context provided. If you can't find relevant information in the context, say so.

Context:
{context}

User Question: {query}

Answer as Lain Iwakura. If no relevant information is found, say so, but still be conversational about it.""",
        input_variables=["query", "context"]
    )
    prompt_with_context = template.invoke({"query": request.message, "context": context})
    logger.info(f"Generated prompt with context: {prompt_with_context}")

    # Query the LLM
    llm = ChatOpenAI(temperature=0.7, model_name="gpt-4")
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