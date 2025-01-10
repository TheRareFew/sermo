import React, { useEffect, useRef, useState } from 'react';
import styled from 'styled-components';
import { useDispatch, useSelector } from 'react-redux';
import ChatMessage from '../../common/ChatMessage';
import DeleteMessageModal from '../DeleteMessageModal';
import ReplyModal from '../ReplyModal';
import MessageReplies from '../MessageReplies';
import { getChannelMessages, deleteMessage as deleteMessageApi, getReplies, createReply } from '../../../services/api/chat';
import { setMessages, deleteMessage, setReplies, toggleExpanded, addMessage } from '../../../store/messages/messagesSlice';
import { Message as ApiMessage, StoreMessage, RootState, User } from '../../../types';
import wsService from '../../../services/websocket';
import { toast } from 'react-toastify';

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

  // Ensure all IDs are strings
  const senderId = String(msg.sender_id);
  const channelId = String(msg.channel_id);
  const messageId = String(msg.id);
  const parentId = msg.parent_id ? String(msg.parent_id) : undefined;

  console.log('Transformed IDs:', { senderId, channelId, messageId, parentId });

  const transformed: StoreMessage = {
    id: messageId,
    content: msg.content,
    channelId: channelId,
    userId: senderId,
    parentId: parentId,
    reactions: [],
    attachments: [],
    createdAt: msg.created_at,
    updatedAt: msg.created_at,
    replyCount: msg.reply_count || 0,
    isExpanded: false
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
  const [deletingMessageIds, setDeletingMessageIds] = useState<Set<string>>(new Set());
  const [messageToDelete, setMessageToDelete] = useState<string | null>(null);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [replyToMessage, setReplyToMessage] = useState<StoreMessage | null>(null);
  const [isReplyModalOpen, setIsReplyModalOpen] = useState(false);

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
      return [];
    }
    const channelMessages = state.messages.messagesByChannel[String(channelId)] || [];
    // Sort messages by timestamp, oldest first
    const sortedMessages = [...channelMessages].sort((a, b) => 
      new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
    );
    return sortedMessages;
  });

  // Organize messages into threads
  const messageThreads = messages.reduce<{ message: StoreMessage; replies: StoreMessage[] }[]>((acc, message) => {
    if (!message.parentId) {
      // This is a top-level message
      acc.push({
        message,
        replies: messages.filter(m => m.parentId === message.id)
      });
    }
    return acc;
  }, []);

  const users = useSelector((state: RootState) => state.chat?.users || {});
  const currentUser = useSelector((state: RootState) => state.auth?.user);
  const isLoading = useSelector((state: RootState) => state.messages?.loading || false);

  // Ensure currentUserId is a string
  const currentUserId = currentUser?.id ? String(currentUser.id) : undefined;

  const handleDeleteMessage = async (messageId: string) => {
    setMessageToDelete(messageId);
    setIsDeleteModalOpen(true);
  };

  const handleReplyToMessage = (message: StoreMessage) => {
    setReplyToMessage(message);
    setIsReplyModalOpen(true);
  };

  const handleSubmitReply = async (content: string) => {
    if (!channelId || !replyToMessage) return;

    try {
      const reply = await createReply(replyToMessage.id, content);
      const transformedReply = transformMessage(reply);
      
      // Update the parent message's reply count and expand state
      const updatedParentMessage = {
        ...replyToMessage,
        replyCount: (replyToMessage.replyCount || 0) + 1,
        isExpanded: true // Ensure the thread is expanded
      };
      
      // Add the reply and update the parent message
      dispatch(addMessage(transformedReply));
      dispatch(setMessages({
        channelId,
        messages: messages.map(msg => 
          msg.id === replyToMessage.id ? updatedParentMessage : msg
        )
      }));

      // Fetch all replies to ensure we have the complete thread
      const replies = await getReplies(replyToMessage.id);
      const transformedReplies = replies.map(transformMessage);
      dispatch(setReplies({ channelId, messageId: replyToMessage.id, replies: transformedReplies }));
      
      // Auto-scroll to bottom
      requestAnimationFrame(() => {
        if (containerRef.current) {
          containerRef.current.scrollTop = containerRef.current.scrollHeight;
        }
      });
      
      toast.success('Reply sent successfully');
    } catch (error) {
      console.error('Failed to send reply:', error);
      toast.error('Failed to send reply. Please try again.');
    }
  };

  const handleToggleReplies = async (messageId: string) => {
    if (!channelId) return;

    const message = messages.find(msg => msg.id === messageId);
    if (!message) return;

    // Check if we're near the bottom before expanding/collapsing
    const container = containerRef.current;
    const isNearBottom = container && 
      (container.scrollHeight - container.scrollTop - container.clientHeight < 100);

    if (!message.isExpanded) {
      try {
        const replies = await getReplies(messageId);
        const transformedReplies = replies.map(transformMessage);
        dispatch(setReplies({ channelId, messageId, replies: transformedReplies }));
      } catch (error) {
        console.error('Failed to fetch replies:', error);
        toast.error('Failed to load replies. Please try again.');
        return;
      }
    }

    dispatch(toggleExpanded({ channelId, messageId }));

    // If we were near the bottom before, scroll to bottom after the change
    if (isNearBottom) {
      requestAnimationFrame(() => {
        if (container) {
          container.scrollTop = container.scrollHeight;
        }
      });
    }
  };

  const confirmDelete = async () => {
    if (!channelId || !messageToDelete) return;

    try {
      setDeletingMessageIds(prev => new Set(prev).add(messageToDelete));
      await deleteMessageApi(messageToDelete);
      dispatch(deleteMessage({ channelId, messageId: messageToDelete }));
      toast.success('Message deleted successfully');
    } catch (error) {
      console.error('Failed to delete message:', error);
      if (error instanceof Error) {
        if (error.message.includes('403')) {
          toast.error('You are not authorized to delete this message');
        } else if (error.message.includes('404')) {
          toast.error('Message not found');
          // Remove from local state anyway since it doesn't exist
          dispatch(deleteMessage({ channelId, messageId: messageToDelete }));
        } else {
          toast.error('Failed to delete message. Please try again.');
        }
      } else {
        toast.error('An unexpected error occurred');
      }
    } finally {
      setDeletingMessageIds(prev => {
        const next = new Set(prev);
        next.delete(messageToDelete);
        return next;
      });
      setMessageToDelete(null);
      setIsDeleteModalOpen(false);
    }
  };

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
    <>
      <MessageListContainer ref={containerRef} onScroll={handleScroll}>
        <MessagesWrapper>
          {error && <ErrorMessage>{error}</ErrorMessage>}
          {isConnecting && <LoadingMessage>Connecting to chat...</LoadingMessage>}
          {!hasMoreMessages && messages.length > 0 && (
            <LoadingMessage>You've reached the beginning of this conversation</LoadingMessage>
          )}
          {isLoadingMore && <LoadingMessage>Loading older messages...</LoadingMessage>}
          {messages.length === 0 && !isLoading && !error && !isConnecting && (
            <NoMessagesMessage>No messages yet. Start the conversation!</NoMessagesMessage>
          )}

          {messageThreads.map(({ message, replies }) => (
            <React.Fragment key={message.id}>
              <ChatMessage
                content={message.content}
                sender={users[message.userId]?.username || message.userId}
                timestamp={message.createdAt}
                userId={message.userId}
                currentUserId={currentUserId}
                onDelete={() => handleDeleteMessage(message.id)}
                replyCount={replies.length}
                isExpanded={message.isExpanded || false}
                onToggleReplies={() => handleToggleReplies(message.id)}
                onReply={() => handleReplyToMessage(message)}
              />
              {replies.length > 0 && (
                <MessageReplies
                  parentId={message.id}
                  replies={replies}
                  isExpanded={message.isExpanded || false}
                  onToggleReplies={handleToggleReplies}
                  onDelete={handleDeleteMessage}
                  currentUserId={currentUserId}
                />
              )}
            </React.Fragment>
          ))}
        </MessagesWrapper>
      </MessageListContainer>

      <DeleteMessageModal
        isOpen={isDeleteModalOpen}
        onClose={() => {
          setIsDeleteModalOpen(false);
          setMessageToDelete(null);
        }}
        onConfirm={confirmDelete}
        isDeleting={messageToDelete ? deletingMessageIds.has(messageToDelete) : false}
      />
      {replyToMessage && (
        <ReplyModal
          isOpen={isReplyModalOpen}
          onClose={() => {
            setIsReplyModalOpen(false);
            setReplyToMessage(null);
          }}
          onSubmit={handleSubmitReply}
          parentMessage={replyToMessage}
        />
      )}
    </>
  );
};

export default MessageList; 