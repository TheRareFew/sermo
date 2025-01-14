import os
from dotenv import load_dotenv
from sqlalchemy import create_engine, text
from langchain.schema import Document
from langchain.text_splitter import RecursiveCharacterTextSplitter
from langchain_community.embeddings import OpenAIEmbeddings
from langchain_community.vectorstores import Pinecone
from pinecone import Pinecone as PineconeClient
import logging
from typing import List

# Set up logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

def load_environment():
    """Load and validate environment variables."""
    load_dotenv()
    
    required_vars = [
        "PINECONE_API_KEY",
        "OPENAI_API_KEY",
        "PINECONE_INDEX_TWO",
        "DATABASE_URL"
    ]
    
    missing_vars = [var for var in required_vars if not os.getenv(var)]
    if missing_vars:
        raise EnvironmentError(f"Missing required environment variables: {', '.join(missing_vars)}")
    
    return {var: os.getenv(var) for var in required_vars}

def fetch_messages(database_url):
    """Fetch all messages from the database."""
    try:
        engine = create_engine(database_url)
        with engine.connect() as connection:
            query = text("""
                SELECT 
                    m.id,
                    m.content,
                    m.created_at,
                    u.username as sender,
                    c.name as channel
                FROM messages m
                JOIN users u ON m.sender_id = u.id
                JOIN channels c ON m.channel_id = c.id
                WHERE m.content IS NOT NULL AND m.content != ''
                ORDER BY m.created_at DESC
            """)
            result = connection.execute(query)
            messages = result.fetchall()
            logger.info(f"Successfully fetched {len(messages)} messages from database")
            return messages
    except Exception as e:
        logger.error(f"Error fetching messages: {str(e)}")
        raise

def prepare_documents(messages):
    """Convert messages to LangChain documents."""
    documents = []
    for message in messages:
        doc = Document(
            page_content=message.content,
            metadata={
                'message_id': str(message.id),
                'sender': message.sender,
                'channel': message.channel,
                'timestamp': str(message.created_at)
            }
        )
        documents.append(doc)
    logger.info(f"Prepared {len(documents)} documents for embedding")
    return documents

def split_documents(documents: List[Document], chunk_size: int = 1000, chunk_overlap: int = 100):
    """Split documents into smaller chunks if necessary."""
    text_splitter = RecursiveCharacterTextSplitter(
        chunk_size=chunk_size,
        chunk_overlap=chunk_overlap,
        length_function=len,
        separators=["\n\n", "\n", " ", ""]
    )
    split_docs = text_splitter.split_documents(documents)
    logger.info(f"Split {len(documents)} documents into {len(split_docs)} chunks")
    return split_docs

def upload_to_pinecone(documents: List[Document], index_name: str):
    """Upload documents to Pinecone."""
    try:
        # Initialize embeddings
        embeddings = OpenAIEmbeddings()
        logger.info("Initialized OpenAI embeddings")
        
        # Upload documents in batches
        batch_size = 100
        for i in range(0, len(documents), batch_size):
            batch = documents[i:i + batch_size]
            Pinecone.from_documents(
                documents=batch,
                embedding=embeddings,
                index_name=index_name,
                namespace="messages"
            )
            logger.info(f"Uploaded batch {i//batch_size + 1} of {len(documents)//batch_size + 1}")
        
        logger.info("Successfully uploaded all documents to Pinecone")
        
    except Exception as e:
        logger.error(f"Error uploading to Pinecone: {str(e)}")
        raise

def main():
    try:
        logger.info("Starting message upload process...")
        
        # Load environment variables
        env_vars = load_environment()
        logger.info("Environment variables loaded successfully")
        
        # Initialize Pinecone
        pc = PineconeClient(api_key=env_vars["PINECONE_API_KEY"])
        logger.info("Pinecone initialized")
        
        # Fetch messages from database
        messages = fetch_messages(env_vars["DATABASE_URL"])
        
        # Prepare documents
        documents = prepare_documents(messages)
        
        # Split documents
        split_docs = split_documents(documents)
        
        # Upload to Pinecone
        upload_to_pinecone(split_docs, env_vars["PINECONE_INDEX_TWO"])
        
        logger.info("Message upload process completed successfully")
        
    except Exception as e:
        logger.error(f"Error during execution: {str(e)}")
        raise

if __name__ == "__main__":
    main() 