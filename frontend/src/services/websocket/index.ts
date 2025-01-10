import { getAuthToken } from '../api/auth';

const WS_URL = process.env.REACT_APP_WS_URL || 'ws://localhost:8000/ws';

export interface WebSocketMessage {
  type: string;
  message?: {
    id: number;
    content: string;
    sender_id: number;
    channel_id: number;
    created_at: string;
  };
  user_id?: number;
  status?: 'online' | 'offline' | 'away' | 'busy';
  [key: string]: any;
}

export class WebSocketService {
  private chatSocket: WebSocket | null = null;
  private presenceSocket: WebSocket | null = null;
  private messageHandlers: ((message: WebSocketMessage) => void)[] = [];
  private presenceHandlers: ((message: WebSocketMessage) => void)[] = [];
  private reconnectTimeout: NodeJS.Timeout | null = null;
  private readonly RECONNECT_DELAY = 5000; // 5 seconds

  constructor() {
    // Bind methods
    this.connect = this.connect.bind(this);
    this.disconnect = this.disconnect.bind(this);
    this.sendMessage = this.sendMessage.bind(this);
    this.updateStatus = this.updateStatus.bind(this);
    this.joinChannel = this.joinChannel.bind(this);
    this.leaveChannel = this.leaveChannel.bind(this);
  }

  public connect(): void {
    const token = getAuthToken();
    if (!token) {
      console.error('No auth token available');
      return;
    }

    // Connect to chat WebSocket
    try {
      if (this.chatSocket?.readyState === WebSocket.OPEN) {
        console.log('Chat WebSocket already connected');
        return;
      }

      console.log('Connecting to chat WebSocket...');
      this.chatSocket = new WebSocket(`${WS_URL}/chat?token=${encodeURIComponent(token)}`);
      this.setupWebSocketHandlers(this.chatSocket, 'chat');
    } catch (error) {
      console.error('Failed to connect to chat WebSocket:', error);
    }

    // Connect to presence WebSocket
    try {
      if (this.presenceSocket?.readyState === WebSocket.OPEN) {
        console.log('Presence WebSocket already connected');
        return;
      }

      console.log('Connecting to presence WebSocket...');
      this.presenceSocket = new WebSocket(`${WS_URL}/presence?token=${encodeURIComponent(token)}`);
      this.setupWebSocketHandlers(this.presenceSocket, 'presence');
    } catch (error) {
      console.error('Failed to connect to presence WebSocket:', error);
    }
  }

  private setupWebSocketHandlers(socket: WebSocket, type: 'chat' | 'presence'): void {
    socket.onopen = () => {
      console.log(`${type} WebSocket connected`);
    };

    socket.onmessage = (event) => {
      try {
        const message = JSON.parse(event.data);
        console.log(`Received ${type} message:`, message);
        if (type === 'chat') {
          this.messageHandlers.forEach(handler => {
            try {
              handler(message);
            } catch (error) {
              console.error('Error in message handler:', error);
            }
          });
        } else {
          this.presenceHandlers.forEach(handler => {
            try {
              handler(message);
            } catch (error) {
              console.error('Error in presence handler:', error);
            }
          });
        }
      } catch (error) {
        console.error(`Failed to parse ${type} message:`, error, event.data);
      }
    };

    socket.onclose = (event) => {
      console.log(`${type} WebSocket closed with code ${event.code}. Attempting to reconnect...`);
      if (event.code === 4001) {
        console.error('Authentication failed. Please log in again.');
        // Trigger logout or auth refresh here if needed
        return;
      }
      this.scheduleReconnect();
    };

    socket.onerror = (error) => {
      console.error(`${type} WebSocket error:`, error);
      this.scheduleReconnect();
    };
  }

  public disconnect(): void {
    if (this.chatSocket) {
      this.chatSocket.close();
      this.chatSocket = null;
    }
    if (this.presenceSocket) {
      this.presenceSocket.close();
      this.presenceSocket = null;
    }
    if (this.reconnectTimeout) {
      clearTimeout(this.reconnectTimeout);
      this.reconnectTimeout = null;
    }
  }

  public sendMessage(channelId: number, content: string): void {
    if (!this.chatSocket || this.chatSocket.readyState !== WebSocket.OPEN) {
      console.error('Chat WebSocket is not connected. State:', this.chatSocket?.readyState);
      return;
    }

    if (!channelId || !content.trim()) {
      console.error('Invalid message parameters:', { channelId, content });
      return;
    }

    const message = {
      type: 'message',
      channel_id: channelId,
      content: content.trim()
    };

    try {
      console.log('Sending WebSocket message:', message);
      this.chatSocket.send(JSON.stringify(message));
    } catch (error) {
      console.error('Failed to send message:', error);
      // Try to reconnect
      this.connect();
    }
  }

  public updateStatus(status: 'online' | 'offline' | 'away' | 'busy'): void {
    if (!this.presenceSocket || this.presenceSocket.readyState !== WebSocket.OPEN) {
      console.error('Presence WebSocket is not connected');
      return;
    }

    const message = {
      type: 'status_update',
      status
    };

    this.presenceSocket.send(JSON.stringify(message));
  }

  public joinChannel(channelId: number): void {
    if (!this.chatSocket || this.chatSocket.readyState !== WebSocket.OPEN) {
      console.error('Chat WebSocket is not connected');
      return;
    }

    const message = {
      type: 'join_channel',
      channel_id: channelId
    };

    this.chatSocket.send(JSON.stringify(message));
  }

  public leaveChannel(channelId: number): void {
    if (!this.chatSocket || this.chatSocket.readyState !== WebSocket.OPEN) {
      console.error('Chat WebSocket is not connected');
      return;
    }

    const message = {
      type: 'leave_channel',
      channel_id: channelId
    };

    this.chatSocket.send(JSON.stringify(message));
  }

  public onMessage(handler: (message: WebSocketMessage) => void): () => void {
    this.messageHandlers.push(handler);
    return () => {
      this.messageHandlers = this.messageHandlers.filter(h => h !== handler);
    };
  }

  public onPresence(handler: (message: WebSocketMessage) => void): () => void {
    this.presenceHandlers.push(handler);
    return () => {
      this.presenceHandlers = this.presenceHandlers.filter(h => h !== handler);
    };
  }

  private scheduleReconnect(): void {
    if (this.reconnectTimeout) {
      clearTimeout(this.reconnectTimeout);
    }
    this.reconnectTimeout = setTimeout(() => {
      console.log('Attempting to reconnect WebSocket...');
      this.connect();
    }, this.RECONNECT_DELAY);
  }

  public getChatSocketState(): number | null {
    return this.chatSocket?.readyState ?? null;
  }

  public getPresenceSocketState(): number | null {
    return this.presenceSocket?.readyState ?? null;
  }
}

// Create a singleton instance
const wsService = new WebSocketService();
export default wsService; 