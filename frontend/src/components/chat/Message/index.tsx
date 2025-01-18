import React, { useState, useCallback, useRef, useEffect } from 'react';
import styled from 'styled-components';
import MessageOptions from '../../chat/MessageOptions';
import FilePreview from '../FilePreview';
import { Reaction, Attachment } from '../../../types';
import { getMessageFiles } from '../../../services/api/files';
import { elevenLabsService } from '../../../utils/elevenLabs';

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
  attachments?: Attachment[];
  has_attachments?: boolean;
  is_bot?: boolean;
  onContentLoad?: () => void;
}

const Sender = styled.span<{ $is_bot?: boolean }>`
  color: ${props => props.$is_bot && props.children === 'lain' ? '#ff00ff' : '#0f0'};
  font-weight: bold;
`;

const MessageContainer = styled.div<{ $isReply: boolean }>`
  font-family: 'Courier New', monospace;
  padding: 0;
  color: #fff;
  position: relative;
  margin-left: ${props => props.$isReply ? '20px' : '0'};
  border-left: ${props => props.$isReply ? '2px solid #333' : 'none'};

  &:hover {
    background-color: #2a2a2a;
  }
`;

const MessageContent = styled.div`
  display: flex;
  flex-direction: column;
  gap: 0;
  position: relative;
  padding: 0 4px;
`;

const MessageRow = styled.div`
  display: flex;
  flex-wrap: wrap;
  align-items: flex-start;
  gap: 2px;
  row-gap: 0;
`;

const MessageText = styled.div`
  flex: 1;
  min-width: 300px; /* Force wrap on longer messages */
  white-space: pre-wrap;
  word-wrap: break-word;
  display: flex;
  align-items: flex-start;
  gap: 4px;
`;

const ButtonsContainer = styled.div`
  display: flex;
  align-items: center;
  gap: 2px;
  margin-left: auto; /* Push to the right */
  flex-shrink: 0;
`;

const OptionsWrapper = styled.div`
  flex-shrink: 0;
`;

const ReactionsContainer = styled.div`
  display: flex;
  flex-wrap: wrap;
  gap: 1px;
  align-items: center;
  margin-left: 2px;
  margin-top: 0;
`;

const Timestamp = styled.span`
  color: #888;
`;

const ReplyCount = styled.button`
  background: none;
  border: none;
  color: #888;
  cursor: pointer;
  font-family: inherit;
  padding: 0 2px;
  font-size: inherit;

  &:hover {
    color: #fff;
  }
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

const AttachmentsContainer = styled.div`
  display: flex;
  flex-direction: column;
  gap: 1px;
  margin-left: 2px;
  margin-top: 0;
`;

const AttachmentIcon = styled.span`
  color: #888;
  cursor: pointer;
  margin-right: 4px;
  flex-shrink: 0;
  
  &:hover {
    color: #fff;
  }
`;

interface VoiceIndicatorProps {
  $isPlaying: boolean;
}

const VoiceIndicator = styled.span<VoiceIndicatorProps>`
  color: #ff00ff;
  margin-left: 4px;
  cursor: pointer;
  opacity: ${props => props.$isPlaying ? 1 : 0.6};

  &:hover {
    opacity: 1;
  }
`;

const Tooltip = styled.div`
  position: absolute;
  background-color: #ff0000;
  color: white;
  padding: 4px 8px;
  border-radius: 4px;
  font-size: 12px;
  z-index: 1000;
  max-width: 200px;
  word-wrap: break-word;
  top: -20px;
  left: 50%;
  transform: translateX(-50%);
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
  attachments = [],
  has_attachments = false,
  is_bot = false,
  onContentLoad,
}) => {
  const [showAttachments, setShowAttachments] = useState(false);
  const [loadedAttachments, setLoadedAttachments] = useState<Attachment[]>(attachments);
  const [isLoadingAttachments, setIsLoadingAttachments] = useState(false);
  const messageRef = useRef<HTMLDivElement>(null);
  const [isPlayingVoice, setIsPlayingVoice] = useState(false);
  const [playbackError, setPlaybackError] = useState<string | null>(null);
  const errorTimeoutRef = useRef<NodeJS.Timeout>();

  useEffect(() => {
    if (is_bot && content && onContentLoad) {
      onContentLoad();
    }
  }, [is_bot, content, onContentLoad]);

  useEffect(() => {
    return () => {
      if (errorTimeoutRef.current) {
        clearTimeout(errorTimeoutRef.current);
      }
    };
  }, []);

  const handleAttachmentToggle = useCallback(async () => {
    if (!has_attachments) return;

    setShowAttachments(!showAttachments);
    if (!showAttachments && loadedAttachments.length === 0) {
      setIsLoadingAttachments(true);
      try {
        const files = await getMessageFiles(id);
        setLoadedAttachments(files);
        // Notify parent that content has loaded
        if (onContentLoad) {
          onContentLoad();
        }
      } catch (error) {
        console.error('Failed to load attachments:', error);
      } finally {
        setIsLoadingAttachments(false);
      }
    } else if (onContentLoad) {
      // If attachments are already loaded, notify parent immediately
      onContentLoad();
    }
  }, [id, has_attachments, showAttachments, loadedAttachments.length, onContentLoad]);

  const handleVoicePlayback = useCallback(async () => {
    if (!is_bot || !sender || typeof sender !== 'string' || sender.toLowerCase() !== 'lain' || isPlayingVoice) return;
    
    try {
      setPlaybackError(null);
      setIsPlayingVoice(true);
      await elevenLabsService.playTextAudio(content);
    } catch (error) {
      console.error('Error playing voice:', error);
      const errorMessage = error instanceof Error ? error.message : 'Failed to play voice message';
      setPlaybackError(errorMessage);
      
      // Clear error after 5 seconds
      errorTimeoutRef.current = setTimeout(() => {
        setPlaybackError(null);
      }, 5000);
    } finally {
      setIsPlayingVoice(false);
    }
  }, [content, sender, is_bot, isPlayingVoice]);

  const formattedTime = new Date(timestamp).toLocaleTimeString([], { 
    hour: '2-digit', 
    minute: '2-digit',
    second: '2-digit',
    hour12: false
  });

  const isOwnMessage = userId === currentUserId;

  // Group reactions by emoji
  const groupedReactions = (reactions || []).reduce((acc, reaction) => {
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

  const handleReactionClick = async (emoji: string) => {
    const reaction = groupedReactions[emoji];
    if (reaction?.hasOwn) {
      onReactionRemove?.(emoji);
    } else {
      onReactionAdd?.(emoji);
    }
  };

  return (
    <MessageContainer ref={messageRef} $isReply={isReply}>
      <MessageContent>
        <MessageRow>
          <MessageText>
            {has_attachments && (
              <AttachmentIcon onClick={handleAttachmentToggle} title="Toggle attachments">
                📎
              </AttachmentIcon>
            )}
            <div>
              <Sender $is_bot={is_bot}>{sender}</Sender> [{formattedTime}]: {content}
              {is_bot && sender && typeof sender === 'string' && sender.toLowerCase() === 'lain' && (
                <VoiceIndicator 
                  onClick={handleVoicePlayback}
                  $isPlaying={isPlayingVoice}
                  title={isPlayingVoice ? "Playing voice..." : "Play voice"}
                >
                  {isPlayingVoice ? '🔊' : '🔈'}
                </VoiceIndicator>
              )}
              {playbackError && (
                <Tooltip>
                  {playbackError}
                </Tooltip>
              )}
            </div>
          </MessageText>
          <ButtonsContainer>
            {replyCount > 0 && (
              <ReplyCount onClick={onToggleReplies}>
                [{isExpanded ? '-' : '+'} {replyCount} {replyCount === 1 ? 'reply' : 'replies'}]
              </ReplyCount>
            )}
            <OptionsWrapper>
              <MessageOptions
                messageId={id}
                onDelete={onDelete}
                onReply={onReply}
                canDelete={isOwnMessage}
                canReply={!is_bot}
                onReactionAdd={onReactionAdd}
                onReactionRemove={onReactionRemove}
              />
            </OptionsWrapper>
          </ButtonsContainer>
        </MessageRow>
        {Object.entries(groupedReactions).length > 0 && (
          <ReactionsContainer>
            {Object.entries(groupedReactions).map(([emoji, { count, hasOwn }]) => (
              <ReactionBadge
                key={emoji}
                onClick={() => handleReactionClick(emoji)}
                $isOwn={hasOwn}
                title={`${hasOwn ? 'Remove' : 'Add'} reaction`}
              >
                {emoji} <ReactionCount>{count}</ReactionCount>
              </ReactionBadge>
            ))}
          </ReactionsContainer>
        )}
      </MessageContent>
      {showAttachments && loadedAttachments.length > 0 && (
        <AttachmentsContainer>
          {loadedAttachments.map((attachment) => (
            <FilePreview
              key={attachment.id}
              fileId={attachment.id}
              filename={attachment.filename}
              fileType={attachment.file_type}
              filePath={attachment.file_path}
              fileSize={attachment.file_size}
              onLoad={onContentLoad}
            />
          ))}
        </AttachmentsContainer>
      )}
    </MessageContainer>
  );
};

export default ChatMessage; 