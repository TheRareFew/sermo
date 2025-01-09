import React, { useEffect, useState, useRef } from 'react';
import styled from 'styled-components';
import { useDispatch, useSelector } from 'react-redux';
import { logout } from '../../../store/auth/authSlice';
import {
  setActiveChannel,
  setChannels,
  addMessage,
  setMessages,
  setUsers,
  updateUserStatus
} from '../../../store/chat/chatSlice';
import Input from '../../common/Input';
import Button from '../../common/Button';
import ChatMessage from '../../common/ChatMessage';
import UserListItem from '../../common/UserListItem';
import ChannelListItem from '../../common/ChannelListItem';
import CreateChannelModal from '../../chat/CreateChannelModal';
import wsService from '../../../services/websocket';
import { getChannels, getChannelMessages, getChannelUsers } from '../../../services/api/chat';

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

const ChatMessages = styled.div`
  flex: 1;
  padding: 16px;
  overflow-y: auto;
  font-family: 'Courier New', monospace;
`;

const ChatInput = styled.div`
  padding: 16px;
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

const NoChannelMessage = styled.div`
  text-align: center;
  padding: 20px;
  color: ${props => props.theme.colors.secondary};
  font-family: 'Courier New', monospace;
`;

const MainLayout: React.FC = () => {
  const dispatch = useDispatch();
  const [message, setMessage] = useState('');
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  
  const activeChannelId = useSelector((state: any) => state.chat.activeChannelId);
  const channels = useSelector((state: any) => state.chat.channels);
  const messages = useSelector((state: any) => state.chat.messages[activeChannelId] || []);
  const users = useSelector((state: any) => state.chat.users);

  useEffect(() => {
    // Initial data fetch
    const fetchInitialData = async () => {
      try {
        const channelsData = await getChannels();
        dispatch(setChannels(channelsData));
        
        if (channelsData.length > 0) {
          const firstChannelId = channelsData[0].id;
          dispatch(setActiveChannel(firstChannelId));
          
          const [messagesData, usersData] = await Promise.all([
            getChannelMessages(firstChannelId),
            getChannelUsers(firstChannelId)
          ]);
          
          dispatch(setMessages({ channelId: firstChannelId, messages: messagesData }));
          dispatch(setUsers(usersData));
        }
      } catch (error) {
        console.error('Failed to fetch initial data:', error);
      }
    };

    fetchInitialData();
    wsService.connect();

    // WebSocket event handlers
    const messageHandler = (data: any) => {
      if (data.type === 'message') {
        dispatch(addMessage(data));
      }
    };

    const presenceHandler = (data: any) => {
      if (data.type === 'status_update') {
        dispatch(updateUserStatus({ userId: data.user_id, status: data.status }));
      }
    };

    wsService.onMessage(messageHandler);
    wsService.onPresence(presenceHandler);

    return () => {
      wsService.disconnect();
    };
  }, [dispatch]);

  useEffect(() => {
    // Scroll to bottom when messages change
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleChannelClick = async (channelId: number) => {
    if (channelId === activeChannelId) return;
    
    dispatch(setActiveChannel(channelId));
    try {
      const [messagesData, usersData] = await Promise.all([
        getChannelMessages(channelId),
        getChannelUsers(channelId)
      ]);
      dispatch(setMessages({ channelId, messages: messagesData }));
      dispatch(setUsers(usersData));
      wsService.joinChannel(channelId);
    } catch (error) {
      console.error('Failed to fetch channel data:', error);
    }
  };

  const handleLogout = () => {
    wsService.disconnect();
    dispatch(logout());
  };

  const handleMessageSubmit = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && message.trim() && activeChannelId) {
      wsService.sendMessage(activeChannelId, message.trim());
      setMessage('');
    }
  };

  const activeChannel = channels.find((c: any) => c.id === activeChannelId);

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
          {channels.map((channel: any) => (
            <ChannelListItem
              key={channel.id}
              name={channel.name}
              isActive={channel.id === activeChannelId}
              hasUnread={false} // TODO: Implement unread tracking
              isDirect={channel.is_direct_message}
              onClick={() => handleChannelClick(channel.id)}
            />
          ))}
        </ChannelList>
        <UserList>
          <h2>Online Users</h2>
          {Object.values(users).map((user: any) => (
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
        <ChatMessages>
          {!activeChannel ? (
            <NoChannelMessage>
              {channels.length === 0 ? (
                <>
                  Welcome to SERMO! Click the "+New" button above to create your first channel.
                </>
              ) : (
                <>
                  Select a channel from the sidebar to start chatting.
                </>
              )}
            </NoChannelMessage>
          ) : (
            <>
              {messages.map((msg: any) => (
                <ChatMessage
                  key={msg.id}
                  content={msg.content}
                  sender={users[msg.sender_id]?.username || 'Unknown'}
                  timestamp={msg.created_at}
                  isSystem={msg.is_system}
                />
              ))}
              <div ref={messagesEndRef} />
            </>
          )}
        </ChatMessages>
        <ChatInput>
          <Input
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            onKeyPress={handleMessageSubmit}
            placeholder={activeChannel ? "Type your message here..." : "Select a channel to start chatting"}
            fullWidth
            disabled={!activeChannel}
          />
        </ChatInput>
      </ChatArea>
      <CreateChannelModal
        isOpen={isCreateModalOpen}
        onClose={() => setIsCreateModalOpen(false)}
      />
    </MainContainer>
  );
};

export default MainLayout; 