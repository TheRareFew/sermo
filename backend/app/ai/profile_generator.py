from sqlalchemy.orm import Session, joinedload
from sqlalchemy import func
from datetime import datetime, time, timedelta, UTC
from collections import Counter
from typing import List, Dict, Any
import logging
from langchain_openai import ChatOpenAI
from langchain.prompts import PromptTemplate
from ..models.message import Message
from ..models.user import User
from ..models.file import File

# Set up logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

async def check_and_update_profile(db: Session, target_user_id: int) -> None:
    """
    Check if a user's profile needs to be updated and generate a new one if needed.
    A profile needs updating if it hasn't been generated in the last hour.
    """
    try:
        user = db.query(User).filter(User.id == target_user_id).first()
        if not user:
            logger.error(f"User {target_user_id} not found")
            return

        # Check if profile needs updating
        needs_update = (
            user.last_profile_generated is None or
            (datetime.now(UTC) - user.last_profile_generated) > timedelta(hours=1)
        )

        if needs_update:
            logger.info(f"Generating new profile for user {target_user_id}")
            await generate_user_profile(db, target_user_id)
            
            # Update last_profile_generated timestamp
            user.last_profile_generated = datetime.now(UTC)
            db.commit()
            logger.info(f"Updated profile generation timestamp for user {target_user_id}")
        else:
            logger.info(f"Profile for user {target_user_id} is still recent, skipping generation")

    except Exception as e:
        logger.error(f"Error in check_and_update_profile for user {target_user_id}: {e}")
        db.rollback()

def analyze_activity_patterns(messages: List[Message]) -> Dict[str, Any]:
    """Analyze user's activity patterns from their messages."""
    if not messages:
        return {}
    
    # Track message times
    hour_counts = Counter([msg.created_at.hour for msg in messages])
    
    # Determine most active hours (top 3)
    most_active_hours = sorted(
        [(hour, count) for hour, count in hour_counts.items()],
        key=lambda x: x[1],
        reverse=True
    )[:3]
    
    # Convert hours to time periods
    def hour_to_period(hour: int) -> str:
        if 5 <= hour < 12:
            return "morning"
        elif 12 <= hour < 17:
            return "afternoon"
        elif 17 <= hour < 22:
            return "evening"
        else:
            return "night"
    
    period_counts = Counter([hour_to_period(hour) for hour in hour_counts.keys()])
    most_active_period = max(period_counts.items(), key=lambda x: x[1])[0]
    
    # Format active hours
    active_hours = [
        f"{hour:02d}:00-{(hour+1):02d}:00"
        for hour, _ in most_active_hours
    ]
    
    return {
        "most_active_period": most_active_period,
        "active_hours": active_hours
    }

def analyze_communication_style(messages: List[Message]) -> Dict[str, Any]:
    """Analyze user's communication style from their messages."""
    if not messages:
        return {}
    
    # Calculate average message length
    avg_length = sum(len(msg.content) for msg in messages) / len(messages)
    
    # Count messages with code blocks
    code_messages = sum(1 for msg in messages if "```" in msg.content)
    uses_code = code_messages > len(messages) * 0.1  # More than 10% of messages have code
    
    # Count messages with emojis (basic check)
    emoji_messages = sum(1 for msg in messages if any(c in msg.content for c in "😀😊🙂👍"))
    uses_emojis = emoji_messages > len(messages) * 0.1
    
    # Analyze message structure
    short_messages = sum(1 for msg in messages if len(msg.content) < 50)
    long_messages = sum(1 for msg in messages if len(msg.content) > 200)
    
    style = "concise" if short_messages > long_messages else "detailed"
    
    return {
        "avg_message_length": avg_length,
        "uses_code_blocks": uses_code,
        "uses_emojis": uses_emojis,
        "communication_style": style
    }

def analyze_file_patterns(files: List[File]) -> Dict[str, Any]:
    """Analyze user's file sharing patterns."""
    try:
        if not files:
            return {
                "common_file_types": [],
                "total_files": 0,
                "avg_files_per_day": 0,
                "shares_files": False
            }
        
        # Track file types
        file_type_counts = Counter()
        for file in files:
            try:
                if hasattr(file, 'file_type') and file.file_type:
                    main_type = file.file_type.split('/')[0]
                    file_type_counts[main_type] += 1
            except (AttributeError, ValueError) as e:
                logger.warning(f"Could not process file type for file {file.id}: {e}")
        
        # Determine most common file categories
        common_types = sorted(
            [(ftype, count) for ftype, count in file_type_counts.items()],
            key=lambda x: x[1],
            reverse=True
        )
        
        # Analyze file sharing frequency
        try:
            file_dates = [file.created_at.date() for file in files if hasattr(file, 'created_at')]
            unique_days = len(set(file_dates))
            total_files = len(files)
            
            # Calculate average files per active day
            avg_files_per_day = total_files / unique_days if unique_days > 0 else 0
        except Exception as e:
            logger.warning(f"Error calculating file frequency: {e}")
            unique_days = 0
            total_files = len(files)
            avg_files_per_day = 0
        
        return {
            "common_file_types": [ftype for ftype, _ in common_types],
            "total_files": total_files,
            "avg_files_per_day": avg_files_per_day,
            "shares_files": total_files > 0
        }
    except Exception as e:
        logger.error(f"Error in analyze_file_patterns: {e}")
        return {
            "common_file_types": [],
            "total_files": 0,
            "avg_files_per_day": 0,
            "shares_files": False
        }

async def generate_user_profile(db: Session, user_id: int) -> str:
    """Generate a profile description for a user based on their message history."""
    try:
        # Get user and their last 50 messages
        messages = (
            db.query(Message)
            .filter(Message.sender_id == user_id)
            .order_by(Message.created_at.desc())
            .limit(50)
            .all()
        )
        
        # Get user's files
        files = (
            db.query(File)
            .filter(File.uploaded_by_id == user_id)
            .order_by(File.created_at.desc())
            .all()
        )
        
        if not messages and not files:
            return "Not enough history to generate a profile."
        
        # Analyze patterns
        activity_patterns = analyze_activity_patterns(messages)
        comm_style = analyze_communication_style(messages)
        file_patterns = analyze_file_patterns(files)
        
        # Create prompt for GPT
        prompt = PromptTemplate(
            template="""Based on the user's message history and file sharing patterns, generate a natural description of their profile. Include their communication style, activity patterns, and apparent interests.

Analysis:
- Most active during the {most_active_period}
- Active hours: {active_hours}
- Average message length: {avg_length:.0f} characters
- Communication style: {comm_style}
- {code_note}
- {emoji_note}
- File sharing: {file_sharing_note}
- Common file types: {file_types}
- File frequency: {file_frequency}

Recent messages (newest first):
{messages}

Generate a natural, paragraph-form description that captures the user's personality and habits. Focus on:
1. Communication style and preferences
2. Typical activity patterns and availability
3. Apparent interests and topics they discuss
4. File sharing habits and preferences
5. Any notable patterns in their interactions

Keep the description professional but conversational. Don't explicitly mention message counts or technical metrics.""",
            input_variables=[
                "most_active_period",
                "active_hours",
                "avg_length",
                "comm_style",
                "code_note",
                "emoji_note",
                "file_sharing_note",
                "file_types",
                "file_frequency",
                "messages"
            ]
        )
        
        # Format messages for prompt
        message_text = "\n".join([
            f"- {msg.content[:100]}..." if len(msg.content) > 100 else f"- {msg.content}"
            for msg in messages[:10]  # Only include first 10 messages in prompt
        ])
        
        # Create file sharing notes
        file_sharing_note = "Frequently shares files" if file_patterns.get("shares_files", False) else "Rarely shares files"
        file_types = ", ".join(file_patterns.get("common_file_types", ["none"]))
        file_frequency = f"Shares approximately {file_patterns.get('avg_files_per_day', 0):.1f} files per active day" if file_patterns.get("shares_files", False) else "No file sharing activity"
        
        # Create prompt variables
        prompt_vars = {
            "most_active_period": activity_patterns.get("most_active_period", "various times"),
            "active_hours": ", ".join(activity_patterns.get("active_hours", [])),
            "avg_length": comm_style.get("avg_message_length", 0),
            "comm_style": comm_style.get("communication_style", "varied"),
            "code_note": "Frequently shares code examples" if comm_style.get("uses_code_blocks") else "Rarely shares code",
            "emoji_note": "Often uses emojis" if comm_style.get("uses_emojis") else "Rarely uses emojis",
            "file_sharing_note": file_sharing_note,
            "file_types": file_types,
            "file_frequency": file_frequency,
            "messages": message_text
        }
        
        # Generate profile using GPT-4
        llm = ChatOpenAI(
            temperature=0.7,
            model_name="gpt-4o-mini",
            model_kwargs={
                "response_format": { "type": "text" }
            }
        )
        
        result = llm.invoke(prompt.format(**prompt_vars))
        
        # Update user's description in database
        user = db.query(User).filter(User.id == user_id).first()
        if user:
            user.description = result.content
            db.commit()
            logger.info(f"Updated profile description for user {user_id}")
        
        return result.content
        
    except Exception as e:
        logger.error(f"Error generating user profile: {e}")
        raise 