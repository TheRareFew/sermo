# Plan to Add AI Chat API Endpoint

## Overview

We aim to add a new API endpoint that allows users to send a message to the bot (@terrence) and receive a response, potentially including follow-up questions. We'll use `main.py` in the `ai_demo` directory as a reference for querying the LLM.

## Steps

1. [ ] **Create `ai_features.py` Module**
   - [ ] Create a new file `backend/app/api/v1/ai_features.py`.
   - [ ] Set up the API router and necessary imports.

2. [ ] **Update Main Application to Include the New Route**
   - [ ] Import the `ai_features` module in `backend/app/main.py`.
   - [ ] Include the router in the FastAPI app.

3. [ ] **Set Up Environment Variables**
   - [ ] Load required environment variables for OpenAI and Pinecone.
   - [ ] Ensure variables like `OPENAI_API_KEY`, `PINECONE_API_KEY`, and `PINECONE_INDEX` are set.

4. [ ] **Define Request and Response Models**
   - [ ] Create Pydantic models for the request and response.

5. [ ] **Implement the AI Query Function**
   - [ ] Initialize embeddings and vector store as per `ai_demo/main.py`.
   - [ ] Define the function to query the LLM and retrieve responses.

6. [ ] **Define the API Endpoint**
   - [ ] Create an endpoint `/api/v1/ai/message` that accepts POST requests.
   - [ ] Integrate the AI query function within the endpoint.

7. [ ] **Handle Authentication and Permissions**
   - [ ] Use dependency injection to require authenticated users.
   - [ ] Ensure only authorized users can access the endpoint.

8. [ ] **Test the Endpoint**
   - [ ] Write unit tests in `tests/api/v1/test_ai_features.py`.
   - [ ] Verify that the bot responds correctly to messages.

9. [ ] **Update Documentation**
   - [ ] Add the new endpoint to `docs/api_endpoints.md`.
   - [ ] Provide usage examples and any necessary details.

---

## Implementation Details

### 1. Create `ai_features.py` Module

[CODE START]
# backend/app/api/v1/ai_features.py

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from langchain_openai import ChatOpenAI
from langchain.prompts.prompt import PromptTemplate
from langchain_pinecone import PineconeVectorStore
from langchain.embeddings.openai import OpenAIEmbeddings
import os

router = APIRouter()
[CODE END]

### 2. Update Main Application to Include the New Route

[CODE START]
# backend/app/main.py

from fastapi import FastAPI
from app.api.v1 import ai_features

app = FastAPI()

# Include the AI features router
app.include_router(ai_features.router, prefix="/api/v1/ai", tags=["ai"])
[CODE END]

### 3. Set Up Environment Variables

Ensure the following environment variables are loaded:

- `OPENAI_API_KEY`
- `PINECONE_API_KEY`
- `PINECONE_INDEX`

[CODE START]
# backend/app/api/v1/ai_features.py

from dotenv import load_dotenv

load_dotenv()

# Validate required environment variables
required_vars = ["OPENAI_API_KEY", "PINECONE_API_KEY", "PINECONE_INDEX"]
missing_vars = [var for var in required_vars if not os.getenv(var)]
if missing_vars:
    raise EnvironmentError(f"Missing required environment variables: {', '.join(missing_vars)}")
[CODE END]

### 4. Define Request and Response Models

[CODE START]
# backend/app/api/v1/ai_features.py

class MessageRequest(BaseModel):
    message: str

class MessageResponse(BaseModel):
    response: str
[CODE END]

### 5. Implement the AI Query Function

[CODE START]
# backend/app/api/v1/ai_features.py

@router.post("/message", response_model=MessageResponse)
async def send_message_to_bot(
    request: MessageRequest,
    # Dependency injection for authentication
    current_user: User = Depends(get_current_user)
):
    # Initialize embeddings
    embeddings = OpenAIEmbeddings(model="text-embedding-ada-002")

    # Set up Pinecone vector store
    index_name = os.getenv("PINECONE_INDEX")
    document_vectorstore = PineconeVectorStore(index_name=index_name, embedding=embeddings)
    retriever = document_vectorstore.as_retriever()

    # Retrieve relevant documents
    context_docs = retriever.invoke(request.message)
    context = "\n\n".join([doc.page_content for doc in context_docs])

    # Create prompt with context
    template = PromptTemplate(
        template="{query}\n\nContext:\n{context}",
        input_variables=["query", "context"]
    )
    prompt_with_context = template.invoke({"query": request.message, "context": context})

    # Query the LLM
    llm = ChatOpenAI(temperature=0.7, model_name="gpt-4")
    results = llm.invoke(prompt_with_context)

    # Return the bot's response
    return MessageResponse(response=results.content)
[CODE END]

### 6. Handle Authentication and Permissions

Assuming there's an existing `get_current_user` dependency and `User` model:

[CODE START]
# backend/app/api/v1/ai_features.py

from app.dependencies import get_current_user
from app.models.user import User

# Use current_user in the endpoint to enforce authentication
[CODE END]

### 7. Test the Endpoint

- Create a new test file `tests/api/v1/test_ai_features.py`.
- Write tests to verify:
  - The endpoint returns a response when given a valid message.
  - Unauthorized users cannot access the endpoint.

### 8. Update Documentation

Add the new endpoint to `docs/api_endpoints.md`:

[CODE START]
### AI Messaging

#### Send Message to Bot

- **POST** `/api/v1/ai/message`
- **Description**: Send a message to the bot (@terrence) and receive a response.
- **Request Body**:
  ```json
  {
    "message": "Your message here"
  }
  ```
- **Response**:
  ```json
  {
    "response": "Bot's response here"
  }
  ```
- **Authentication**: Required
[CODE END]

---

## Notes

- Ensure that all secrets (API keys) are safely managed and not hard-coded.
- Handle exceptions and errors gracefully.
- Consider rate limiting to prevent abuse of the endpoint.

## Progress Tracking

- [x] **Create `ai_features.py` Module**
- [x] **Update Main Application to Include the New Route**
- [x] **Set Up Environment Variables**
- [x] **Define Request and Response Models**
- [x] **Implement the AI Query Function**
- [x] **Define the API Endpoint**
- [x] **Handle Authentication and Permissions**
- [x] **Test the Endpoint**
- [x] **Update Documentation**