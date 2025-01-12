import { WebSocketMessage } from '../../types';
import { getAuthToken } from '../api/auth';
import { store } from '../../store';
import { addMessage, setReplies } from '../../store/messages/messagesSlice';

// Add WebSocket message types
interface WebSocketJoinMessage {
  type: 'join_channel';
  channel_id: string;
}

interface WebSocketJoinResponse {
  type: 'channel_joined' | 'channel_join_error';
  channelId: string;
  error?: string;
}

class WebSocketService {
  private socket: WebSocket | null = null;
  private messageHandlers: ((message: WebSocketMessage) => void)[] = [];
  private errorHandlers: ((error: Error) => void)[] = [];
  private currentChannelId: string | null = null;
  private joinedChannels: Set<string> = new Set();
  private messageQueue: { channelId: string; content: string }[] = [];
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 5;
  private reconnectTimeout: NodeJS.Timeout | null = null;
  private isReconnecting = false;
  private connectionPromise: Promise<void> | null = null;
  private joinPromise: Promise<void> | null = null;
  private lastMessageId: string | null = null;
  private processingQueue = false;
  private heartbeatInterval: NodeJS.Timeout | null = null;
  private lastHeartbeatResponse: number = Date.now();

  public async connect(channelId: string): Promise<void> {
    if (this.isConnected() && this.isConnectedToChannel(channelId)) {
      console.log('[DEBUG] Already connected to channel:', channelId);
      return;
    }

    // Always disconnect before connecting to ensure clean state
    this.disconnect();
    this.currentChannelId = channelId;
    this.isReconnecting = false;
    this.reconnectAttempts = 0;
    
    try {
      const token = getAuthToken();
      if (!token) {
        throw new Error('No authentication token found');
      }

      console.log('[DEBUG] Connecting to WebSocket...');
      this.socket = new WebSocket(`ws://localhost:8000/ws/chat?token=${token}`);

      await new Promise<void>((resolve, reject) => {
        const timeout = setTimeout(() => {
          reject(new Error('WebSocket connection timeout'));
        }, 5000);

        if (this.socket) {
          this.socket.onopen = () => {
            console.log('[DEBUG] WebSocket connection opened');
            clearTimeout(timeout);
            this.startHeartbeat();
            resolve();
          };

          this.socket.onerror = (error) => {
            console.error('[DEBUG] WebSocket connection error:', error);
            clearTimeout(timeout);
            reject(error);
          };

          this.socket.onclose = this.handleClose;
        }
      });

      if (this.socket) {
        this.socket.onmessage = this.handleWebSocketMessage;
        console.log('[DEBUG] Joining channel:', channelId);
        await this.joinChannel(channelId);
        console.log('[DEBUG] Successfully joined channel:', channelId);
      }
      
    } catch (error) {
      console.error('[DEBUG] WebSocket connection failed:', error);
      this.handleError(error instanceof Error ? error : new Error('WebSocket connection failed'));
      throw error;
    }
  }

  private startHeartbeat(): void {
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
    }

    this.heartbeatInterval = setInterval(() => {
      if (!this.isConnected()) {
        return;
      }

      // Check if we haven't received a heartbeat response in 30 seconds
      if (Date.now() - this.lastHeartbeatResponse > 30000) {
        console.warn('No heartbeat response received, reconnecting...');
        this.reconnect();
        return;
      }

      try {
        this.socket?.send(JSON.stringify({ type: 'ping' }));
      } catch (error) {
        console.error('Error sending heartbeat:', error);
        this.reconnect();
      }
    }, 15000); // Send heartbeat every 15 seconds
  }

  private reconnect(): void {
    if (this.currentChannelId) {
      this.disconnect();
      this.connect(this.currentChannelId).catch(console.error);
    }
  }

  private handleClose = (event: CloseEvent) => {
    console.log('[DEBUG] WebSocket closed:', event.code, event.reason);
    if (this.socket === null) return;
    
    const wasConnected = this.socket.readyState === WebSocket.OPEN;
    this.socket = null;
    this.joinedChannels.clear();

    if (event.code !== 1000 && wasConnected) {
      if (!this.isReconnecting && this.reconnectAttempts < this.maxReconnectAttempts) {
        console.log('[DEBUG] Attempting reconnect after close');
        this.attemptReconnect();
      }
    }
  };

  public async joinChannel(channelId: string): Promise<void> {
    if (!this.socket || this.socket.readyState !== WebSocket.OPEN) {
      throw new Error('Cannot join channel: WebSocket is not connected');
    }

    if (this.isConnectedToChannel(channelId)) {
      console.log('[DEBUG] Already joined channel:', channelId);
      return;
    }

    return new Promise((resolve, reject) => {
      const joinMessage = {
        type: 'join',
        data: {
          channel_id: parseInt(channelId)
        }
      };
      
      const joinTimeout = setTimeout(() => {
        this.socket?.removeEventListener('message', handleJoinResponse);
        reject(new Error('Channel join timeout'));
      }, 10000);
      
      const handleJoinResponse = (event: MessageEvent) => {
        try {
          const data = JSON.parse(event.data);
          console.log('[DEBUG] Received join response:', data);
          
          if (data.type === 'joined' && data.data?.channel_id?.toString() === channelId) {
            clearTimeout(joinTimeout);
            this.socket?.removeEventListener('message', handleJoinResponse);
            this.joinedChannels.add(channelId);
            console.log('[DEBUG] Successfully joined channel:', channelId);
            resolve();
          } else if (data.type === 'error') {
            clearTimeout(joinTimeout);
            this.socket?.removeEventListener('message', handleJoinResponse);
            console.error('[DEBUG] Error joining channel:', data.message);
            reject(new Error(data.message));
          }
        } catch (error) {
          console.error('[DEBUG] Error handling join response:', error);
        }
      };

      if (this.socket) {
        this.socket.addEventListener('message', handleJoinResponse);
        console.log('[DEBUG] Sending join message:', joinMessage);
        this.socket.send(JSON.stringify(joinMessage));
      } else {
        clearTimeout(joinTimeout);
        reject(new Error('WebSocket not available'));
      }
    });
  }

  private handleError(error: Error): void {
    console.error('WebSocket error:', error);
    this.errorHandlers.forEach(handler => handler(error));
  }

  public isConnected(): boolean {
    return this.socket !== null && this.socket.readyState === WebSocket.OPEN;
  }

  private isConnectedToChannel(channelId: string): boolean {
    return this.isConnected() && this.joinedChannels.has(channelId) && this.currentChannelId === channelId;
  }

  public onMessage(handler: (message: WebSocketMessage) => void): () => void {
    this.messageHandlers.push(handler);
    return () => {
      this.messageHandlers = this.messageHandlers.filter(h => h !== handler);
    };
  }

  public onError(handler: (error: Error) => void): () => void {
    this.errorHandlers.push(handler);
    return () => {
      this.errorHandlers = this.errorHandlers.filter(h => h !== handler);
    };
  }

  public disconnect(): void {
    console.log('[DEBUG] Disconnecting WebSocket...');
    this.isReconnecting = false;
    if (this.reconnectTimeout) {
      clearTimeout(this.reconnectTimeout);
      this.reconnectTimeout = null;
    }
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
      this.heartbeatInterval = null;
    }
    if (this.socket && this.socket.readyState === WebSocket.OPEN) {
      this.socket.close(1000);
    }
    this.socket = null;
    this.joinedChannels.clear();
    this.messageHandlers = [];
    this.errorHandlers = [];
    this.reconnectAttempts = 0;
    this.connectionPromise = null;
    this.joinPromise = null;
    this.currentChannelId = null;
    console.log('[DEBUG] WebSocket disconnected and state cleared');
  }

  private async processMessageQueue(): Promise<void> {
    if (this.processingQueue || this.messageQueue.length === 0) return;

    this.processingQueue = true;
    console.log(`Processing message queue (${this.messageQueue.length} messages)`);

    while (this.messageQueue.length > 0) {
      const message = this.messageQueue[0];
      
      try {
        if (this.isConnectedToChannel(message.channelId)) {
          await this.sendMessage(message.channelId, message.content);
          this.messageQueue.shift(); // Remove the successfully sent message
        } else {
          // If we're not connected to the channel, try to connect
          try {
            await this.connect(message.channelId);
          } catch (error) {
            console.error('Failed to connect while processing queue:', error);
            break; // Stop processing if we can't connect
          }
        }
      } catch (error) {
        console.error('Failed to send queued message:', error);
        // If sending fails, leave the message in the queue and try again later
        break;
      }
    }

    this.processingQueue = false;
  }

  public async sendMessage(channelId: string, content: string): Promise<void> {
    console.log('Attempting to send message:', { channelId, content });

    if (!this.isConnectedToChannel(channelId)) {
      console.log('Not connected to channel, attempting to connect...');
      try {
        await this.connect(channelId);
      } catch (error) {
        console.error('Failed to connect:', error);
        throw error;
      }
    }

    const message = {
      type: 'message',
      data: {
        channel_id: parseInt(channelId),
        content: content
      }
    };

    if (!this.socket || this.socket.readyState !== WebSocket.OPEN) {
      console.error('WebSocket is not connected');
      throw new Error('WebSocket is not connected');
    }

    try {
      console.log('Sending WebSocket message:', message);
      this.socket.send(JSON.stringify(message));
      console.log('Message sent successfully');
    } catch (error) {
      console.error('Error sending message:', error);
      throw error;
    }
  }

  private async attemptReconnect(): Promise<void> {
    if (this.isReconnecting || this.reconnectAttempts >= this.maxReconnectAttempts) {
      console.log('Skipping reconnect: already reconnecting or max attempts reached');
      return;
    }

    this.isReconnecting = true;
    this.reconnectAttempts++;

    console.log(`Attempting to reconnect (attempt ${this.reconnectAttempts}/${this.maxReconnectAttempts})...`);

    if (this.currentChannelId) {
      const backoffTime = Math.min(1000 * Math.pow(2, this.reconnectAttempts - 1), 10000);
      
      if (this.reconnectTimeout) {
        clearTimeout(this.reconnectTimeout);
      }

      this.reconnectTimeout = setTimeout(async () => {
        try {
          await this.connect(this.currentChannelId!);
          this.isReconnecting = false;
          // Process any queued messages after successful reconnection
          await this.processMessageQueue();
        } catch (error) {
          console.error('Reconnection failed:', error);
          if (this.reconnectAttempts < this.maxReconnectAttempts) {
            this.isReconnecting = false; // Reset flag to allow next attempt
            this.attemptReconnect();
          } else {
            console.log('Max reconnection attempts reached');
            this.isReconnecting = false;
            this.handleError(new Error('Failed to reconnect after maximum attempts'));
          }
        }
      }, backoffTime);
    } else {
      this.isReconnecting = false;
    }
  }

  public getChatSocketState(): number {
    return this.socket?.readyState || WebSocket.CLOSED;
  }

  // Update message handler to track last message ID
  private handleWebSocketMessage = (event: MessageEvent) => {
    try {
      const message = JSON.parse(event.data) as WebSocketMessage;
      console.log('[DEBUG] WebSocket received raw message:', event.data);
      console.log('[DEBUG] WebSocket parsed message:', message);
      
      // Update heartbeat timestamp for any message
      this.lastHeartbeatResponse = Date.now();

      if (message.type === 'pong') {
        console.log('[DEBUG] Received pong message');
        return; // Ignore heartbeat responses
      }

      // Handle channel join responses separately
      if (message.type === 'joined') {
        const channelId = message.data?.channel_id?.toString();
        if (channelId) {
          console.log('[DEBUG] Channel joined:', channelId);
          this.joinedChannels.add(channelId);
        }
        return;
      }

      // For message events, update lastMessageId
      if (message.type === 'message' || message.type === 'message_sent' || 
          message.type === 'new_message' || message.type === 'message_updated') {
        if ('data' in message && typeof message.data === 'object' && message.data?.id) {
          this.lastMessageId = message.data.id.toString();
          console.log('[DEBUG] Updated last message ID:', this.lastMessageId);
        }
      }

      // Notify all handlers
      console.log('[DEBUG] Broadcasting message to handlers, count:', this.messageHandlers.length);
      this.messageHandlers.forEach(handler => {
        try {
          handler(message);
        } catch (error) {
          console.error('[DEBUG] Error in message handler:', error);
        }
      });
    } catch (error) {
      console.error('[DEBUG] Error handling WebSocket message:', error);
    }
  };

  public offMessage(handler: (message: WebSocketMessage) => void): void {
    this.messageHandlers = this.messageHandlers.filter(h => h !== handler);
  }

  public offError(handler: (error: Error) => void): void {
    this.errorHandlers = this.errorHandlers.filter(h => h !== handler);
  }
}

const wsService = new WebSocketService();
export default wsService; 