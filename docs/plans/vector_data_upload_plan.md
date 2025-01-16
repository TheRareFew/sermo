# Plan of Action to Update the Codebase for Pinecone Integration

## Objective

Modify the codebase to:

1. Use the appropriate Pinecone indexes (`PINECONE_INDEX` with 3072 dimensions and `PINECONE_INDEX_TWO` with 1536 dimensions) based on data type.
2. Include the message text that accompanies file uploads in the Pinecone metadata.
3. Include the type of file uploaded in the Pinecone metadata.
4. Ensure the embedding models used match the dimensions of the respective Pinecone indexes.

---

## Steps

### 1. Update Environment Variables

- **[ ]** **Ensure the environment variables are correctly set:**
  - `PINECONE_INDEX` (3072 dimensions) for files and file descriptions.
  - `PINECONE_INDEX_TWO` (1536 dimensions) for user messages and metadata.

---

### 2. Update `file_description.py` to Use Correct Pinecone Index and Include File Metadata

- **[ ]** **Modify `upload_to_pinecone` function in `backend/app/ai/file_description.py`:**

  [CODE START]
  import os
  # Existing imports...

  async def upload_to_pinecone(
      description: str,
      file_id: int,
      filename: str,
      uploaded_by: str,
      file_type: str,
      message: Optional[Message],
      index_name: str,
      created_at: datetime
  ) -> None:
      """Upload file description to Pinecone."""
      try:
          embeddings = OpenAIEmbeddings(model="appropriate-model-for-3072-dimensions")
          
          document = Document(
              page_content=description,
              metadata={
                  'file_id': str(file_id),
                  'filename': filename,
                  'uploaded_by': uploaded_by,
                  'file_type': file_type,
                  'message_text': message.content if message else None,
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
          # Don't raise the error to prevent failing the file upload
          pass
  [CODE END]

- **[ ]** **Update calls to `upload_to_pinecone` to pass file metadata:**

  [CODE START]
  async def process_file(
      file_path: str,
      file_type: str,
      file_id: int,
      filename: str,
      uploaded_by: str,
      message: Optional[Message],
      pinecone_index: str,
      created_at: datetime
  ) -> Optional[str]:
      if description:
          logger.info(f"Generated description for {filename}, uploading to Pinecone")
          await upload_to_pinecone(
              description=description,
              file_id=file_id,
              filename=filename,
              uploaded_by=uploaded_by,
              file_type=file_type,
              message=message,
              index_name=pinecone_index,
              created_at=created_at
          )
      # Existing code...
  [CODE END]

---

### 3. Update `ai_features.py` to Use Correct Pinecone Indexes

- **[ ]** **Modify the embeddings and vector stores initialization:**

  [CODE START]
  # Inside ai_features.py
  import os
  # Existing imports...

  # Initialize embeddings
  embeddings_1536 = OpenAIEmbeddings(model="text-embedding-ada-002")  # 1536 dimensions
  embeddings_3072 = OpenAIEmbeddings(model="appropriate-model-for-3072-dimensions")  # Replace with actual model

  # Messages vectorstore
  messages_vectorstore = PineconeVectorStore(
      index_name=os.getenv("PINECONE_INDEX_TWO"),
      embedding=embeddings_1536,
      namespace="messages"
  )
  messages_retriever = messages_vectorstore.as_retriever(
      search_kwargs={"k": 5}
  )

  # Files vectorstore
  files_vectorstore = PineconeVectorStore(
      index_name=os.getenv("PINECONE_INDEX"),
      embedding=embeddings_3072,
      namespace="files"
  )
  files_retriever = files_vectorstore.as_retriever(
      search_kwargs={"k": 5}
  )
  [CODE END]

- **[ ]** **Ensure that query embeddings match the embeddings used during indexing:**
  - When invoking the retrievers, make sure the embeddings are processed correctly.

---

### 4. Include File Type and Message Content in Retrieval and Context

- **[ ]** **Modify how file documents are formatted in the context within `ai_features.py`:**

  [CODE START]
  # Inside send_message_to_bot function

  # Format file context
  file_context = "\n\n".join([
      f"""File Description: {doc.page_content}
      File: {doc.metadata.get('filename')}
      File Type: {doc.metadata.get('file_type')}
      Message Text: {doc.metadata.get('message_text')}
      Uploaded by: {doc.metadata.get('uploaded_by')}
      Uploaded on: {doc.metadata.get('upload_date')}"""
      for doc in file_docs
  ])
  [CODE END]

- **[ ]** **Ensure that the LLM receives the updated context including file type and message content.**

---

### 5. Verify and Update Embedding Models

- **[ ]** **Confirm the correct embedding models are used:**
  - For `PINECONE_INDEX_TWO` (1536 dimensions), continue using `text-embedding-ada-002`.
  - For `PINECONE_INDEX` (3072 dimensions), select an appropriate model that outputs embeddings with 3072 dimensions.

- **[ ]** **Update any code where embeddings are generated to use the correct model.**

---

### 6. Testing

- **[ ]** **Test file uploads:**
  - Upload different types of files (PDF, text, images).
  - Verify that file metadata is correctly passed to Pinecone.
  - Check that descriptions are generated and uploaded to the correct Pinecone index.

- **[ ]** **Test message retrieval and LLM responses:**
  - Ensure that the LLM can retrieve and utilize both message and file contexts correctly.
  - Confirm that the embeddings are correctly aligning with the respective index dimensions.

---

### 7. Documentation

- **[ ]** **Update any relevant documentation or README files:**
  - Document the changes to the environment variables.
  - Explain the purpose of the two Pinecone indexes.
  - Provide instructions on setting up and configuring the indexes and embedding models.

---

## Additional Notes

- **Error Handling:**
  - Ensure robust error handling for Pinecone operations.
  - Add appropriate logging for debugging purposes.

- **Dependencies:**
  - Verify that any new embedding models are supported by the current version of `langchain` and `OpenAIEmbeddings`.

- **Collaboration:**
  - Coordinate with team members if there are overlapping changes to shared files.

---

## Progress Tracking

- [ ] **Step 1:** Update Environment Variables
- [ ] **Step 2:** Update `file_description.py`
- [ ] **Step 3:** Update `ai_features.py`
- [ ] **Step 4:** Include File Type and Message Content in Context
- [ ] **Step 5:** Verify Embedding Models
- [ ] **Step 6:** Testing
- [ ] **Step 7:** Documentation

---

**End of Plan**