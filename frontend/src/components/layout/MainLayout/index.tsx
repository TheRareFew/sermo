import React, { useEffect, useState, useRef, useCallback, useMemo } from 'react';
import styled from 'styled-components';
import { useDispatch, useSelector } from 'react-redux';
import { logout } from '../../../store/auth/authSlice';
import {
  setActiveChannel,
  setChannels,
  setUsers,
  updateUserStatus,
  addChannel,
  removeChannel,
  updateChannelUnreadCount,
  setError
} from '../../../store/chat/chatSlice';
import {
  addMessage,
  setMessages,
  setReplies,
  deleteMessage,
  updateMessage
} from '../../../store/messages/messagesSlice';
import { transformMessage } from '../../../utils/messageTransform';
import Button from '../../common/Button';
import UserListItem from '../../chat/UserListItem';
import ChannelListItem from '../../chat/ChannelListItem';
import CreateChannelModal from '../../chat/CreateChannelModal';
import MessageInput from '../../chat/MessageInput';
import MessageList from '../../chat/MessageList';
import SearchBar from '../../common/SearchBar';
import SearchResults from '../../common/SearchResults';
import wsService from '../../../services/websocket';
import { getChannels, getChannelUsers, getChannelMessages, joinChannel, getReplies } from '../../../services/api/chat';
import { searchAll } from '../../../services/api/search';
import { 
  RootState, 
  WebSocketMessage, 
  Channel, 
  User, 
  Message, 
  SearchResult,
  UserStatus,
  RawMessage,
  StoreMessage
} from '../../../types';
import ChannelSettings from '../../chat/ChannelSettings';
import { AppDispatch } from '../../../store';
import { store } from '../../../store';

const MainContainer = styled.div`
  display: flex;
  height: 100vh;
  background-color: ${props => props.theme.colors.background};
  color: ${props => props.theme.colors.text};
  font-family: 'VT323', monospace;
`;

const Sidebar = styled.div`
  width: 200px;
  border-right: 2px solid ${props => props.theme.colors.border};
  display: flex;
  flex-direction: column;
`;

const ChannelList = styled.div`
  flex: 1;
  padding: 16px;
  border-bottom: 2px solid ${props => props.theme.colors.border};
  overflow-y: auto;

  h2 {
    margin: 0 0 16px 0;
    text-transform: uppercase;
    color: ${props => props.theme.colors.primary};
  }
`;

const UserList = styled.div`
  height: 200px;
  padding: 16px;
  border-top: 2px solid ${props => props.theme.colors.border};
  overflow-y: auto;

  h2 {
    margin: 0 0 16px 0;
    text-transform: uppercase;
    color: ${props => props.theme.colors.primary};
  }
`;

const ChatArea = styled.div`
  flex: 1;
  display: flex;
  flex-direction: column;
  height: 100%;
  overflow: hidden;
`;

const ChatHeader = styled.div`
  padding: 16px;
  border-bottom: 2px solid ${props => props.theme.colors.border};
  display: flex;
  justify-content: space-between;
  align-items: center;

  h1 {
    margin: 0;
    text-transform: uppercase;
  }
`;

const ChatInput = styled.div`
  border-top: 2px solid ${props => props.theme.colors.border};
`;

const LogoutButton = styled.button`
  background: none;
  border: 2px solid ${props => props.theme.colors.error};
  color: ${props => props.theme.colors.error};
  padding: 4px 8px;
  font-family: 'VT323', monospace;
  cursor: pointer;
  text-transform: uppercase;

  &:hover {
    background: ${props => props.theme.colors.error};
    color: ${props => props.theme.colors.background};
  }
`;

const ChannelHeader = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 16px;

  h2 {
    margin: 0;
    text-transform: uppercase;
    color: ${props => props.theme.colors.primary};
  }
`;

const CreateChannelButton = styled(Button)`
  padding: 2px 8px;
  font-size: 0.875rem;
`;

const ChannelGroup = styled.div`
  margin-bottom: 16px;

  &:last-child {
    margin-bottom: 0;
  }
`;

const GroupTitle = styled.h3`
  margin: 0 0 8px 0;
  padding: 4px 8px;
  font-size: 0.875rem;
  text-transform: uppercase;
  color: ${props => props.theme.colors.textLight};
  border-bottom: 1px solid ${props => props.theme.colors.border};
  font-family: 'Courier New', monospace;
`;

const ChannelActions = styled.div`
  display: flex;
  gap: 8px;
`;

const SettingsButton = styled(Button)`
  padding: 2px 8px;
  font-size: 0.875rem;
`;

const SearchContainer = styled.div`
  position: relative;
  margin-right: 16px;
`;

const MainLayout: React.FC = () => {
  const dispatch = useDispatch<AppDispatch>();
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const [isSearching, setIsSearching] = useState(false);
  const [searchResults, setSearchResults] = useState<SearchResult | null>(null);
  const [searchError, setSearchError] = useState<string | undefined>();
  const messageListRef = useRef<HTMLDivElement>(null);
  const [selectedMessageId, setSelectedMessageId] = useState<string | null>(null);
  const isChannelSwitching = useRef<boolean>(false);
  
  // Memoize selectors
  const { channels, activeChannelId, users } = useSelector((state: RootState) => ({
    channels: state.chat.channels,
    activeChannelId: state.chat.activeChannelId,
    users: state.chat.users as { [key: string]: User }
  }), (prev, next) => {
    return prev.channels === next.channels &&
           prev.activeChannelId === next.activeChannelId &&
           prev.users === next.users;
  });

  const activeChannel = useMemo(() => 
    channels.find(channel => channel.id === activeChannelId),
    [channels, activeChannelId]
  );

  const channelMessages = useSelector((state: RootState) => {
    return state.messages.messagesByChannel[activeChannelId || ''] || [];
  }, (prev, next) => prev === next);

  // Helper function to transform messages in chunks
  const transformMessagesInChunks = useCallback((messages: Message[]): StoreMessage[] => {
    return messages.map(msg => transformMessage(msg));
  }, []);

  // Initial data fetch
  useEffect(() => {
    const fetchInitialData = async () => {
      try {
        console.log('Fetching initial data...');
        const fetchedChannels = await getChannels();
        dispatch(setChannels(fetchedChannels));

        if (fetchedChannels.length > 0) {
          const firstChannelId = fetchedChannels[0].id;
          const channelUsers = await getChannelUsers(firstChannelId);
          const usersObject = channelUsers.reduce<{ [key: string]: User }>((acc, user) => ({
            ...acc,
            [user.id]: user
          }), {});
          dispatch(setUsers(usersObject));
          dispatch(setActiveChannel(firstChannelId));
        }
      } catch (error) {
        console.error('Failed to fetch initial data:', error);
        dispatch(setError('Failed to fetch initial data'));
      }
    };

    fetchInitialData();
  }, [dispatch]); // Only run once on mount, but include dispatch in dependencies

  // Handle channel initialization and WebSocket connection
  useEffect(() => {
    if (!activeChannelId || isChannelSwitching.current) return;

    const initializeChannel = async () => {
      try {
        setIsConnecting(true);
        const messages = await getChannelMessages(activeChannelId);
        const transformedMessages = transformMessagesInChunks(messages);
        dispatch(setMessages({ channelId: activeChannelId, messages: transformedMessages }));
        await wsService.connect(activeChannelId);
      } catch (error) {
        console.error('Error initializing channel:', error);
        dispatch(setError('Error initializing channel'));
      } finally {
        setIsConnecting(false);
      }
    };

    initializeChannel();

    return () => {
      wsService.disconnect();
    };
  }, [activeChannelId, transformMessagesInChunks, dispatch]);

  // Handle channel selection
  const handleChannelSelect = useCallback(async (channelId: string) => {
    if (channelId === activeChannelId || isChannelSwitching.current) {
      return;
    }

    try {
      isChannelSwitching.current = true;
      setIsConnecting(true);

      console.log('[DEBUG] Switching to channel:', channelId);

      // First disconnect from current channel
      console.log('[DEBUG] Disconnecting from current WebSocket');
      wsService.disconnect();

      // Set the active channel and clear messages
      dispatch(setActiveChannel(channelId));
      dispatch(setMessages({ channelId, messages: [] }));

      // Fetch channel users and messages in parallel
      console.log('[DEBUG] Fetching channel data');
      const [channelUsers, messages] = await Promise.all([
        getChannelUsers(channelId),
        getChannelMessages(channelId)
      ]);

      // Update users in store
      const usersObject = channelUsers.reduce((acc, user) => ({
        ...acc,
        [user.id]: user
      }), {});
      dispatch(setUsers(usersObject));

      // Transform and update messages
      const transformedMessages = transformMessagesInChunks(messages);
      dispatch(setMessages({ channelId, messages: transformedMessages }));

      // Connect to WebSocket for the new channel with retries
      let retryCount = 0;
      const maxRetries = 3;
      
      while (retryCount < maxRetries) {
        try {
          console.log('[DEBUG] Attempting WebSocket connection, attempt:', retryCount + 1);
          await wsService.connect(channelId);
          console.log('[DEBUG] Successfully connected to WebSocket for channel:', channelId);
          break;
        } catch (wsError) {
          console.error(`[DEBUG] WebSocket connection attempt ${retryCount + 1} failed:`, wsError);
          retryCount++;
          
          if (retryCount === maxRetries) {
            console.error('[DEBUG] Max WebSocket connection retries reached');
            // Even if WebSocket fails, we can still show messages
            // We'll retry connection in the background
            setTimeout(() => wsService.connect(channelId), 2000);
          } else {
            // Wait before retrying
            await new Promise(resolve => setTimeout(resolve, 1000));
          }
        }
      }

    } catch (error) {
      console.error('[DEBUG] Error switching channels:', error);
      dispatch(setError('Failed to switch channels. Please try again.'));
    } finally {
      isChannelSwitching.current = false;
      setIsConnecting(false);
    }
  }, [activeChannelId, dispatch]);

  // Handle WebSocket messages
  useEffect(() => {
    if (!activeChannelId) return;

    const handleWebSocketMessage = (message: WebSocketMessage) => {
      console.log('MainLayout received WebSocket message:', message);

      // Helper function to check if message belongs to current channel
      const isMessageForCurrentChannel = (msg: WebSocketMessage): boolean => {
        if (msg.data?.channel_id) {
          const channelId = msg.data.channel_id.toString();
          console.log('Message channel ID:', channelId, 'Active channel ID:', activeChannelId);
          return channelId === activeChannelId;
        }
        return true; // For other message types like user_status
      };

      // Skip messages not meant for current channel
      if (!isMessageForCurrentChannel(message)) {
        console.log('Ignoring message from different channel');
        return;
      }

      // Log the message type and content for debugging
      console.log('Processing message type:', message.type);
      if (message.data) {
        console.log('Message data:', message.data);
      }

      try {
        switch (message.type) {
          case 'channel_created':
          case 'channel_updated':
            if (message.data?.message) {
              console.log('Adding/updating channel:', message.data.message);
              dispatch(addChannel(message.data.message as unknown as Channel));
            }
            break;

          case 'channel_deleted':
            if (message.data?.channel_id) {
              const channelId = message.data.channel_id.toString();
              console.log('Removing channel:', channelId);
              dispatch(removeChannel(channelId));
              if (channelId === activeChannelId && channels.length > 0) {
                const firstChannel = channels.find((ch: Channel) => ch.id !== channelId);
                if (firstChannel) {
                  handleChannelSelect(firstChannel.id);
                }
              }
            }
            break;

          case 'unread_count_updated':
            if (message.data?.channel_id && typeof message.data.count === 'number') {
              console.log('Updating unread count:', message.data.channel_id, message.data.count);
              dispatch(updateChannelUnreadCount({
                channelId: message.data.channel_id.toString(),
                count: message.data.count
              }));
            }
            break;

          case 'user_status':
            if (message.data?.user_id && message.data.status) {
              console.log('Updating user status:', message.data.user_id, message.data.status);
              dispatch(updateUserStatus({
                userId: message.data.user_id.toString(),
                status: message.data.status as UserStatus
              }));
            }
            break;

          case 'message':
          case 'message_sent':
          case 'message_updated':
            if (message.data?.message) {
              console.log('Processing message:', message);
              const transformedMessage = transformMessage(message.data.message as RawMessage);
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
                  if (messageListRef.current) {
                    messageListRef.current.scrollTop = messageListRef.current.scrollHeight;
                  }
                });
              }
            }
            break;

          case 'new_reply':
            if (message.data?.message && message.data.message.parent_id) {
              console.log('Processing reply:', message);
              const transformedReply = transformMessage(message.data.message as RawMessage);
              console.log('Transformed reply:', transformedReply);
              
              dispatch(setReplies({
                channelId: transformedReply.channelId,
                messageId: message.data.message.parent_id.toString(),
                replies: [transformedReply]
              }));
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
              dispatch(setError(`WebSocket error: ${message.message}`));
            }
            break;

          default:
            console.warn('Unknown message type:', message.type);
            break;
        }
      } catch (error) {
        console.error('Error processing WebSocket message:', error);
        dispatch(setError('Error processing message from server'));
      }
    };

    // Add connection status handling
    const handleConnectionError = (error: Error) => {
      console.error('WebSocket connection error:', error);
      dispatch(setError('Lost connection to chat server. Attempting to reconnect...'));
    };

    const handleConnectionStatus = () => {
      const status = wsService.getChatSocketState();
      if (status === WebSocket.OPEN) {
        dispatch(setError(null));
      }
    };

    console.log('Setting up WebSocket handlers for channel:', activeChannelId);
    const unsubscribeMessage = wsService.onMessage(handleWebSocketMessage);
    const unsubscribeError = wsService.onError(handleConnectionError);

    // Check connection status periodically
    const statusInterval = setInterval(handleConnectionStatus, 5000);

    return () => {
      console.log('Cleaning up WebSocket handlers for channel:', activeChannelId);
      clearInterval(statusInterval);
      unsubscribeMessage();
      unsubscribeError();
    };
  }, [activeChannelId, channels, dispatch, handleChannelSelect, messageListRef]);

  // Handle search
  const handleSearch = async (query: string) => {
    if (!query.trim()) {
      setSearchResults(null);
      return;
    }

    setIsSearching(true);
    setSearchError(undefined);

    try {
      const results = await searchAll(query);
      setSearchResults(results);
    } catch (error) {
      console.error('Search failed:', error);
      setSearchError('Failed to perform search');
    } finally {
      setIsSearching(false);
    }
  };

  // Handle message selection from search results
  const handleSelectMessage = async (channelId: string, messageId: string) => {
    try {
      if (channelId !== activeChannelId) {
        dispatch(setMessages({ channelId, messages: [] }));
        dispatch(setActiveChannel(channelId));
      }

      setSelectedMessageId(messageId);
      setSearchResults(null);

      const scrollToMessage = () => {
        const messageElement = document.getElementById(`message-${messageId}`);
        if (messageElement) {
          messageElement.scrollIntoView({ behavior: 'smooth', block: 'center' });
          messageElement.classList.add('highlight');
          setTimeout(() => messageElement.classList.remove('highlight'), 2000);
        } else {
          requestAnimationFrame(scrollToMessage);
        }
      };
      requestAnimationFrame(scrollToMessage);
    } catch (error) {
      console.error('Error navigating to message:', error);
    }
  };

  // Handle logout
  const handleLogout = () => {
    dispatch(logout());
  };

  // Sort and group channels
  const sortedChannels = [...channels].sort((a: Channel, b: Channel) => {
    // Sort by public/private first
    if (a.is_public !== b.is_public) {
      return a.is_public ? -1 : 1;
    }
    // Then sort by name
    return a.name.localeCompare(b.name);
  });

  const publicChannels = sortedChannels.filter((channel: Channel) => channel.is_public && !channel.is_direct_message);
  const privateChannels = sortedChannels.filter((channel: Channel) => !channel.is_public && !channel.is_direct_message);
  const directMessages = sortedChannels.filter((channel: Channel) => channel.is_direct_message);

  return (
    <MainContainer>
      <Sidebar>
        <ChannelList>
          <ChannelHeader>
            <h2>Channels</h2>
            <CreateChannelButton
              variant="secondary"
              size="small"
              onClick={() => setIsCreateModalOpen(true)}
            >
              +New
            </CreateChannelButton>
          </ChannelHeader>

          {publicChannels.length > 0 && (
            <ChannelGroup>
              <GroupTitle>Public Channels</GroupTitle>
              {publicChannels.map((channel: Channel) => (
                <ChannelListItem
                  key={channel.id}
                  name={channel.name}
                  isActive={channel.id === activeChannelId}
                  hasUnread={channel.unreadCount > 0}
                  isDirect={channel.is_direct_message}
                  isPublic={channel.is_public}
                  onClick={() => handleChannelSelect(channel.id)}
                />
              ))}
            </ChannelGroup>
          )}

          {privateChannels.length > 0 && (
            <ChannelGroup>
              <GroupTitle>Private Channels</GroupTitle>
              {privateChannels.map((channel: Channel) => (
                <ChannelListItem
                  key={channel.id}
                  name={channel.name}
                  isActive={channel.id === activeChannelId}
                  hasUnread={channel.unreadCount > 0}
                  isDirect={channel.is_direct_message}
                  isPublic={channel.is_public}
                  onClick={() => handleChannelSelect(channel.id)}
                />
              ))}
            </ChannelGroup>
          )}

          {directMessages.length > 0 && (
            <ChannelGroup>
              <GroupTitle>Direct Messages</GroupTitle>
              {directMessages.map((channel: Channel) => (
                <ChannelListItem
                  key={channel.id}
                  name={channel.name}
                  isActive={channel.id === activeChannelId}
                  hasUnread={channel.unreadCount > 0}
                  isDirect={channel.is_direct_message}
                  isPublic={channel.is_public}
                  onClick={() => handleChannelSelect(channel.id)}
                />
              ))}
            </ChannelGroup>
          )}
        </ChannelList>
        <UserList>
          <h2>Online Users</h2>
          {Object.values(users).map((user: User) => (
            <UserListItem
              key={user.id}
              username={user.username}
              status={user.status}
            />
          ))}
        </UserList>
      </Sidebar>
      <ChatArea>
        <ChatHeader>
          <h1>{activeChannel?.name || 'Select a Channel'}</h1>
          <ChannelActions>
            <SearchContainer>
              <SearchBar 
                onSearch={handleSearch}
                placeholder="Search messages, files, and channels..."
              />
              {searchResults && (
                <SearchResults
                  results={searchResults}
                  isLoading={isSearching}
                  onClose={() => setSearchResults(null)}
                  onSelectChannel={(channelId) => {
                    dispatch(setActiveChannel(channelId));
                    setSearchResults(null);
                  }}
                  onSelectMessage={handleSelectMessage}
                  onSelectFile={(fileId) => {
                    // TODO: Implement file selection
                    console.log('Selected file:', fileId);
                    setSearchResults(null);
                  }}
                />
              )}
            </SearchContainer>
            {activeChannel && !activeChannel.is_direct_message && (
              <SettingsButton onClick={() => setIsSettingsOpen(true)}>
                Settings
              </SettingsButton>
            )}
            <LogoutButton onClick={handleLogout}>Logout</LogoutButton>
          </ChannelActions>
        </ChatHeader>
        
        <MessageList
          ref={messageListRef}
          messages={channelMessages}
          selectedMessageId={selectedMessageId}
        />
        
        <ChatInput>
          <MessageInput
            channelId={activeChannelId}
          />
        </ChatInput>
      </ChatArea>

      {isCreateModalOpen && (
        <CreateChannelModal
          isOpen={isCreateModalOpen}
          onClose={() => setIsCreateModalOpen(false)}
        />
      )}

      {isSettingsOpen && activeChannel && (
        <ChannelSettings
          isOpen={isSettingsOpen}
          channel={activeChannel}
          onClose={() => setIsSettingsOpen(false)}
        />
      )}
    </MainContainer>
  );
};

export default MainLayout; 