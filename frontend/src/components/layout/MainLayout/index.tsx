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
  deleteMessage,
  updateMessage
} from '../../../store/messages/messagesSlice';
import { transformMessage } from '../../../utils/messageTransform';
import Button from '../../common/Button';
import UserListItem from '../../chat/UserListItem';
import ChannelListItem from '../../chat/ChannelListItem';
import CreateChannelModal from '../../chat/CreateChannelModal';
import { MessageInput } from '../../chat/MessageInput';
import MessageList from '../../chat/MessageList';
import SearchBar from '../../common/SearchBar';
import SearchResults from '../../common/SearchResults';
import { getChannels, getChannelUsers, getChannelMessages, joinChannel, getReplies, getMessagePosition } from '../../../services/api/chat';
import { searchAll } from '../../../services/api/search';
import WebSocketService from '../../../services/websocket';
import { 
  RootState, 
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

// Constants
const PAGE_SIZE = 50;

const MainLayout: React.FC = () => {
  const dispatch = useDispatch<AppDispatch>();
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isSearching, setIsSearching] = useState(false);
  const [searchResults, setSearchResults] = useState<SearchResult | null>(null);
  const [searchError, setSearchError] = useState<string | undefined>();
  const messageListRef = useRef<HTMLDivElement>(null);
  const [selectedMessageId, setSelectedMessageId] = useState<string | null>(null);
  const [initialScrollComplete, setInitialScrollComplete] = useState(false);
  const isChannelSwitching = useRef<boolean>(false);
  const lastMessageTimestamp = useRef<number | null>(null);
  const pollingInterval = useRef<NodeJS.Timeout | null>(null);
  const isSearchNavigation = useRef<boolean>(false);

  // Define loadInitialMessages at the very top
  const loadInitialMessages = useCallback(async (channelId: string) => {
    try {
      console.log('Loading initial messages for channel:', channelId);
      const messages = await getChannelMessages(channelId, 50, 0);
      if (messages.length > 0) {
        const transformedMessages = messages.map(transformMessage);
        dispatch(setMessages({
          channelId,
          messages: transformedMessages
        }));
      }
    } catch (error) {
      console.error('Error loading initial messages:', error);
      dispatch(setError('Failed to load messages'));
    }
  }, [dispatch]);

  // Memoize selectors
  const { channels, activeChannelId, users, currentUser } = useSelector((state: RootState) => ({
    channels: state.chat.channels,
    activeChannelId: state.chat.activeChannelId,
    users: state.chat.users as { [key: string]: User },
    currentUser: state.auth.user
  }), (prev, next) => {
    return prev.channels === next.channels &&
           prev.activeChannelId === next.activeChannelId &&
           prev.users === next.users &&
           prev.currentUser === next.currentUser;
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

  // Initialize WebSocket connection and handle channel subscriptions
  useEffect(() => {
    if (!activeChannelId) return;

    console.log('Setting up WebSocket for channel:', activeChannelId);
    
    // Ensure WebSocket is connected
    WebSocketService.connect();
    
    // Small delay to ensure WebSocket is connected before joining channel
    const joinTimeout = setTimeout(() => {
      console.log('Joining channel:', activeChannelId);
      WebSocketService.joinChannel(activeChannelId);
      
      // Load initial messages
      loadInitialMessages(activeChannelId);
    }, 500);
    
    // Cleanup function
    return () => {
      clearTimeout(joinTimeout);
      if (activeChannelId) {
        console.log('Leaving channel:', activeChannelId);
        WebSocketService.leaveChannel(activeChannelId);
      }
    };
  }, [activeChannelId, loadInitialMessages]);

  // Initial data fetch
  useEffect(() => {
    const fetchInitialData = async () => {
      try {
        console.log('Fetching initial data...');
        const fetchedChannels = await getChannels();
        dispatch(setChannels(fetchedChannels));

        if (fetchedChannels.length > 0) {
          // Find the first public channel or default to first channel
          const firstPublicChannel = fetchedChannels.find(ch => ch.is_public) || fetchedChannels[0];
          dispatch(setActiveChannel(firstPublicChannel.id));
        }
      } catch (error) {
        console.error('Failed to fetch initial data:', error);
        dispatch(setError('Failed to fetch initial data'));
      }
    };

    fetchInitialData();
  }, [dispatch]);

  // Handle channel initialization and WebSocket subscription
  useEffect(() => {
    if (!activeChannelId) return;

    const initializeChannel = async () => {
      try {
        // Find the channel to check if it's public
        const channel = channels.find(ch => ch.id === activeChannelId);
        if (!channel) {
          throw new Error('Channel not found');
        }

        let messages: Message[] = [];
        let channelUsers: User[] = [];

        // For private channels, ensure we're a member first
        if (!channel.is_public) {
          try {
            await joinChannel(activeChannelId);
            console.log('[DEBUG] Joined private channel:', activeChannelId);
          } catch (error) {
            console.error('[DEBUG] Error joining channel:', error);
            dispatch(setError('Failed to join channel'));
            return;
          }
        }

        try {
          // Get initial messages first since they don't require membership
          messages = await getChannelMessages(activeChannelId, PAGE_SIZE);
          
          // Then try to get users
          channelUsers = await getChannelUsers(activeChannelId);
          
          // Update store with users if we got them
          const usersObject = channelUsers.reduce<{ [key: string]: User }>((acc, user) => ({
            ...acc,
            [user.id]: user
          }), {});
          dispatch(setUsers(usersObject));
        } catch (error) {
          console.error('[DEBUG] Error fetching channel data:', error);
          // Don't throw here, we might still have messages to show
        }

        // Update messages if we got any
        if (messages.length > 0) {
          const transformedMessages = transformMessagesInChunks(messages);
          dispatch(setMessages({
            channelId: activeChannelId,
            messages: transformedMessages
          }));
        }

        // Join WebSocket channel
        WebSocketService.joinChannel(activeChannelId);
      } catch (error) {
        console.error('Failed to initialize channel:', error);
        dispatch(setError('Failed to initialize channel'));
      }
    };

    initializeChannel();

    // Cleanup: leave WebSocket channel when switching channels
    return () => {
      WebSocketService.leaveChannel(activeChannelId);
    };
  }, [activeChannelId, dispatch, transformMessagesInChunks, channels]);

  // Handle search
  const handleSearch = async (query: string) => {
    if (!query.trim()) {
      setSearchResults(null);
      return;
    }

    setIsSearching(true);
    try {
      const results = await searchAll(query);
      setSearchResults(results);
    } catch (error) {
      console.error('Search error:', error);
      setSearchError('Failed to search');
    } finally {
      setIsSearching(false);
    }
  };

  // Handle search result selection
  const handleSelectChannel = (channelId: string) => {
    dispatch(setActiveChannel(channelId));
    setSearchResults(null);
  };

  const handleSelectMessage = async (channelId: string, messageId: string) => {
    try {
      console.log('[DEBUG] handleSelectMessage called:', { channelId, messageId });
      isSearchNavigation.current = true;

      // If switching channels
      if (channelId !== activeChannelId) {
        console.log('[DEBUG] Switching channels for message navigation');
        await dispatch(setActiveChannel(channelId));
      }

      // Set the selected message ID after channel switch
      setSelectedMessageId(messageId);
      setInitialScrollComplete(false);
      setSearchResults(null);
      isSearchNavigation.current = false;
    } catch (error) {
      console.error('[DEBUG] Error selecting message:', error);
      dispatch(setError('Failed to navigate to message'));
      isSearchNavigation.current = false;
    }
  };

  const handleSelectFile = (fileId: string) => {
    // TODO: Implement file selection
    console.log('Selected file:', fileId);
    setSearchResults(null);
  };

  // Handle logout
  const handleLogout = () => {
    dispatch(logout());
  };

  // Sort channels by type
  const sortedChannels = useMemo(() => {
    return [...channels].sort((a, b) => a.name.localeCompare(b.name));
  }, [channels]);

  const publicChannels = useMemo(() => 
    sortedChannels.filter(channel => channel.is_public && !channel.is_direct_message),
    [sortedChannels]
  );

  const privateChannels = useMemo(() => 
    sortedChannels.filter(channel => !channel.is_public && !channel.is_direct_message),
    [sortedChannels]
  );

  const directMessages = useMemo(() => 
    sortedChannels.filter(channel => channel.is_direct_message),
    [sortedChannels]
  );

  // Update the channel selection handler
  const handleChannelSelect = useCallback(async (channelId: string) => {
    try {
      console.log('Selecting channel:', channelId);
      isChannelSwitching.current = true;
      setInitialScrollComplete(false);
      setSelectedMessageId(null);
      dispatch(setActiveChannel(channelId));

      // Fetch channel messages
      const messages = await getChannelMessages(channelId);
      console.log('Fetched messages:', messages);
      
      const transformedMessages = transformMessagesInChunks(messages);
      console.log('Transformed messages:', transformedMessages);
      
      dispatch(setMessages({
        channelId,
        messages: transformedMessages
      }));

      // Fetch channel users and transform to dictionary
      const channelUsers = await getChannelUsers(channelId);
      const usersDict = channelUsers.reduce<{ [key: string]: User }>((acc, user) => {
        acc[user.id] = user;
        return acc;
      }, {});
      
      console.log('Transformed users:', usersDict);
      dispatch(setUsers(usersDict));

      isChannelSwitching.current = false;
    } catch (error) {
      console.error('Error selecting channel:', error);
      dispatch(setError('Failed to load channel messages'));
      isChannelSwitching.current = false;
    }
  }, [dispatch, transformMessagesInChunks]);

  // Add effect to handle scroll reset on normal channel changes
  useEffect(() => {
    if (!isSearchNavigation.current && activeChannelId) {
      setInitialScrollComplete(false);
      setSelectedMessageId(null);
    }
  }, [activeChannelId]);

  return (
    <MainContainer>
      <Sidebar>
        <ChannelList>
          <ChannelHeader>
            <h2>Channels</h2>
            <CreateChannelButton onClick={() => setIsCreateModalOpen(true)}>
              +
            </CreateChannelButton>
          </ChannelHeader>

          {/* Public Channels */}
          <ChannelGroup>
            <GroupTitle>Public</GroupTitle>
            {publicChannels.map(channel => (
              <ChannelListItem
                key={channel.id}
                name={channel.name}
                isActive={channel.id === activeChannelId}
                hasUnread={channel.unreadCount > 0}
                isDirect={false}
                isPublic={true}
                onClick={() => handleChannelSelect(channel.id)}
              />
            ))}
          </ChannelGroup>

          {/* Private Channels */}
          <ChannelGroup>
            <GroupTitle>Private</GroupTitle>
            {privateChannels.map(channel => (
              <ChannelListItem
                key={channel.id}
                name={channel.name}
                isActive={channel.id === activeChannelId}
                hasUnread={channel.unreadCount > 0}
                isDirect={false}
                isPublic={false}
                onClick={() => handleChannelSelect(channel.id)}
              />
            ))}
          </ChannelGroup>

          {/* Direct Messages */}
          <ChannelGroup>
            <GroupTitle>Direct Messages</GroupTitle>
            {directMessages.map(channel => (
              <ChannelListItem
                key={channel.id}
                name={channel.name}
                isActive={channel.id === activeChannelId}
                hasUnread={channel.unreadCount > 0}
                isDirect={true}
                isPublic={false}
                onClick={() => handleChannelSelect(channel.id)}
              />
            ))}
          </ChannelGroup>
        </ChannelList>

        <UserList>
          <h2>Users</h2>
          {Object.values(users).map(user => (
            <UserListItem
              key={user.id}
              username={user.username}
              status={user.status}
            />
          ))}
        </UserList>
        <LogoutButton onClick={handleLogout}>
          Logout
        </LogoutButton>
      </Sidebar>

      <ChatArea>
        <ChatHeader>
          <h1>{activeChannel?.name || 'Select a Channel'}</h1>
          {activeChannel && (
            <ChannelActions>
              <SearchContainer>
                <SearchBar
                  onSearch={handleSearch}
                />
                {searchResults && (
                  <SearchResults
                    results={searchResults}
                    onSelectChannel={handleSelectChannel}
                    onSelectMessage={handleSelectMessage}
                    onSelectFile={handleSelectFile}
                    onClose={() => setSearchResults(null)}
                  />
                )}
              </SearchContainer>
              <SettingsButton onClick={() => setIsSettingsOpen(true)}>
                Settings
              </SettingsButton>
            </ChannelActions>
          )}
        </ChatHeader>
        <MessageList
          ref={messageListRef}
          messages={channelMessages}
          selectedMessageId={selectedMessageId}
          initialScrollComplete={initialScrollComplete}
          channelId={activeChannelId}
          targetMessageId={selectedMessageId}
        />
        <ChatInput>
          {activeChannelId && currentUser && (
            <MessageInput channelId={activeChannelId} currentUser={currentUser} />
          )}
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