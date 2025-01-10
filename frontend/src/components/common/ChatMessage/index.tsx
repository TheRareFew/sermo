import React, { useState } from 'react';
import styled from 'styled-components';
import MessageOptions from '../../chat/MessageOptions';

interface ChatMessageProps {
  content: string;
  sender: string;
  timestamp: string;
  isSystem?: boolean;
  userId?: string;
  currentUserId?: string;
  onDelete?: () => void;
}

const MessageContainer = styled.div<{ isSystem: boolean }>`
  font-family: 'Courier New', monospace;
  margin: 2px 0;
  padding: 4px 8px;
  color: ${props => props.isSystem ? props.theme.colors.secondary : props.theme.colors.text};
  word-wrap: break-word;
  transition: background-color 0.2s;
  position: relative;
  display: flex;
  align-items: flex-start;
  gap: 8px;

  &:hover {
    background-color: ${props => props.theme.colors.hover};
  }
`;

const MessageContent = styled.div`
  flex: 1;
`;

const Timestamp = styled.span`
  color: ${props => props.theme.colors.secondary};
`;

const Sender = styled.span`
  color: ${props => props.theme.colors.primary};
  font-weight: bold;
`;

const MenuTrigger = styled.button`
  background: none;
  border: none;
  color: ${props => props.theme.colors.secondary};
  font-family: 'Courier New', monospace;
  cursor: pointer;
  padding: 0 4px;
  visibility: hidden;
  font-size: 1.2em;
  line-height: 1;

  ${MessageContainer}:hover & {
    visibility: visible;
  }

  &:hover {
    color: ${props => props.theme.colors.primary};
  }
`;

const formatTime = (timestamp: string): string => {
  try {
    console.log('Formatting timestamp:', timestamp);
    
    // Parse the timestamp, assuming UTC if no timezone is specified
    const date = new Date(timestamp);
    if (isNaN(date.getTime())) {
      console.error('Invalid timestamp:', timestamp);
      return '--:--:--';
    }
    
    // Convert to local time
    const hours = date.getHours().toString().padStart(2, '0');
    const minutes = date.getMinutes().toString().padStart(2, '0');
    const seconds = date.getSeconds().toString().padStart(2, '0');
    
    const formattedTime = `${hours}:${minutes}:${seconds}`;
    console.log('Formatted time:', formattedTime);
    return formattedTime;
  } catch (error) {
    console.error('Error formatting timestamp:', error);
    return '--:--:--';
  }
};

const ChatMessage: React.FC<ChatMessageProps> = ({ 
  content, 
  sender, 
  timestamp, 
  isSystem = false,
  userId,
  currentUserId,
  onDelete
}) => {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const formattedTime = formatTime(timestamp);
  
  if (isSystem) {
    return (
      <MessageContainer isSystem={true}>
        <MessageContent>
          <Timestamp>[{formattedTime}]</Timestamp> *** {content} ***
        </MessageContent>
      </MessageContainer>
    );
  }

  const canDelete = userId && currentUserId && userId === currentUserId;

  return (
    <MessageContainer isSystem={false}>
      <MessageContent>
        <Timestamp>[{formattedTime}]</Timestamp> &lt;<Sender>{sender}</Sender>&gt; {content}
      </MessageContent>
      {canDelete && (
        <>
          <MenuTrigger onClick={() => setIsMenuOpen(true)}>⋮</MenuTrigger>
          <MessageOptions
            isOpen={isMenuOpen}
            onClose={() => setIsMenuOpen(false)}
            onDelete={() => {
              if (onDelete) {
                onDelete();
                setIsMenuOpen(false);
              }
            }}
          />
        </>
      )}
    </MessageContainer>
  );
};

export default ChatMessage; 