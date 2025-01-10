import React, { useState, KeyboardEvent } from 'react';
import { useDispatch } from 'react-redux';
import styled from 'styled-components';
import wsService from '../../../services/websocket';
import { addMessage } from '../../../store/messages/messagesSlice';
import { StoreMessage } from '../../../store/types';

interface MessageInputProps {
  channelId: number;
}

const InputContainer = styled.div`
  padding: 16px;
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
`;

const MessageInput: React.FC<MessageInputProps> = ({ channelId }) => {
  const [message, setMessage] = useState('');
  const dispatch = useDispatch();

  const handleKeyPress = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && message.trim() && channelId) {
      const wsState = wsService.getChatSocketState();
      console.log('WebSocket state:', {
        state: wsState,
        isConnected: wsState === WebSocket.OPEN,
        channelId,
        content: message.trim()
      });
      
      if (wsState === WebSocket.OPEN) {
        // Optimistically add the message to the store
        const now = new Date();
        const utcTimestamp = now.toISOString();
        const optimisticMessage: StoreMessage = {
          id: `temp-${Date.now()}`,
          content: message.trim(),
          channelId: String(channelId),
          userId: '1', // TODO: Get from auth state
          reactions: [],
          attachments: [],
          createdAt: utcTimestamp,
          updatedAt: utcTimestamp
        };
        dispatch(addMessage(optimisticMessage));
        wsService.sendMessage(channelId, message.trim());
        setMessage('');
      } else {
        console.error('WebSocket is not connected. State:', wsState);
      }
    }
  };

  return (
    <InputContainer>
      <Input
        type="text"
        value={message}
        onChange={(e: React.ChangeEvent<HTMLInputElement>) => setMessage(e.target.value)}
        onKeyPress={handleKeyPress}
        placeholder="Type a message..."
      />
    </InputContainer>
  );
};

export default MessageInput; 