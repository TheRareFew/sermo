# Message Reply Implementation Plan

## 1. Frontend Types & State
- [ ] Add reply-related types to `types.ts`:
  ```typescript
  interface StoreMessage {
    // Add to existing interface:
    parentId?: string;
    replyCount: number;
    isExpanded?: boolean;
  }
  ```
- [ ] Add reply actions to message slice:
  ```typescript
  // In messagesSlice.ts
  setReplies: (state, action: PayloadAction<{
    messageId: string,
    replies: StoreMessage[]
  }>) => {
    // Store replies in messagesByChannel
  },
  toggleExpanded: (state, action: PayloadAction<{
    channelId: string,
    messageId: string
  }>) => {
    // Toggle isExpanded state
  }
  ```

## 2. Message Component Updates
- [ ] Add reply button & count to ChatMessage component:
  ```typescript
  const ReplyButton = styled.button`
    // Similar styling to MenuTrigger but different icon
  `;
  ```
- [ ] Add reply count display:
  ```typescript
  const ReplyCount = styled.span`
    color: ${props => props.theme.colors.secondary};
    font-size: 0.9em;
  `;
  ```
- [ ] Add expand/collapse functionality:
  ```typescript
  const handleToggleReplies = async () => {
    if (!isExpanded && !repliesLoaded) {
      const replies = await getReplies(messageId);
      dispatch(setReplies({ messageId, replies }));
    }
    dispatch(toggleExpanded({ channelId, messageId }));
  };
  ```

## 3. Reply Display Component
- [ ] Create new `MessageReplies` component:
  ```typescript
  interface MessageRepliesProps {
    parentId: string;
    replies: StoreMessage[];
    isExpanded: boolean;
  }
  ```
- [ ] Style replies with indentation:
  ```typescript
  const RepliesContainer = styled.div`
    margin-left: 24px;
    border-left: 2px solid ${props => props.theme.colors.border};
    padding-left: 12px;
  `;
  ```

## 4. Message Options Update
- [ ] Add "Reply" option to MessageOptions component:
typescript:frontend/src/components/chat/MessageOptions/index.tsx
startLine: 74
endLine: 80


## 5. Reply Creation
- [ ] Create `ReplyModal` component:
  ```typescript
  interface ReplyModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSubmit: (content: string) => void;
    parentMessage: StoreMessage;
  }
  ```
- [ ] Add reply creation handler to MessageList:
  ```typescript
  const handleCreateReply = async (messageId: string, content: string) => {
    try {
      const reply = await createReply(messageId, content);
      dispatch(addMessage(reply));
    } catch (error) {
      toast.error('Failed to create reply');
    }
  };
  ```

## 6. API Integration
- [ ] Create reply-related API functions in chat service:
  ```typescript
  export const getReplies = async (messageId: string): Promise<ApiMessage[]> => {
    const response = await api.get(`/messages/${messageId}/replies`);
    return response.data;
  };

  export const createReply = async (messageId: string, content: string): Promise<ApiMessage> => {
    const response = await api.post(`/messages/${messageId}/replies`, { content });
    return response.data;
  };
  ```

## 7. WebSocket Updates
- [ ] Add reply handling to WebSocket message processing:
  ```typescript
  case 'new_reply':
    dispatch(addMessage({
      ...transformMessage(data.message),
      parentId: data.parentId
    }));
    break;
  ```


## 9. Documentation
- [ ] Update component documentation
- [ ] Add reply-related props documentation
- [ ] Document new state management features
- [ ] Update API integration documentation

## 10. Polish & Bug Fixes
- [ ] Add loading states for reply fetching
- [ ] Add error handling for failed operations
- [ ] Add animations for expand/collapse
- [ ] Ensure proper keyboard navigation
- [ ] Add proper ARIA attributes for accessibility