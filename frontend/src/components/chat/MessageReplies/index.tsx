import React, { useEffect } from 'react';
import styled from 'styled-components';
import { useSelector, useDispatch } from 'react-redux';
import { StoreMessage, RootState } from '../../../types';
import { transformMessage } from '../../../utils/messageTransform';
import Message from '../Message';
import { setReplies } from '../../../store/messages/messagesSlice';
import { getReplies } from '../../../services/api/chat';

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
  const dispatch = useDispatch();
  const users = useSelector((state: RootState) => state.chat?.users || {});
  const activeChannelId = useSelector((state: RootState) => state.chat.activeChannelId);

  // Load replies when expanded
  useEffect(() => {
    const loadReplies = async () => {
      if (!isExpanded || !activeChannelId || !parentId) return;

      try {
        const fetchedReplies = await getReplies(parentId);
        const transformedReplies = fetchedReplies.map(reply => transformMessage(reply));

        dispatch(setReplies({
          channelId: activeChannelId,
          messageId: parentId,
          replies: transformedReplies
        }));
      } catch (error) {
        console.error('Error loading replies:', error);
      }
    };

    loadReplies();
  }, [isExpanded, activeChannelId, parentId, dispatch]);

  // Sort replies by creation time
  const sortedReplies = [...replies].sort((a, b) => {
    const timeA = new Date(a.createdAt).getTime();
    const timeB = new Date(b.createdAt).getTime();
    return timeA - timeB;
  });

  return (
    <RepliesContainer isExpanded={isExpanded}>
      {sortedReplies.map((reply) => (
        <ReplyWrapper key={reply.id}>
          <Message
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