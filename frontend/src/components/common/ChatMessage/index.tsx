import React from 'react';
import styled from 'styled-components';

interface ChatMessageProps {
  content: string;
  sender: string;
  timestamp: string;
  isSystem?: boolean;
}

const MessageContainer = styled.div<{ isSystem: boolean }>`
  font-family: 'Courier New', monospace;
  margin: 2px 0;
  padding: 4px 8px;
  color: ${props => props.isSystem ? props.theme.colors.secondary : props.theme.colors.text};
  word-wrap: break-word;
  transition: background-color 0.2s;

  &:hover {
    background-color: ${props => props.theme.colors.hover};
  }
`;

const Timestamp = styled.span`
  color: ${props => props.theme.colors.secondary};
`;

const Sender = styled.span`
  color: ${props => props.theme.colors.primary};
  font-weight: bold;
`;

const formatTime = (timestamp: string): string => {
  const date = new Date(timestamp);
  const hours = date.getHours().toString().padStart(2, '0');
  const minutes = date.getMinutes().toString().padStart(2, '0');
  const seconds = date.getSeconds().toString().padStart(2, '0');
  return `${hours}:${minutes}:${seconds}`;
};

const ChatMessage: React.FC<ChatMessageProps> = ({ content, sender, timestamp, isSystem = false }) => {
  const formattedTime = formatTime(timestamp);
  
  if (isSystem) {
    return (
      <MessageContainer isSystem={true}>
        <Timestamp>[{formattedTime}]</Timestamp> *** {content} ***
      </MessageContainer>
    );
  }

  return (
    <MessageContainer isSystem={false}>
      <Timestamp>[{formattedTime}]</Timestamp> &lt;<Sender>{sender}</Sender>&gt; {content}
    </MessageContainer>
  );
};

export default ChatMessage; 