import React, { useState, KeyboardEvent, useRef, useLayoutEffect, useEffect, ChangeEvent } from 'react';
import styled from 'styled-components';
import { useDispatch, useSelector } from 'react-redux';
import { RootState } from '../../../store';
import { sendMessage, sendAiMessage } from '../../../services/api/chat';
import { uploadFile, FileUploadError } from '../../../services/api/files';
import { User } from '../../../types';
import data from '@emoji-mart/data';
import Picker from '@emoji-mart/react';

interface MessageInputProps {
  channelId: string;
  currentUser: User;
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
  max-width: 100%;
`;

const VideoPreview = styled.video`
  max-width: 200px;
  max-height: 150px;
  border-radius: 4px;
`;

const FilePreviewContent = styled.div`
  display: flex;
  align-items: center;
  gap: 8px;
  flex: 1;
  min-width: 0;
`;

const FilePreviewText = styled.span`
  font-family: 'Courier New', monospace;
  font-size: 12px;
  color: ${props => props.theme.colors.text};
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  flex: 1;
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

export const MessageInput: React.FC<MessageInputProps> = ({ channelId, currentUser }): JSX.Element => {
  const dispatch = useDispatch();
  const [message, setMessage] = useState('');
  const [error, setError] = useState<ErrorState | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [messageSent, setMessageSent] = useState(false);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [attachedFile, setAttachedFile] = useState<File | null>(null);
  const [uploadProgress, setUploadProgress] = useState<number>(0);
  const [isLainMention, setIsLainMention] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const lastAttemptRef = useRef<{ file?: File; message: string } | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);

  // Get all users from the store
  const users = useSelector((state: RootState) => state.chat.users || {});
  const usersList = Object.values(users) as User[];

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

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newMessage = e.target.value;
    setMessage(newMessage);
    
    // Check for @mentions
    const mentionMatch = newMessage.match(/@(\w+)\b/);
    if (mentionMatch) {
      const mentionedUsername = mentionMatch[1];
      const mentionedUser = usersList.find((u) => u.username === mentionedUsername);
      
      if (mentionedUser) {
        if (mentionedUser.isBot) {
          setIsLainMention(true);
        } else if (mentionedUser.status === 'offline') {
          // Create bot name with <bot> suffix
          const botUsername = `${mentionedUsername}<bot>`;
          setIsLainMention(true);
        } else {
          setIsLainMention(false);
        }
      }
    } else {
      setIsLainMention(false);
    }
  };

  const handleKeyPress = async (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && (message.trim() || attachedFile) && channelId && currentUser) {
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
              setIsLoading(false);
              return;
            } else {
              setError({ 
                message: 'Failed to upload file. Please try again.'
              });
              setIsLoading(false);
              return;
            }
          }
        }

        // Clear input before sending message
        const messageContent = message.trim();
        setMessage('');
        setAttachedFile(null);
        setMessageSent(true);
        setIsLoading(false);

        // Send the message to the server
        const messageResponse = await sendMessage({
          channelId,
          content: messageContent,
          fileId
        });

        // Check for @mentions of offline users or bots
        const mentionMatch = messageContent.match(/@(\w+)\b/);
        if (mentionMatch) {
          const mentionedUsername = mentionMatch[1];
          const mentionedUser = usersList.find((u) => u.username === mentionedUsername);

          if (mentionedUser && (mentionedUser.isBot || mentionedUser.status === 'offline')) {
            try {
              await sendAiMessage({
                message: messageContent,
                channel_id: parseInt(channelId, 10),
                parent_message_id: parseInt(messageResponse.id.toString(), 10),
                target_user: mentionedUser.username
              });
              
              console.log('AI message sent successfully');
              setIsLainMention(false);

            } catch (error: unknown) {
              console.error('AI response error:', error);
              let errorMessage = 'Failed to get AI response. Please try again.';
              
              if (error instanceof Error) {
                errorMessage = error.message;
              } else if (typeof error === 'object' && error !== null && 'message' in error) {
                errorMessage = String((error as { message: unknown }).message);
              }
              
              setError({ 
                message: errorMessage,
                isWarning: true
              });
            }
          }
        }
      } catch (error) {
        setError({ 
          message: 'Failed to send message. Please try again.',
          isWarning: true
        });
        setIsLoading(false);
      }
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
        const allowedTypes = [
          // Images
          'image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp', 'image/svg+xml', 'image/bmp',
          // Videos
          'video/mp4', 'video/webm', 'video/ogg', 'video/quicktime',
          // Documents
          'application/pdf', 'text/plain',
          'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
          'application/vnd.ms-excel', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
          'application/vnd.ms-powerpoint', 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
          // Archives
          'application/zip', 'application/x-zip-compressed', 'application/x-rar-compressed',
          // Audio
          'audio/mpeg', 'audio/wav', 'audio/ogg',
          // Code
          'text/javascript', 'application/javascript', 'text/css', 'text/html', 'application/json',
          'text/x-python', 'text/python', 'application/x-python', 'application/x-python-code'
        ];

        if (!allowedTypes.includes(file.type)) {
          throw new FileUploadError(
            'File type not supported. Allowed types: images (jpg, png, gif, webp, svg, bmp), videos (mp4, webm, ogg, mov), documents (pdf, txt, doc, docx, xls, xlsx, ppt, pptx), archives (zip, rar), audio (mp3, wav, ogg), and code files (js, css, html, json, py)',
            'INVALID_FILE_TYPE'
          );
        }

        // Create preview URL for video files
        if (file.type.startsWith('video/')) {
          const url = URL.createObjectURL(file);
          setPreviewUrl(url);
        } else {
          setPreviewUrl(null);
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
        setPreviewUrl(null);
      }
    }
  };

  const handleAttachClick = () => {
    fileInputRef.current?.click();
  };

  const handleRemoveFile = () => {
    if (previewUrl) {
      URL.revokeObjectURL(previewUrl);
    }
    setPreviewUrl(null);
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

  // Clean up preview URL when component unmounts
  useEffect(() => {
    return () => {
      if (previewUrl) {
        URL.revokeObjectURL(previewUrl);
      }
    };
  }, [previewUrl]);

  return (
    <InputContainer>
      <EmojiButton 
        onClick={toggleEmojiPicker}
        disabled={isLoading}
        title="Add emoji"
      >
        :-)
      </EmojiButton>
      <AttachButton
        onClick={handleAttachClick}
        disabled={isLoading}
        title="Attach file"
      >
        📎
      </AttachButton>
      <InputWrapper>
        {attachedFile && (
          <FilePreviewContainer>
            <FilePreviewContent>
              {previewUrl && attachedFile.type.startsWith('video/') && (
                <VideoPreview 
                  src={previewUrl} 
                  controls 
                  muted
                  preload="metadata"
                />
              )}
              <FilePreviewText>{attachedFile.name}</FilePreviewText>
            </FilePreviewContent>
            <RemoveFileButton onClick={handleRemoveFile} title="Remove file">×</RemoveFileButton>
          </FilePreviewContainer>
        )}
        <Input
          ref={inputRef}
          type="text"
          value={message}
          onChange={handleChange}
          onKeyPress={handleKeyPress}
          placeholder="Type a message..."
          disabled={isLoading}
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
          accept={
            // Images
            ".jpg,.jpeg,.png,.gif,.webp,.svg,.bmp," +
            // Videos
            ".mp4,.webm,.ogv,.mov," +
            // Documents
            ".pdf,.txt,.doc,.docx,.xls,.xlsx,.ppt,.pptx," +
            // Archives
            ".zip,.rar," +
            // Audio
            ".mp3,.wav,.ogg," +
            // Code
            ".js,.css,.html,.json,.py"
          }
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

// Export both named and default export
export default MessageInput; 