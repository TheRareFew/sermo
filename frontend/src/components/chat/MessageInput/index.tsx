import React, { useState, KeyboardEvent } from 'react';
import styled from 'styled-components';
import wsService from '../../../services/websocket';

interface MessageInputProps {
  channelId: string | null;
}

const InputContainer = styled.div`
  padding: 16px;
  position: relative;
`;

const Input = styled.input`
  width: 100%;
  padding: 8px;
  border: 2px solid ${props => props.theme.colors.border};
  background: ${props => props.theme.colors.background};
  color: ${props => props.theme.colors.text};
  font-family: 'VT323', monospace;

  &:focus {
    outline: none;
    border-color: ${props => props.theme.colors.primary};
  }

  &:disabled {
    opacity: 0.7;
    cursor: not-allowed;
  }
`;

const ErrorMessage = styled.div`
  color: ${props => props.theme.colors.error};
  font-family: 'VT323', monospace;
  font-size: 0.875rem;
  margin-top: 4px;
  padding: 4px;
`;

const MessageInput: React.FC<MessageInputProps> = ({ channelId }) => {
  const [message, setMessage] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const handleKeyPress = async (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && message.trim() && channelId) {
      const wsState = wsService.getChatSocketState();
      console.log('WebSocket state:', {
        state: wsState,
        isConnected: wsState === WebSocket.OPEN,
        channelId,
        content: message.trim()
      });
      
      if (wsState === WebSocket.OPEN) {
        setError(null);
        setIsLoading(true);

        try {
          await wsService.sendMessage(channelId, message.trim());
          setMessage('');
        } catch (error) {
          console.error('Failed to send message:', error);
          setError('Failed to send message. Please try again.');
        } finally {
          setIsLoading(false);
        }
      } else {
        console.error('WebSocket is not connected. State:', wsState);
        setError('Connection lost. Please refresh the page.');
      }
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setMessage(e.target.value);
    if (error) {
      setError(null);
    }
  };

  return (
    <InputContainer>
      <Input
        type="text"
        value={message}
        onChange={handleChange}
        onKeyPress={handleKeyPress}
        placeholder="Type a message..."
        disabled={isLoading || !channelId}
      />
      {error && <ErrorMessage>{error}</ErrorMessage>}
    </InputContainer>
  );
};

export default MessageInput; 