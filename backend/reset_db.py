from sqlalchemy import create_engine, inspect, text
from app.database import Base, init_db, DATABASE_URL, SessionLocal
import sys
from sqlalchemy.orm import close_all_sessions
import os
from dotenv import load_dotenv
from pinecone import Pinecone
import logging
from app.models.user import User
from app.models.channel import Channel, channel_members
from app.auth.security import get_password_hash

# Set up logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

def create_test_data(db: SessionLocal):
    """Create test users and channels"""
    try:
        logger.info("Creating test users...")
        
        # Create test users
        test_users = [
            User(
                username=f"test_{i:02d}",
                email=f"test_{i:02d}@test.com",
                full_name=f"Test User {i:02d}",
                hashed_password=get_password_hash("1234"),
                status="online"
            )
            for i in range(2)  # Creates test_00 and test_01
        ]
        
        for user in test_users:
            db.add(user)
        db.flush()  # Get IDs without committing
        
        logger.info("Creating general channel...")
        # Create general channel
        general_channel = Channel(
            name="general",
            description="Public chat channel",
            is_public=True,
            created_by_id=test_users[0].id  # First test user creates the channel
        )
        db.add(general_channel)
        db.flush()
        
        # Add both users to the channel
        general_channel.members.extend(test_users)
        
        db.commit()
        logger.info("Successfully created test data")
        
    except Exception as e:
        logger.error(f"Error creating test data: {str(e)}")
        db.rollback()
        raise

def reset_pinecone():
    """Reset Pinecone indexes by deleting all vectors"""
    try:
        logger.info("Resetting Pinecone indexes...")
        
        # Load environment variables
        load_dotenv()
        
        # Initialize Pinecone
        pc = Pinecone(api_key=os.getenv("PINECONE_API_KEY"))
        
        # Get both index names
        message_index = os.getenv("PINECONE_INDEX_TWO")  # 1536d index for messages
        file_index = os.getenv("PINECONE_INDEX")      # 3072d index for files
        
        if not message_index or not file_index:
            logger.error("Required Pinecone index environment variables not found")
            logger.error(f"PINECONE_INDEX_TWO (messages): {'Found' if message_index else 'Missing'}")
            logger.error(f"PINECONE_INDEX (files): {'Found' if file_index else 'Missing'}")
            return
        
        # Function to safely reset an index
        def safe_reset_index(index_name: str, namespace: str):
            try:
                index = pc.Index(index_name)
                logger.info(f"Attempting to reset index {index_name}, namespace {namespace}")
                
                # Try to delete all vectors regardless of namespace existence
                try:
                    index.delete(delete_all=True, namespace=namespace)
                    logger.info(f"Successfully deleted all vectors from {index_name}/{namespace}")
                except Exception as e:
                    if "Namespace not found" in str(e):
                        logger.info(f"No vectors found in {index_name}/{namespace} - already clean")
                    else:
                        raise e
                
            except Exception as e:
                logger.error(f"Error resetting {index_name}/{namespace}: {str(e)}")
                raise e
        
        # Reset message index
        logger.info("Resetting message vectors...")
        safe_reset_index(message_index, "messages")
        
        # Reset file index namespaces
        logger.info("Resetting file chunks namespace...")
        safe_reset_index(file_index, "chunks")  # Store file chunks here
        logger.info("Resetting file descriptions namespace...")
        safe_reset_index(file_index, "descriptions")   # Store file descriptions here
        
        logger.info("Successfully completed Pinecone index reset operations")
        
    except Exception as e:
        logger.error(f"Error resetting Pinecone indexes: {str(e)}")
        raise

def reset_database(with_test_data: bool = False):
    """Reset the database by dropping all tables and recreating them"""
    print("Starting database reset...")
    
    # Reset Pinecone first
    try:
        reset_pinecone()
    except Exception as e:
        print(f"Warning: Failed to reset Pinecone indexes: {str(e)}")
        if not "--ignore-pinecone-errors" in sys.argv:
            print("Use --ignore-pinecone-errors to continue despite Pinecone reset failures")
            return
    
    # Close all existing sessions
    print("Closing all database sessions...")
    close_all_sessions()
    
    # Create engine and drop all tables
    print("Dropping all tables...")
    engine = create_engine(DATABASE_URL)
    
    # Force drop all tables
    Base.metadata.reflect(engine)  # Get all tables
    Base.metadata.drop_all(engine)
    
    # Clear metadata to avoid table redefinition issues
    Base.metadata.clear()
    
    # Dispose engine connections
    engine.dispose()
    
    print("Creating new tables...")
    new_engine = create_engine(DATABASE_URL)
    
    # Import all models to ensure they are registered
    from app.models.user import User
    from app.models.channel import Channel, channel_members
    from app.models.message import Message
    from app.models.file import File
    from app.models.presence import Presence
    from app.models.reaction import Reaction
    from app.models.bot_message_score import BotMessageScore
    from app.auth.security import RefreshToken
    
    # Create MetaData instance
    metadata = Base.metadata
    
    # Create tables in order based on dependencies
    tables_in_order = [
        User.__table__,
        channel_members,
        Channel.__table__,
        Message.__table__,
        File.__table__,
        Presence.__table__,
        Reaction.__table__,
        BotMessageScore.__table__,
        RefreshToken.__table__
    ]
    
    # Add tables to metadata if not already present
    for table in tables_in_order:
        if table.name not in metadata.tables:
            metadata._add_table(table.name, table.schema, table)
    
    # Create all tables at once to handle dependencies correctly
    metadata.create_all(bind=new_engine)
    
    # Initialize with test data if requested
    if with_test_data:
        print("Adding test data...")
        db = SessionLocal()
        try:
            create_test_data(db)
        finally:
            db.close()
    
    print("Database reset complete!")

if __name__ == "__main__":
    # Check if --with-test-data flag is provided
    with_test_data_flag = "--with-test-data" in sys.argv
    reset_database(with_test_data_flag) 