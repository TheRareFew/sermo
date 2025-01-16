import { RawMessage, StoreMessage } from '../types';

const getChannelId = (message: RawMessage) => {
  return message.channel_id || message.channelId || '';
};

const getUserId = (message: RawMessage) => {
  return message.sender_id || message.userId || '';
};

const getCreatedAt = (message: RawMessage) => {
  return message.created_at || message.createdAt || new Date().toISOString();
};

const getUpdatedAt = (message: RawMessage) => {
  return message.updated_at || message.updatedAt || message.created_at || message.createdAt || new Date().toISOString();
};

const getParentId = (message: RawMessage) => {
  return message.parent_id || message.parentId || undefined;
};

const getReplyCount = (message: RawMessage) => {
  return message.reply_count || message.replyCount || 0;
};

export const transformMessage = (message: RawMessage): StoreMessage => {
  const created_at = getCreatedAt(message);
  const updated_at = getUpdatedAt(message);
  const channel_id = getChannelId(message);
  const sender_id = getUserId(message);
  const parent_id = getParentId(message);
  const reply_count = getReplyCount(message);

  return {
    id: message.id.toString(),
    content: message.content,
    channel_id,
    sender_id,
    created_at,
    updated_at,
    parent_id,
    reply_count,
    reactions: message.reactions || [],
    attachments: message.attachments || [],
    has_attachments: message.attachments?.length > 0 || false,
    is_bot: message.is_bot || false,
    isExpanded: false,
    replies: []
  };
}; 