import os
from typing import Optional
import aiofiles
from langchain_openai import ChatOpenAI
from langchain_community.embeddings import OpenAIEmbeddings
from langchain_community.vectorstores import Pinecone
from langchain.schema import Document
import logging
from PIL import Image
import io
import fitz  # PyMuPDF for PDF processing
import base64
from openai import AsyncOpenAI
from datetime import datetime

# Set up logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Initialize OpenAI client
openai_client = AsyncOpenAI(api_key=os.getenv("OPENAI_API_KEY"))

# Initialize LLM for text processing
llm = ChatOpenAI(model_name="gpt-4o-mini")

async def read_text_file(file_path: str) -> str:
    """Read content from a text file."""
    try:
        async with aiofiles.open(file_path, 'r', encoding='utf-8') as f:
            content = await f.read()
            return content
    except UnicodeDecodeError:
        # If UTF-8 fails, try with a different encoding
        async with aiofiles.open(file_path, 'r', encoding='latin-1') as f:
            content = await f.read()
            return content

async def read_pdf_file(file_path: str) -> str:
    """Read content from a PDF file."""
    try:
        text = []
        doc = fitz.open(file_path)
        for page in doc:
            text.append(page.get_text())
        return "\n".join(text)
    except Exception as e:
        logger.error(f"Error reading PDF file: {str(e)}")
        raise

async def encode_image(file_path: str) -> str:
    """Encode image as base64 string."""
    try:
        async with aiofiles.open(file_path, "rb") as image_file:
            content = await image_file.read()
            return base64.b64encode(content).decode("utf-8")
    except Exception as e:
        logger.error(f"Error encoding image: {str(e)}")
        raise

async def generate_text_summary(content: str) -> str:
    """Generate a summary for text content."""
    try:
        prompt = f"Please provide a concise summary of the following text (max 200 words):\n\n{content[:4000]}"  # Limit content length
        response = await llm.ainvoke(prompt)
        return response.content
    except Exception as e:
        logger.error(f"Error generating text summary: {str(e)}")
        return "Error generating summary"

async def generate_image_description(file_path: str) -> str:
    """Generate a description for an image using base64 encoding."""
    try:
        # Encode image to base64
        base64_image = await encode_image(file_path)
        
        # Create message with image
        response = await openai_client.chat.completions.create(
            model="gpt-4o-mini",
            messages=[
                {
                    "role": "system",
                    "content": "You are a helpful assistant that provides detailed descriptions of images. Focus on the main elements, colors, composition, and any text visible in the image."
                },
                {
                    "role": "user",
                    "content": [
                        {
                            "type": "text",
                            "text": "Please describe this image in detail."
                        },
                        {
                            "type": "image_url",
                            "image_url": {
                                "url": f"data:image/jpeg;base64,{base64_image}"
                            }
                        }
                    ]
                }
            ],
            temperature=0.7,
        )
        
        return response.choices[0].message.content
    except Exception as e:
        logger.error(f"Error generating image description: {str(e)}")
        return "Error generating image description"

async def upload_to_pinecone(
    description: str,
    file_id: int,
    filename: str,
    uploaded_by: str,
    index_name: str,
    created_at: datetime
) -> None:
    """Upload file description to Pinecone."""
    try:
        embeddings = OpenAIEmbeddings()
        
        document = Document(
            page_content=description,
            metadata={
                'file_id': str(file_id),
                'filename': filename,
                'uploaded_by': uploaded_by,
                'upload_date': str(created_at)
            }
        )
        
        Pinecone.from_documents(
            documents=[document],
            embedding=embeddings,
            index_name=index_name,
            namespace="files"
        )
        
        logger.info(f"Successfully uploaded description for file {filename} to Pinecone")
    except Exception as e:
        logger.error(f"Error uploading to Pinecone: {str(e)}")
        # Don't raise the error - we don't want to fail the file upload if Pinecone fails
        pass

async def process_file(
    file_path: str,
    file_type: str,
    file_id: int,
    filename: str,
    uploaded_by: str,
    pinecone_index: str,
    created_at: datetime
) -> Optional[str]:
    """Process a file and generate its description."""
    try:
        description = None
        
        # Process based on file type
        if file_type.startswith('text/') or file_type == 'application/pdf':
            content = await read_pdf_file(file_path) if file_type == 'application/pdf' else await read_text_file(file_path)
            description = await generate_text_summary(content)
        
        elif file_type.startswith('image/'):
            description = await generate_image_description(file_path)
        
        # Upload to Pinecone if description was generated
        if description:
            await upload_to_pinecone(
                description=description,
                file_id=file_id,
                filename=filename,
                uploaded_by=uploaded_by,
                index_name=pinecone_index,
                created_at=created_at
            )
        
        return description
    
    except Exception as e:
        logger.error(f"Error processing file: {str(e)}")
        return None 