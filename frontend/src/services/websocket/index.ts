import { WebSocketMessage } from '../../types';
import { getAuthToken } from '../api/auth';

class WebSocketService {
  private socket: WebSocket | null = null;
  private messageHandlers: ((message: WebSocketMessage) => void)[] = [];

  connect() {
    if (this.socket?.readyState === WebSocket.OPEN) {
      console.log('WebSocket already connected');
      return;
    }

    const token = getAuthToken();
    if (!token) {
      console.error('No auth token available for WebSocket connection');
      return;
    }

    const baseWsUrl = process.env.REACT_APP_WS_URL || 'ws://localhost:8000/ws/chat';
    const wsUrl = `${baseWsUrl}?token=${token}`;
    console.log('Connecting to WebSocket with URL:', wsUrl);
    
    this.socket = new WebSocket(wsUrl);

    this.socket.onopen = () => {
      console.log('WebSocket connected');
    };

    this.socket.onmessage = (event) => {
      try {
        const message = JSON.parse(event.data) as WebSocketMessage;
        console.log('WebSocket message received:', message);
        this.messageHandlers.forEach(handler => handler(message));
      } catch (error) {
        console.error('Error parsing WebSocket message:', error);
      }
    };

    this.socket.onerror = (error) => {
      console.error('WebSocket error:', error);
    };

    this.socket.onclose = (event) => {
      console.log('WebSocket disconnected with code:', event.code);
      this.socket = null;

      // If the connection was closed due to authentication failure (403),
      // don't attempt to reconnect immediately
      if (event.code !== 1003) { // 1003 is close code for "Unsupported"
        // Try to reconnect after a delay
        setTimeout(() => {
          console.log('Attempting to reconnect WebSocket...');
          this.connect();
        }, 5000); // Wait 5 seconds before reconnecting
      }
    };
  }

  disconnect() {
    if (this.socket) {
      this.socket.close();
      this.socket = null;
    }
  }

  sendMessage(channelId: string, content: string) {
    if (this.socket?.readyState === WebSocket.OPEN) {
      const message = {
        type: 'message',
        channel_id: channelId,
        content: content
      };
      this.socket.send(JSON.stringify(message));
    } else {
      console.error('WebSocket is not connected');
    }
  }

  onMessage(handler: (message: WebSocketMessage) => void) {
    this.messageHandlers.push(handler);
    return () => {
      this.messageHandlers = this.messageHandlers.filter(h => h !== handler);
    };
  }

  getChatSocketState() {
    return this.socket?.readyState || WebSocket.CLOSED;
  }
}

const wsService = new WebSocketService();
export default wsService; 