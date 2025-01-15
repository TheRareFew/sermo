# Plan of Action

## Objective

Add prior messages to the context for the LLM. Specifically, implement a new endpoint that returns Lain's most recent 10 messages where the parent message belongs to the prompting user, and dynamically update Lain's context in `ai_features.py` with these messages.

## Tasks

- [ ] **1. Create a new endpoint to retrieve Lain's messages**

    - **Endpoint Details:**
        - **Method:** `GET`
        - **Path:** `/api/v1/ai/lain_messages`
        - **Query Parameters:**
            - `user_id` (optional): ID of the prompting user. If not provided, use the current authenticated user.
            - `limit` (optional): Number of messages to retrieve (default: 10)

    - **Implementation Steps:**
        - [ ] **a.** In `ai_features.py`, create a new route:
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
        - [ ] **b.** Inside the endpoint:
            - If `user_id` is not provided, set it to `current_user.id`.
            - Query the `Message` model to retrieve messages where:
                - `sender_id` is Lain's user ID.
                - `parent_id` belongs to messages sent by the prompting user.
            - Order the messages by `created_at` descending.
            - Limit the results to the specified `limit`.
        - [ ] **c.** Add necessary imports and dependencies.

- [ ] **2. Update Lain's context in `ai_features.py`**

    - **Implementation Steps:**
        - [ ] **a.** In the `send_message_to_bot` function in `ai_features.py`, retrieve Lain's recent messages using the new endpoint or directly querying the database.
            [CODE START]
            # Retrieve Lain's recent messages in response to the user
            lain_messages = db.query(Message).filter(
                Message.sender_id == lain_user.id,
                Message.parent_id.in_(
                    db.query(Message.id).filter(Message.sender_id == current_user.id)
                )
            ).order_by(Message.created_at.desc()).limit(10).all()
            [CODE END]
        - [ ] **b.** Incorporate these messages into the context passed to the LLM.
            - Build the context string by appending these messages, ensuring they are in chronological order.
        - [ ] **c.** Update the prompt template to include these messages.
            [CODE START]
            # Prepare Lain's previous messages
            lain_context = "\n\n".join([
                f"Lain: {msg.content}" for msg in reversed(lain_messages)
            ])
            # Update the context with Lain's messages
            context = lain_context + "\n\n" + context
            [CODE END]

- [ ] **3. Update Documentation**

    - [ ] **a.** Document the new endpoint in `docs/overviews/ai_overview.md`.
    - [ ] **b.** Update any relevant API documentation or comments in the code.

## References

- **Database Models:**
    - `backend/app/models/message.py`
- **AI Features Endpoint:**
    - `backend/app/api/v1/ai_features.py`
- **Documentation:**
    - `docs/overviews/ai_overview.md`

## Notes

- Ensure that proper error handling is in place for the new endpoint.
- Consider pagination for the endpoint if more messages are needed in the future.
- Test the changes thoroughly to verify that the LLM receives the correct context.
