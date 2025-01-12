# Live Message Updates Fix Plan

## 1. Issue Identification
- WebSocket message handling in MainLayout is not properly processing all message types
- Message transformation is inconsistent between initial load and real-time updates
- Channel switching logic needs improvement for WebSocket reconnection

## 2. Fix WebSocket Message Handling

### Update MainLayout WebSocket Handler
Reference: `frontend/src/components/layout/MainLayout/index.tsx`

Changes needed:
1. Modify handleWebSocketMessage to properly handle all message types:

[CODE START]
const handleWebSocketMessage = (message: WebSocketMessage) => {
  // Ensure message is for current channel
  if (!isMessageForCurrentChannel(message)) return;

  switch (message.type) {
    case 'message':
    case 'message_sent':
      if ('message' in message && message.message) {
        const transformedMessage = transformMessage(message.message);
        dispatch(addMessage({
          channelId: activeChannelId,
          message: transformedMessage
        }));
      }
      break;
    
    case 'message_updated':
      if ('message' in message && message.message) {
        const transformedMessage = transformMessage(message.message);
        dispatch(updateMessage({
          channelId: transformedMessage.channelId,
          id: transformedMessage.id,
          message: transformedMessage
        }));
      }
      break;
  }
};
[CODE END]

## 3. Improve WebSocket Connection Management

1. Add reconnection logic:

[CODE START]
const connectWebSocket = async (channelId: string, retries = 3) => {
  for (let i = 0; i < retries; i++) {
    try {
      await wsService.connect(channelId);
      return true;
    } catch (error) {
      console.error(`WebSocket connection attempt ${i + 1} failed:`, error);
      if (i === retries - 1) throw error;
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
  }
  return false;
};
[CODE END]

2. Update channel switching logic:

[CODE START]
const handleChannelSelect = async (channelId: string) => {
  if (channelId === activeChannelId) return;
  
  try {
    setIsConnecting(true);
    
    // Disconnect from current channel
    wsService.disconnect();
    
    // Update active channel
    dispatch(setActiveChannel(channelId));
    
    // Connect to new channel
    await connectWebSocket(channelId);
    
    // Fetch initial messages
    const messages = await getChannelMessages(channelId);
    const transformedMessages = transformMessagesInChunks(messages);
    dispatch(setMessages({ channelId, messages: transformedMessages }));
    
  } catch (error) {
    console.error('Error switching channels:', error);
    dispatch(setError('Failed to switch channels'));
  } finally {
    setIsConnecting(false);
  }
};
[CODE END]

## 4. Add Message Queue System

1. Create a message queue service to handle out-of-order messages:

[CODE START]
// services/messageQueue.ts
export class MessageQueue {
  private queue: Map<string, WebSocketMessage[]> = new Map();
  
  addMessage(channelId: string, message: WebSocketMessage) {
    if (!this.queue.has(channelId)) {
      this.queue.set(channelId, []);
    }
    this.queue.get(channelId)?.push(message);
  }
  
  processQueue(channelId: string) {
    const messages = this.queue.get(channelId) || [];
    this.queue.set(channelId, []);
    return messages;
  }
}
[CODE END]

## 5. Implementation Steps

1. Update WebSocket service to use new connection management
2. Implement message queue system
3. Update MainLayout component with new message handling
4. Add error recovery for WebSocket disconnections
5. Add proper cleanup on component unmount
6. Add message delivery confirmation

## 6. Testing Plan

1. Test real-time message delivery between multiple clients
2. Verify message order is maintained
3. Test channel switching behavior
4. Verify WebSocket reconnection works
5. Test message queue system handles out-of-order messages

## 7. Key Files to Update

- `frontend/src/components/layout/MainLayout/index.tsx`
- `frontend/src/services/websocket.ts`
- `frontend/src/services/messageQueue.ts`
- `frontend/src/store/messages/messagesSlice.ts`

## 8. Expected Outcomes

1. Messages appear immediately for all users in the channel
2. Message order is preserved
3. No duplicate messages
4. Smooth channel switching
5. Reliable WebSocket connections
6. Proper error handling and recovery

## 9. Monitoring and Logging

Add logging for:
- WebSocket connection states
- Message processing events
- Queue operations
- Error conditions
- Performance metrics

## 10. Rollout Plan

1. Implement changes in development environment
2. Test with multiple clients
3. Deploy to staging
4. Monitor for issues
5. Roll out to production
