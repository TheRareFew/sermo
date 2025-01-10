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
import { RootState, WebSocketMessage, StoreMessage, Channel, User } from '../../../types';

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

const MainLayout: React.FC = () => {
  const dispatch = useDispatch();
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  
  const { channels, activeChannelId, users } = useSelector((state: RootState) => ({
    channels: state.chat.channels,
    activeChannelId: state.chat.activeChannelId,
    users: state.chat.users as { [key: string]: User }
  }));
  const activeChannel = channels.find(channel => channel.id === activeChannelId);

  useEffect(() => {
    const fetchInitialData = async () => {
      try {
        // Fetch all channels - all channels are accessible by default
        const fetchedChannels = await getChannels();
        dispatch(setChannels(fetchedChannels));

        // Set the first channel as active if there are any channels
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
    
    // Connect to WebSocket
    console.log('Connecting to WebSocket...');
    wsService.connect();

    // Check WebSocket connection status
    const checkConnection = setInterval(() => {
      const wsState = wsService.getChatSocketState();
      console.log('WebSocket state:', wsState);
      if (wsState !== WebSocket.OPEN) {
        console.log('Reconnecting WebSocket...');
        wsService.connect();
      }
    }, 5000);

    return () => {
      clearInterval(checkConnection);
      wsService.disconnect();
    };
  }, [dispatch]);

  // Handle WebSocket messages in a separate useEffect
  useEffect(() => {
    const handleMessage = (message: WebSocketMessage) => {
      console.log('Received WebSocket message:', message);
      
      // Handle both new message and message_sent events
      if ((message.type === 'message' || message.type === 'message_sent') && message.message) {
        try {
          const { id, content, channel_id, sender_id, created_at } = message.message;
          console.log('Processing message:', { id, content, channel_id, sender_id, created_at });
          
          if (!id || !content || !channel_id || !sender_id) {
            console.error('Invalid message format:', message);
            return;
          }

          // Check if we have the sender's information
          if (!users[sender_id]) {
            console.log('Fetching information for new user:', sender_id);
            // Fetch updated user list for the channel
            getChannelUsers(String(channel_id))
              .then(channelUsers => {
                console.log('Updated user list:', channelUsers);
                dispatch(setUsers(channelUsers));
              })
              .catch(error => {
                console.error('Failed to fetch user information:', error);
              });
          }

          const transformedMessage: StoreMessage = {
            id: String(id),
            content: content,
            channelId: String(channel_id),
            userId: String(sender_id),
            reactions: [],
            attachments: [],
            createdAt: created_at || new Date().toISOString(),
            updatedAt: created_at || new Date().toISOString()
          };

          console.log('Dispatching transformed message:', transformedMessage);
          dispatch(addMessage(transformedMessage));
        } catch (error) {
          console.error('Error handling WebSocket message:', error);
        }
      } else if (message.type === 'presence_update' && message.user_id && message.status) {
        dispatch(updateUserStatus({
          userId: String(message.user_id),
          status: message.status
        }));
      }
    };

    // onMessage returns a cleanup function
    const cleanup = wsService.onMessage(handleMessage);
    return cleanup;
  }, [dispatch, users]);

  const handleChannelClick = async (channelId: string) => {
    if (channelId !== activeChannelId) {
      dispatch(setActiveChannel(channelId));
      try {
        const channelUsers = await getChannelUsers(channelId);
        dispatch(setUsers(channelUsers));
      } catch (error) {
        console.error('Failed to fetch channel users:', error);
      }
    }
  };

  const handleLogout = () => {
    dispatch(logout());
  };

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
          {channels.map((channel: Channel) => (
            <ChannelListItem
              key={channel.id}
              name={channel.name}
              isActive={channel.id === activeChannelId}
              hasUnread={channel.unreadCount > 0}
              isDirect={channel.is_direct_message}
              onClick={() => handleChannelClick(channel.id)}
            />
          ))}
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
          <LogoutButton onClick={handleLogout}>Logout</LogoutButton>
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
    </MainContainer>
  );
};

export default MainLayout; 