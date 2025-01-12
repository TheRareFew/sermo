import React from 'react';
import styled from 'styled-components';
import MessageOptions from '../../chat/MessageOptions';

export interface ChatMessageProps {
  content: string;
  sender: string;
  timestamp: string;
  userId: string;
  currentUserId?: string;
  onDelete: () => void;
  replyCount: number;
  isExpanded: boolean;
  onToggleReplies: () => void;
  onReply: () => void;
  isReply?: boolean;
}

const MessageContainer = styled.div<{ $isReply?: boolean }>`
  font-family: 'Courier New', monospace;
  padding: 2px 0;
  color: #fff;
  position: relative;
  
  &:hover {
    background-color: #2a2a2a;
  }
`;

const MessageContent = styled.div`
  display: flex;
  align-items: flex-start;
  gap: 8px;
  white-space: pre-wrap;
  word-wrap: break-word;
  position: relative;
  padding-right: 40px; /* Make room for the options menu */
`;

const MessageText = styled.div`
  flex: 1;
  min-width: 0; /* Allow text to wrap */
`;

const OptionsWrapper = styled.div`
  position: absolute;
  right: 8px;
  top: 0;
`;

const Timestamp = styled.span`
  color: #888;
`;

const Sender = styled.span`
  color: #0f0;
  font-weight: bold;
`;

const ReplyCount = styled.button`
  background: none;
  border: none;
  color: #888;
  cursor: pointer;
  font-family: inherit;
  padding: 0 4px;
  font-size: inherit;

  &:hover {
    color: #fff;
  }
`;

const ChatMessage: React.FC<ChatMessageProps> = ({
  content,
  sender,
  timestamp,
  userId,
  currentUserId,
  onDelete,
  replyCount,
  isExpanded,
  onToggleReplies,
  onReply,
  isReply = false,
}) => {
  const formattedTime = new Date(timestamp).toLocaleTimeString([], { 
    hour: '2-digit', 
    minute: '2-digit',
    second: '2-digit',
    hour12: false
  });

  const isOwnMessage = userId === currentUserId;

  return (
    <MessageContainer $isReply={isReply}>
      <MessageContent>
        <Timestamp>[{formattedTime}]</Timestamp>
        <Sender>&lt;{sender}&gt;</Sender>
        <MessageText>
          <span>{content}</span>
          {!isReply && replyCount > 0 && (
            <ReplyCount onClick={onToggleReplies}>
              [{isExpanded ? '-' : '+'} {replyCount}]
            </ReplyCount>
          )}
        </MessageText>
        <OptionsWrapper>
          <MessageOptions 
            onDelete={onDelete} 
            onReply={onReply}
            canDelete={isOwnMessage}
            canReply={!isReply}
          />
        </OptionsWrapper>
      </MessageContent>
    </MessageContainer>
  );
};

export default ChatMessage; 