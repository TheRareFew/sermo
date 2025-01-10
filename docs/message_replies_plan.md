# Message Reply Implementation Plan

## 1. Frontend Types & State ✅
- [x] Add reply-related types to `types.ts`:
  ```typescript
  interface StoreMessage {
    // Added to existing interface:
    parentId?: string;
    replyCount: number;
    isExpanded?: boolean;
  }
  ```
- [x] Add reply actions to message slice:
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

## 2. Message Component Updates ✅
- [x] Add reply button & count to ChatMessage component
- [x] Add reply count display
- [x] Add expand/collapse functionality

## 3. Reply Display Component ✅
- [x] Created new `MessageReplies` component with:
  ```typescript
  interface MessageRepliesProps {
    parentId: string;
    replies: StoreMessage[];
    isExpanded: boolean;
    onToggleReplies: (messageId: string) => void;
    onDelete?: (messageId: string) => void;
    currentUserId?: string;
  }
  ```
- [x] Styled replies with indentation and border

## 4. Message Options Update ✅
- [x] Added "Reply" option to MessageOptions component
- [x] Updated MessageOptions interface to include onReply handler

## 5. Reply Creation ✅
- [x] Created `ReplyModal` component with:
  ```typescript
  interface ReplyModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSubmit: (content: string) => void;
    parentMessage: StoreMessage;
  }
  ```
- [x] Added reply creation handler to MessageList

## 6. API Integration ✅
- [x] Created reply-related API functions in chat service:
  ```typescript
  export const getReplies = async (messageId: string): Promise<Message[]>;
  export const createReply = async (messageId: string, content: string): Promise<Message>;
  ```

## 7. WebSocket Updates ✅
- [x] Added reply handling to WebSocket message processing:
  ```typescript
  case 'new_reply':
    dispatch(addMessage({
      ...transformMessage(data.message),
      parentId: data.parentId
    }));
    break;
  ```

## 8. Implementation Details
- Messages can be replied to via the reply button or context menu
- Replies are indented and visually connected to parent messages
- Reply count shows number of direct replies to a message
- Replies can be expanded/collapsed using the [+]/[-] toggle
- Real-time updates for new replies via WebSocket
- Replies maintain all regular message functionality (delete, reply to replies)

## 9. Documentation ✅
- [x] Updated component documentation
- [x] Added reply-related props documentation
- [x] Documented new state management features
- [x] Updated API integration documentation

## 10. Polish & Bug Fixes ✅
- [x] Added loading states for reply fetching
- [x] Added error handling for failed operations
- [x] Added animations for expand/collapse
- [x] Added proper keyboard navigation
- [x] Added proper ARIA attributes for accessibility