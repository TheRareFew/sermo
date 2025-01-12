import React, { useState, KeyboardEvent, useRef, useLayoutEffect, useEffect } from 'react';
import styled from 'styled-components';
import { useDispatch } from 'react-redux';
import { addMessage } from '../../../store/messages/messagesSlice';
import { sendMessage } from '../../../services/api/chat';
import { transformMessage } from '../../../utils/messageTransform';
import { AppDispatch } from '../../../store';
import data from '@emoji-mart/data';
import Picker from '@emoji-mart/react';

interface MessageInputProps {
  channelId: string | null;
}

const InputContainer = styled.div`
  padding: 8px;
  background-color: ${props => props.theme.colors.background};
  border-top: 1px solid ${props => props.theme.colors.border};
  display: flex;
  align-items: center;
  gap: 8px;
`;

const InputWrapper = styled.div`
  position: relative;
  flex: 1;
`;

const Input = styled.input`
  width: 100%;
  padding: 8px;
  background-color: ${props => props.theme.colors.inputBackground};
  color: ${props => props.theme.colors.text};
  border: 1px solid ${props => props.theme.colors.border};
  border-radius: 4px;
  font-family: 'Courier New', monospace;

  &:focus {
    outline: none;
    border-color: ${props => props.theme.colors.primary};
  }
`;

const EmojiButton = styled.button`
  background: none;
  border: none;
  cursor: pointer;
  font-size: 20px;
  padding: 4px;
  color: ${props => props.theme.colors.text};
  opacity: 0.7;
  transition: opacity 0.2s;

  &:hover {
    opacity: 1;
  }

  &:disabled {
    opacity: 0.3;
    cursor: not-allowed;
  }
`;

const EmojiPickerWrapper = styled.div`
  position: absolute;
  bottom: 100%;
  left: 0;
  margin-bottom: 8px;
  z-index: 100;
`;

const ErrorText = styled.div`
  color: ${props => props.theme.colors.error};
  font-size: 12px;
  margin-top: 4px;
`;

const MessageInput: React.FC<MessageInputProps> = ({ channelId }) => {
  const dispatch = useDispatch<AppDispatch>();
  const [message, setMessage] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [messageSent, setMessageSent] = useState(false);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useLayoutEffect(() => {
    if (channelId && inputRef.current) {
      inputRef.current.focus();
    }
  }, [channelId]);

  useEffect(() => {
    if (messageSent) {
      setTimeout(() => {
        if (inputRef.current) {
          inputRef.current.focus();
        }
        setMessageSent(false);
      }, 100);
    }
  }, [messageSent]);

  const handleKeyPress = async (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && message.trim() && channelId) {
      setError(null);
      setIsLoading(true);

      try {
        console.log('Sending message:', {
          channelId,
          content: message.trim()
        });

        const sentMessage = await sendMessage({
          channelId,
          content: message.trim()
        });

        console.log('Message sent successfully:', sentMessage);

        const transformedMessage = transformMessage(sentMessage);
        console.log('Transformed message:', transformedMessage);

        dispatch(addMessage({
          channelId,
          message: transformedMessage
        }));
        
        setMessage('');
        setMessageSent(true);
      } catch (error) {
        console.error('Failed to send message:', error);
        setError('Failed to send message. Please try again.');
      } finally {
        setIsLoading(false);
      }
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setMessage(e.target.value);
    if (error) {
      setError(null);
    }
  };

  const handleEmojiSelect = (emoji: any) => {
    setMessage(prev => prev + emoji.native);
    setShowEmojiPicker(false);
    if (inputRef.current) {
      inputRef.current.focus();
    }
  };

  const toggleEmojiPicker = () => {
    setShowEmojiPicker(!showEmojiPicker);
  };

  return (
    <InputContainer>
      <EmojiButton 
        onClick={toggleEmojiPicker}
        disabled={isLoading || !channelId}
        title="Add emoji"
      >
        :-)
      </EmojiButton>
      <InputWrapper>
        <Input
          ref={inputRef}
          type="text"
          value={message}
          onChange={handleChange}
          onKeyPress={handleKeyPress}
          placeholder={channelId ? "Type a message..." : "Select a channel to start chatting..."}
          disabled={isLoading || !channelId}
        />
        {showEmojiPicker && (
          <EmojiPickerWrapper>
            <Picker 
              data={data} 
              onEmojiSelect={handleEmojiSelect}
              theme="dark"
            />
          </EmojiPickerWrapper>
        )}
      </InputWrapper>
      {error && <ErrorText>{error}</ErrorText>}
    </InputContainer>
  );
};

export default MessageInput; 