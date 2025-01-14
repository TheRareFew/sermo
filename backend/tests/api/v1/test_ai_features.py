from fastapi.testclient import TestClient
import pytest
from unittest.mock import patch, MagicMock
from app.main import app

client = TestClient(app)

@pytest.fixture
def authenticated_client(test_client: TestClient, test_user_token: str):
    """Create an authenticated test client."""
    return TestClient(app, headers={"Authorization": f"Bearer {test_user_token}"})

def test_send_message_to_bot_unauthorized():
    """Test that unauthorized users cannot access the endpoint"""
    response = client.post("/api/v1/ai/message", json={"message": "Hello"})
    assert response.status_code == 401

@pytest.mark.asyncio
@patch("app.api.v1.ai_features.OpenAIEmbeddings")
@patch("app.api.v1.ai_features.PineconeVectorStore")
@patch("app.api.v1.ai_features.ChatOpenAI")
async def test_send_message_to_bot_authorized(mock_chat_openai, mock_vectorstore, mock_embeddings, authenticated_client):
    """Test that authorized users can send messages and receive responses"""
    # Mock the AI components
    mock_retriever = MagicMock()
    mock_vectorstore.return_value.as_retriever.return_value = mock_retriever
    mock_retriever.invoke.return_value = [MagicMock(page_content="Test context")]
    
    mock_chat = MagicMock()
    mock_chat_openai.return_value = mock_chat
    mock_chat.invoke.return_value = MagicMock(content="Test response")

    # Send request
    response = authenticated_client.post(
        "/api/v1/ai/message",
        json={"message": "Hello"}
    )

    # Verify response
    assert response.status_code == 200
    assert response.json() == {"response": "Test response"}

    print(response)
    # Verify mocks were called correctly
    mock_embeddings.assert_called_once()
    mock_vectorstore.assert_called_once()
    mock_chat_openai.assert_called_once_with(temperature=0.7, model_name="gpt-4o-mini")
    mock_chat.invoke.assert_called_once() 