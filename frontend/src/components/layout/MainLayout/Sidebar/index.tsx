import React from 'react';
import { useSelector, useDispatch } from 'react-redux';
import styled from 'styled-components';
import { setActiveChannel } from '../../../../store/chat/chatSlice';
import Button from '../../../common/Button';
import { Channel, User } from '../../../../types';
import { RootState } from '../../../../store/rootReducer';

const SidebarContainer = styled.div`
  width: 280px;
  display: flex;
  flex-direction: column;
  background-color: ${props => props.theme.colors.backgroundDark};
  border-right: 2px solid ${props => props.theme.colors.border};
  font-family: 'VT323', monospace;
`;

const Section = styled.div`
  padding: 1rem;
  border-bottom: 2px solid ${props => props.theme.colors.border};

  &:last-child {
    border-bottom: none;
  }
`;

const SectionHeader = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 0.5rem;
  padding: 0.25rem 0;
  border-bottom: 1px solid ${props => props.theme.colors.border};
`;

const SectionTitle = styled.h2`
  margin: 0;
  color: ${props => props.theme.colors.primary};
  font-size: 1rem;
  text-transform: uppercase;
`;

const ChannelList = styled.div`
  flex: 1;
  overflow-y: auto;
`;

const UserList = styled.div`
  height: 200px;
  overflow-y: auto;
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

interface SidebarProps {
  onCreateChannel: () => void;
}

const Sidebar: React.FC<SidebarProps> = ({ onCreateChannel }) => {
  const dispatch = useDispatch();
  // All channels are accessible by default to all users
  const channels = useSelector((state: RootState) => state.chat.channels);
  const users = useSelector((state: RootState) => state.chat.users);
  const activeChannelId = useSelector((state: RootState) => state.chat.activeChannelId);

  const handleChannelClick = (channelId: string) => {
    // Users can freely switch between any channel
    dispatch(setActiveChannel(channelId));
  };

  return (
    <SidebarContainer>
      <Section>
        <SectionHeader>
          <SectionTitle>Channels</SectionTitle>
          <Button variant="secondary" size="small" onClick={onCreateChannel}>
            +New
          </Button>
        </SectionHeader>
        <ChannelList>
          {/* Display all channels - no filtering based on permissions */}
          {channels.map((channel: Channel) => (
            <ChannelItem
              key={channel.id}
              isActive={channel.id === activeChannelId}
              onClick={() => handleChannelClick(channel.id)}
            >
              {channel.name}
            </ChannelItem>
          ))}
        </ChannelList>
      </Section>
      <Section>
        <SectionHeader>
          <SectionTitle>Online Users</SectionTitle>
        </SectionHeader>
        <UserList>
          {Object.values(users).map((user: User) => (
            <UserItem key={user.id} status={user.status || 'offline'}>
              {user.username}
            </UserItem>
          ))}
        </UserList>
      </Section>
    </SidebarContainer>
  );
};

export default Sidebar; 