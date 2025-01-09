import React, { useEffect, useRef, useState } from 'react';
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
import Button from '../../common/Button';
import ChatMessage from '../../common/ChatMessage';
import UserListItem from '../../common/UserListItem';
import ChannelListItem from '../../common/ChannelListItem';
import CreateChannelModal from '../../chat/CreateChannelModal';
import MessageInput from '../../chat/MessageInput';
import wsService from '../../../services/websocket';
import { getChannels, getChannelMessages, getChannelUsers } from '../../../services/api/chat';
import { Message, WebSocketMessage } from '../../../types';

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

const LoadingMessage = styled.div`
  text-align: center;
  padding: 8px;
  color: ${props => props.theme.colors.textSecondary};
  font-family: 'Courier New', monospace;
  font-style: italic;
`;

const MainLayout: React.FC = () => {
  const dispatch = useDispatch();
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const messagesContainerRef = useRef<HTMLDivElement>(null);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [hasMoreMessages, setHasMoreMessages] = useState(true);
  
  const activeChannelId = useSelector((state: any) => state.chat.activeChannelId);
  const channels = useSelector((state: any) => state.chat.channels);
  const messages = useSelector((state: any) => state.chat.messages[activeChannelId] || []);
  const users = useSelector((state: any) => state.chat.users);

  const MESSAGES_PER_PAGE = 30;

  // Function to scroll to bottom of messages
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  // Handle scroll to load more messages
  const handleScroll = async (e: React.UIEvent<HTMLDivElement>) => {
    const div = e.currentTarget;
    if (div.scrollTop === 0 && !isLoadingMore && hasMoreMessages && activeChannelId) {
      setIsLoadingMore(true);
      try {
        const oldestMessageId = messages[0]?.id;
        const olderMessages = await getChannelMessages(activeChannelId, MESSAGES_PER_PAGE);
        
        if (olderMessages.length < MESSAGES_PER_PAGE) {
          setHasMoreMessages(false);
        }

        if (olderMessages.length > 0) {
          // Filter out messages we already have
          const newMessages = olderMessages.filter(msg => 
            !messages.some((existing: Message) => existing.id === msg.id)
          );
          if (newMessages.length > 0) {
            dispatch(setMessages({ 
              channelId: activeChannelId, 
              messages: [...newMessages, ...messages]
            }));
            
            // Maintain scroll position
            const currentMessage = document.getElementById(`message-${oldestMessageId}`);
            currentMessage?.scrollIntoView();
          }
        }
      } catch (error) {
        console.error('Failed to fetch older messages:', error);
      } finally {
        setIsLoadingMore(false);
      }
    }
  };

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
            getChannelMessages(firstChannelId, MESSAGES_PER_PAGE),
            getChannelUsers(firstChannelId)
          ]);
          
          dispatch(setMessages({ channelId: firstChannelId, messages: messagesData }));
          dispatch(setUsers(usersData));
          wsService.joinChannel(firstChannelId);
          setHasMoreMessages(messagesData.length === MESSAGES_PER_PAGE);
        }
      } catch (error) {
        console.error('Failed to fetch initial data:', error);
      }
    };

    wsService.connect();
    fetchInitialData();

    // WebSocket event handlers
    const messageHandler = (data: WebSocketMessage) => {
      if (data.type === 'message' && data.id && data.content && data.sender_id && 
          data.channel_id && data.created_at) {
        const message: Message = {
          id: data.id,
          content: data.content,
          sender_id: data.sender_id,
          channel_id: data.channel_id,
          created_at: data.created_at,
          is_system: data.is_system
        };
        dispatch(addMessage(message));
        scrollToBottom();
      }
    };

    const presenceHandler = (data: WebSocketMessage) => {
      if (data.type === 'presence_update' && data.user_id && data.status) {
        dispatch(updateUserStatus({
          userId: data.user_id,
          status: data.status
        }));
      }
    };

    wsService.onMessage(messageHandler);
    wsService.onPresence(presenceHandler);

    return () => {
      wsService.disconnect();
    };
  }, [dispatch]);

  const handleChannelClick = async (channelId: number) => {
    if (channelId === activeChannelId) return;
    
    dispatch(setActiveChannel(channelId));
    setHasMoreMessages(true);
    try {
      const [messagesData, usersData] = await Promise.all([
        getChannelMessages(channelId, MESSAGES_PER_PAGE),
        getChannelUsers(channelId)
      ]);
      dispatch(setMessages({ channelId, messages: messagesData }));
      dispatch(setUsers(usersData));
      wsService.joinChannel(channelId);
      setHasMoreMessages(messagesData.length === MESSAGES_PER_PAGE);
    } catch (error) {
      console.error('Failed to fetch channel data:', error);
    }
  };

  // Scroll to bottom on initial load and channel change
  useEffect(() => {
    scrollToBottom();
  }, [activeChannelId]);

  const handleLogout = () => {
    wsService.disconnect();
    dispatch(logout());
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
        <ChatMessages ref={messagesContainerRef} onScroll={handleScroll}>
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
              {isLoadingMore && (
                <LoadingMessage>Loading older messages...</LoadingMessage>
              )}
              {messages.map((msg: Message) => (
                <div key={msg.id} id={`message-${msg.id}`} style={{ width: '100%' }}>
                  <ChatMessage
                    content={msg.content}
                    sender={users[msg.sender_id]?.username || 'Unknown'}
                    timestamp={msg.created_at}
                    isSystem={msg.is_system}
                  />
                </div>
              ))}
              <div ref={messagesEndRef} />
            </>
          )}
        </ChatMessages>
        <ChatInput>
          {activeChannel && (
            <MessageInput
              channelId={activeChannel.id}
              wsService={wsService}
            />
          )}
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