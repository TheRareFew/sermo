# Message Search Scroll Behavior Fix Plan

## Issue
When switching channels after selecting a search result, the scroll position initially jumps to the selected message but then resets to the top of the message list when the channel changes.

## Root Cause
The issue stems from how messages are loaded and how the scroll position is managed in the MessageList component. The scroll reset occurs because:
1. Channel switch triggers message fetch
2. Messages are set in state
3. MessageList re-renders
4. Default scroll behavior takes over

## Implementation Plan

### 1. Update MessageList Component

#### Modify Container Ref Handling
- [x] Use both forwarded ref and internal ref
- [x] Implement proper ref merging
- [x] Add scroll position management

Reference:
frontend/src/components/chat/MessageList/index.tsx

#### Add Scroll Position Management
- [ ] Create new state for scroll management:
[CODE START]
const [shouldScrollToMessage, setShouldScrollToMessage] = useState(false);
const [initialScrollComplete, setInitialScrollComplete] = useState(false);
[CODE END]

#### Update Scroll Effect
- [ ] Modify the scroll effect to handle both cases:
[CODE START]
useEffect(() => {
  if (!containerRef.current) return;

  // Case 1: Scroll to selected message
  if (selectedMessageId && shouldScrollToMessage) {
    const messageElement = containerRef.current.querySelector(
      `[data-message-id="${selectedMessageId}"]`
    ) as HTMLElement;
    
    if (messageElement) {
      messageElement.scrollIntoView({
        behavior: 'smooth',
        block: 'center'
      });
      setShouldScrollToMessage(false);
      setInitialScrollComplete(true);
    }
  } 
  // Case 2: Scroll to bottom for new channel
  else if (!initialScrollComplete) {
    containerRef.current.scrollTop = containerRef.current.scrollHeight;
    setInitialScrollComplete(true);
  }
}, [selectedMessageId, shouldScrollToMessage, messages]);
[CODE END]

### 2. Update MainLayout Component

#### Modify Channel Switch Logic
- [ ] Update the channel selection handler to manage scroll behavior:

Reference:
frontend/src/components/layout/MainLayout/index.tsx

New implementation:
[CODE START]
const handleSelectMessage = async (channelId: string, messageId: string) => {
  try {
    // If switching channels
    if (channelId !== activeChannelId) {
      // Set flag to prevent immediate scroll to bottom
      dispatch(setScrollBehavior('awaiting-message'));
      
      // Switch channel and load messages
      await dispatch(setActiveChannel(channelId));
      const messages = await getChannelMessages(channelId, 50);
      
      if (messages.length > 0) {
        const transformedMessages = messages.map(transformMessage);
        dispatch(setMessages({
          channelId,
          messages: transformedMessages
        }));
      }
    }
    
    // Set selected message and trigger scroll
    setSelectedMessageId(messageId);
    setShouldScrollToMessage(true);
    setSearchResults(null);
    
  } catch (error) {
    console.error('Error selecting message:', error);
    dispatch(setError('Failed to navigate to message'));
  }
};
[CODE END]

### 3. Add Scroll Behavior to Redux Store

#### Create New Slice for UI State
- [ ] Add scroll behavior management to store:
[CODE START]
// store/ui/uiSlice.ts
interface UIState {
  scrollBehavior: 'bottom' | 'awaiting-message' | 'maintain';
}

const uiSlice = createSlice({
  name: 'ui',
  initialState: {
    scrollBehavior: 'bottom'
  } as UIState,
  reducers: {
    setScrollBehavior: (state, action: PayloadAction<UIState['scrollBehavior']>) => {
      state.scrollBehavior = action.payload;
    }
  }
});
[CODE END]

## Testing Plan

1. Test Scenarios
- [ ] Regular channel switch (should scroll to bottom)
- [ ] Search result navigation (should scroll to message)
- [ ] Multiple channel switches
- [ ] Back-to-back search result selections
- [ ] Edge cases with loading states

2. Performance Testing
- [ ] Measure scroll performance with large message lists
- [ ] Check for any layout shifts during navigation
- [ ] Verify smooth scrolling behavior

## Implementation Order

1. [ ] Add UI state management for scroll behavior
2. [ ] Update MessageList component with new scroll logic
3. [ ] Modify MainLayout to handle scroll behavior during navigation
4. [ ] Add proper cleanup and error handling
5. [ ] Test all scenarios
6. [ ] Add performance monitoring