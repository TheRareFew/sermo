import { Message, RawMessage, StoreMessage } from '../types';

export const transformMessage = (message: RawMessage | Message): StoreMessage => ({
  id: message.id.toString(),
  content: message.content,
  channelId: message.channel_id.toString(),
  userId: message.sender_id.toString(),
  reactions: [],
  attachments: [],
  createdAt: message.created_at,
  updatedAt: message.updated_at || message.created_at,
  parentId: message.parent_id?.toString(),
  replyCount: message.reply_count || 0,
  isExpanded: false,
  repliesLoaded: false,
  replies: []
}); 