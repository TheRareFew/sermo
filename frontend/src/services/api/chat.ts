import { User, Channel, Message, ApiAuthResponse, RawReaction } from '../../types';
import { apiRequest } from './utils';
import { store } from '../../store';

interface ApiUser {
  id: string;
  username: string;
  email: string;
  full_name: string;
  status: 'online' | 'offline' | 'away' | 'busy';
  last_seen: string;
}

// Transform API user to our User type
const transformUser = (apiUser: ApiUser): User => ({
  id: apiUser.id,
  username: apiUser.username,
  status: apiUser.status || 'offline',
  avatar_url: undefined
});

interface CreateChannelParams {
  name: string;
  description?: string;
  is_public: boolean;
  member_ids?: string[];
}

interface SendMessageParams {
  content: string;
  channelId: string;
  parentId?: string;
  fileId?: number;
}

export const getChannels = async (): Promise<Channel[]> => {
  console.log('Fetching channels...');
  try {
    // All channels are accessible by default to all users
    const channels = await apiRequest<Channel[]>('/channels');
    console.log('Received channels:', channels);
    return channels;
  } catch (error) {
    console.error('Error fetching channels:', error);
    throw error;
  }
};

export const getChannelMessages = async (channelId: string, limit: number = 50, skip: number = 0): Promise<Message[]> => {
  console.log(`[DEBUG] Fetching messages for channel ${channelId} with limit ${limit} and skip ${skip}...`);
  try {
    if (!channelId) {
      throw new Error('Invalid channel ID');
    }

    if (limit <= 0) {
      throw new Error('Invalid limit value');
    }

    if (skip < 0) {
      throw new Error('Invalid skip value');
    }

    const messages = await apiRequest<Message[]>(`/channels/${channelId}/messages?limit=${limit}&skip=${skip}`);
    console.log('[DEBUG] Raw messages from API:', JSON.stringify(messages, null, 2));

    // Validate and transform messages
    const validMessages = messages
      .filter(msg => msg && msg.id && msg.content && msg.channel_id && msg.sender_id)
      .map(msg => {
        console.log('[DEBUG] Processing message:', {
          id: msg.id,
          content: msg.content.slice(0, 50),
          reactions: msg.reactions,
          parent_id: msg.parent_id
        });
        
        return {
          ...msg,
          created_at: msg.created_at || new Date().toISOString(),
          is_system: msg.is_system || false,
          parent_id: msg.parent_id || undefined,
          reply_count: msg.reply_count || 0,
          reactions: Array.isArray(msg.reactions) ? msg.reactions.map((r: RawReaction) => ({
            id: r.id?.toString() || `${msg.id}_${r.user_id || r.userId}_${r.emoji}`,
            messageId: msg.id.toString(),
            userId: (r.user_id || r.userId)?.toString() || '',
            emoji: r.emoji || '',
            createdAt: r.created_at || r.createdAt || new Date().toISOString()
          })) : [],
          attachments: Array.isArray(msg.attachments) ? msg.attachments : []
        };
      });

    console.log('[DEBUG] Validated and transformed messages:', JSON.stringify(validMessages, null, 2));
    return validMessages;
  } catch (error) {
    console.error(`[DEBUG] Error fetching messages for channel ${channelId}:`, error);
    throw error;
  }
};

export const getChannelUsers = async (channelId: string): Promise<User[]> => {
  console.log(`Fetching users for channel ${channelId}...`);
  try {
    const apiUsers = await apiRequest<ApiUser[]>(`/channels/${channelId}/members`);
    console.log('Received users:', apiUsers);
    const users = apiUsers.map(transformUser);
    console.log('Transformed users:', users);
    return users;
  } catch (error) {
    console.error(`Error fetching users for channel ${channelId}:`, error);
    throw error;
  }
};

export const createChannel = async (params: CreateChannelParams): Promise<Channel> => {
  console.log('Creating channel:', params);
  try {
    const channel = await apiRequest<Channel>('/channels', {
      method: 'POST',
      body: JSON.stringify(params),
    });
    console.log('Created channel:', channel);
    return channel;
  } catch (error) {
    console.error('Error creating channel:', error);
    throw error;
  }
};

export const joinChannel = async (channelId: string): Promise<void> => {
  console.log(`Joining channel ${channelId}...`);
  try {
    // Get the current user's ID from the auth state
    const currentUser = store.getState().auth.user;
    if (!currentUser) {
      throw new Error('No authenticated user');
    }

    const payload = {
      user_id: currentUser.id
    };
    console.log('[DEBUG] Join channel payload:', payload);

    // Add the current user as a member
    await apiRequest(`/channels/${channelId}/members`, {
      method: 'POST',
      body: JSON.stringify(payload),
    });
    console.log(`Channel ${channelId} joined`);
  } catch (error) {
    console.error(`Error joining channel ${channelId}:`, error);
    throw error;
  }
};

export const leaveChannel = async (channelId: string): Promise<void> => {
  console.log(`Leaving channel ${channelId}...`);
  try {
    await apiRequest(`/channels/${channelId}/leave`, {
      method: 'POST',
    });
    console.log(`Left channel ${channelId}`);
  } catch (error) {
    console.error(`Error leaving channel ${channelId}:`, error);
    throw error;
  }
};

export const addChannelMember = async (channelId: string, userId: string): Promise<void> => {
  console.log(`Adding user ${userId} to channel ${channelId}...`);
  try {
    await apiRequest(`/channels/${channelId}/members`, {
      method: 'POST',
      body: JSON.stringify({ user_id: userId }),
    });
    console.log(`Added user ${userId} to channel ${channelId}`);
  } catch (error) {
    console.error(`Error adding member to channel ${channelId}:`, error);
    throw error;
  }
};

export const removeChannelMember = async (channelId: string, userId: string): Promise<void> => {
  console.log(`Removing user ${userId} from channel ${channelId}...`);
  try {
    await apiRequest(`/channels/${channelId}/members/${userId}`, {
      method: 'DELETE',
    });
    console.log(`Removed user ${userId} from channel ${channelId}`);
  } catch (error) {
    console.error(`Error removing member from channel ${channelId}:`, error);
    throw error;
  }
};

export const deleteMessage = async (messageId: string): Promise<void> => {
  console.log(`Deleting message ${messageId}...`);
  try {
    await apiRequest(`/messages/${messageId}`, {
      method: 'DELETE',
    });
    console.log(`Message ${messageId} deleted successfully`);
  } catch (error) {
    console.error(`Error deleting message ${messageId}:`, error);
    throw error;
  }
};

export const getReplies = async (messageId: string): Promise<Message[]> => {
  console.log(`Fetching replies for message ${messageId}...`);
  try {
    const replies = await apiRequest<Message[]>(`/messages/${messageId}/replies`);
    console.log('Received replies:', replies);

    // Validate and transform replies
    const validReplies = replies
      .filter(msg => msg && msg.id && msg.content && msg.channel_id && msg.sender_id)
      .map(msg => ({
        ...msg,
        created_at: msg.created_at || new Date().toISOString(),
        is_system: msg.is_system || false
      }));

    console.log('Validated and transformed replies:', validReplies);
    return validReplies;
  } catch (error) {
    console.error(`Error fetching replies for message ${messageId}:`, error);
    throw error;
  }
};

export const createReply = async (messageId: string, content: string): Promise<Message> => {
  console.log(`Creating reply to message ${messageId}:`, content);
  try {
    // First get the parent message to ensure we use the correct channel
    const parentMessage = await apiRequest<Message>(`/messages/${messageId}`);
    const channelId = parentMessage.channel_id.toString();

    const reply = await apiRequest<Message>(`/messages/${messageId}/replies`, {
      method: 'POST',
      body: JSON.stringify({ 
        content,
        channel_id: channelId
      }),
    });

    return reply;
  } catch (error) {
    console.error(`Error creating reply to message ${messageId}:`, error);
    throw error;
  }
};

export const sendMessage = async (params: SendMessageParams): Promise<Message> => {
  console.log('Sending message:', params);
  try {
    let endpoint: string;
    
    if (params.parentId) {
      // If this is a reply, use the replies endpoint
      endpoint = `/messages/${params.parentId}/replies`;
    } else {
      // For regular messages, use the channel messages endpoint
      endpoint = `/channels/${params.channelId}/messages`;
    }

    const message = await apiRequest<Message>(endpoint, {
      method: 'POST',
      body: JSON.stringify({
        content: params.content,
        channel_id: params.channelId,
        file_ids: params.fileId ? [params.fileId] : undefined
      }),
    });
    console.log('Message sent:', message);
    return message;
  } catch (error) {
    console.error('Error sending message:', error);
    throw error;
  }
};

export const getMessagePosition = async (channelId: string, messageId: string): Promise<number> => {
  console.log(`Getting position for message ${messageId} in channel ${channelId}...`);
  try {
    const position = await apiRequest<number>(`/messages/${messageId}/position`);
    console.log(`Message position:`, position);
    return position;
  } catch (error) {
    console.error(`Error getting message position:`, error);
    throw error;
  }
}; 