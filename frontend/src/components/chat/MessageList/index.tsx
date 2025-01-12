import React, { useEffect, useRef, forwardRef, useState, useCallback } from 'react';
import styled from 'styled-components';
import { useSelector, useDispatch } from 'react-redux';
import { RootState, StoreMessage, User } from '../../../types';
import Message, { ChatMessageProps } from '../Message';
import MessageReplies from '../MessageReplies';
import ReplyModal from '../ReplyModal';
import { getChannelMessages, createReply } from '../../../services/api/chat';
import { prependMessages, addMessage, toggleReplies } from '../../../store/messages/messagesSlice';
import { transformMessage } from '../../../utils/messageTransform';
import { addReaction, removeReaction } from '../../../services/api/reactions';
import { setError } from '../../../store/chat/chatSlice';

interface MessageListProps {
  messages: StoreMessage[];
  selectedMessageId?: string | null;
  initialScrollComplete?: boolean;
  channelId?: string | null;
}

const MessageListContainer = styled.div`
  flex: 1;
  overflow-y: auto;
  padding: 16px;
  display: flex;
  flex-direction: column;
  height: 100%;
`;

const MessagesWrapper = styled.div`
  display: flex;
  flex-direction: column;
  gap: 8px;
  margin-top: auto;
  min-height: min-content;
`;

const LoadingIndicator = styled.div`
  text-align: center;
  padding: 8px;
  color: ${props => props.theme.colors.textLight};
  font-family: 'Courier New', monospace;
`;

const MessageWrapper = styled.div<{ $isSelected?: boolean }>`
  transition: all 0.3s ease;
  padding: 4px;
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
  const { messages, selectedMessageId, initialScrollComplete: propInitialScrollComplete, channelId } = props;
  const containerRef = useRef<HTMLDivElement>(null);
  const highlightTimeoutRef = useRef<NodeJS.Timeout>();
  const scrollTimeoutRef = useRef<NodeJS.Timeout>();
  const prevSelectedMessageRef = useRef<string | null | undefined>(null);
  const lastMessageRef = useRef<string | null>(messages[messages.length - 1]?.id || null);
  const [shouldScrollToMessage, setShouldScrollToMessage] = useState(false);
  const [initialScrollComplete, setInitialScrollComplete] = useState(!!propInitialScrollComplete);
  const prevMessagesRef = useRef(messages);
  const isUserScrolling = useRef(false);
  const currentChannelRef = useRef<string | null>(messages[0]?.channelId || null);
  const isInitialRender = useRef(true);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [replyModalOpen, setReplyModalOpen] = useState(false);
  const [selectedMessage, setSelectedMessage] = useState<StoreMessage | null>(null);
  const dispatch = useDispatch();

  const { currentUser, users } = useSelector((state: RootState) => ({
    currentUser: state.auth.user,
    users: state.chat.users as { [key: string]: User }
  }));

  // Add logging to debug user state
  useEffect(() => {
    console.log('Current user state:', currentUser);
    console.log('Users state:', users);
  }, [currentUser, users]);

  // Cleanup effect
  useEffect(() => {
    return () => {
      if (highlightTimeoutRef.current) {
        clearTimeout(highlightTimeoutRef.current);
      }
      if (scrollTimeoutRef.current) {
        clearTimeout(scrollTimeoutRef.current);
      }
    };
  }, []);

  // Initial render and channel change handler
  useEffect(() => {
    if (!containerRef.current) return;

    const newChannelId = messages[0]?.channelId;
    const channelChanged = newChannelId !== currentChannelRef.current;
    
    if ((isInitialRender.current || channelChanged) && messages.length > 0) {
      // Reset all scroll-related state
      setInitialScrollComplete(false);
      prevSelectedMessageRef.current = null;
      lastMessageRef.current = messages[messages.length - 1]?.id;
      isUserScrolling.current = false;
      currentChannelRef.current = newChannelId;

      // Use RAF to ensure DOM is updated before scrolling
      requestAnimationFrame(() => {
        if (containerRef.current) {
          containerRef.current.scrollTop = containerRef.current.scrollHeight;
          // Double-check scroll position after a brief delay
          setTimeout(() => {
            if (containerRef.current) {
              containerRef.current.scrollTop = containerRef.current.scrollHeight;
            }
          }, 50);
        }
      });
      setInitialScrollComplete(true);
    }

    isInitialRender.current = false;
  }, [messages[0]?.channelId]);

  // Add function to load older messages
  const loadOlderMessages = useCallback(async () => {
    if (!channelId || channelId === null || isLoadingMore) return;

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

      if (olderMessages.length > 0) {
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
      }
    } catch (error) {
      console.error('Error loading older messages:', error);
    } finally {
      setIsLoadingMore(false);
    }
  }, [channelId, messages, dispatch, isLoadingMore]);

  // Handle scroll behavior
  useEffect(() => {
    if (!containerRef.current) return;

    const container = containerRef.current;
    let scrollTimeout: NodeJS.Timeout;

    const handleScroll = () => {
      isUserScrolling.current = true;
      clearTimeout(scrollTimeout);

      // Check if we're at the top
      if (container.scrollTop === 0 && !isLoadingMore) {
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
  }, [loadOlderMessages, isLoadingMore]);

  // Add effect to handle messages loading
  useEffect(() => {
    if (containerRef.current && messages.length > 0) {
      containerRef.current.scrollTop = containerRef.current.scrollHeight;
    }
  }, [messages.length]);

  // Handle user scrolling
  useEffect(() => {
    if (!containerRef.current) return;

    const container = containerRef.current;
    let scrollTimeout: NodeJS.Timeout;

    const handleScroll = () => {
      isUserScrolling.current = true;
      clearTimeout(scrollTimeout);
      scrollTimeout = setTimeout(() => {
        isUserScrolling.current = false;
      }, 150); // Reset after scrolling stops
    };

    container.addEventListener('scroll', handleScroll);
    return () => {
      container.removeEventListener('scroll', handleScroll);
      clearTimeout(scrollTimeout);
    };
  }, []);

  // Handle scroll behavior
  useEffect(() => {
    if (!containerRef.current || isInitialRender.current) return;

    const container = containerRef.current;
    const isAtBottom = container.scrollHeight - container.scrollTop <= container.clientHeight + 50;
    const hasNewMessages = messages[messages.length - 1]?.id !== lastMessageRef.current;
    const isNewMessage = hasNewMessages && messages.length > prevMessagesRef.current.length;
    const isOwnMessage = isNewMessage && messages[messages.length - 1]?.userId === currentUser?.id;

    // Always scroll to selected message when it changes
    if (selectedMessageId && selectedMessageId !== prevSelectedMessageRef.current) {
      const messageElement = container.querySelector(
        `[data-message-id="${selectedMessageId}"]`
      ) as HTMLElement;
      
      if (messageElement) {
        messageElement.scrollIntoView({
          behavior: 'smooth',
          block: 'center'
        });

        // Add highlight effect
        messageElement.classList.add('highlight');
        
        if (highlightTimeoutRef.current) {
          clearTimeout(highlightTimeoutRef.current);
        }
        
        highlightTimeoutRef.current = setTimeout(() => {
          messageElement.classList.remove('highlight');
        }, 1000);
      }
    } 
    // Immediately scroll to bottom for own messages or when already at bottom
    else if (isOwnMessage || (isNewMessage && isAtBottom)) {
      container.scrollTop = container.scrollHeight;
    }

    prevSelectedMessageRef.current = selectedMessageId;
    lastMessageRef.current = messages[messages.length - 1]?.id;
    prevMessagesRef.current = messages;
  }, [selectedMessageId, messages, currentUser?.id]);

  const handleDeleteMessage = (messageId: string) => {
    console.log('Delete message:', messageId);
  };

  const handleToggleReplies = (messageId: string) => {
    if (!channelId) return;
    
    console.log('Toggling replies for message:', messageId);
    console.log('Current message state:', messages.find(msg => msg.id === messageId));
    
    dispatch(toggleReplies({
      channelId,
      messageId
    }));

    // Log state after dispatch
    setTimeout(() => {
      console.log('Message state after toggle:', messages.find(msg => msg.id === messageId));
    }, 0);
  };

  const handleReply = (messageId: string) => {
    const message = messages.find(msg => msg.id === messageId);
    if (message) {
      setSelectedMessage(message);
      setReplyModalOpen(true);
    }
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
            parentId: selectedMessage.id,
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
    } catch (error) {
      console.error('Failed to add reaction:', error);
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

  const renderMessage = (message: StoreMessage) => {
    const isSelected = message.id === selectedMessageId;
    const sender = users[message.userId]?.username || 'Unknown';

    return (
      <MessageWrapper 
        key={message.id} 
        data-message-id={message.id}
        $isSelected={isSelected}
      >
        <Message
          id={message.id}
          content={message.content}
          sender={sender}
          timestamp={message.createdAt}
          userId={message.userId}
          currentUserId={currentUser?.id}
          onDelete={() => handleDeleteMessage(message.id)}
          replyCount={message.replyCount || 0}
          isExpanded={message.isExpanded || false}
          onToggleReplies={() => handleToggleReplies(message.id)}
          onReply={() => handleReply(message.id)}
          reactions={message.reactions || []}
          onReactionAdd={(emoji) => handleReactionAdd(message.id, emoji)}
          onReactionRemove={(emoji) => handleReactionRemove(message.id, emoji)}
          attachments={message.attachments || []}
          has_attachments={message.has_attachments || false}
        />
        {message.isExpanded && (
          <MessageReplies
            parentId={message.id}
            replies={message.replies}
            currentUserId={currentUser?.id}
            isExpanded={message.isExpanded}
            onToggleReplies={() => handleToggleReplies(message.id)}
            onDelete={handleDeleteMessage}
          />
        )}
      </MessageWrapper>
    );
  };

  return (
    <MessageListContainer ref={containerRef}>
      <MessagesWrapper>
        {isLoadingMore && (
          <LoadingIndicator>Loading older messages...</LoadingIndicator>
        )}
        {[...messages]
          .sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime())
          // Only render main messages (non-replies) in the main list
          .filter(message => !message.parentId)
          .map(renderMessage)}
      </MessagesWrapper>
      {selectedMessage && (
        <ReplyModal
          isOpen={replyModalOpen}
          onClose={() => setReplyModalOpen(false)}
          onSubmit={handleReplySubmit}
          parentMessage={selectedMessage}
        />
      )}
    </MessageListContainer>
  );
});

MessageList.displayName = 'MessageList';

export default MessageList; 