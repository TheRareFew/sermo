import { getAuthToken } from '../api/auth';

const WS_URL = process.env.REACT_APP_WS_URL || 'ws://localhost:8000/ws';

interface WebSocketMessage {
  type: string;
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
    this.chatSocket = new WebSocket(`${WS_URL}/chat?token=${encodeURIComponent(token)}`);
    this.setupWebSocketHandlers(this.chatSocket, 'chat');

    // Connect to presence WebSocket
    this.presenceSocket = new WebSocket(`${WS_URL}/presence?token=${encodeURIComponent(token)}`);
    this.setupWebSocketHandlers(this.presenceSocket, 'presence');
  }

  private setupWebSocketHandlers(socket: WebSocket, type: 'chat' | 'presence'): void {
    socket.onopen = () => {
      console.log(`${type} WebSocket connected`);
    };

    socket.onmessage = (event) => {
      try {
        const message = JSON.parse(event.data);
        if (type === 'chat') {
          this.messageHandlers.forEach(handler => handler(message));
        } else {
          this.presenceHandlers.forEach(handler => handler(message));
        }
      } catch (error) {
        console.error(`Failed to parse ${type} message:`, error);
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
      console.error('Chat WebSocket is not connected');
      return;
    }

    const message = {
      type: 'message',
      channel_id: channelId,
      content
    };

    this.chatSocket.send(JSON.stringify(message));
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
}

// Create a singleton instance
const wsService = new WebSocketService();
export default wsService; 