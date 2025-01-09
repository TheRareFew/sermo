import React, { useState } from 'react';
import styled from 'styled-components';
import { useDispatch } from 'react-redux';
import { logout } from '../../../store/auth/authSlice';
import Input from '../../common/Input';

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

const MainLayout: React.FC = () => {
  const dispatch = useDispatch();
  const [message, setMessage] = useState('');

  const handleLogout = () => {
    dispatch(logout());
  };

  const handleMessageSubmit = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && message.trim()) {
      // TODO: Handle message sending
      setMessage('');
    }
  };

  return (
    <MainContainer>
      <Sidebar>
        <ChannelList>
          <h2>Channels</h2>
          <div># general</div>
          <div># random</div>
          <div># help</div>
        </ChannelList>
        <UserList>
          <h2>Online Users</h2>
          <div>● user1</div>
          <div>● user2</div>
          <div>○ user3 (away)</div>
        </UserList>
      </Sidebar>
      <ChatArea>
        <ChatHeader>
          <h1># general</h1>
          <LogoutButton onClick={handleLogout}>Logout</LogoutButton>
        </ChatHeader>
        <ChatMessages>
          <div>[12:00] &lt;user1&gt; Welcome to SERMO!</div>
          <div>[12:01] &lt;user2&gt; Thanks! Excited to be here.</div>
        </ChatMessages>
        <ChatInput>
          <Input
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            onKeyPress={handleMessageSubmit}
            placeholder="Type your message here..."
            fullWidth
          />
        </ChatInput>
      </ChatArea>
    </MainContainer>
  );
};

export default MainLayout; 