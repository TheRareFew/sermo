import React, { useEffect, useState } from 'react';
import styled from 'styled-components';
import { useDispatch, useSelector } from 'react-redux';
import { logout } from '../../../store/auth/authSlice';
import {
  setActiveChannel,
  setChannels,
  setUsers,
  updateUserStatus
} from '../../../store/chat/chatSlice';
import { addMessage } from '../../../store/messages/messagesSlice';
import Button from '../../common/Button';
import UserListItem from '../../common/UserListItem';
import ChannelListItem from '../../common/ChannelListItem';
import CreateChannelModal from '../../chat/CreateChannelModal';
import MessageInput from '../../chat/MessageInput';
import MessageList from '../../chat/MessageList';
import wsService from '../../../services/websocket';
import { getChannels, getChannelUsers } from '../../../services/api/chat';
import { RootState, WebSocketMessage, StoreMessage, Channel, User, WebSocketChannelMessage, WebSocketStatusMessage } from '../../../types';
import ChannelSettings from '../../chat/ChannelSettings';
import { AppDispatch } from '../../../store';

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

const MainLayout: React.FC = () => {
  const dispatch = useDispatch<AppDispatch>();
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  
  const { channels, activeChannelId, users } = useSelector((state: RootState) => ({
    channels: state.chat.channels,
    activeChannelId: state.chat.activeChannelId,
    users: state.chat.users as { [key: string]: User }
  }));
  const activeChannel = channels.find(channel => channel.id === activeChannelId);

  // Initial data fetch
  useEffect(() => {
    const fetchInitialData = async () => {
      try {
        const fetchedChannels = await getChannels();
        dispatch(setChannels(fetchedChannels));

        if (fetchedChannels.length > 0) {
          const channelUsers = await getChannelUsers(fetchedChannels[0].id);
          dispatch(setUsers(channelUsers));
          dispatch(setActiveChannel(fetchedChannels[0].id));
        }
      } catch (error) {
        console.error('Failed to fetch initial data:', error);
      }
    };

    fetchInitialData();
    
    return () => {
      wsService.disconnect();
    };
  }, [dispatch]);

  // Handle channel switching and WebSocket connection
  useEffect(() => {
    let isMounted = true;

    const connectToChannel = async () => {
      if (!activeChannelId || isConnecting) return;

      setIsConnecting(true);
      
      try {
        // First disconnect from any existing connection
        wsService.disconnect();
        
        // Wait a bit before reconnecting to avoid race conditions
        await new Promise(resolve => setTimeout(resolve, 500));
        
        // Connect to the new channel
        await wsService.connect(activeChannelId);
        
        if (!isMounted) return;
        
        // After successful connection, join the channel
        await wsService.joinChannel(activeChannelId);
        
        if (!isMounted) return;
        
        // After joining, fetch channel users
        const channelUsers = await getChannelUsers(activeChannelId);
        if (isMounted) {
          dispatch(setUsers(channelUsers));
        }
      } catch (error) {
        console.error('Error connecting to channel:', error);
      } finally {
        if (isMounted) {
          setIsConnecting(false);
        }
      }
    };

    if (activeChannelId) {
      connectToChannel();
    }

    return () => {
      isMounted = false;
    };
  }, [activeChannelId, dispatch, isConnecting]);

  // Handle WebSocket messages
  useEffect(() => {
    const handleWebSocketMessage = (message: WebSocketMessage) => {
      console.log('Received WebSocket message:', message);
      
      // Handle broadcast messages
      if (message.type === 'message' || message.type === 'new_reply') {
        // Type guard to ensure we have a channel message
        const isChannelMessage = (msg: WebSocketMessage): msg is WebSocketChannelMessage => {
          return (msg.type === 'message' || msg.type === 'new_reply') && 'message' in msg;
        };

        if (!isChannelMessage(message)) {
          console.error('Invalid message format:', message);
          return;
        }

        try {
          const { message: wsMessage } = message;
          const storeMessage: StoreMessage = {
            id: wsMessage.id.toString(),
            content: wsMessage.content,
            channelId: wsMessage.channel_id.toString(),
            userId: wsMessage.sender_id.toString(),
            reactions: [],
            attachments: [],
            createdAt: wsMessage.created_at,
            updatedAt: wsMessage.created_at,
            replyCount: 0,
            isExpanded: false,
            ...(message.type === 'new_reply' && message.parentId ? { parentId: message.parentId.toString() } : {})
          };

          dispatch(addMessage(storeMessage));
        } catch (error) {
          console.error('Error handling WebSocket message:', error);
        }
      }

      // Handle status messages
      if (message.type === 'user_status' || message.type === 'presence_update') {
        const isStatusMessage = (msg: WebSocketMessage): msg is WebSocketStatusMessage => {
          return (msg.type === 'user_status' || msg.type === 'presence_update') && 'user_id' in msg && 'status' in msg;
        };

        if (!isStatusMessage(message)) {
          console.error('Invalid status message format:', message);
          return;
        }

        dispatch(updateUserStatus({
          userId: message.user_id.toString(),
          status: message.status
        }));
      }
    };

    const unsubscribe = wsService.onMessage(handleWebSocketMessage);
    return () => unsubscribe();
  }, [dispatch]);

  const handleChannelClick = async (channelId: string) => {
    if (channelId !== activeChannelId) {
      dispatch(setActiveChannel(channelId));
    }
  };

  const handleLogout = () => {
    dispatch(logout());
  };

  // Sort and group channels
  const sortedChannels = [...channels].sort((a, b) => {
    // Sort by public/private first
    if (a.is_public !== b.is_public) {
      return a.is_public ? -1 : 1;
    }
    // Then sort by name
    return a.name.localeCompare(b.name);
  });

  const publicChannels = sortedChannels.filter(channel => channel.is_public && !channel.is_direct_message);
  const privateChannels = sortedChannels.filter(channel => !channel.is_public && !channel.is_direct_message);
  const directMessages = sortedChannels.filter(channel => channel.is_direct_message);

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
                  onClick={() => handleChannelClick(channel.id)}
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
                  onClick={() => handleChannelClick(channel.id)}
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
                  onClick={() => handleChannelClick(channel.id)}
                />
              ))}
            </ChannelGroup>
          )}
        </ChannelList>
        <UserList>
          <h2>Online Users</h2>
          {Object.values(users).map((user) => (
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
          <h1>{activeChannel ? `${activeChannel.is_direct_message ? '@' : '#'}${activeChannel.name}` : 'Select a channel'}</h1>
          <ChannelActions>
            {activeChannel && (
              <SettingsButton
                variant="secondary"
                size="small"
                onClick={() => setIsSettingsOpen(true)}
              >
                Settings
              </SettingsButton>
            )}
            <LogoutButton onClick={handleLogout}>Logout</LogoutButton>
          </ChannelActions>
        </ChatHeader>
        <MessageList channelId={activeChannelId} />
        <ChatInput>
          <MessageInput channelId={activeChannelId} />
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
          onClose={() => setIsSettingsOpen(false)}
          channel={activeChannel}
        />
      )}
    </MainContainer>
  );
};

export default MainLayout; 