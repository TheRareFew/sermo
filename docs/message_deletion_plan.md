# Message Options & Deletion Implementation Plan

## 1. Frontend Components

### Create MessageOptions Component
- [x] Create new component `src/components/chat/MessageOptions/index.tsx`
- [x] Add styled-components for retro menu styling:
  - Beveled edges matching app theme
  - Monospace font
  - DOS-style dropdown
  - Hover states
- [x] Add click-outside handler to close menu
- [x] Position menu relative to message (top-right corner)
- [x] Add initial delete option (more options will be added later)

### Update ChatMessage Component
- [x] Add three-dot menu icon trigger
- [x] Add state for menu visibility (isMenuOpen)
- [x] Add check for message ownership by comparing message.userId with currentUser.id
- [x] Only show menu icon if user owns message
- [x] Pass deletion handler from parent
- [x] Add menu trigger button styled to match retro theme

## 2. State Management

### Use Existing Redux Actions
- [x] Review existing deleteMessage action in messagesSlice:
typescript:frontend/src/store/messages/messagesSlice.ts
startLine: 57
endLine: 63

- [x] Handle 403/404 responses
- [x] Add proper TypeScript types for request/response

## 3. Message Component Integration

### Update MessageList Component
- [x] Add deleteMessage handler that:
  - Calls API endpoint
  - Dispatches deleteMessage action on success
  - Shows error toast on failure
- [x] Pass current user ID to ChatMessage for ownership check
- [x] Add loading state during deletion
- [x] Add error handling for failed deletions
- [x] Reference existing component structure:
typescript:frontend/src/components/chat/MessageList/index.tsx
startLine: 330
endLine: 344


## 4. Styling

### Create CSS Module
- [x] Create `src/components/chat/MessageOptions/MessageOptions.module.css`
- [x] Style menu container:
  - Border: 2px beveled (matching theme)
  - Background: Theme background color
  - Shadow: Retro drop shadow
- [x] Style menu items:
  - Hover highlight
  - Danger color for delete
  - Monospace font
  - Padding/spacing
- [x] Add transitions/animations:
  - Fade in/out
  - Slide animation
  - Hover transitions

## 5. Error Handling

### Frontend Error States
- [x] Add error toast notifications using existing toast system
- [x] Handle network errors
- [x] Handle unauthorized errors (403)
- [x] Handle not found errors (404)
- [x] Add loading states during API calls
- [x] Add confirmation dialog before delete using existing Modal component

## Implementation Order
1. ✅ Create basic MessageOptions component structure
2. ✅ Add delete functionality
3. ✅ Style components to match theme
4. ✅ Add error handling
5. ✅ Add loading states
6. ✅ Add confirmation dialog
7. ✅ Add animations and polish

## Future Enhancements (Not Part of This Task)
- Edit message option
- Reaction option
- Reply option
- Message threading
- Message forwarding