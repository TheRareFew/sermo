import React, { useEffect, useRef, forwardRef, useState, useCallback } from 'react';
import styled from 'styled-components';
import { useSelector, useDispatch } from 'react-redux';
import { RootState, StoreMessage, User } from '../../../types';
import Message, { ChatMessageProps } from '../Message';
import MessageReplies from '../MessageReplies';
import ReplyModal from '../ReplyModal';
import { getChannelMessages, createReply, getMessagePosition } from '../../../services/api/chat';
import { prependMessages, addMessage, toggleReplies } from '../../../store/messages/messagesSlice';
import { transformMessage } from '../../../utils/messageTransform';
import { addReaction, removeReaction } from '../../../services/api/reactions';
import { setError } from '../../../store/chat/chatSlice';

interface MessageListProps {
  messages: StoreMessage[];
  selectedMessageId?: string | null;
  initialScrollComplete?: boolean;
  channelId: string | null;
  targetMessageId?: string | null;
}

interface MessageListContainerProps {
  $ready: boolean;
}

const MessageListContainer = styled.div<MessageListContainerProps>`
  flex: 1;
  overflow-y: auto;
  padding: 16px;
  display: flex;
  flex-direction: column;
  height: 100%;
  scroll-behavior: smooth;
  visibility: ${props => props.$ready ? 'visible' : 'hidden'};
`;

const MessagesWrapper = styled.div`
  display: flex;
  flex-direction: column;
  gap: 1px;
  min-height: min-content;
  margin-top: auto;
`;

const LoadingIndicator = styled.div`
  text-align: center;
  padding: 8px;
  color: ${props => props.theme.colors.textLight};
  font-family: 'Courier New', monospace;
`;

const MessageWrapper = styled.div<{ $isSelected?: boolean }>`
  transition: all 0.3s ease;
  padding: 4px 0;
  border-radius: 4px;
  background-color: ${props => props.$isSelected ? '#3a3a3a' : 'transparent'};
  border-left: ${props => props.$isSelected ? '2px solid #666' : '2px solid transparent'};
  
  &.highlight {
    animation: flash 1s;
  }

  @keyframes flash {
    0% { background-color: #4a4a4a; }
    100% { background-color: ${props => props.$isSelected ? '#3a3a3a' : 'transparent'}; }
  }
`;

const MessageList = forwardRef<HTMLDivElement, MessageListProps>((props, ref) => {
  const { messages, selectedMessageId, initialScrollComplete: propInitialScrollComplete, channelId, targetMessageId } = props;
  
  // State declarations
  const containerRef = useRef<HTMLDivElement>(null);
  const highlightTimeoutRef = useRef<NodeJS.Timeout>();
  const scrollTimeoutRef = useRef<NodeJS.Timeout>();
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [hasMoreMessages, setHasMoreMessages] = useState(true);
  const [replyModalOpen, setReplyModalOpen] = useState(false);
  const [selectedMessage, setSelectedMessage] = useState<StoreMessage | null>(null);
  const [isLoadingTarget, setIsLoadingTarget] = useState(false);
  const isUserScrolling = useRef(false);
  const currentChannelRef = useRef<string | null>(channelId);
  const dispatch = useDispatch();
  const [messagesReady, setMessagesReady] = useState(true);

  const { currentUser, users } = useSelector((state: RootState) => ({
    currentUser: state.auth.user,
    users: state.chat.users as { [key: string]: User }
  }));

  const handleDeleteMessage = useCallback(async (messageId: string) => {
    try {
      // TODO: Implement message deletion API call
      console.log('Delete message:', messageId);
    } catch (error) {
      console.error('Error deleting message:', error);
      dispatch(setError('Failed to delete message'));
    }
  }, [dispatch]);

  // Initialize currentChannelRef
  useEffect(() => {
    currentChannelRef.current = channelId || null;
  }, []);

  // Add channel change handler
  useEffect(() => {
    // If channel has changed
    if (channelId !== currentChannelRef.current) {
      console.log('[DEBUG] Channel changed, resetting state');
      
      // Hide messages immediately
      setMessagesReady(false);
      
      // Reset pagination state
      setHasMoreMessages(true);
      setIsLoadingMore(false);
      setIsLoadingTarget(false);
      isUserScrolling.current = false;

      // If we're not navigating to a specific message, load latest messages
      if (!targetMessageId) {
        const loadLatestMessages = async () => {
          if (!channelId) return;

          try {
            const latestMessages = await getChannelMessages(
              channelId,
              50, // limit
              0 // start from beginning
            );

            if (latestMessages.length > 0) {
              const transformedMessages = latestMessages.map(transformMessage);
              
              // Update messages while they're hidden
              dispatch(prependMessages({
                channelId,
                messages: transformedMessages,
                replace: true
              }));

              // Wait for next frame to ensure messages are rendered
              await new Promise(resolve => requestAnimationFrame(resolve));

              // Position scroll before showing messages
              if (containerRef.current) {
                containerRef.current.scrollTop = containerRef.current.scrollHeight;
                // Show messages after positioning
                requestAnimationFrame(() => {
                  setMessagesReady(true);
                });
              }
            } else {
              // If no messages, just show empty container
              setMessagesReady(true);
            }
          } catch (error) {
            console.error('[DEBUG] Error loading latest messages:', error);
            dispatch(setError('Failed to load latest messages'));
            setMessagesReady(true);
          }
        };

        loadLatestMessages();
      }

      // Update current channel reference
      currentChannelRef.current = channelId || null;
    }
  }, [channelId, dispatch, targetMessageId]);

  // Add loadOlderMessages before it's used
  const loadOlderMessages = useCallback(async () => {
    if (!channelId || isLoadingMore || !hasMoreMessages) return;

    try {
      setIsLoadingMore(true);
      const container = containerRef.current;
      if (!container) return;

      // Store the scroll height and a reference element before loading
      const oldScrollHeight = container.scrollHeight;
      const oldFirstMessage = container.querySelector('[data-message-id]');
      const oldFirstMessageTop = oldFirstMessage?.getBoundingClientRect().top;

      const olderMessages = await getChannelMessages(
        channelId,
        50, // limit
        messages.length // skip
      );

      if (olderMessages.length === 0) {
        setHasMoreMessages(false);
        return;
      }

      const transformedMessages = olderMessages.map(transformMessage);
      dispatch(prependMessages({
        channelId,
        messages: transformedMessages
      }));

      // After React has updated the DOM, adjust scroll position
      requestAnimationFrame(() => {
        if (!container) return;
        
        // Calculate new scroll position
        const newScrollHeight = container.scrollHeight;
        const heightDifference = newScrollHeight - oldScrollHeight;
        
        // Adjust scroll position to maintain the same relative position
        container.scrollTop = heightDifference;

        // Fine-tune adjustment if we have a reference element
        if (oldFirstMessage && oldFirstMessageTop) {
          const newFirstMessageTop = oldFirstMessage.getBoundingClientRect().top;
          const topDifference = newFirstMessageTop - oldFirstMessageTop;
          container.scrollTop += topDifference;
        }
      });
    } catch (error) {
      console.error('Error loading older messages:', error);
      setHasMoreMessages(false);
    } finally {
      setIsLoadingMore(false);
    }
  }, [channelId, messages.length, dispatch, isLoadingMore, hasMoreMessages]);

  // Simplified navigation function
  const navigateToMessage = useCallback(async (targetId: string) => {
    if (!channelId || !targetId || isLoadingTarget) return;

    console.log('[DEBUG] Navigating to message:', targetId);
    setIsLoadingTarget(true);

    try {
      // Get message position
      const position = await getMessagePosition(channelId, targetId);
      if (position === -1) {
        console.warn('[DEBUG] Message not found');
        dispatch(setError('Message not found'));
        return;
      }

      // Load messages around target
      const CONTEXT_SIZE = 50;
      const startPosition = Math.max(0, position - CONTEXT_SIZE);
      const messages = await getChannelMessages(
        channelId,
        CONTEXT_SIZE * 2,
        startPosition
      );

      if (messages.length > 0) {
        // Transform and update messages
        const transformedMessages = messages.map(transformMessage);
        dispatch(prependMessages({
          channelId,
          messages: transformedMessages,
          replace: true
        }));

        // Wait for state update
        await new Promise(resolve => setTimeout(resolve, 100));

        // Attempt to scroll to target
        const scrollToTarget = () => {
          const container = containerRef.current;
          const targetElement = container?.querySelector(`[data-message-id="${targetId}"]`);
          
          if (targetElement && container) {
            // Remove existing highlights
            container.querySelectorAll('.highlight').forEach(el => {
              el.classList.remove('highlight');
            });

            // Calculate scroll position
            const containerHeight = container.clientHeight;
            const elementTop = (targetElement as HTMLElement).offsetTop;
            const elementHeight = (targetElement as HTMLElement).offsetHeight;
            const centerPosition = elementTop - (containerHeight / 2) + (elementHeight / 2);

            // Scroll and highlight
            container.scrollTo({
              top: centerPosition,
              behavior: 'smooth'
            });
            targetElement.classList.add('highlight');

            // Remove highlight after delay
            setTimeout(() => {
              targetElement.classList.remove('highlight');
            }, 2000);

            return true;
          }
          return false;
        };

        // Try scrolling multiple times
        let attempts = 0;
        const maxAttempts = 5;
        const tryScroll = () => {
          if (attempts >= maxAttempts) return;
          if (!scrollToTarget()) {
            attempts++;
            setTimeout(tryScroll, 100);
          }
        };
        tryScroll();
      }
    } catch (error) {
      console.error('[DEBUG] Navigation error:', error);
      dispatch(setError('Failed to navigate to message'));
    } finally {
      setIsLoadingTarget(false);
    }
  }, [channelId, dispatch]);

  // Single effect to handle navigation
  useEffect(() => {
    if (targetMessageId) {
      console.log('[DEBUG] Target message changed:', targetMessageId);
      navigateToMessage(targetMessageId);
    }
  }, [targetMessageId, navigateToMessage]);

  // Scroll handler
  useEffect(() => {
    if (!containerRef.current) return;

    const container = containerRef.current;
    let scrollTimeout: NodeJS.Timeout;

    const handleScroll = () => {
      if (isLoadingTarget) return;

      isUserScrolling.current = true;
      clearTimeout(scrollTimeout);

      if (container.scrollTop === 0 && !isLoadingMore && hasMoreMessages) {
        loadOlderMessages();
      }

      scrollTimeout = setTimeout(() => {
        isUserScrolling.current = false;
      }, 150);
    };

    container.addEventListener('scroll', handleScroll);
    return () => {
      container.removeEventListener('scroll', handleScroll);
      clearTimeout(scrollTimeout);
    };
  }, [loadOlderMessages, isLoadingMore, hasMoreMessages, isLoadingTarget]);

  // Auto-scroll for new messages
  useEffect(() => {
    if (!containerRef.current || !messages.length || isLoadingTarget) return;
    
    const container = containerRef.current;
    const isNearBottom = container.scrollHeight - container.scrollTop - container.clientHeight < 100;
    
    if (isNearBottom && !isUserScrolling.current && !targetMessageId) {
      requestAnimationFrame(() => {
        if (container) {
          container.scrollTop = container.scrollHeight;
        }
      });
    }
  }, [messages, targetMessageId, isLoadingTarget]);

  const ensureElementInView = useCallback((element: HTMLElement) => {
    const container = containerRef.current;
    if (!container) return;

    const containerRect = container.getBoundingClientRect();
    const elementRect = element.getBoundingClientRect();
    
    // Check if element is below the visible area or if its bottom is not fully visible
    const isElementBelowView = elementRect.top > containerRect.bottom;
    const isElementBottomHidden = elementRect.bottom > containerRect.bottom;
    
    if (isElementBelowView || isElementBottomHidden) {
      // Scroll the element into view with some padding
      element.scrollIntoView({ behavior: 'smooth', block: 'end' });
      // Add extra padding at the bottom
      container.scrollTop += 20;
    }
  }, []);

  const handleToggleReplies = useCallback((messageId: string) => {
    if (!channelId) return;
    dispatch(toggleReplies({ channelId, messageId }));
    
    // After the state updates and DOM re-renders, ensure the replies are in view
    requestAnimationFrame(() => {
      const messageElement = containerRef.current?.querySelector(`[data-message-id="${messageId}"]`);
      if (messageElement instanceof HTMLElement) {
        // Wait a bit for any animations to start
        setTimeout(() => {
          ensureElementInView(messageElement);
        }, 100);
      }
    });
  }, [dispatch, ensureElementInView, channelId]);

  const handleReply = (message: StoreMessage) => {
    setSelectedMessage(message);
    setReplyModalOpen(true);
  };

  const handleReplySubmit = async (content: string) => {
    if (selectedMessage && channelId) {
      try {
        const reply = await createReply(selectedMessage.id, content);
        const transformedReply = transformMessage(reply);
        
        dispatch(addMessage({ 
          channelId, 
          message: {
            ...transformedReply,
            parent_id: selectedMessage.id,
            attachments: []
          }
        }));

        // Close the modal
        setReplyModalOpen(false);
        setSelectedMessage(null);
      } catch (error) {
        console.error('Error creating reply:', error);
      }
    }
  };

  const handleReactionAdd = async (messageId: string, emoji: string) => {
    try {
      console.log('Adding reaction to message:', messageId, emoji);
      await addReaction(messageId, emoji);
      console.log('Reaction added successfully, waiting for WebSocket event');
    } catch (error: any) {
      // Try to parse the error message
      try {
        const errorData = error?.message ? JSON.parse(error.message.replace('API error (400): ', '')) : null;
        if (errorData?.detail === "Already reacted with this emoji") {
          // If user already reacted, remove the reaction instead
          console.debug('User already reacted with this emoji, removing reaction instead');
          await handleReactionRemove(messageId, emoji);
          return;
        }
      } catch {
        // If we can't parse the error, it's an unexpected error format
        console.error('Failed to add reaction:', error);
      }
      
      // For other errors, show the generic error message
      dispatch(setError('Failed to add reaction'));
    }
  };

  const handleReactionRemove = async (messageId: string, emoji: string) => {
    try {
      console.log('Removing reaction from message:', messageId, emoji);
      await removeReaction(messageId, emoji);
      console.log('Reaction removed successfully, waiting for WebSocket event');
    } catch (error) {
      console.error('Failed to remove reaction:', error);
      dispatch(setError('Failed to remove reaction'));
    }
  };

  const handleContentLoad = useCallback((messageId: string) => {
    requestAnimationFrame(() => {
      const container = containerRef.current;
      if (!container) return;

      // Scroll all the way down when content is loaded
      container.scrollTo({
        top: container.scrollHeight,
        behavior: 'smooth'
      });
    });
  }, []);

  return (
    <MessageListContainer ref={containerRef} $ready={messagesReady}>
      {isLoadingMore && (
        <LoadingIndicator>Loading older messages...</LoadingIndicator>
      )}
      <MessagesWrapper>
        {messages.map((message) => (
          <MessageWrapper
            key={message.id}
            data-message-id={message.id}
            $isSelected={message.id === selectedMessageId}
          >
            <Message
              id={message.id}
              content={message.content}
              sender={users[message.sender_id]?.username || 'Unknown User'}
              timestamp={message.created_at}
              userId={message.sender_id}
              currentUserId={currentUser?.id}
              onDelete={() => handleDeleteMessage(message.id)}
              replyCount={message.reply_count}
              isExpanded={message.isExpanded || false}
              onToggleReplies={() => handleToggleReplies(message.id)}
              onReply={() => handleReply(message)}
              reactions={message.reactions}
              onReactionAdd={(emoji) => handleReactionAdd(message.id, emoji)}
              onReactionRemove={(emoji) => handleReactionRemove(message.id, emoji)}
              attachments={message.attachments}
              has_attachments={message.has_attachments}
              is_bot={message.is_bot}
              onContentLoad={() => handleContentLoad(message.id)}
            />
            {message.isExpanded && message.replies && (
              <MessageReplies
                replies={message.replies}
                currentUserId={currentUser?.id}
                users={users}
                onDelete={handleDeleteMessage}
                onReactionAdd={handleReactionAdd}
                onReactionRemove={handleReactionRemove}
                onContentLoad={() => handleContentLoad(message.id)}
              />
            )}
          </MessageWrapper>
        ))}
      </MessagesWrapper>
      {replyModalOpen && selectedMessage && (
        <ReplyModal
          message={selectedMessage}
          onClose={() => setReplyModalOpen(false)}
          onSubmit={handleReplySubmit}
        />
      )}
    </MessageListContainer>
  );
});

MessageList.displayName = 'MessageList';

export default MessageList; 