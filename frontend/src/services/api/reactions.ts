import { apiRequest } from './utils';
import { Reaction } from '../../types';

export const getReactions = async (messageId: string): Promise<Reaction[]> => {
  return apiRequest(`/messages/${messageId}/reactions`, {
    method: 'GET'
  });
};

export const addReaction = async (messageId: string, emoji: string): Promise<Reaction> => {
  const requestData = { emoji };
  const body = JSON.stringify(requestData);
  console.debug(`Adding reaction - messageId: ${messageId}, emoji: ${emoji}, requestData:`, requestData, 'body:', body);
  return apiRequest(`/messages/${messageId}/reactions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body
  });
};

export const removeReaction = async (messageId: string, emoji: string): Promise<void> => {
  const encodedEmoji = encodeURIComponent(emoji);
  console.debug(`Removing reaction - messageId: ${messageId}, emoji: ${emoji}, encoded: ${encodedEmoji}`);
  return apiRequest(`/messages/${messageId}/reactions?emoji=${encodedEmoji}`, {
    method: 'DELETE',
    headers: {
      'Content-Type': 'application/json'
    }
  });
}; 