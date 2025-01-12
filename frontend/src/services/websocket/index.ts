import { Message, User, StoreMessage } from '../../types';
import { store } from '../../store';
import { addMessage, updateMessage } from '../../store/messages/messagesSlice';
import { updateUserStatus } from '../../store/chat/chatSlice';

// Get WebSocket URL from environment variable or fallback to localhost
const WS_BASE_URL = process.env.REACT_APP_WS_URL || 'ws://localhost:8000/ws';

// Helper function to get the correct WebSocket URL based on the current protocol
const getWebSocketUrl = () => {
  // If we're on HTTPS, use WSS
  if (window.location.protocol === 'https:' && WS_BASE_URL.startsWith('ws:')) {
    return WS_BASE_URL.replace('ws:', 'wss:');
  }
  return WS_BASE_URL;
};

interface WebSocketMessage {
  type: 'NEW_MESSAGE' | 'UPDATE_MESSAGE' | 'USER_STATUS' | 'PING' | 'PONG' | 'JOIN_CHANNEL' | 'LEAVE_CHANNEL';
  channelId?: string;
  message?: StoreMessage;
  id?: string;
  updates?: Partial<StoreMessage>;
  userId?: string;
  status?: 'online' | 'offline' | 'away' | 'busy';
  isReply?: boolean;
  parentId?: string;
}

export class WebSocketService {
  private static instance: WebSocketService | null = null;
  private ws: WebSocket | null = null;
  private pingInterval: NodeJS.Timeout | null = null;
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 5;
  private reconnectTimeout: NodeJS.Timeout | null = null;
  private channels: Set<string> = new Set();

  constructor() {
    if (WebSocketService.instance) {
      return WebSocketService.instance;
    }
    WebSocketService.instance = this;
  }

  private getAuthToken(): string | null {
    const state = store.getState();
    return state.auth?.token || null;
  }

  public connect() {
    if (this.ws?.readyState === WebSocket.OPEN) return;

    const token = this.getAuthToken();
    if (!token) {
      console.warn('No auth token available, skipping WebSocket connection');
      return;
    }

    const wsUrl = `${getWebSocketUrl()}?token=${token}`;
    console.log('Connecting to WebSocket:', wsUrl);
    
    try {
      this.ws = new WebSocket(wsUrl);
      
      this.ws.onopen = () => {
        console.log('WebSocket connected successfully');
        this.reconnectAttempts = 0;
        this.startPingInterval();
        
        // Rejoin all channels
        this.channels.forEach(channelId => {
          this.joinChannel(channelId);
        });
      };

      this.ws.onmessage = this.handleMessage.bind(this);
      this.ws.onclose = (event) => {
        console.log('WebSocket disconnected with code:', event.code);
        this.stopPingInterval();
        this.handleReconnect();
      };
      this.ws.onerror = (error) => {
        console.error('WebSocket error:', error);
      };
    } catch (error) {
      console.error('Error creating WebSocket connection:', error);
    }
  }

  private handleReconnect() {
    if (this.reconnectAttempts < this.maxReconnectAttempts) {
      this.reconnectAttempts++;
      console.log(`Attempting to reconnect (${this.reconnectAttempts}/${this.maxReconnectAttempts})`);
      this.reconnectTimeout = setTimeout(() => {
        this.connect();
      }, 5000);
    }
  }

  private startPingInterval() {
    this.pingInterval = setInterval(() => {
      if (this.ws?.readyState === WebSocket.OPEN) {
        this.ws.send(JSON.stringify({ type: 'PING' }));
      }
    }, 30000);
  }

  private stopPingInterval() {
    if (this.pingInterval) {
      clearInterval(this.pingInterval);
      this.pingInterval = null;
    }
  }

  public disconnect() {
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
    if (this.reconnectTimeout) {
      clearTimeout(this.reconnectTimeout);
      this.reconnectTimeout = null;
    }
    this.stopPingInterval();
  }

  private handleMessage(event: MessageEvent) {
    try {
      const data = JSON.parse(event.data) as WebSocketMessage;
      console.log('WebSocket message received:', data);

      switch (data.type) {
        case 'NEW_MESSAGE':
          if (data.channelId && data.message) {
            if (data.isReply && data.parentId) {
              // Handle reply message
              store.dispatch(addMessage({
                channelId: data.channelId,
                message: {
                  ...data.message,
                  parentId: data.parentId
                }
              }));
            } else {
              // Handle regular message
              store.dispatch(addMessage({
                channelId: data.channelId,
                message: data.message
              }));
            }
          }
          break;

        case 'UPDATE_MESSAGE':
          if (data.channelId && data.id && data.updates) {
            const updatedMessage = {
              id: data.id,
              ...data.updates
            } as StoreMessage;
            
            store.dispatch(updateMessage({
              channelId: data.channelId,
              id: data.id,
              message: updatedMessage
            }));
          }
          break;

        case 'USER_STATUS':
          if (data.userId && data.status) {
            store.dispatch(updateUserStatus({
              userId: data.userId,
              status: data.status
            }));
          }
          break;

        case 'PONG':
          // Handle pong response
          break;

        default:
          console.warn('Unknown message type:', data.type);
      }
    } catch (error) {
      console.error('Error handling WebSocket message:', error);
    }
  }

  public joinChannel(channelId: string) {
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify({
        type: 'JOIN_CHANNEL',
        channelId
      }));
      this.channels.add(channelId);
    }
  }

  public leaveChannel(channelId: string) {
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify({
        type: 'LEAVE_CHANNEL',
        channelId
      }));
      this.channels.delete(channelId);
    }
  }
}

export default new WebSocketService(); 