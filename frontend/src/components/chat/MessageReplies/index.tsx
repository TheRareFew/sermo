import React from 'react';
import styled from 'styled-components';
import Message from '../Message';
import { StoreMessage, User } from '../../../types';

interface MessageRepliesProps {
  replies: StoreMessage[];
  currentUserId?: string;
  onDelete: (messageId: string) => void;
  onReactionAdd: (messageId: string, emoji: string) => void;
  onReactionRemove: (messageId: string, emoji: string) => void;
  users: { [key: string]: User };
  onContentLoad?: () => void;
}

const RepliesContainer = styled.div`
  margin-left: 20px;
  border-left: 1px solid #333;
  padding-left: 10px;
`;

const MessageReplies: React.FC<MessageRepliesProps> = ({
  replies,
  currentUserId,
  onDelete,
  onReactionAdd,
  onReactionRemove,
  users,
  onContentLoad
}) => {
  return (
    <RepliesContainer>
      {replies.map((reply) => {
        const user = users[reply.userId];
        const username = user ? user.username : reply.userId;
        
        return (
          <Message
            key={reply.id}
            id={reply.id}
            content={reply.content}
            sender={username}
            timestamp={reply.createdAt}
            userId={reply.userId}
            currentUserId={currentUserId}
            onDelete={() => onDelete(reply.id)}
            replyCount={0}
            isExpanded={false}
            onToggleReplies={() => {}}
            onReply={() => {}}
            isReply={true}
            reactions={reply.reactions}
            onReactionAdd={(emoji) => onReactionAdd(reply.id, emoji)}
            onReactionRemove={(emoji) => onReactionRemove(reply.id, emoji)}
            attachments={reply.attachments}
            has_attachments={reply.has_attachments}
            isBot={user?.isBot}
            onContentLoad={onContentLoad}
          />
        );
      })}
    </RepliesContainer>
  );
};

export default MessageReplies; 