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
from datetime import datetime, UTC

# Set up logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

def create_test_data(db: SessionLocal):
    """Create Lain bot user and general channel"""
    try:
        logger.info("Starting test data creation...")
        
        # Check if Lain already exists
        existing_lain = db.query(User).filter(User.username == "lain").first()
        if existing_lain:
            logger.info("Lain user already exists, skipping creation")
            return
        
        # Create Lain bot user
        logger.info("Creating Lain bot user...")
        lain_bot = User(
            username="lain",
            email="lain@sermo.ai",
            full_name="Lain Iwakura",
            description="I am Lain, an AI assistant. Let's all love Lain!",
            auth0_id="auth0|lain_bot",
            status="online",
            is_active=True,
            is_bot=True,
            last_seen=datetime.now(UTC)
        )
        db.add(lain_bot)
        
        # Explicitly flush to get the ID and check for errors
        logger.info("Flushing Lain user to database...")
        db.flush()
        logger.info(f"Created Lain user with ID: {lain_bot.id}")
        
        # Create general channel
        logger.info("Creating general channel...")
        general_channel = Channel(
            name="general",
            description="Public chat channel",
            is_public=True,
            created_by_id=lain_bot.id,
            created_at=datetime.now(UTC),
            updated_at=datetime.now(UTC)
        )
        db.add(general_channel)
        
        # Explicitly flush to get the ID and check for errors
        logger.info("Flushing general channel to database...")
        db.flush()
        logger.info(f"Created general channel with ID: {general_channel.id}")
        
        # Add Lain to the channel
        logger.info("Adding Lain to general channel...")
        general_channel.members.append(lain_bot)
        
        # Final commit
        logger.info("Committing changes to database...")
        db.commit()
        
        # Verify the creation
        verification = db.query(User).filter(User.username == "lain").first()
        if verification:
            logger.info("Successfully verified Lain user creation")
        else:
            logger.error("Failed to verify Lain user creation")
            raise Exception("Lain user verification failed")
        
        logger.info("Successfully completed test data creation")
        
    except Exception as e:
        logger.error(f"Error creating test data: {str(e)}")
        db.rollback()
        raise

def reset_pinecone():
    """Reset Pinecone indexes while preserving PDF content"""
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
        
        # Function to safely delete vectors by IDs
        def safe_delete_vectors(index_name: str, namespace: str, ids: list = None):
            try:
                index = pc.Index(index_name)
                if ids:
                    logger.info(f"Attempting to delete {len(ids)} vectors from {index_name}, namespace {namespace}")
                    # Delete in batches of 1000 to avoid request size limits
                    batch_size = 1000
                    for i in range(0, len(ids), batch_size):
                        batch_ids = ids[i:i + batch_size]
                        index.delete(ids=batch_ids, namespace=namespace)
                    logger.info(f"Successfully deleted vectors from {index_name}/{namespace}")
                else:
                    logger.info(f"No vectors to delete in {index_name}/{namespace}")
            except Exception as e:
                if "Namespace not found" in str(e):
                    logger.info(f"No vectors found in {index_name}/{namespace} - already clean")
                else:
                    logger.error(f"Error deleting vectors from {index_name}/{namespace}: {str(e)}")
                    raise e
        
        # Reset message index (all messages can be deleted)
        logger.info("Resetting message vectors...")
        message_index_obj = pc.Index(message_index)
        try:
            message_index_obj.delete(delete_all=True, namespace="messages")
            logger.info("Successfully deleted all message vectors")
        except Exception as e:
            if "Namespace not found" in str(e):
                logger.info("No message vectors found - already clean")
            else:
                raise e
        
        # For file index, we need to query and selectively delete
        logger.info("Selectively resetting file vectors...")
        file_index_obj = pc.Index(file_index)
        
        try:
            # Query to find non-PDF vectors in descriptions namespace
            query_response = file_index_obj.query(
                namespace="descriptions",
                vector=[0] * 3072,  # Dummy vector for metadata-only query
                top_k=10000,
                include_metadata=True
            )
            
            # Filter for non-PDF vectors
            non_pdf_ids = [
                match.id for match in query_response.matches 
                if match.metadata.get("file_type") != "application/pdf"
            ]
            
            if non_pdf_ids:
                logger.info(f"Found {len(non_pdf_ids)} non-PDF vectors to delete")
                safe_delete_vectors(file_index, "descriptions", non_pdf_ids)
            else:
                logger.info("No non-PDF vectors found in descriptions namespace")
                
        except Exception as e:
            if "Namespace not found" in str(e):
                logger.info("No vectors found in descriptions namespace - already clean")
            else:
                logger.error(f"Error querying file index: {str(e)}")
                raise e
        
        logger.info("Successfully completed Pinecone index reset operations")
        logger.info("PDF content has been preserved")
        
    except Exception as e:
        logger.error(f"Error resetting Pinecone indexes: {str(e)}")
        raise

def reset_database(with_test_data: bool = True):
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
    
    try:
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
        
        # Create MetaData instance
        metadata = Base.metadata
        
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
            except Exception as e:
                logger.error(f"Failed to create test data: {str(e)}")
                raise
            finally:
                db.close()
        
        print("Database reset complete!")
        
    except Exception as e:
        logger.error(f"Database reset failed: {str(e)}")
        raise

if __name__ == "__main__":
    # Check if --no-test-data flag is provided to explicitly disable test data
    with_test_data = not "--no-test-data" in sys.argv
    reset_database(with_test_data) 