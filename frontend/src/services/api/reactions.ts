import { apiRequest } from './utils';
import { Reaction } from '../../types';

export const getReactions = async (messageId: string): Promise<Reaction[]> => {
  return apiRequest(`/messages/${messageId}/reactions`, {
    method: 'GET'
  });
};

export const addReaction = async (messageId: string, emoji: string): Promise<Reaction> => {
  return apiRequest(`/messages/${messageId}/reactions`, {
    method: 'POST',
    body: JSON.stringify({ emoji })
  });
};

export const removeReaction = async (messageId: string, emoji: string): Promise<void> => {
  return apiRequest(`/messages/${messageId}/reactions`, {
    method: 'DELETE',
    body: JSON.stringify({ emoji })
  });
}; 