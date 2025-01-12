import React, { useEffect, useRef, forwardRef, useState, useCallback, useMemo } from 'react';
import styled from 'styled-components';
import { useSelector, useDispatch } from 'react-redux';
import { RootState, StoreMessage, User, Message as ApiMessage, WebSocketMessage } from '../../../types';
import { transformMessage } from '../../../utils/messageTransform';
import Message from '../Message';
import MessageReplies from '../MessageReplies';
import ReplyModal from '../ReplyModal';
import { deleteMessage, toggleExpanded, prependMessages, addMessage, setMessages, setReplies, updateMessage } from '../../../store/messages/messagesSlice';
import { deleteMessage as deleteMessageApi, getChannelMessages, createReply, getReplies } from '../../../services/api/chat';
import { setError } from '../../../store/chat/chatSlice';
import { toast } from 'react-toastify';
import wsService from '../../../services/websocket';

interface MessageListProps {
  messages: StoreMessage[];
  selectedMessageId?: string | null;
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
`;

const LoadingIndicator = styled.div`
  text-align: center;
  padding: 8px;
  color: ${props => props.theme.colors.textLight};
  font-family: 'Courier New', monospace;
`;

const MessageWrapper = styled.div<{ $isSelected?: boolean }>`
  transition: background-color 0.3s ease;
  padding: 4px;
  border-radius: 4px;
  background-color: ${props => props.$isSelected ? '#3a3a3a' : 'transparent'};
`;

const MessageList = forwardRef<HTMLDivElement, MessageListProps>((props, ref) => {
  const { messages, selectedMessageId } = props;
  const dispatch = useDispatch();
  const selectedMessageRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [page, setPage] = useState(0);
  const [replyToMessage, setReplyToMessage] = useState<StoreMessage | null>(null);
  const PAGE_SIZE = 50;
  const scrollLockRef = useRef<{ position: number; height: number } | null>(null);
  const loadedRepliesRef = useRef<Set<string>>(new Set());

  const { currentUser, users, activeChannelId } = useSelector((state: RootState) => ({
    currentUser: state.auth.user,
    users: state.chat.users as { [key: string]: User },
    activeChannelId: state.chat.activeChannelId
  }));

  // Sort messages by creation time to ensure newest is at the bottom
  const sortedMessages = useMemo(() => {
    // Filter out messages that are replies (have parentId)
    const mainMessages = messages.filter(msg => !msg.parentId);
    
    return [...mainMessages].sort((a, b) => {
      const timeA = new Date(a.createdAt).getTime();
      const timeB = new Date(b.createdAt).getTime();
      return timeA - timeB;
    });
  }, [messages]);

  // Reset pagination when channel changes
  useEffect(() => {
    setPage(0);
    setHasMore(true);
    scrollLockRef.current = null;
  }, [activeChannelId]);

  // Load replies for messages with replyCount > 0 when channel changes
  useEffect(() => {
    const loadRepliesForMessages = async () => {
      if (!activeChannelId) return;
      
      // Get all messages that have replies but haven't loaded them yet
      const messagesToLoadReplies = messages.filter(msg => 
        msg.replyCount > 0 && 
        !msg.repliesLoaded && 
        !msg.parentId && 
        !loadedRepliesRef.current.has(msg.id)
      );

      if (messagesToLoadReplies.length === 0) return;

      for (const message of messagesToLoadReplies) {
        try {
          loadedRepliesRef.current.add(message.id);
          const replies = await getReplies(message.id);
          const transformedReplies = replies.map(transformMessage);
          
          dispatch(setMessages({
            channelId: activeChannelId,
            messages: messages.map(msg => 
              msg.id === message.id 
                ? { 
                    ...msg, 
                    repliesLoaded: true,
                    replies: transformedReplies,
                    isExpanded: msg.isExpanded || false
                  } 
                : msg
            )
          }));
        } catch (error) {
          console.error(`Error loading replies for message ${message.id}:`, error);
          loadedRepliesRef.current.delete(message.id); // Remove from loaded set if failed
        }
      }
    };

    // Clear the loaded replies set when channel changes
    if (activeChannelId) {
      loadedRepliesRef.current.clear();
    }

    loadRepliesForMessages();
  }, [activeChannelId, messages, dispatch]);

  // Helper function to organize messages and their replies
  const organizeMessagesAndReplies = (messages: StoreMessage[]) => {
    const mainMessages: StoreMessage[] = [];
    const repliesByParentId: { [key: string]: StoreMessage[] } = {};

    // Separate messages into main messages and replies
    messages.forEach(msg => {
      if (msg.parentId) {
        // This is a reply
        if (!repliesByParentId[msg.parentId]) {
          repliesByParentId[msg.parentId] = [];
        }
        repliesByParentId[msg.parentId].push(msg);
      } else {
        // This is a main message
        mainMessages.push(msg);
      }
    });

    // Attach replies to their parent messages
    mainMessages.forEach(msg => {
      if (repliesByParentId[msg.id]) {
        msg.replies = repliesByParentId[msg.id];
        msg.replyCount = repliesByParentId[msg.id].length;
        msg.repliesLoaded = true;
      }
    });

    return mainMessages;
  };

  const loadMoreMessages = useCallback(async () => {
    if (!activeChannelId || isLoadingMore || !hasMore) return;

    try {
      setIsLoadingMore(true);
      console.log('[DEBUG] Loading more messages, page:', page + 1);

      // Store the current scroll height and position
      const container = containerRef.current;
      if (container) {
        scrollLockRef.current = {
          position: container.scrollTop,
          height: container.scrollHeight
        };
      }

      // Load more messages
      const olderMessages = await getChannelMessages(activeChannelId, PAGE_SIZE, (page + 1) * PAGE_SIZE);
      
      if (olderMessages.length < PAGE_SIZE) {
        setHasMore(false);
      }

      if (olderMessages.length > 0) {
        // Transform messages and organize them
        const transformedMessages = olderMessages.map(transformMessage);
        const organizedMessages = organizeMessagesAndReplies(transformedMessages);

        // Prepend the organized messages
        dispatch(prependMessages({ 
          channelId: activeChannelId, 
          messages: organizedMessages
        }));
        setPage(p => p + 1);
      }
    } catch (error) {
      console.error('Error loading more messages:', error);
    } finally {
      setIsLoadingMore(false);
    }
  }, [activeChannelId, isLoadingMore, hasMore, page, dispatch]);

  // Maintain scroll position after messages are loaded
  useEffect(() => {
    if (scrollLockRef.current && containerRef.current) {
      const container = containerRef.current;
      const { position, height } = scrollLockRef.current;
      const newPosition = position + (container.scrollHeight - height);
      
      // Immediately set the scroll position
      container.scrollTop = newPosition;
      
      // Clear the scroll lock
      scrollLockRef.current = null;
    } else if (page === 0 && containerRef.current) {
      // Only auto-scroll to bottom on initial load or new messages when we're at page 0
      containerRef.current.scrollTop = containerRef.current.scrollHeight;
    }
  }, [messages, page]);

  // Handle scroll for infinite loading with debounce
  const handleScroll = useCallback((event: React.UIEvent<HTMLDivElement>) => {
    const container = event.currentTarget;
    if (container.scrollTop <= 100 && !isLoadingMore) {
      loadMoreMessages();
    }
  }, [loadMoreMessages, isLoadingMore]);

  useEffect(() => {
    // Scroll to selected message
    if (selectedMessageId && selectedMessageRef.current) {
      selectedMessageRef.current.scrollIntoView({
        behavior: 'smooth',
        block: 'center'
      });
    }
  }, [selectedMessageId]);

  const handleDeleteMessage = async (messageId: string) => {
    try {
      await deleteMessageApi(messageId);
      if (activeChannelId) {
        dispatch(deleteMessage({ channelId: activeChannelId, messageId }));
      }
    } catch (error) {
      console.error('Error deleting message:', error);
    }
  };

  const handleToggleReplies = async (messageId: string) => {
    if (!activeChannelId) return;

    const message = messages.find(m => m.id === messageId);
    if (!message) return;

    // If we're expanding and replies aren't loaded yet, load them first
    if (!message.isExpanded && message.replyCount > 0 && !message.repliesLoaded) {
      try {
        const replies = await getReplies(messageId);
        const transformedReplies = replies.map(transformMessage);
        
        dispatch(setMessages({
          channelId: activeChannelId,
          messages: messages.map(msg => 
            msg.id === messageId 
              ? {
                  ...msg,
                  repliesLoaded: true,
                  replies: transformedReplies,
                  isExpanded: true // Auto-expand after loading replies
                }
              : msg
          )
        }));
        return; // Return early since we've already expanded
      } catch (error) {
        console.error('Error loading replies:', error);
        return;
      }
    }

    // Toggle expanded state
    dispatch(toggleExpanded({ channelId: activeChannelId, messageId }));
  };

  const handleReply = (messageId: string) => {
    const message = messages.find(m => m.id === messageId);
    if (message) {
      setReplyToMessage(message);
    }
  };

  const handleSendReply = async (content: string) => {
    if (!replyToMessage || !activeChannelId) return;
    
    try {
      const reply = await createReply(replyToMessage.id, content);
      const transformedReply = transformMessage(reply);
      
      // Update the parent message and its replies in a single dispatch
      dispatch(setMessages({
        channelId: activeChannelId,
        messages: messages.map(msg => 
          msg.id === replyToMessage.id 
            ? {
                ...msg,
                replyCount: (msg.replyCount || 0) + 1,
                isExpanded: true,
                repliesLoaded: true,
                replies: [...(msg.replies || []), transformedReply]
              }
            : msg
        )
      }));
      
      // Auto-scroll to bottom
      if (containerRef.current) {
        containerRef.current.scrollTop = containerRef.current.scrollHeight;
      }

      setReplyToMessage(null);
      toast.success('Reply sent successfully');
    } catch (error) {
      console.error('Error sending reply:', error);
      toast.error('Failed to send reply. Please try again.');
    }
  };

  // Add WebSocket message handler
  useEffect(() => {
    if (!activeChannelId) return;

    const handleWebSocketMessage = (message: WebSocketMessage) => {
      console.log('[DEBUG] MessageList received WebSocket message:', message);
      console.log('[DEBUG] Active channel ID:', activeChannelId);
      
      // Check if message is from another channel
      if (message.data?.channel_id) {
        const messageChannelId = message.data.channel_id.toString();
        console.log('[DEBUG] Message channel ID:', messageChannelId);
        
        if (messageChannelId && (message.type === 'message' || message.type === 'message_sent' || 
             message.type === 'new_message' || message.type === 'message_updated') && 
            messageChannelId !== activeChannelId) {
          console.log('[DEBUG] Ignoring message from different channel');
          return; // Ignore messages from other channels
        }
      }

      console.log('[DEBUG] Processing message for current channel:', message.type);

      switch (message.type) {
        case 'message':
        case 'message_sent':
        case 'message_updated':
          if (message.data?.message) {
            console.log('Processing message:', message);
            const transformedMessage = transformMessage(message.data.message);
            console.log('Transformed message:', transformedMessage);
            
            if (message.type === 'message_updated') {
              dispatch(updateMessage({
                channelId: transformedMessage.channelId,
                id: transformedMessage.id,
                message: transformedMessage
              }));
            } else {
              dispatch(addMessage({
                channelId: transformedMessage.channelId,
                message: transformedMessage
              }));

              // Auto-scroll to bottom for new messages
              requestAnimationFrame(() => {
                if (containerRef.current) {
                  containerRef.current.scrollTop = containerRef.current.scrollHeight;
                }
              });
            }
          }
          break;

        case 'new_reply':
          if (message.data?.message && message.data.message.parent_id) {
            console.log('Processing reply:', message);
            const transformedReply = transformMessage(message.data.message);
            console.log('Transformed reply:', transformedReply);
            
            dispatch(setReplies({
              channelId: activeChannelId,
              messageId: message.data.message.parent_id.toString(),
              replies: [transformedReply]
            }));

            // Expand the parent message if it exists
            const parentId = message.data.message.parent_id.toString();
            const parentMessage = messages.find(m => m.id === parentId);
            if (parentMessage && !parentMessage.isExpanded) {
              dispatch(toggleExpanded({
                channelId: activeChannelId,
                messageId: parentId
              }));
            }
          }
          break;

        case 'message_deleted':
          if (message.data?.channel_id && message.data.message_id) {
            console.log('Deleting message:', message.data.channel_id, message.data.message_id);
            dispatch(deleteMessage({
              channelId: message.data.channel_id.toString(),
              messageId: message.data.message_id.toString()
            }));
          }
          break;

        case 'error':
          if (message.message) {
            console.error('WebSocket error:', message.message);
            dispatch(setError('Error processing message from server'));
          }
          break;
      }
    };

    const unsubscribe = wsService.onMessage(handleWebSocketMessage);
    return () => unsubscribe();
  }, [activeChannelId, messages, dispatch]);

  return (
    <>
      <MessageListContainer ref={containerRef} onScroll={handleScroll}>
        {isLoadingMore && (
          <LoadingIndicator>Loading older messages...</LoadingIndicator>
        )}
        <MessagesWrapper>
          {sortedMessages.map(message => (
            <React.Fragment key={message.id}>
              <MessageWrapper
                $isSelected={message.id === selectedMessageId}
                ref={message.id === selectedMessageId ? selectedMessageRef : undefined}
              >
                <Message
                  content={message.content}
                  sender={users[message.userId]?.username || message.userId}
                  timestamp={message.createdAt}
                  userId={message.userId}
                  currentUserId={currentUser?.id}
                  onDelete={() => handleDeleteMessage(message.id)}
                  replyCount={message.replyCount}
                  isExpanded={message.isExpanded || false}
                  onToggleReplies={() => handleToggleReplies(message.id)}
                  onReply={() => handleReply(message.id)}
                />
              </MessageWrapper>
              {message.isExpanded && message.replyCount > 0 && (
                <MessageReplies 
                  parentId={message.id}
                  replies={message.replies || []}
                  isExpanded={message.isExpanded}
                  onToggleReplies={handleToggleReplies}
                  onDelete={handleDeleteMessage}
                  currentUserId={currentUser?.id}
                />
              )}
            </React.Fragment>
          ))}
        </MessagesWrapper>
      </MessageListContainer>
      
      {replyToMessage && (
        <ReplyModal
          isOpen={true}
          onClose={() => setReplyToMessage(null)}
          onSubmit={handleSendReply}
          parentMessage={replyToMessage}
        />
      )}
    </>
  );
});

MessageList.displayName = 'MessageList';

export default MessageList; 