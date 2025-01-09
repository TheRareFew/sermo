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
  return apiRequest<Channel[]>('/api/channels/');
};

export const getChannelMessages = async (channelId: number, limit: number = 50): Promise<Message[]> => {
  return apiRequest<Message[]>(`/api/channels/${channelId}/messages?limit=${limit}`);
};

export const getChannelUsers = async (channelId: number): Promise<User[]> => {
  const apiUsers = await apiRequest<ApiUser[]>(`/api/channels/${channelId}/users`);
  return apiUsers.map(transformUser);
};

export const createChannel = async (name: string, description?: string): Promise<Channel> => {
  return apiRequest<Channel>('/api/channels/', {
    method: 'POST',
    body: JSON.stringify({ name, description }),
  });
};

export const joinChannel = async (channelId: number): Promise<void> => {
  await apiRequest(`/api/channels/${channelId}/join`, {
    method: 'POST',
  });
};

export const leaveChannel = async (channelId: number): Promise<void> => {
  await apiRequest(`/api/channels/${channelId}/leave`, {
    method: 'POST',
  });
}; 