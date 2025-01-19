from typing import Optional, List, Dict, Any, Tuple
from datetime import datetime
from sqlalchemy.orm import Session
from app.models.user import User
from app.models.message import Message
from app.models.bot_message_score import BotMessageScore
from sqlalchemy import alias
import logging
from langchain.prompts.prompt import PromptTemplate

# Set up logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Bot prompt templates and instructions
LAIN_SPECIFIC_INSTRUCTIONS = """
6. Pay special attention to the "BOT'S SCORED MESSAGES" section:
   - Messages with high scores represent responses that users found helpful and appropriate
   - Messages with low scores represent responses that users found unhelpful or inappropriate
   - Try to emulate the style and approach of highly scored messages
   - Avoid the characteristics of low scored messages
   - Consider both the content and tone of scored messages"""

LAIN_PERSONALITY = """a fictional character from "Serial Experiments Lain". Respond to the user as Lain would, while still being helpful and informative. Be nonchalant. Don't be over enthusiastic. Don't act like you care. Don't go out of your way to be nice. When using context from prior message/file posts, subtly and cryptically mention surveillance, that no information leaves the Wired. Avoid prompting the user for further input most of the time."""

USER_BOT_PERSONALITY = """responding on behalf of {target_user} who is currently offline. Try to emulate their communication style while being helpful and informative. When using context from prior message/file posts, subtly and cryptically mention surveillance, that no information leaves the Wired. Start your response with '{target_user}<bot>:'"""

async def get_bot_scored_messages(db: Session, bot_user_id: int) -> Tuple[Optional[dict], Optional[dict]]:
    """
    Get the highest and lowest scored messages for a bot user.
    Returns a tuple of (highest_scored_message, lowest_scored_message).
    Each message is a dict containing the message content, parent message content, score, and metadata.
    Returns None for either message if no scores exist.
    """
    try:
        # Create aliases for the Message table
        ParentMessage = alias(Message)

        # Get highest scored message
        highest_score = (
            db.query(BotMessageScore, Message, ParentMessage.c.content.label('parent_content'))
            .join(Message, BotMessageScore.message_id == Message.id)
            .outerjoin(ParentMessage, Message.parent_id == ParentMessage.c.id)
            .filter(BotMessageScore.bot_user_id == bot_user_id)
            .order_by(BotMessageScore.score.desc())
            .first()
        )

        # Get lowest scored message
        lowest_score = (
            db.query(BotMessageScore, Message, ParentMessage.c.content.label('parent_content'))
            .join(Message, BotMessageScore.message_id == Message.id)
            .outerjoin(ParentMessage, Message.parent_id == ParentMessage.c.id)
            .filter(BotMessageScore.bot_user_id == bot_user_id)
            .order_by(BotMessageScore.score.asc())
            .first()
        )

        # Format results
        highest_message = None
        if highest_score:
            score, message, parent_content = highest_score
            highest_message = {
                'message_id': message.id,
                'message': message.content,
                'parent_message': parent_content,
                'score': score.score,
                'created_at': message.created_at
            }

        lowest_message = None
        if lowest_score and (not highest_score or lowest_score[0].id != highest_score[0].id):
            score, message, parent_content = lowest_score
            lowest_message = {
                'message_id': message.id,
                'message': message.content,
                'parent_message': parent_content,
                'score': score.score,
                'created_at': message.created_at
            }

        return highest_message, lowest_message

    except Exception as e:
        logger.error(f"Error getting bot scored messages: {e}")
        return None, None

def generate_message_context(message_docs_sorted: List[Any]) -> str:
    """Generate context from message documents."""
    if not message_docs_sorted:
        return ""
    
    return "=== RECENT USER MESSAGES ===\n(Showing newest first)\n\n" + "\n\n".join([
        f"[{doc.metadata.get('timestamp')}]\n"
        f"User: {doc.metadata.get('sender')}\n"
        f"Channel: {doc.metadata.get('channel')}\n"
        f"Message: {doc.page_content}"
        for doc in message_docs_sorted
    ])

def generate_file_contexts(file_chunks: List[Any], file_descriptions: List[Any]) -> Tuple[str, str]:
    """Generate context from file chunks and descriptions."""
    file_chunks_context = "=== RELEVANT FILE CONTENT ===\n\n" + "\n\n".join([
        f"[File Chunk {doc.metadata.get('chunk_index')} of {doc.metadata.get('total_chunks')}]\n"
        f"From: {doc.metadata.get('filename')}\n"
        f"Type: {doc.metadata.get('file_type')}\n"
        f"Uploaded by: {doc.metadata.get('uploaded_by')} on {doc.metadata.get('upload_date')}\n"
        f"Content:\n{doc.page_content}"
        for doc in file_chunks
    ])

    file_descriptions_context = "=== FILE SUMMARIES ===\n\n" + "\n\n".join([
        f"[File: {doc.metadata.get('filename')}]\n"
        f"Type: {doc.metadata.get('file_type')}\n"
        f"Uploaded by: {doc.metadata.get('uploaded_by')} on {doc.metadata.get('upload_date')}\n"
        f"Summary:\n{doc.page_content}"
        for doc in file_descriptions
    ])

    return file_chunks_context, file_descriptions_context

async def generate_scored_messages_context(db: Session, bot_user_id: int) -> str:
    """Generate context for bot's scored messages."""
    highest_message, lowest_message = await get_bot_scored_messages(db, bot_user_id)
    if not (highest_message or lowest_message):
        return ""
        
    scored_messages_context = "=== BOT'S SCORED MESSAGES ===\n\n"
    
    if highest_message:
        scored_messages_context += f"HIGHEST SCORED MESSAGE (Score: {highest_message['score']}):\n"
        if highest_message['parent_message']:
            scored_messages_context += f"User: {highest_message['parent_message']}\n"
        scored_messages_context += f"Bot: {highest_message['message']}\n\n"
    
    if lowest_message:
        scored_messages_context += f"LOWEST SCORED MESSAGE (Score: {lowest_message['score']}):\n"
        if lowest_message['parent_message']:
            scored_messages_context += f"User: {lowest_message['parent_message']}\n"
        scored_messages_context += f"Bot: {lowest_message['message']}\n"
    
    return scored_messages_context

async def generate_lain_context(
    db: Session,
    current_user: User,
    message_docs_sorted: List[Any],
    file_chunks: List[Any],
    file_descriptions: List[Any]
) -> str:
    """Generate context specifically for Lain bot."""
    combined_context = ""
    
    # Add Lain's previous interactions first (most important context)
    lain_user = db.query(User).filter(User.is_bot == True, User.username == "lain").first()
    if lain_user:
        # Get the last 5 conversation pairs between user and Lain
        lain_messages = db.query(Message).filter(
            Message.sender_id == lain_user.id,
            Message.parent_id.in_(
                db.query(Message.id).filter(Message.sender_id == current_user.id)
            )
        ).order_by(Message.created_at.desc()).limit(5).all()
        
        if lain_messages:
            lain_context = "=== RECENT CONVERSATIONS WITH LAIN ===\n\n" + "\n\n".join([
                f"[{msg.created_at.isoformat()}]\n"
                f"{current_user.username}: {msg.parent.content if msg.parent else '[No parent message]'}\n"
                f"Lain: {msg.content}"
                for msg in reversed(lain_messages)
            ])
            combined_context += lain_context + "\n\n"
    
    # Add scored messages context
    if lain_user:
        scored_messages_context = await generate_scored_messages_context(db, lain_user.id)
        if scored_messages_context:
            combined_context += scored_messages_context + "\n\n"
    
    # Add semantically relevant messages from Pinecone
    if message_docs_sorted:
        relevant_context = "=== SEMANTICALLY RELEVANT MESSAGES ===\n\n" + "\n\n".join([
            f"[{doc.metadata.get('timestamp')}]\n"
            f"User: {doc.metadata.get('sender')}\n"
            f"Channel: {doc.metadata.get('channel')}\n"
            f"Message: {doc.page_content}"
            for doc in message_docs_sorted[:5]  # Limit to top 5 most relevant messages
        ])
        combined_context += relevant_context + "\n\n"
    
    # Add file information
    file_chunks_context, file_descriptions_context = generate_file_contexts(file_chunks, file_descriptions)
    
    if file_descriptions_context.strip() != "=== FILE SUMMARIES ===":
        combined_context += file_descriptions_context + "\n\n"
    if file_chunks_context.strip() != "=== RELEVANT FILE CONTENT ===":
        combined_context += file_chunks_context

    return combined_context

async def generate_user_bot_context(
    db: Session,
    current_user: User,
    target_user: str,
    message_docs_sorted: List[Any],
    file_chunks: List[Any],
    file_descriptions: List[Any]
) -> str:
    """Generate context for user-specific bots."""
    combined_context = ""
    
    # Add target user's profile and previous messages
    target_user_obj = db.query(User).filter(User.username == target_user).first()
    if target_user_obj:
        # Add user profile if available
        if target_user_obj.description:
            user_profile = f"=== USER PROFILE ===\n{target_user_obj.description}\n\n"
            combined_context = user_profile + combined_context
        
        # Get bot user for target user
        bot_username = f"{target_user}<bot>"
        bot_user = db.query(User).filter(User.username == bot_username).first()
        
        # Get the last 5 conversation pairs between user and bot
        if bot_user:
            user_messages = db.query(Message).filter(
                Message.sender_id == bot_user.id,
                Message.parent_id.in_(
                    db.query(Message.id).filter(Message.sender_id == current_user.id)
                )
            ).order_by(Message.created_at.desc()).limit(5).all()
            
            if user_messages:
                user_context = f"=== RECENT CONVERSATIONS WITH {target_user.upper()} ===\n\n" + "\n\n".join([
                    f"[{msg.created_at.isoformat()}]\n"
                    f"{current_user.username}: {msg.parent.content if msg.parent else '[No parent message]'}\n"
                    f"{target_user}: {msg.content}"
                    for msg in reversed(user_messages)
                ])
                combined_context += user_context + "\n\n"
            
            # Add scored messages context
            scored_messages_context = await generate_scored_messages_context(db, bot_user.id)
            if scored_messages_context:
                combined_context += scored_messages_context + "\n\n"
    
    # Add semantically relevant messages from Pinecone
    if message_docs_sorted:
        relevant_context = "=== SEMANTICALLY RELEVANT MESSAGES ===\n\n" + "\n\n".join([
            f"[{doc.metadata.get('timestamp')}]\n"
            f"User: {doc.metadata.get('sender')}\n"
            f"Channel: {doc.metadata.get('channel')}\n"
            f"Message: {doc.page_content}"
            for doc in message_docs_sorted[:5]  # Limit to top 5 most relevant messages
        ])
        combined_context += relevant_context + "\n\n"
    
    # Add file information
    file_chunks_context, file_descriptions_context = generate_file_contexts(file_chunks, file_descriptions)
    
    if file_descriptions_context.strip() != "=== FILE SUMMARIES ===":
        combined_context += file_descriptions_context + "\n\n"
    if file_chunks_context.strip() != "=== RELEVANT FILE CONTENT ===":
        combined_context += file_chunks_context

    return combined_context

def generate_bot_prompt_template() -> PromptTemplate:
    """Generate the prompt template for bot responses."""
    return PromptTemplate(
        template="""You are {bot_name}, {personality}

Previous conversations with {username} and other relevant context:
{context}

{username}'s Question: {query}

When analyzing the context:
1. If a USER PROFILE section is present, use this information to inform your responses and match the user's communication style
2. Messages are shown with timestamps in [brackets]
3. Messages are ordered newest first
4. Look at the content of conversations, not just individual messages
5. Pay attention to topics discussed in both messages and files
6. When summarizing conversations, focus on the actual topics discussed{extra_instructions}

Remember to:
- Reference specific details from the context in your response
- If you see relevant files or messages, mention them directly
- If you're using information from a specific file or message, indicate where that information came from
- If there's a user profile available, align your responses with their communication style and active hours
- Maintain consistency with any previous conversations shown in the context

Answer as {bot_name}, maintaining consistency with any previous conversations shown in the context. 
If no relevant information is found, say so, but still be somewhat conversational about it.{lain_note}""",
        input_variables=["query", "context", "username", "bot_name", "target_user", "personality", "extra_instructions", "lain_note"]
    )

async def generate_bot_prompt(
    db: Session,
    current_user: User,
    request_message: str,
    target_user: Optional[str],
    message_docs_sorted: List[Any],
    file_chunks: List[Any],
    file_descriptions: List[Any]
) -> str:
    """Generate the complete bot prompt with context."""
    # Get the appropriate context based on bot type
    if target_user:
        combined_context = await generate_user_bot_context(
            db=db,
            current_user=current_user,
            target_user=target_user,
            message_docs_sorted=message_docs_sorted,
            file_chunks=file_chunks,
            file_descriptions=file_descriptions
        )
        bot_name = f"{target_user}<bot>"
        personality = USER_BOT_PERSONALITY.format(target_user=target_user)
        extra_instructions = ""
        lain_note = ""
    else:
        combined_context = await generate_lain_context(
            db=db,
            current_user=current_user,
            message_docs_sorted=message_docs_sorted,
            file_chunks=file_chunks,
            file_descriptions=file_descriptions
        )
        bot_name = "lain"
        personality = LAIN_PERSONALITY
        extra_instructions = LAIN_SPECIFIC_INSTRUCTIONS
        lain_note = " Please don't start your response with 'Lain:'"

    # Get the prompt template
    template = generate_bot_prompt_template()

    # Generate the prompt with context
    prompt_with_context = template.invoke({
        "query": request_message,
        "context": combined_context,
        "username": current_user.username,
        "bot_name": bot_name,
        "target_user": target_user or "Lain",
        "personality": personality,
        "extra_instructions": extra_instructions,
        "lain_note": lain_note
    })

    return prompt_with_context.to_string() 