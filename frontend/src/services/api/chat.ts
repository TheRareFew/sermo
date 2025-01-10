import { Channel, Message, User } from '../../types';
import { apiRequest } from './utils';
import wsService from '../websocket';

interface ApiUser {
  id: string;
  username: string;
  status: 'online' | 'offline' | 'away' | 'busy';
  last_seen: string;
}

// Transform API user to our User type
const transformUser = (apiUser: ApiUser): User => ({
  id: apiUser.id,
  username: apiUser.username,
  email: `${apiUser.username}@example.com`, // Placeholder email since it's required
  full_name: apiUser.username, // Using username as full_name since it's required
  status: apiUser.status || 'offline',
  last_seen: apiUser.last_seen
});

interface CreateChannelParams {
  name: string;
  description?: string;
  is_public: boolean;
  member_ids?: string[];
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
  console.log(`Fetching messages for channel ${channelId} with limit ${limit} and skip ${skip}...`);
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
    console.log('Received messages:', messages);

    // Validate and transform messages
    const validMessages = messages
      .filter(msg => msg && msg.id && msg.content && msg.channel_id && msg.sender_id)
      .map(msg => ({
        ...msg,
        created_at: msg.created_at || new Date().toISOString(),
        is_system: msg.is_system || false
      }));

    console.log('Validated and transformed messages:', validMessages);
    return validMessages;
  } catch (error) {
    console.error(`Error fetching messages for channel ${channelId}:`, error);
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
    // Join channel through WebSocket
    await wsService.joinChannel(channelId);
    console.log(`Joined channel ${channelId}`);
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