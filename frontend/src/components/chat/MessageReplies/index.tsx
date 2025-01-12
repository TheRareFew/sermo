import React, { useEffect } from 'react';
import styled from 'styled-components';
import { useDispatch, useSelector } from 'react-redux';
import { RootState, StoreMessage, User } from '../../../types';
import { transformMessage } from '../../../utils/messageTransform';
import Message from '../Message';
import { updateMessage } from '../../../store/messages/messagesSlice';
import { getReplies } from '../../../services/api/chat';

interface MessageRepliesProps {
  parentId: string;
  replies?: StoreMessage[];
  currentUserId?: string;
  isExpanded: boolean;
  onToggleReplies: () => void;
  onDelete: (messageId: string) => void;
}

const RepliesContainer = styled.div<{ isExpanded: boolean }>`
  margin-left: 24px;
  border-left: 1px solid ${props => props.theme.colors.border};
  padding-left: 8px;
  display: ${props => props.isExpanded ? 'block' : 'none'};
`;

const ReplyWrapper = styled.div`
  margin-top: 4px;
`;

const LoadingIndicator = styled.div`
  color: ${props => props.theme.colors.textLight};
  font-family: 'Courier New', monospace;
  padding: 4px 0;
`;

const MessageReplies: React.FC<MessageRepliesProps> = ({
  parentId,
  replies = [],
  currentUserId,
  isExpanded,
  onToggleReplies,
  onDelete
}) => {
  const dispatch = useDispatch();
  const [isLoading, setIsLoading] = React.useState(false);
  const { users } = useSelector((state: RootState) => ({
    users: state.chat.users as { [key: string]: User }
  }));

  console.log('MessageReplies render:', {
    parentId,
    replies,
    isExpanded,
    isLoading
  });

  useEffect(() => {
    const loadReplies = async () => {
      if (!isExpanded || (replies && replies.length > 0)) {
        console.log('Skipping reply load:', {
          isExpanded,
          repliesLength: replies?.length
        });
        return;
      }
      
      console.log('Loading replies for message:', parentId);
      setIsLoading(true);
      try {
        const fetchedReplies = await getReplies(parentId);
        console.log('Fetched replies:', fetchedReplies);
        const transformedReplies = fetchedReplies.map(transformMessage);
        
        // Update the parent message with the new replies
        if (transformedReplies.length > 0) {
          console.log('Updating message with replies:', {
            channelId: transformedReplies[0]?.channelId,
            messageId: parentId,
            replies: transformedReplies
          });
          
          dispatch(updateMessage({
            channelId: transformedReplies[0]?.channelId,
            messageId: parentId,
            message: {
              replies: transformedReplies,
              repliesLoaded: true,
              isExpanded: true
            }
          }));
        }
      } catch (error) {
        console.error('Failed to load replies:', error);
      } finally {
        setIsLoading(false);
      }
    };

    loadReplies();
  }, [dispatch, isExpanded, parentId, replies]);

  // Sort replies by creation time
  const sortedReplies = [...(replies || [])].sort(
    (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
  );

  if (!isExpanded) {
    return null;
  }

  return (
    <RepliesContainer isExpanded={isExpanded}>
      {isLoading ? (
        <LoadingIndicator>Loading replies...</LoadingIndicator>
      ) : (
        sortedReplies.map((reply) => (
          <ReplyWrapper key={reply.id}>
            <Message
              id={reply.id}
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
              isReply={true}
              reactions={reply.reactions || []}
              onReactionAdd={() => {}}
              onReactionRemove={() => {}}
            />
          </ReplyWrapper>
        ))
      )}
    </RepliesContainer>
  );
};

export default MessageReplies; 