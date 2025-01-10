import React, { useEffect, useRef, useState } from 'react';
import styled from 'styled-components';
import { useDispatch, useSelector } from 'react-redux';
import ChatMessage from '../../common/ChatMessage';
import { getChannelMessages } from '../../../services/api/chat';
import { setMessages } from '../../../store/messages/messagesSlice';
import { Message as ApiMessage, StoreMessage, RootState, User } from '../../../types';
import wsService from '../../../services/websocket';

const MessageListContainer = styled.div`
  flex: 1;
  overflow-y: auto;
  display: flex;
  flex-direction: column;
  padding: 16px;
  gap: 2px;
  background: ${props => props.theme.colors.background};
  border: 2px solid ${props => props.theme.colors.border};
  font-family: 'Courier New', monospace;
`;

const MessagesWrapper = styled.div`
  display: flex;
  flex-direction: column;
  margin-top: auto;
  min-height: min-content;
`;

const LoadingMessage = styled.div`
  text-align: center;
  padding: 8px;
  color: ${props => props.theme.colors.textSecondary};
  font-family: 'Courier New', monospace;
  font-style: italic;
`;

const ErrorMessage = styled.div`
  text-align: center;
  padding: 8px;
  color: ${props => props.theme.colors.error};
  font-family: 'Courier New', monospace;
  border: 1px solid ${props => props.theme.colors.error};
  margin: 8px;
`;

const NoMessagesMessage = styled.div`
  text-align: center;
  padding: 20px;
  color: ${props => props.theme.colors.secondary};
  font-family: 'Courier New', monospace;
  border: 1px dashed ${props => props.theme.colors.border};
  margin: 16px;
`;

interface MessageListProps {
  channelId: string | null;
}

const MESSAGES_PER_PAGE = 30;

// Transform API message to store message format
const transformMessage = (msg: ApiMessage): StoreMessage => {
  console.log('Transforming message:', msg);
  if (!msg || !msg.id || !msg.content || !msg.channel_id || !msg.sender_id) {
    console.error('Invalid message format:', msg);
    throw new Error('Invalid message format');
  }

  const transformed: StoreMessage = {
    id: String(msg.id),
    content: msg.content,
    channelId: String(msg.channel_id),
    userId: String(msg.sender_id),
    reactions: [],
    attachments: [],
    createdAt: msg.created_at,
    updatedAt: msg.created_at
  };

  console.log('Transformed message:', transformed);
  return transformed;
};

const MessageList: React.FC<MessageListProps> = ({ channelId }) => {
  const dispatch = useDispatch();
  const containerRef = useRef<HTMLDivElement>(null);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [hasMoreMessages, setHasMoreMessages] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [shouldScrollToBottom, setShouldScrollToBottom] = useState(true);
  const [isConnecting, setIsConnecting] = useState(false);

  // Connect to WebSocket when channel changes
  useEffect(() => {
    let isMounted = true;
    let errorHandler: ((error: { code: string; message: string }) => void) | null = null;

    const connectToChannel = async () => {
      if (!channelId) return;

      setIsConnecting(true);
      setError(null);

      try {
        await wsService.connect(channelId);
        if (isMounted) {
          setError(null);
        }
      } catch (error) {
        console.error('Failed to connect to channel:', error);
        if (isMounted) {
          if (error instanceof Error) {
            setError(error.message);
          } else {
            setError('Failed to connect to channel. Messages may not update in real-time.');
          }
        }
      } finally {
        if (isMounted) {
          setIsConnecting(false);
        }
      }
    };

    // Set up WebSocket error handler
    errorHandler = (error: { code: string; message: string }) => {
      if (!isMounted) return;
      
      console.error('WebSocket error:', error);
      if (error.code === 'MAX_RECONNECT_ATTEMPTS') {
        setError('Lost connection to chat. Please refresh the page.');
      } else if (error.code === 'AUTH_FAILED') {
        setError('Authentication failed. Please try logging in again.');
      } else if (error.code === 'CHANNEL_ACCESS_DENIED') {
        setError('You do not have access to this channel.');
      } else {
        setError(error.message || 'Connection error. Messages may not update in real-time.');
      }
    };

    wsService.onError(errorHandler);
    connectToChannel();

    // Cleanup
    return () => {
      isMounted = false;
      if (channelId) {
        wsService.leaveChannel(channelId);
      }
    };
  }, [channelId]);

  const messages = useSelector((state: RootState) => {
    if (!channelId || !state.messages?.messagesByChannel) {
      console.log('No messages to display - channelId or messagesByChannel is missing:', {
        channelId,
        hasMessagesByChannel: !!state.messages?.messagesByChannel
      });
      return [];
    }
    const channelMessages = state.messages.messagesByChannel[String(channelId)] || [];
    // Sort messages by timestamp, oldest first
    const sortedMessages = [...channelMessages].sort((a, b) => 
      new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
    );
    console.log('Selected messages for channel', channelId, ':', {
      channelId,
      messageCount: sortedMessages.length,
      messages: sortedMessages,
      messagesByChannel: state.messages.messagesByChannel,
      stateMessages: state.messages
    });
    return sortedMessages;
  });

  const users = useSelector((state: RootState) => {
    const allUsers = state.chat?.users || {} as { [key: number]: User };
    console.log('Selected users:', {
      userCount: Object.keys(allUsers).length,
      users: allUsers
    });
    return allUsers;
  });

  const isLoading = useSelector((state: RootState) => {
    const loading = state.messages?.loading || false;
    console.log('Loading state:', loading);
    return loading;
  });

  // Initial message load
  useEffect(() => {
    if (channelId) {
      console.log('Loading messages for channel:', channelId);
      setIsLoadingMore(true);
      setHasMoreMessages(true);
      setError(null);
      setShouldScrollToBottom(true);
      
      getChannelMessages(channelId, MESSAGES_PER_PAGE)
        .then(newMessages => {
          console.log('Received messages from API:', newMessages);
          if (newMessages.length < MESSAGES_PER_PAGE) {
            setHasMoreMessages(false);
          }
          const transformedMessages: StoreMessage[] = newMessages.map(transformMessage);
          console.log('Transformed messages:', transformedMessages);
          dispatch(setMessages({ 
            channelId: String(channelId), 
            messages: transformedMessages 
          }));
        })
        .catch(error => {
          console.error('Failed to fetch messages:', error);
          setError('Failed to load messages. Please try again.');
        })
        .finally(() => {
          setIsLoadingMore(false);
        });
    }
  }, [channelId, dispatch]);

  // Handle scroll to load more messages
  const handleScroll = async (e: React.UIEvent<HTMLDivElement>) => {
    const div = e.currentTarget;
    const isNearTop = div.scrollTop <= 100;
    const previousScrollHeight = div.scrollHeight;
    
    if (isNearTop && !isLoadingMore && hasMoreMessages && channelId) {
      setIsLoadingMore(true);
      setError(null);
      setShouldScrollToBottom(false);
      
      try {
        const olderMessages = await getChannelMessages(
          channelId, 
          MESSAGES_PER_PAGE,
          messages.length
        );
        
        if (olderMessages.length < MESSAGES_PER_PAGE) {
          setHasMoreMessages(false);
        }

        if (olderMessages.length > 0) {
          const transformedMessages: StoreMessage[] = olderMessages.map(transformMessage);
          const allMessages: StoreMessage[] = [...transformedMessages, ...messages];
          dispatch(setMessages({ 
            channelId: String(channelId), 
            messages: allMessages
          }));
          
          // Maintain scroll position after loading older messages
          requestAnimationFrame(() => {
            if (containerRef.current) {
              const newScrollHeight = containerRef.current.scrollHeight;
              containerRef.current.scrollTop = newScrollHeight - previousScrollHeight;
            }
          });
        }
      } catch (error) {
        console.error('Failed to fetch older messages:', error);
        setError('Failed to load more messages. Please try again.');
      } finally {
        setIsLoadingMore(false);
      }
    }
  };

  // Auto-scroll to bottom on new messages
  useEffect(() => {
    if (containerRef.current && messages.length > 0 && shouldScrollToBottom) {
      const container = containerRef.current;
      // Use requestAnimationFrame to ensure the scroll happens after the render
      requestAnimationFrame(() => {
        container.scrollTop = container.scrollHeight;
      });
    }
  }, [messages, shouldScrollToBottom]);

  // Reset scroll behavior when channel changes
  useEffect(() => {
    setShouldScrollToBottom(true);
  }, [channelId]);

  if (!channelId) {
    return (
      <MessageListContainer>
        <NoMessagesMessage>
          Select a channel to view messages
        </NoMessagesMessage>
      </MessageListContainer>
    );
  }

  return (
    <MessageListContainer
      ref={containerRef}
      onScroll={handleScroll}
    >
      <MessagesWrapper>
        {error && (
          <ErrorMessage>
            {error}
          </ErrorMessage>
        )}
        
        {isConnecting && (
          <LoadingMessage>
            Connecting to chat...
          </LoadingMessage>
        )}
        
        {!hasMoreMessages && messages.length > 0 && (
          <LoadingMessage>
            You've reached the beginning of this conversation
          </LoadingMessage>
        )}
        
        {isLoadingMore && (
          <LoadingMessage>Loading older messages...</LoadingMessage>
        )}

        {messages.length === 0 && !isLoading && !error && !isConnecting && (
          <NoMessagesMessage>
            No messages yet. Start the conversation!
          </NoMessagesMessage>
        )}

        {messages.map((msg: StoreMessage) => {
          const userId = Number(msg.userId);
          const user = users[userId];
          const sender = user?.username || `User ${msg.userId}`;
          return (
            <div key={msg.id} id={`message-${msg.id}`} style={{ margin: '4px 0' }}>
              <ChatMessage
                content={msg.content}
                sender={sender}
                timestamp={msg.createdAt}
                isSystem={false}
              />
            </div>
          );
        })}
      </MessagesWrapper>
    </MessageListContainer>
  );
};

export default MessageList; 