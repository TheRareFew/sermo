import React, { useState, KeyboardEvent, useRef, useLayoutEffect, useEffect, ChangeEvent } from 'react';
import styled from 'styled-components';
import { useDispatch } from 'react-redux';
import { addMessage } from '../../../store/messages/messagesSlice';
import { sendMessage } from '../../../services/api/chat';
import { uploadFile, updateFileMessage, FileUploadError } from '../../../services/api/files';
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

const ErrorContainer = styled.div`
  display: flex;
  flex-direction: column;
  gap: 4px;
`;

const ErrorText = styled.div<{ $isWarning?: boolean }>`
  color: ${props => props.$isWarning ? props.theme.colors.warning : props.theme.colors.error};
  font-size: 12px;
  margin-top: 4px;
  font-family: 'Courier New', monospace;
  display: flex;
  align-items: center;
  gap: 4px;
`;

const RetryButton = styled.button`
  background: none;
  border: 1px solid ${props => props.theme.colors.error};
  color: ${props => props.theme.colors.error};
  padding: 2px 8px;
  font-family: 'Courier New', monospace;
  font-size: 12px;
  cursor: pointer;
  margin-left: 8px;

  &:hover {
    background-color: ${props => props.theme.colors.error};
    color: ${props => props.theme.colors.background};
  }
`;

const AttachButton = styled(EmojiButton)`
  font-family: monospace;
  font-size: 16px;
`;

const FilePreviewContainer = styled.div`
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 4px 8px;
  background-color: ${props => props.theme.colors.inputBackground};
  border: 1px solid ${props => props.theme.colors.border};
  border-radius: 4px;
  margin-bottom: 4px;
`;

const FilePreviewText = styled.span`
  font-family: 'Courier New', monospace;
  font-size: 12px;
  color: ${props => props.theme.colors.text};
`;

const RemoveFileButton = styled.button`
  background: none;
  border: none;
  color: ${props => props.theme.colors.error};
  cursor: pointer;
  font-family: monospace;
  padding: 0 4px;
  
  &:hover {
    opacity: 0.8;
  }
`;

const HiddenFileInput = styled.input`
  display: none;
`;

interface ErrorState {
  message: string;
  code?: string;
  isWarning?: boolean;
}

const MessageInput: React.FC<MessageInputProps> = ({ channelId }): JSX.Element => {
  const dispatch = useDispatch<AppDispatch>();
  const [message, setMessage] = useState('');
  const [error, setError] = useState<ErrorState | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [messageSent, setMessageSent] = useState(false);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [attachedFile, setAttachedFile] = useState<File | null>(null);
  const [uploadProgress, setUploadProgress] = useState<number>(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const lastAttemptRef = useRef<{ file?: File; message: string } | null>(null);

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
    if (e.key === 'Enter' && (message.trim() || attachedFile) && channelId) {
      setError(null);
      setIsLoading(true);
      setUploadProgress(0);

      try {
        // Store attempt details for retry
        lastAttemptRef.current = {
          file: attachedFile || undefined,
          message: message.trim()
        };

        let fileId: number | undefined;

        // Upload file first if attached
        if (attachedFile) {
          try {
            const uploadedFile = await uploadFile(attachedFile);
            fileId = uploadedFile.id;
            setUploadProgress(100);
          } catch (error) {
            if (error instanceof FileUploadError) {
              switch (error.code) {
                case 'NETWORK_ERROR':
                  setError({ 
                    message: error.message,
                    code: error.code,
                    isWarning: true
                  });
                  break;
                case 'AUTH_ERROR':
                  setError({ 
                    message: 'Please log in again to upload files.',
                    code: error.code
                  });
                  break;
                case 'SERVER_ERROR':
                  setError({ 
                    message: error.message,
                    code: error.code,
                    isWarning: true
                  });
                  break;
                default:
                  setError({ 
                    message: error.message,
                    code: error.code
                  });
              }
              return; // Don't send message if file upload fails
            } else {
              setError({ 
                message: 'Failed to upload file. Please try again.'
              });
              return; // Don't send message if file upload fails
            }
          }
        }

        // Send the message with the file ID if upload was successful
        const messageResponse = await sendMessage({
          channelId,
          content: message.trim(),
          fileId
        });

        const transformedMessage = transformMessage(messageResponse);
        dispatch(addMessage({
          channelId,
          message: transformedMessage
        }));
        
        setMessage('');
        setAttachedFile(null);
        setMessageSent(true);
        lastAttemptRef.current = null;
      } catch (error) {
        console.error('Failed to send message:', error);
        setError({ 
          message: 'Failed to send message. Please try again.',
          isWarning: true
        });
      } finally {
        setIsLoading(false);
        setUploadProgress(0);
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

  const handleFileSelect = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      try {
        // Check file size (50MB limit)
        if (file.size > 50 * 1024 * 1024) {
          throw new FileUploadError(
            'File size exceeds 50MB limit',
            'FILE_TOO_LARGE'
          );
        }

        // Check file type
        const allowedTypes = ['image/jpeg', 'image/png', 'image/gif', 'application/pdf', 'text/plain'];
        if (!allowedTypes.includes(file.type)) {
          throw new FileUploadError(
            'File type not supported. Allowed types: jpg, png, gif, pdf, txt',
            'INVALID_FILE_TYPE'
          );
        }

        setAttachedFile(file);
        setError(null);
      } catch (error) {
        if (error instanceof FileUploadError) {
          setError({ 
            message: error.message,
            code: error.code
          });
        } else {
          setError({ 
            message: 'Invalid file selected.'
          });
        }
        if (fileInputRef.current) {
          fileInputRef.current.value = '';
        }
      }
    }
  };

  const handleAttachClick = () => {
    fileInputRef.current?.click();
  };

  const handleRemoveFile = () => {
    setAttachedFile(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleRetry = () => {
    if (lastAttemptRef.current) {
      const { file, message } = lastAttemptRef.current;
      if (file) setAttachedFile(file);
      if (message) setMessage(message);
      setError(null);
    }
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
      <AttachButton
        onClick={handleAttachClick}
        disabled={isLoading || !channelId}
        title="Attach file"
      >
        📎
      </AttachButton>
      <InputWrapper>
        {attachedFile && (
          <FilePreviewContainer>
            <FilePreviewText>{attachedFile.name}</FilePreviewText>
            <RemoveFileButton onClick={handleRemoveFile} title="Remove file">×</RemoveFileButton>
          </FilePreviewContainer>
        )}
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
        <HiddenFileInput
          ref={fileInputRef}
          type="file"
          onChange={handleFileSelect}
          accept=".jpg,.jpeg,.png,.gif,.pdf,.txt"
        />
      </InputWrapper>
      {error && (
        <ErrorContainer>
          <ErrorText $isWarning={error.isWarning}>
            {error.isWarning ? '⚠️' : '❌'} {error.message}
            {error.isWarning && lastAttemptRef.current && (
              <RetryButton onClick={handleRetry}>Retry</RetryButton>
            )}
          </ErrorText>
        </ErrorContainer>
      )}
    </InputContainer>
  );
};

export default MessageInput; 