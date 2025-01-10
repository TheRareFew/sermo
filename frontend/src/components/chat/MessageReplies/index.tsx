import React from 'react';
import styled from 'styled-components';
import { useSelector } from 'react-redux';
import { StoreMessage, RootState } from '../../../types';
import ChatMessage from '../../common/ChatMessage';

interface MessageRepliesProps {
  parentId: string;
  replies: StoreMessage[];
  isExpanded: boolean;
  onToggleReplies: (messageId: string) => void;
  onDelete: (messageId: string) => void;
  currentUserId?: string;
}

const RepliesContainer = styled.div<{ isExpanded: boolean }>`
  display: ${props => props.isExpanded ? 'block' : 'none'};
  margin-left: 24px;
  position: relative;
  border-left: 2px solid ${props => props.theme.colors.border};
  margin-top: 2px;
  margin-bottom: 2px;
  padding-left: 8px;

  &:before {
    content: '';
    position: absolute;
    left: -2px;
    top: 0;
    width: 8px;
    height: 2px;
    background-color: ${props => props.theme.colors.border};
  }
`;

const ReplyWrapper = styled.div`
  position: relative;
  padding: 2px 0;
  background-color: ${props => props.theme.colors.backgroundDark};

  &:hover {
    background-color: ${props => props.theme.colors.hover};
  }

  &:last-child {
    &:after {
      content: '';
      position: absolute;
      left: -10px;
      bottom: 50%;
      width: 8px;
      height: 2px;
      background-color: ${props => props.theme.colors.border};
    }
  }
`;

const MessageReplies: React.FC<MessageRepliesProps> = ({
  parentId,
  replies,
  isExpanded,
  onToggleReplies,
  onDelete,
  currentUserId,
}) => {
  const users = useSelector((state: RootState) => state.chat?.users || {});

  console.log('MessageReplies - currentUserId:', currentUserId);
  console.log('MessageReplies - replies:', replies.map(r => ({
    id: r.id,
    userId: r.userId,
    isOwnMessage: r.userId === currentUserId
  })));

  return (
    <RepliesContainer isExpanded={isExpanded}>
      {replies.map((reply) => (
        <ReplyWrapper key={reply.id}>
          <ChatMessage
            content={reply.content}
            sender={users[reply.userId]?.username || reply.userId}
            timestamp={reply.createdAt}
            userId={reply.userId}
            currentUserId={currentUserId}
            onDelete={() => onDelete(reply.id)}
            replyCount={0}
            isExpanded={false}
            onToggleReplies={() => {}}
            onReply={() => {}}
            isReply
          />
        </ReplyWrapper>
      ))}
    </RepliesContainer>
  );
};

export default MessageReplies; 