# Plan of Action to Implement File Summarization and Description

We need to add functionality to summarize or describe uploaded files, store the summaries in the database, and upload the descriptions to Pinecone. Here's a step-by-step plan:

## Overview

- **Objective**: When a user uploads a file, if it's a PDF or text file, generate a summary using `gpt-4o-mini`; if it's an image, generate a description. Store this in a new `description` column in the `file` table, and upload the description to Pinecone.

## Steps

1. **[ ] Update Database Schema to Add `description` Column**

    - Modify the `File` model to include a new `description` field.
    - Create a new Alembic migration to add the `description` column to the `files` table.

2. **[ ] Update Pydantic Schemas**

    - Update the `FileBase`, `FileCreate`, and `File` schemas in `backend/app/schemas/file.py` to include the `description` field.

3. **[ ] Modify File Upload Endpoint**

    - In `backend/app/api/v1/files.py`, modify the `upload_file` function to process the uploaded file.

    - After saving the file to disk, add logic to:

        - For PDFs and text files:

            - Read the file content.

            - Generate a summary using `gpt-4o-mini`.

        - For images:

            - Generate a description using `gpt-4o-mini`.

        - Store the summary/description in the `description` field of the `File` model.

4. **[ ] Integrate `gpt-4o-mini` for Summarization and Description**

    - Set up the `gpt-4o-mini` client in the file upload handler.

    - Write functions to generate summaries and descriptions based on file type.

5. **[ ] Upload Descriptions to Pinecone**

    - Initialize the Pinecone client with 3072-dimension embeddings.

    - After generating the summary/description, upload it to Pinecone with enhanced metadata.

6. **[ ] Testing**

    - Upload various files (PDF, text, images) and ensure that summaries/descriptions are generated and stored.

    - Verify that the descriptions are uploaded to Pinecone.

7. **[ ] Update Documentation**

    - Update any relevant documentation or README files to reflect the new functionality.

---

## Implementation Details

### 1. Update Database Schema to Add `description` Column

- **Modify `File` model in `backend/app/models/file.py`**:

    [CODE START]
    from sqlalchemy import Column, Integer, String, Text, ForeignKey, DateTime
    # ... other imports ...

    class File(Base):
        __tablename__ = "files"

        id = Column(Integer, primary_key=True, index=True)
        filename = Column(String, nullable=False)
        file_type = Column(String, nullable=False)
        file_size = Column(Integer, nullable=False)
        file_path = Column(String, nullable=False)
        description = Column(Text, nullable=True)  # New description field
        # ... other fields ...
    [CODE END]

- **Create a new Alembic migration**:

    - Generate migration script:

        [CODE START]
        alembic revision -m "Add description column to files"
        [CODE END]

    - Edit the generated migration script to add the `description` column:

        [CODE START]
        def upgrade():
            op.add_column('files', sa.Column('description', sa.Text(), nullable=True))

        def downgrade():
            op.drop_column('files', 'description')
        [CODE END]

    - Run the migration:

        [CODE START]
        alembic upgrade head
        [CODE END]

### 2. Update Pydantic Schemas

- **Update `backend/app/schemas/file.py`**:

    - Add `description` field to `FileBase`, `FileCreate`, and `File` classes.

    [CODE START]
    from typing import Optional
    from pydantic import BaseModel

    class FileBase(BaseModel):
        filename: str
        file_type: str
        file_size: int
        file_path: str
        description: Optional[str] = None  # New description field

    class FileCreate(FileBase):
        message_id: Optional[int] = None

    class File(FileBase):
        id: int
        message_id: Optional[int] = None
        uploaded_by_id: int
        created_at: datetime
        updated_at: datetime

        model_config = ConfigDict(from_attributes=True, populate_by_name=True)
    [CODE END]

### 3. Modify File Upload Endpoint

- **In `upload_file` function of `backend/app/api/v1/files.py`**:

    - After saving the file, add logic to process the file based on its type.

    - Example:

        [CODE START]
        # After saving the file...
        # Determine the description
        description = None

        if file.content_type in ['application/pdf', 'text/plain']:
            # Read the file content
            content = await read_file_contents(saved_file_path)
            # Generate summary
            description = await generate_summary(content)
        elif file.content_type.startswith('image/'):
            # For images
            image_data = await read_image_data(saved_file_path)
            description = await generate_image_description(image_data)
        else:
            description = None  # Unsupported file types

        # Create FileModel instance with description
        db_file = FileModel(
            filename=file.filename,
            file_type=file.content_type,
            file_size=file_size,
            file_path=saved_file_path,
            description=description,
            uploaded_by_id=current_user.id,
            message_id=message_id,
            created_at=datetime.utcnow(),
            updated_at=datetime.utcnow()
        )
        [CODE END]

- **Add helper functions to read file contents and generate descriptions**:

    [CODE START]
    async def read_file_contents(file_path: str) -> str:
        async with aiofiles.open(file_path, 'r') as f:
            return await f.read()

    async def read_image_data(file_path: str):
        # Implement image data reading if necessary
        pass
    [CODE END]

### 4. Integrate `gpt-4o-mini` for Summarization and Description

- **Set up `gpt-4o-mini` client**:

    [CODE START]
    from langchain_openai import ChatOpenAI
    llm = ChatOpenAI(model_name="gpt-4o-mini")
    [CODE END]

- **Write functions to generate summary and description**:

    [CODE START]
    async def generate_summary(text_content: str) -> str:
        prompt = f"Please provide a concise summary of the following text:\n\n{text_content}"
        response = llm.invoke(prompt)
        return response.content

    async def generate_image_description(image_data) -> str:
        # If using image recognition model, integrate accordingly
        prompt = "Describe the content of the image."
        response = llm.invoke(prompt)
        return response.content
    [CODE END]

- **Note**: For image description, you might need to use an image captioning model or encode the image into a format that the language model can understand.

### 5. Upload Descriptions to Pinecone

- **Initialize Pinecone client with 3072-dimension embeddings**:

    [CODE START]
    from langchain_community.vectorstores import Pinecone
    from langchain.schema import Document
    embeddings = OpenAIEmbeddings(model="text-embedding-3-large")  # 3072 dimensions
    pinecone_client = Pinecone(
        api_key=os.getenv("PINECONE_API_KEY"),
        index_name=os.getenv("PINECONE_INDEX"),  # Use 3072d index for files
        embedding=embeddings,
        namespace="files"
    )
    [CODE END]

- **Upload description to Pinecone with enhanced metadata**:

    [CODE START]
    if description:
        document = Document(
            page_content=description,
            metadata={
                'file_id': str(db_file.id),
                'filename': db_file.filename,
                'file_type': db_file.file_type,
                'uploaded_by': current_user.username,
                'message_text': message.content if message else None,
                'upload_date': str(datetime.utcnow())
            }
        )
        # Upload document to Pinecone
        await pinecone_client.add_document(document)
    [CODE END]

### 6. Testing

- **Upload Files and Verify**:

    - Upload a PDF or text file and verify that:

        - A summary is generated and stored in the `description` field.

        - The summary is uploaded to Pinecone with correct metadata.

    - Upload an image file and verify that:

        - A description is generated and stored.

        - The description is uploaded to Pinecone.

- **Check Database Entries**:

    - Ensure the new `description` field is populated appropriately in the database.

- **Verify Pinecone Entries**:

    - Use Pinecone's dashboard or API to verify that entries are correctly stored.

### 7. Update Documentation

- **Update README or Documentation Files**:

    - Explain the new functionality.

    - Document any new environment variables or configuration settings.

    - Provide instructions for setting up required services (e.g., Pinecone).

---

## Additional Considerations

- **Asynchronous Processing**:

    - If generating summaries or descriptions significantly delays the upload response, consider processing them asynchronously (e.g., using a background task or job queue).

- **File Size Limitations**:

    - Be mindful of file sizes, especially for large PDFs or images.

    - Implement checks or limitations as necessary.

- **Error Handling**:

    - Add try-except blocks around external service calls to handle failures gracefully.

- **Security**:

    - Ensure that only authorized users can upload and access files.

    - Sanitize inputs to prevent injection attacks.

---

## Progress Tracking

- **[✓]** Updated the `File` model to include `description` field
  - Added description field to File model
  - Created and ran Alembic migration successfully

- **[✓]** Created and ran Alembic migration
  - Created migration file: 2c1cbdc7087f_add_description_to_files.py
  - Successfully ran migration after fixing database state

- **[✓]** Updated Pydantic schemas
  - Added description field to FileBase schema
  - Field is optional with default None

- **[✓]** Modified the file upload endpoint to generate summaries/descriptions
  - Created new module `app/ai/file_description.py` for AI processing
  - Updated file upload endpoint to generate descriptions
  - Added error handling and logging

- **[✓]** Integrated `gpt-4o-mini` for processing files
  - Added support for text files, PDFs, and images
  - Implemented file content extraction
  - Added text summarization and image description

- **[✓]** Uploaded descriptions to Pinecone
  - Integrated Pinecone upload functionality
  - Added error handling to prevent upload failures from affecting file uploads

- **[ ]** Tested with various file types

- **[ ]** Updated documentation

## Current Status (Updated)
- Completed all implementation tasks
- Added new dependencies to requirements.txt
- Next steps:
  1. Test with various file types
  2. Update documentation
  3. Deploy changes
