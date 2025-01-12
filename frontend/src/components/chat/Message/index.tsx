import React from 'react';
import styled from 'styled-components';
import MessageOptions from '../../chat/MessageOptions';
import { Reaction } from '../../../types';

export interface ChatMessageProps {
  id: string;
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
  reactions: Reaction[];
  onReactionAdd?: (emoji: string) => void;
  onReactionRemove?: (emoji: string) => void;
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

const ReactionsContainer = styled.div`
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
  margin-top: 2px;
  margin-left: 8px;
`;

const ReactionBadge = styled.button<{ $isOwn: boolean }>`
  background: ${props => props.$isOwn ? '#2a2a2a' : 'none'};
  border: 1px solid #444;
  color: ${props => props.theme.colors.text};
  cursor: pointer;
  font-family: inherit;
  padding: 1px 4px;
  font-size: inherit;
  border-radius: 4px;
  display: inline-flex;
  align-items: center;
  gap: 4px;

  &:hover {
    background-color: ${props => props.theme.colors.hover};
    border-color: ${props => props.theme.colors.primary};
  }
`;

const ReactionCount = styled.span`
  color: #888;
  font-size: 0.9em;
`;

const ChatMessage: React.FC<ChatMessageProps> = ({
  id,
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
  reactions = [],
  onReactionAdd,
  onReactionRemove,
}) => {
  console.log('Message props:', {
    id,
    content: content.slice(0, 50), // Only log first 50 chars of content
    sender,
    userId,
    currentUserId,
    reactions
  });

  const formattedTime = new Date(timestamp).toLocaleTimeString([], { 
    hour: '2-digit', 
    minute: '2-digit',
    second: '2-digit',
    hour12: false
  });

  const isOwnMessage = userId === currentUserId;

  // Group reactions by emoji
  const groupedReactions = (reactions || []).reduce((acc, reaction) => {
    console.log('Processing reaction:', reaction);
    if (!reaction || !reaction.emoji) {
      console.warn('Invalid reaction:', reaction);
      return acc;
    }

    if (!acc[reaction.emoji]) {
      acc[reaction.emoji] = {
        count: 0,
        hasOwn: false,
        users: new Set()
      };
    }
    acc[reaction.emoji].count++;
    acc[reaction.emoji].users.add(reaction.userId);
    if (reaction.userId === currentUserId) {
      acc[reaction.emoji].hasOwn = true;
    }
    return acc;
  }, {} as Record<string, { count: number; hasOwn: boolean; users: Set<string> }>);

  console.log('Grouped reactions:', groupedReactions);

  const handleReactionClick = async (emoji: string) => {
    console.log('Reaction clicked:', emoji);
    const reaction = groupedReactions[emoji];
    console.log('Reaction state:', reaction);
    if (reaction?.hasOwn) {
      console.log('Removing reaction:', emoji);
      onReactionRemove?.(emoji);
    } else {
      console.log('Adding reaction:', emoji);
      onReactionAdd?.(emoji);
    }
  };

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
            messageId={id}
            onDelete={onDelete} 
            onReply={onReply}
            canDelete={isOwnMessage}
            canReply={!isReply}
            onReactionAdd={onReactionAdd}
            onReactionRemove={onReactionRemove}
          />
        </OptionsWrapper>
      </MessageContent>
      {Object.entries(groupedReactions).length > 0 && (
        <ReactionsContainer>
          {Object.entries(groupedReactions).map(([emoji, { count, hasOwn }]) => (
            <ReactionBadge
              key={emoji}
              onClick={() => handleReactionClick(emoji)}
              $isOwn={hasOwn}
              title={hasOwn ? 'Click to remove reaction' : 'Click to add reaction'}
            >
              {emoji}
              <ReactionCount>{count}</ReactionCount>
            </ReactionBadge>
          ))}
        </ReactionsContainer>
      )}
    </MessageContainer>
  );
};

export default ChatMessage; 