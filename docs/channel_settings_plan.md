# Channel Settings Implementation Plan

## Features to Implement

- [ ] Edit channel name
- [ ] Edit channel description
- [ ] Add members to private channels
- [ ] Remove members from private channels

---

## Plan of Action

### 1. Edit Channel Name

- [ ] **Backend:**

    - [ ] **API Endpoint:**

        - Create a new API endpoint to update the channel name.
        - **Endpoint:** PATCH /api/channels/{channel_id}/name
        - **Request Body:** { "name": "new_channel_name" }

    - [ ] **Database Model:**

        - Ensure the Channel model allows updating the name field.
        - Add necessary validation if required.

    - [ ] **Permissions:**

        - Only channel creators or administrators can edit the channel name.
        - Validate permissions within the endpoint.

- [ ] **Frontend:**

    - [ ] **UI Component:**

        - Add an editable field or modal in the channel settings page for changing the channel name.
        - Include form validation for the channel name length and allowed characters.

    - [ ] **API Integration:**

        - Implement a function to call the backend API and update the channel name.
        - Handle success and error responses appropriately.
        - Update the UI to reflect the new channel name after a successful update.

---

### 2. Edit Channel Description

- [ ] **Backend:**

    - [ ] **API Endpoint:**

        - Create a new API endpoint to update the channel description.
        - **Endpoint:** PATCH /api/channels/{channel_id}/description
        - **Request Body:** { "description": "new_channel_description" }

    - [ ] **Database Model:**

        - Ensure the Channel model allows updating the description field.
        - Add necessary validation if required.

    - [ ] **Permissions:**

        - Only channel creators or administrators can edit the channel description.
        - Validate permissions within the endpoint.

- [ ] **Frontend:**

    - [ ] **UI Component:**

        - Add an editable field or modal in the channel settings page for changing the channel description.
        - Include form validation for the description length.

    - [ ] **API Integration:**

        - Implement a function to call the backend API and update the channel description.
        - Handle success and error responses appropriately.
        - Update the UI to reflect the new channel description after a successful update.

---

### 3. Add Members to Private Channels

- [ ] **Backend:**

    - [ ] **API Endpoint:**

        - Create an endpoint to add members to a private channel.
        - **Endpoint:** POST /api/channels/{channel_id}/members
        - **Request Body:** { "user_ids": [1, 2, 3] }

    - [ ] **Database Model:**

        - Update the Channel model relationships to handle adding members.
        - Ensure that adding members updates any necessary association tables.

    - [ ] **Permissions:**

        - Only channel creators or administrators can add members to private channels.
        - Validate permissions within the endpoint.

- [ ] **Frontend:**

    - [ ] **UI Component:**

        - Add a user search and selection feature in the channel settings.
        - Allow selecting multiple users to add at once.

    - [ ] **API Integration:**

        - Implement a function to call the backend API and add selected users to the channel.
        - Handle success and error responses.
        - Update the members list in the UI after successful addition.

---

### 4. Remove Members from Private Channels

- [ ] **Backend:**

    - [ ] **API Endpoint:**

        - Create an endpoint to remove members from a private channel.
        - **Endpoint:** DELETE /api/channels/{channel_id}/members/{user_id}

    - [ ] **Database Model:**

        - Update the Channel model relationships to handle removing members.
        - Ensure that removing members updates any necessary association tables.

    - [ ] **Permissions:**

        - Only channel creators or administrators can remove members from private channels.
        - Prevent removing oneself if not permitted.

- [ ] **Frontend:**

    - [ ] **UI Component:**

        - Display a list of current channel members in the channel settings.
        - Provide an option (e.g., a remove button) next to each member.

    - [ ] **API Integration:**

        - Implement a function to call the backend API and remove the selected user from the channel.
        - Handle success and error responses.
        - Update the members list in the UI after successful removal.

---

## Code Implementation Examples

### Backend API Endpoint for Updating Channel Name

[CODE START]
@router.patch("/channels/{channel_id}/name")
async def update_channel_name(
    channel_id: int,
    name: str = Body(..., embed=True),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    # Fetch the channel
    channel = db.query(Channel).filter(Channel.id == channel_id).first()
    if not channel:
        raise HTTPException(status_code=404, detail="Channel not found")

    # Check permissions
    if not current_user.id == channel.created_by_id:
        raise HTTPException(status_code=403, detail="Not authorized to edit this channel")

    # Update channel name
    channel.name = name
    db.commit()
    db.refresh(channel)
    return channel
[CODE END]

### Frontend API Call for Updating Channel Name

[CODE START]
// src/services/api/channels.ts
export const updateChannelName = async (channelId: number, name: string): Promise<Channel> => {
  const response = await fetch(`/api/channels/${channelId}/name`, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${localStorage.getItem('auth_token')}`,
    },
    body: JSON.stringify({ name }),
  });

  if (!response.ok) {
    throw new Error('Failed to update channel name');
  }

  return response.json();
};
[CODE END]

---

## Progress Tracking

- [ ] **Edit channel name**
- [ ] **Edit channel description**
- [ ] **Add members to private channels**
- [ ] **Remove members from private channels**

---

## Testing and Validation

- [ ] **Unit Tests:**

    - Write tests for new backend endpoints.
    - Ensure permissions are enforced correctly.
    - Validate error handling.

- [ ] **Integration Tests:**

    - Test the full flow from the frontend to the backend.
    - Simulate user interactions in the UI.

- [ ] **User Acceptance Testing:**

    - Verify that channel creators and admins can update settings.
    - Ensure that unauthorized users cannot perform restricted actions.

---

## Documentation

- [ ] **Update API Documentation:**

    - Document new endpoints and their usage.
    - Include request and response examples.

- [ ] **Update User Guides:**

    - Provide instructions on how to use the new channel settings features.
    - Include screenshots or illustrations if necessary.

---

## Deployment Considerations

- [ ] **Database Migrations:**

    - If any changes to the database schema are required, prepare migration scripts.

- [ ] **Environment Variables:**

    - Verify if any new environment variables are needed for configuration.

- [ ] **Rollout Plan:**

    - Deploy to a staging environment first.
    - Monitor logs for any errors.
    - Proceed to production deployment after validation.