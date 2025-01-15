import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useDispatch, useSelector } from 'react-redux';
import styled from 'styled-components';
import { DefaultTheme } from 'styled-components';
import { setActiveChannel } from '../../../../store/chat/chatSlice';
import { logout } from '../../../../store/auth/authSlice';
import Button from '../../../common/Button';
import { Channel, User } from '../../../../types';
import { RootState } from '../../../../store/rootReducer';
import VoiceChannel from '../../../voice/VoiceChannel';

const SidebarContainer = styled.div`
  width: 200px;
  border-right: 2px solid ${props => props.theme.colors.border};
  display: flex;
  flex-direction: column;
  background-color: ${props => props.theme.colors.backgroundDark};
  font-family: 'VT323', monospace;
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

const ChannelItem = styled.div<{ isActive: boolean }>`
  padding: 0.25rem 0.5rem;
  margin: 0.25rem 0;
  cursor: pointer;
  color: ${props => props.isActive ? props.theme.colors.primary : props.theme.colors.text};
  background-color: ${props => props.isActive ? props.theme.colors.hover : 'transparent'};
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;

  &:hover {
    background-color: ${props => props.theme.colors.hover};
  }

  &:before {
    content: '#';
    color: ${props => props.theme.colors.secondary};
    margin-right: 0.5rem;
  }
`;

const VoiceChannelItem = styled(ChannelItem)`
  &:before {
    content: '$';
    color: ${props => props.theme.colors.secondary};
    margin-right: 0.5rem;
  }
`;

const UserItem = styled.div<{ status: string }>`
  padding: 0.25rem 0.5rem;
  margin: 0.25rem 0;
  color: ${props => props.theme.colors.text};

  &:before {
    content: '@';
    color: ${props => props.theme.colors.secondary};
    margin-right: 0.5rem;
  }

  &:after {
    content: '[${props => props.status.toUpperCase()}]';
    color: ${props => {
      switch (props.status) {
        case 'online':
          return props.theme.colors.success;
        case 'away':
          return props.theme.colors.warning;
        case 'busy':
          return props.theme.colors.error;
        default:
          return props.theme.colors.textDim;
      }
    }};
    margin-left: 0.5rem;
    font-size: 0.875rem;
  }
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

const VoiceChannelContainer = styled.div`
  position: fixed;
  bottom: 0;
  right: 0;
  background: ${props => props.theme.colors.backgroundDark};
  border: 2px solid ${props => props.theme.colors.border};
  border-radius: 8px;
  padding: 16px;
  width: 300px;
  z-index: 100;
  margin: 16px;
`;

interface SidebarProps {
  onCreateChannel: () => void;
}

const Sidebar: React.FC<SidebarProps> = ({ onCreateChannel }) => {
  const navigate = useNavigate();
  const dispatch = useDispatch();
  const channels = useSelector((state: RootState) => state.chat.channels);
  const users = useSelector((state: RootState) => state.chat.users);
  const [activeVoiceChannel, setActiveVoiceChannel] = useState<Channel | null>(null);

  // Filter channels
  const textChannels = channels.filter((channel: Channel) => !channel.is_vc);
  const publicChannels = textChannels.filter((channel: Channel) => channel.is_public && !channel.is_direct_message);
  const privateChannels = textChannels.filter((channel: Channel) => !channel.is_public && !channel.is_direct_message);
  const directMessages = textChannels.filter((channel: Channel) => channel.is_direct_message);
  const voiceChannels = channels.filter((channel: Channel) => channel.is_vc);

  const handleChannelClick = (channel: Channel) => {
    if (channel.is_vc) {
      // Toggle voice channel
      if (activeVoiceChannel?.id === channel.id) {
        setActiveVoiceChannel(null);
      } else {
        setActiveVoiceChannel(channel);
      }
    } else {
      // Navigate to text channel
      navigate(`/channels/${channel.id}`);
    }
  };

  const handleLogout = () => {
    dispatch(logout());
  };

  return (
    <>
      <SidebarContainer>
        <ChannelList>
          <ChannelHeader>
            <h2>Channels</h2>
            <CreateChannelButton onClick={onCreateChannel}>
              +
            </CreateChannelButton>
          </ChannelHeader>

          {/* Public Text Channels */}
          <ChannelGroup>
            <GroupTitle>Public</GroupTitle>
            {publicChannels.map((channel: Channel) => (
              <ChannelItem
                key={channel.id}
                isActive={false}
                onClick={() => handleChannelClick(channel)}
              >
                {channel.name}
              </ChannelItem>
            ))}
          </ChannelGroup>

          {/* Private Text Channels */}
          {privateChannels.length > 0 && (
            <ChannelGroup>
              <GroupTitle>Private</GroupTitle>
              {privateChannels.map((channel: Channel) => (
                <ChannelItem
                  key={channel.id}
                  isActive={false}
                  onClick={() => handleChannelClick(channel)}
                >
                  {channel.name}
                </ChannelItem>
              ))}
            </ChannelGroup>
          )}

          {/* Direct Messages */}
          {directMessages.length > 0 && (
            <ChannelGroup>
              <GroupTitle>Direct Messages</GroupTitle>
              {directMessages.map((channel: Channel) => (
                <ChannelItem
                  key={channel.id}
                  isActive={false}
                  onClick={() => handleChannelClick(channel)}
                >
                  {channel.name}
                </ChannelItem>
              ))}
            </ChannelGroup>
          )}

          {/* Voice Channels */}
          <ChannelGroup>
            <GroupTitle>Voice</GroupTitle>
            {voiceChannels.map((channel: Channel) => (
              <VoiceChannelItem
                key={channel.id}
                isActive={channel.id === activeVoiceChannel?.id}
                onClick={() => handleChannelClick(channel)}
              >
                {channel.name}
              </VoiceChannelItem>
            ))}
          </ChannelGroup>
        </ChannelList>

        <UserList>
          <h2>Users</h2>
          {Object.values(users as Record<string, User>).map((user: User) => (
            <UserItem key={user.id} status={user.status || 'offline'}>
              {user.username}
            </UserItem>
          ))}
        </UserList>

        <LogoutButton onClick={handleLogout}>
          Logout
        </LogoutButton>
      </SidebarContainer>

      {/* Active Voice Channel */}
      {activeVoiceChannel && (
        <VoiceChannelContainer>
          <VoiceChannel channelId={activeVoiceChannel.id} />
        </VoiceChannelContainer>
      )}
    </>
  );
};

export default Sidebar; 