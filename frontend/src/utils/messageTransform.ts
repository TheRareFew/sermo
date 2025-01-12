import { RawMessage, StoreMessage, Reaction, Message, Attachment } from '../types';

export const transformMessage = (message: RawMessage | Message): StoreMessage => {
  console.log('Transforming message:', message);
  
  // Ensure reactions is an array
  const reactions = Array.isArray(message.reactions) ? message.reactions : [];
  console.log('Transformed reactions:', reactions);

  // Transform attachments
  const transformAttachments = (attachments: any[]): Attachment[] => {
    return attachments.map(attachment => ({
      id: attachment.id,
      filename: attachment.filename,
      file_type: attachment.file_type,
      file_path: attachment.file_path,
      message_id: attachment.message_id,
      file_size: attachment.file_size || 0,
      created_at: attachment.created_at || new Date().toISOString(),
      updated_at: attachment.updated_at || new Date().toISOString()
    }));
  };
  
  // Handle both Message and RawMessage types with proper type guards
  const getChannelId = (): string => {
    if ('channel_id' in message && message.channel_id) return message.channel_id;
    if ('channelId' in message && message.channelId) return message.channelId;
    return '';
  };
  
  const getUserId = (): string => {
    if ('sender_id' in message && message.sender_id) return message.sender_id;
    if ('userId' in message && message.userId) return message.userId;
    return '';
  };
  
  const getCreatedAt = (): string => {
    if ('created_at' in message && message.created_at) return message.created_at;
    if ('createdAt' in message && message.createdAt) return message.createdAt;
    return new Date().toISOString();
  };
  
  const getUpdatedAt = (createdAt: string): string => {
    if ('updated_at' in message && message.updated_at) return message.updated_at;
    if ('updatedAt' in message && message.updatedAt) return message.updatedAt;
    return createdAt;
  };
  
  const getParentId = (): string | undefined => {
    if ('parent_id' in message && message.parent_id) return message.parent_id;
    if ('parentId' in message && message.parentId) return message.parentId;
    return undefined;
  };
  
  const getReplyCount = (): number => {
    if ('reply_count' in message && typeof message.reply_count === 'number') return message.reply_count;
    if ('replyCount' in message && typeof message.replyCount === 'number') return message.replyCount;
    return 0;
  };
  
  const createdAt = getCreatedAt();
  
  return {
    id: message.id.toString(),
    content: message.content,
    channelId: getChannelId().toString(),
    userId: getUserId().toString(),
    createdAt,
    updatedAt: getUpdatedAt(createdAt),
    parentId: getParentId(),
    replyCount: getReplyCount(),
    isExpanded: 'isExpanded' in message ? !!message.isExpanded : false,
    repliesLoaded: 'repliesLoaded' in message ? !!message.repliesLoaded : false,
    replies: 'replies' in message && Array.isArray(message.replies) ? message.replies : [],
    reactions,
    attachments: Array.isArray(message.attachments) ? transformAttachments(message.attachments) : [],
    has_attachments: 'has_attachments' in message ? message.has_attachments : false
  };
}; 