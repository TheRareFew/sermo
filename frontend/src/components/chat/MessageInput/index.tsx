import React, { useState, KeyboardEvent } from 'react';
import styled from 'styled-components';
import { useDispatch } from 'react-redux';
import { WebSocketService } from '../../../services/websocket';

interface MessageInputProps {
  channelId: number;
  wsService: WebSocketService;
}

const InputContainer = styled.div`
  padding: 16px 32px;
  background: ${props => props.theme.colors.background};
  display: flex;
  justify-content: center;
`;

const StyledInput = styled.input`
  width: 100%;
  max-width: 800px;
  padding: 12px 16px;
  background: ${props => props.theme.colors.background};
  color: ${props => props.theme.colors.text};
  border: 2px solid ${props => props.theme.colors.border};
  border-radius: 4px;
  font-family: 'Courier New', monospace;
  font-size: 14px;

  &:focus {
    outline: none;
    border-color: ${props => props.theme.colors.primary};
    box-shadow: 0 0 0 1px ${props => props.theme.colors.primary};
  }

  &::placeholder {
    color: ${props => props.theme.colors.textSecondary};
  }
`;

const MessageInput: React.FC<MessageInputProps> = ({ channelId, wsService }) => {
  const [message, setMessage] = useState('');
  const dispatch = useDispatch();

  const handleKeyPress = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && message.trim()) {
      wsService.sendMessage(channelId, message.trim());
      setMessage('');
    }
  };

  return (
    <InputContainer>
      <StyledInput
        type="text"
        value={message}
        onChange={(e) => setMessage(e.target.value)}
        onKeyPress={handleKeyPress}
        placeholder="> Type your message and press Enter..."
        aria-label="Message input"
      />
    </InputContainer>
  );
};

export default MessageInput; 