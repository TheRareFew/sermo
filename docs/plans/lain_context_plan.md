# Plan of Action

## Objective

Add prior messages to the context for the LLM. Specifically, implement a new endpoint that returns Lain's most recent 10 messages where the parent message belongs to the prompting user, and dynamically update Lain's context in `ai_features.py` with these messages.

## Tasks

- [x] **1. Create a new endpoint to retrieve Lain's messages** [COMPLETED]

    - **Endpoint Details:**
        - **Method:** `GET`
        - **Path:** `/api/v1/ai/lain_messages`
        - **Query Parameters:**
            - `user_id` (optional): ID of the prompting user. If not provided, use the current authenticated user.
            - `limit` (optional): Number of messages to retrieve (default: 10)

    - **Implementation Steps:**
        - [x] **a.** In `ai_features.py`, create a new route:
            [CODE START]
            @router.get("/lain_messages", response_model=List[Message])
            async def get_lain_messages(
                user_id: Optional[int] = None,
                limit: int = 10,
                current_user: User = Depends(get_current_user),
                db: Session = Depends(get_db)
            ):
                # Implementation
            [CODE END]
            
            Implementation Details:
            - Added SQLAlchemy query to get Lain's messages
            - Added error handling for invalid user_id
            - Added error handling for missing Lain bot user
            
        - [x] **b.** Inside the endpoint:
            - [x] If `user_id` is not provided, set it to `current_user.id`.
            - [x] Query the `Message` model to retrieve messages where:
                - [x] `sender_id` is Lain's user ID.
                - [x] `parent_id` belongs to messages sent by the prompting user.
            - [x] Order the messages by `created_at` descending.
            - [x] Limit the results to the specified `limit`.
        - [x] **c.** Add necessary imports and dependencies:
            - Added `List, Optional` from typing
            - Using existing imports for other dependencies

- [x] **2. Update Lain's context in `ai_features.py`** [COMPLETED]

    - **Implementation Steps:**
        - [x] **a.** In the `send_message_to_bot` function in `ai_features.py`, retrieve Lain's recent messages using direct database query:
            - Added query to get Lain's user
            - Added query to get messages where Lain responded to the current user
            - Limited to 10 most recent messages
        - [x] **b.** Incorporated messages into the context:
            - Added messages in chronological order (oldest first)
            - Included both user's message and Lain's response for each conversation
            - Only included messages where parent message exists
            - Added messages before the vector search context
        - [x] **c.** Updated the prompt template:
            - Added section for previous conversations
            - Updated instructions to maintain consistency with previous conversations
            - Improved context organization in the prompt

- [x] **3. Update Documentation** [COMPLETED]

    - [x] **a.** Document the new endpoint in `docs/todos/overviews/ai_overview.md`:
        - Added Lain Message History section to Table of Contents
        - Added detailed endpoint documentation
        - Added context integration details
        - Added example context format
        - Updated introduction and architecture sections
    - [x] **b.** Updated code comments and docstrings in `ai_features.py`

## References

- **Database Models:**
    - `backend/app/models/message.py`
- **AI Features Endpoint:**
    - `backend/app/api/v1/ai_features.py`
- **Documentation:**
    - `docs/todos/overviews/ai_overview.md`

## Notes

- Ensure that proper error handling is in place for the new endpoint.
- Consider pagination for the endpoint if more messages are needed in the future.
- Test the changes thoroughly to verify that the LLM receives the correct context.

## Progress Updates

### 2024-03-19
- Started implementation of `/api/v1/ai/lain_messages` endpoint
- Added implementation details for the route definition
- Completed endpoint implementation with error handling
- Completed context update in send_message_to_bot function:
  - Added previous conversation retrieval
  - Updated prompt template
  - Improved context organization
- Completed documentation updates:
  - Added new sections to AI overview
  - Updated architecture description
  - Added detailed endpoint documentation
  - Added context integration examples

✅ All tasks completed! The implementation now includes Lain's previous conversations in the context, which should help maintain more consistent and contextually aware responses.