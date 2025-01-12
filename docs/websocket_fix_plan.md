# Plan to Remove WebSockets and Implement Live Updates via API

## 1. Identify and Remove WebSocket Code in Frontend ✅

### 1.1 Files Handling WebSockets in the Frontend ✅

- **WebSocket Service** ✅

  - `frontend/src/services/websocket/` ✅
    - `frontend/src/services/websocket/index.ts`: Main WebSocket service - DELETED ✅
    - `frontend/src/services/websocket/messageQueue.ts`: Message queue for WebSocket messages - DELETED ✅

- **Components Using WebSockets** ✅

  - `frontend/src/components/layout/MainLayout/index.tsx`: Handles WebSocket connections and message handling - UPDATED ✅
  - `frontend/src/components/chat/MessageList/index.tsx`: Subscribes to WebSocket messages for live chat updates - UPDATED ✅
  - `frontend/src/components/chat/MessageInput/index.tsx`: Already using API, no changes needed ✅
  - Any other components or utilities that import the WebSocket service - CHECKED ✅

### 1.2 Steps to Remove WebSocket Code ✅

1. **Delete WebSocket Service** ✅

   - Remove the entire `frontend/src/services/websocket/` directory - DONE ✅

2. **Modify Components Using WebSockets** ✅

   - **MainLayout Component** ✅
     - **File**: `frontend/src/components/layout/MainLayout/index.tsx`
     - **Actions**:
       - Remove all imports related to the WebSocket service ✅
       - Remove `useEffect` hooks and functions that establish WebSocket connections ✅
       - Remove WebSocket message handlers like `handleWebSocketMessage` ✅
       - Remove any state variables related to WebSocket connections ✅
       - Add polling mechanism for updates ✅

   - **MessageList Component** ✅
     - **File**: `frontend/src/components/chat/MessageList/index.tsx`
     - **Actions**:
       - Remove imports of the WebSocket service ✅
       - Remove `useEffect` hooks that handle WebSocket messages ✅
       - Remove any WebSocket-related message handling logic ✅
       - Add polling mechanism for new messages ✅

   - **MessageInput Component** ✅
     - **File**: `frontend/src/components/chat/MessageInput/index.tsx`
     - **Actions**:
       - Already using the API endpoint instead of WebSockets ✅

3. **Update Redux Store** ✅

   - **Messages Slice**
     - **File**: `frontend/src/store/messages/messagesSlice.ts`
     - **Actions**:
       - No changes needed as the actions and reducers are generic enough to work with both WebSocket and API updates ✅

## 2. Implement Live Updates Using API Polling ✅

### 2.1 Decide on Update Method ✅

- Implement periodic polling to fetch updates using the existing API ✅
- Use `setInterval` to poll the backend for new messages and updates every 5 seconds ✅

### 2.2 Modify Backend Endpoints if Necessary ✅

- Ensure that the backend provides endpoints to fetch updates efficiently.

1. **Modify Messages Endpoint to Support Incremental Updates** ✅

   - **Endpoint**: `GET /api/channels/{channel_id}/messages` ✅
   - **Parameters**:
     - `since`: Optional timestamp to fetch messages after a certain time ✅
   - **Actions**:
     - Update the backend to accept a `since` parameter and return only new messages ✅

2. **Other Endpoints** ✅

   - Ensure that similar functionality is available for:
     - User statuses ✅
     - Reactions ✅
     - Channel updates ✅
   - Add `since` parameters to relevant endpoints to fetch only recent changes ✅

### 2.3 Update Frontend to Use API for Updates ✅

1. **MessageList Component** ✅

   - **File**: `frontend/src/components/chat/MessageList/index.tsx`
   - **Actions**:
     - Implement a polling mechanism using `setInterval` within a `useEffect` hook to fetch new messages periodically ✅
     - Update the message list state with any new messages returned by the API ✅
     - Keep track of the timestamp of the latest message to use with the `since` parameter ✅

2. **MessageInput Component** ✅

   - **File**: `frontend/src/components/chat/MessageInput/index.tsx`
   - **Actions**:
     - Already using the API endpoint instead of WebSockets ✅

3. **User Status Updates** ✅

   - **File**: `frontend/src/components/users/UserList/index.tsx`
   - **Actions**:
     - Implement polling to fetch user statuses using the API ✅

4. **Reactions and Channels** ✅

   - Implement similar polling mechanisms for reactions and channel updates if necessary ✅

## Next Steps:

1. Test the changes thoroughly
2. ~~Update remaining backend endpoints to support incremental updates:~~ ✅
   - [x] User status endpoint
   - [x] Channel updates endpoint
   - [x] Reactions endpoint
3. Optimize polling intervals and implement error handling
4. Update documentation
