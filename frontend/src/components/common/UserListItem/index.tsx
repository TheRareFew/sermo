import React from 'react';
import styled from 'styled-components';

interface UserListItemProps {
  username: string;
  status: 'online' | 'offline' | 'away' | 'busy';
}

const Container = styled.div`
  font-family: 'Courier New', monospace;
  margin: 4px 0;
  display: flex;
  align-items: center;
  cursor: pointer;
  padding: 2px 4px;

  &:hover {
    background-color: ${props => props.theme.colors.hover};
  }
`;

const StatusIndicator = styled.span<{ status: string }>`
  margin-right: 8px;
  color: ${props => {
    switch (props.status) {
      case 'online':
        return props.theme.colors.success;
      case 'away':
        return props.theme.colors.warning;
      case 'busy':
        return props.theme.colors.error;
      default:
        return props.theme.colors.disabled;
    }
  }};
`;

const Username = styled.span`
  color: ${props => props.theme.colors.text};
`;

const getStatusSymbol = (status: string) => {
  switch (status) {
    case 'online':
      return '●';
    case 'away':
      return '○';
    case 'busy':
      return '⊘';
    default:
      return '⊗';
  }
};

const UserListItem: React.FC<UserListItemProps> = ({ username, status }) => {
  return (
    <Container>
      <StatusIndicator status={status}>{getStatusSymbol(status)}</StatusIndicator>
      <Username>{username}</Username>
      {status !== 'online' && ` (${status})`}
    </Container>
  );
};

export default UserListItem; 