import { Channel, Message, User } from '../../types';
import { apiRequest } from './utils';

interface ApiUser {
  id: number;
  username: string;
  status: 'online' | 'offline' | 'away' | 'busy';
  last_seen: string;
}

// Transform API user to our User type
const transformUser = (apiUser: ApiUser): User => ({
  ...apiUser,
  email: '', // Set default values for required fields that the channel API doesn't provide
  full_name: apiUser.username, // Use username as full_name if not provided
});

export const getChannels = async (): Promise<Channel[]> => {
  console.log('Fetching channels...');
  try {
    const channels = await apiRequest<Channel[]>('/api/channels');
    console.log('Received channels:', channels);
    return channels;
  } catch (error) {
    console.error('Error fetching channels:', error);
    throw error;
  }
};

export const getChannelMessages = async (channelId: number, limit: number = 50, skip: number = 0): Promise<Message[]> => {
  console.log(`Fetching messages for channel ${channelId} with limit ${limit} and skip ${skip}...`);
  try {
    if (!channelId || channelId <= 0) {
      throw new Error('Invalid channel ID');
    }

    if (limit <= 0) {
      throw new Error('Invalid limit value');
    }

    if (skip < 0) {
      throw new Error('Invalid skip value');
    }

    const messages = await apiRequest<Message[]>(`/api/channels/${channelId}/messages?limit=${limit}&skip=${skip}`);
    console.log('Received messages:', messages);

    // Validate and transform messages
    const validMessages = messages
      .filter(msg => msg && msg.id && msg.content && msg.channel_id && msg.sender_id)
      .map(msg => ({
        id: Number(msg.id),
        content: msg.content,
        channel_id: Number(msg.channel_id),
        sender_id: Number(msg.sender_id),
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

export const getChannelUsers = async (channelId: number): Promise<User[]> => {
  console.log(`Fetching users for channel ${channelId}...`);
  try {
    const apiUsers = await apiRequest<ApiUser[]>(`/api/channels/${channelId}/users`);
    console.log('Received users:', apiUsers);
    const users = apiUsers.map(transformUser);
    console.log('Transformed users:', users);
    return users;
  } catch (error) {
    console.error(`Error fetching users for channel ${channelId}:`, error);
    throw error;
  }
};

export const createChannel = async (name: string, description?: string): Promise<Channel> => {
  console.log('Creating channel:', { name, description });
  try {
    const channel = await apiRequest<Channel>('/api/channels', {
      method: 'POST',
      body: JSON.stringify({ name, description }),
    });
    console.log('Created channel:', channel);
    return channel;
  } catch (error) {
    console.error('Error creating channel:', error);
    throw error;
  }
};

export const joinChannel = async (channelId: number): Promise<void> => {
  console.log(`Joining channel ${channelId}...`);
  try {
    await apiRequest(`/api/channels/${channelId}/join`, {
      method: 'POST',
    });
    console.log(`Joined channel ${channelId}`);
  } catch (error) {
    console.error(`Error joining channel ${channelId}:`, error);
    throw error;
  }
};

export const leaveChannel = async (channelId: number): Promise<void> => {
  console.log(`Leaving channel ${channelId}...`);
  try {
    await apiRequest(`/api/channels/${channelId}/leave`, {
      method: 'POST',
    });
    console.log(`Left channel ${channelId}`);
  } catch (error) {
    console.error(`Error leaving channel ${channelId}:`, error);
    throw error;
  }
}; 