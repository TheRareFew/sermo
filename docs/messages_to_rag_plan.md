# Plan of Action to Upload Messages to Pinecone

We will create a Python script that extracts all messages from the database and uploads them to Pinecone using LangChain. Each message will include the sender, channel, content, and timestamp.

## Steps

1. [x] **Set Up the Environment**
   - [x] Install necessary packages
   - [x] Load environment variables

2. [x] **Connect to the Database**
   - [x] Establish a connection to the message database
   - [x] Fetch all messages with required fields

3. [x] **Prepare Messages for Embedding**
   - [x] Convert messages into LangChain `Document` objects
   - [x] Include sender, channel, content, and timestamp in metadata

4. [x] **Split Messages into Chunks (if necessary)**
   - [x] Use `RecursiveCharacterTextSplitter` to split long messages

5. [x] **Initialize Embeddings and Vector Store**
   - [x] Set up OpenAI embeddings
   - [x] Configure Pinecone vector store

6. [x] **Upload Data to Pinecone**
   - [x] Use LangChain to upload messages to Pinecone

7. [x] **Test and Verify**
   - [x] Ensure messages are correctly uploaded
   - [x] Verify data integrity and retrieval

---

## Implementation Details

The implementation is complete in `ai_demo/messages_to_rag.py`. The script includes the following key components:

### Environment Setup
- Uses `python-dotenv` to load environment variables
- Validates required environment variables:
  - `PINECONE_API_KEY`
  - `OPENAI_API_KEY`
  - `PINECONE_INDEX`
  - `DATABASE_URL`

### Database Connection
- Uses SQLAlchemy to connect to the database
- Fetches messages with JOIN operations to include:
  - Message content
  - Sender username
  - Channel name
  - Creation timestamp

### Document Preparation
- Converts database records to LangChain Document objects
- Includes metadata:
  - Message ID
  - Sender
  - Channel
  - Timestamp

### Text Splitting
- Uses RecursiveCharacterTextSplitter
- Default chunk size: 1000 characters
- Default overlap: 100 characters
- Custom separators: ["\n\n", "\n", " ", ""]

### Pinecone Upload
- Initializes OpenAI embeddings
- Uploads documents in batches of 100
- Uses "messages" namespace in Pinecone
- Includes progress logging for each batch

### Logging
- Comprehensive logging throughout the process
- Error handling with detailed error messages
- Progress tracking for long-running operations

## Usage

1. Ensure all required environment variables are set in `.env`:
```
PINECONE_API_KEY=your_key
OPENAI_API_KEY=your_key
PINECONE_INDEX=your_index
DATABASE_URL=your_db_url
```

2. Run the script:
```bash
python ai_demo/messages_to_rag.py
```

The script will automatically:
- Connect to the database
- Fetch all messages
- Process and split them
- Upload them to Pinecone
- Log progress and any errors

## Error Handling

The script includes comprehensive error handling:
- Environment variable validation
- Database connection errors
- Document processing errors
- Pinecone upload errors

Each error is logged with detailed information to help with debugging.

---

## References

- **LangChain Documentation**
  - [LangChain Docs](https://langchain.readthedocs.io/)
- **Pinecone Documentation**
  - [Pinecone Docs](https://docs.pinecone.io/)
- **SQLAlchemy Documentation**
  - [SQLAlchemy Docs](https://docs.sqlalchemy.org/)
