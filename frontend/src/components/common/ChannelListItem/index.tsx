import React from 'react';
import styled from 'styled-components';

interface ChannelListItemProps {
  name: string;
  isActive: boolean;
  hasUnread: boolean;
  isDirect?: boolean;
  onClick: () => void;
}

const Container = styled.div<{ isActive: boolean }>`
  font-family: 'Courier New', monospace;
  margin: 4px 0;
  padding: 2px 4px;
  cursor: pointer;
  display: flex;
  align-items: center;
  background-color: ${props => props.isActive ? props.theme.colors.hover : 'transparent'};

  &:hover {
    background-color: ${props => props.theme.colors.hover};
  }
`;

const Prefix = styled.span`
  color: ${props => props.theme.colors.secondary};
  margin-right: 4px;
`;

const ChannelName = styled.span<{ isActive: boolean }>`
  color: ${props => props.isActive ? props.theme.colors.primary : props.theme.colors.text};
  flex: 1;
`;

const UnreadIndicator = styled.span`
  color: ${props => props.theme.colors.error};
  margin-left: 8px;
`;

const ChannelListItem: React.FC<ChannelListItemProps> = ({
  name,
  isActive,
  hasUnread,
  isDirect = false,
  onClick
}) => {
  return (
    <Container isActive={isActive} onClick={onClick}>
      <Prefix>{isDirect ? '@' : '#'}</Prefix>
      <ChannelName isActive={isActive}>{name}</ChannelName>
      {hasUnread && <UnreadIndicator>*</UnreadIndicator>}
    </Container>
  );
};

export default ChannelListItem; 