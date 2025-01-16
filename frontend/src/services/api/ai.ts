import { api } from './base';

interface AiMessageRequest {
  message: string;
  channel_id: number;
  parent_message_id: number;
}

interface AiMessageResponse {
  response: string;
  message_id: string;
}

export const sendAiMessage = async (data: AiMessageRequest): Promise<AiMessageResponse> => {
  const response = await api.post<AiMessageResponse>('/api/ai/message', data);
  return response.data;
}; 