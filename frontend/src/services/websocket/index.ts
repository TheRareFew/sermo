import { WebSocketMessage, WebSocketChannelJoinMessage, WebSocketChannelMessage, StoreMessage } from '../../types';
import { getAuthToken } from '../api/auth';
import { store } from '../../store';
import { addMessage, setReplies } from '../../store/messages/messagesSlice';

class WebSocketService {
  private socket: WebSocket | null = null;
  private messageHandlers: ((message: WebSocketMessage) => void)[] = [];
  private errorHandlers: ((error: { code: string; message: string }) => void)[] = [];
  private currentChannelId: string | null = null;
  private joinedChannels: Set<string> = new Set();
  private processedMessageIds: Set<string> = new Set();
  private reconnectAttempts: number = 0;
  private maxReconnectAttempts: number = 5;
  private reconnectTimeout: NodeJS.Timeout | null = null;
  private isReconnecting: boolean = false;
  private messageQueue: { channelId: string; content: string }[] = [];
  private joinChannelResolvers: Map<string, { resolve: () => void; reject: (error: Error) => void }> = new Map();
  private pendingChannels: Set<string> = new Set();

  private getReconnectDelay(): number {
    // Exponential backoff: 1s, 2s, 4s, 8s, 16s
    return Math.min(1000 * Math.pow(2, this.reconnectAttempts), 16000);
  }

  private async attemptReconnect(channelId: string) {
    if (this.isReconnecting) {
      console.log('Already attempting to reconnect...');
      return;
    }

    this.isReconnecting = true;
    
    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      console.error('Max reconnection attempts reached');
      this.errorHandlers.forEach(handler => handler({
        code: 'MAX_RECONNECT_ATTEMPTS',
        message: 'Unable to reconnect after multiple attempts. Please refresh the page.'
      }));
      this.isReconnecting = false;
      return;
    }

    console.log(`Attempting to reconnect (attempt ${this.reconnectAttempts + 1}/${this.maxReconnectAttempts})...`);
    
    try {
      // Add a small delay before reconnecting
      await new Promise(resolve => setTimeout(resolve, this.getReconnectDelay()));
      
      // Store the current channels before reconnecting
      const channelsToRejoin = Array.from(this.joinedChannels);
      
      // Connect to the initial channel
      await this.connect(channelId);
      
      // After successful connection, join all previously joined channels
      for (const channel of channelsToRejoin) {
        if (channel !== channelId) {
          try {
            await this.joinChannel(channel);
          } catch (error) {
            console.error(`Failed to rejoin channel ${channel}:`, error);
          }
        }
      }
      
      this.reconnectAttempts = 0;
      this.isReconnecting = false;
    } catch (error) {
      this.reconnectAttempts++;
      this.isReconnecting = false;
      
      // Schedule next reconnection attempt
      const delay = this.getReconnectDelay();
      console.log(`Scheduling next reconnection attempt in ${delay}ms`);
      this.reconnectTimeout = setTimeout(() => {
        this.attemptReconnect(channelId);
      }, delay);
    }
  }

  private handleError(error: unknown): void {
    console.error('WebSocket error:', error);
    const errorObj = {
      code: error instanceof Error ? error.name : 'UNKNOWN_ERROR',
      message: error instanceof Error ? error.message : String(error)
    };
    this.errorHandlers.forEach(handler => {
      try {
        handler(errorObj);
      } catch (handlerError) {
        console.error('Error in error handler:', handlerError);
      }
    });
  }

  connect(channelId: string) {
    return new Promise<void>((resolve, reject) => {
      // Clear any existing reconnection timeout
      if (this.reconnectTimeout) {
        clearTimeout(this.reconnectTimeout);
        this.reconnectTimeout = null;
      }

      // If already connected to this channel, do nothing
      if (this.socket?.readyState === WebSocket.OPEN && this.joinedChannels.has(channelId)) {
        console.log('WebSocket already connected to channel', channelId);
        this.currentChannelId = channelId;
        resolve();
        return;
      }

      // If socket is open, just join the new channel
      if (this.socket?.readyState === WebSocket.OPEN) {
        console.log('Socket open, joining new channel:', channelId);
        this.joinChannel(channelId)
          .then(() => {
            this.currentChannelId = channelId;
            resolve();
          })
          .catch(error => {
            console.error('Failed to join channel:', error);
            reject(error);
          });
        return;
      }

      const token = getAuthToken();
      if (!token) {
        const error = new Error('No auth token available for WebSocket connection');
        this.handleError(error);
        reject(error);
        return;
      }

      const baseWsUrl = process.env.REACT_APP_WS_URL || 'ws://localhost:8000/ws';
      const wsUrl = `${baseWsUrl}/chat?token=${token}`;
      console.log('Connecting to WebSocket:', wsUrl);
      
      try {
        this.socket = new WebSocket(wsUrl);
        this.currentChannelId = channelId;
        this.processedMessageIds.clear();
        this.pendingChannels.clear();
        this.pendingChannels.add(channelId);

        let hasResolved = false;
        let connectionTimeout: NodeJS.Timeout;

        // Set a connection timeout
        connectionTimeout = setTimeout(() => {
          if (!hasResolved) {
            console.error('WebSocket connection timeout');
            this.handleError('Connection timeout. Attempting to reconnect...');
            this.socket?.close();
            this.attemptReconnect(channelId);
          }
        }, 10000);

        this.socket.onopen = async () => {
          clearTimeout(connectionTimeout);
          console.log('WebSocket connection opened');
          
          // Add a small delay before joining the channel to ensure the connection is stable
          await new Promise(resolve => setTimeout(resolve, 500));
          
          try {
            await this.joinChannel(channelId);
            this.joinedChannels.add(channelId);
            this.pendingChannels.delete(channelId);
            hasResolved = true;
            resolve();
            // Process any queued messages
            this.processMessageQueue().catch(error => {
              console.error('Error processing message queue:', error);
            });
          } catch (error) {
            console.error('Failed to join channel:', error);
            this.handleError('Failed to join channel. Attempting to reconnect...');
            this.attemptReconnect(channelId);
          }
        };

        this.socket.onmessage = this.handleMessage;

        this.socket.onerror = (event: Event) => {
          console.error('WebSocket error:', event);
          this.handleError('Connection error. Attempting to reconnect...');
        };

        this.socket.onclose = (event: CloseEvent) => {
          clearTimeout(connectionTimeout);
          console.log('WebSocket disconnected with code:', event.code);
          
          const shouldReconnect = !hasResolved || (event.code !== 1000 && event.code !== 1001);
          
          this.socket = null;
          this.pendingChannels.clear();
          
          switch (event.code) {
            case 1000: // Normal closure
            case 1001: // Going away
              this.joinedChannels.clear();
              if (!hasResolved) {
                resolve();
              }
              break;
            case 1003: // Unsupported
              this.handleError('WebSocket connection not supported');
              if (!hasResolved) {
                reject(new Error('WebSocket connection not supported'));
              }
              break;
            case 4001: // Channel access denied
              this.handleError('Access to the channel was denied');
              if (!hasResolved) {
                reject(new Error('Access to the channel was denied'));
              }
              break;
            case 4002: // Authentication failed
              this.handleError('Authentication failed');
              if (!hasResolved) {
                reject(new Error('Authentication failed'));
              }
              break;
            default:
              if (shouldReconnect) {
                console.log('Abnormal closure, attempting to reconnect...');
                this.attemptReconnect(this.currentChannelId || channelId);
              }
          }
        };
      } catch (error) {
        console.error('Error creating WebSocket:', error);
        this.handleError(error);
        this.attemptReconnect(channelId);
      }
    });
  }

  disconnect() {
    if (this.reconnectTimeout) {
      clearTimeout(this.reconnectTimeout);
      this.reconnectTimeout = null;
    }
    
    if (this.socket) {
      // Leave all joined channels
      Array.from(this.joinedChannels).forEach(channelId => {
        try {
          const message = {
            type: 'leave_channel',
            channel_id: channelId
          };
          this.socket?.send(JSON.stringify(message));
        } catch (error) {
          console.error(`Error leaving channel ${channelId}:`, error);
        }
      });
      
      this.socket.close(1000); // Normal closure
      this.socket = null;
      this.currentChannelId = null;
      this.joinedChannels.clear();
      this.reconnectAttempts = 0;
      this.isReconnecting = false;
    }
  }

  private async processMessageQueue() {
    while (this.messageQueue.length > 0 && this.socket?.readyState === WebSocket.OPEN) {
      const message = this.messageQueue.shift();
      if (message) {
        try {
          await this.sendMessageImmediate(message.channelId, message.content);
        } catch (error) {
          console.error('Failed to send queued message:', error);
        }
      }
    }
  }

  private sendMessageImmediate(channelId: string, content: string) {
    if (this.socket?.readyState !== WebSocket.OPEN) {
      throw new Error('WebSocket is not connected');
    }

    const message = {
      type: 'message',
      channel_id: channelId,
      content: content
    };
    this.socket.send(JSON.stringify(message));
  }

  async sendMessage(channelId: string, content: string) {
    // If not connected to the right channel, connect first
    if (this.currentChannelId !== channelId) {
      console.log('Connecting to channel before sending message');
      try {
        await this.connect(channelId);
      } catch (error) {
        console.error('Failed to connect to channel:', error);
        this.handleError('Failed to send message: Could not connect to channel');
        return;
      }
    }

    if (this.socket?.readyState === WebSocket.OPEN) {
      try {
        await this.sendMessageImmediate(channelId, content);
      } catch (error) {
        console.error('Failed to send message:', error);
        // Queue the message for retry
        this.messageQueue.push({ channelId, content });
        this.handleError('Message will be sent when connection is restored');
      }
    } else {
      // Queue the message for later
      this.messageQueue.push({ channelId, content });
      this.handleError('Message will be sent when connection is restored');
    }
  }

  async joinChannel(channelId: string): Promise<void> {
    return new Promise((resolve, reject) => {
      if (!this.socket || this.socket.readyState !== WebSocket.OPEN) {
        reject(new Error('WebSocket is not connected'));
        return;
      }

      // If already joined or pending, don't try to join again
      if (this.joinedChannels.has(channelId) || this.pendingChannels.has(channelId)) {
        console.log('Channel already joined or pending:', channelId);
        resolve();
        return;
      }

      this.pendingChannels.add(channelId);

      // Set up a timeout for the join operation
      const joinTimeout = setTimeout(() => {
        this.joinChannelResolvers.delete(channelId);
        this.pendingChannels.delete(channelId);
        reject(new Error('Join channel timeout'));
      }, 5000);

      // Store the resolver
      this.joinChannelResolvers.set(channelId, {
        resolve: () => {
          clearTimeout(joinTimeout);
          this.joinChannelResolvers.delete(channelId);
          this.pendingChannels.delete(channelId);
          this.joinedChannels.add(channelId);
          resolve();
        },
        reject: (error: Error) => {
          clearTimeout(joinTimeout);
          this.joinChannelResolvers.delete(channelId);
          this.pendingChannels.delete(channelId);
          reject(error);
        }
      });

      try {
        const message = {
          type: 'join_channel',
          channel_id: channelId
        };
        this.socket.send(JSON.stringify(message));
      } catch (error) {
        clearTimeout(joinTimeout);
        this.joinChannelResolvers.delete(channelId);
        this.pendingChannels.delete(channelId);
        reject(error);
      }
    });
  }

  leaveChannel(channelId: string) {
    if (this.socket?.readyState === WebSocket.OPEN && this.joinedChannels.has(channelId)) {
      const message = {
        type: 'leave_channel',
        channel_id: channelId
      };
      this.socket.send(JSON.stringify(message));
      this.joinedChannels.delete(channelId);
      
      // If this was the current channel, set current to null
      if (this.currentChannelId === channelId) {
        this.currentChannelId = null;
      }
    }
  }

  onMessage(handler: (message: WebSocketMessage) => void) {
    this.messageHandlers.push(handler);
    return () => {
      this.messageHandlers = this.messageHandlers.filter(h => h !== handler);
    };
  }

  onError(handler: (error: { code: string; message: string }) => void) {
    this.errorHandlers.push(handler);
    return () => {
      this.errorHandlers = this.errorHandlers.filter(h => h !== handler);
    };
  }

  getChatSocketState() {
    return this.socket?.readyState || WebSocket.CLOSED;
  }

  getCurrentChannelId() {
    return this.currentChannelId;
  }

  private handleMessage = (event: MessageEvent) => {
    try {
      const data = JSON.parse(event.data) as WebSocketMessage;
      console.log('Received WebSocket message:', data);

      if (data.type === 'message' || data.type === 'new_reply') {
        if (!this.processedMessageIds.has(data.message.id.toString())) {
          this.processedMessageIds.add(data.message.id.toString());
          const transformedMessage: StoreMessage = {
            id: data.message.id.toString(),
            content: data.message.content,
            channelId: data.message.channel_id.toString(),
            userId: data.message.sender_id.toString(),
            createdAt: data.message.created_at,
            updatedAt: data.message.created_at,
            reactions: [],
            attachments: [],
            replyCount: 0,
            isExpanded: false,
            ...(data.type === 'new_reply' && data.parentId ? { parentId: data.parentId.toString() } : {})
          };
          store.dispatch(addMessage(transformedMessage));
        }
      } else if (data.type === 'channel_joined') {
        const resolvers = this.joinChannelResolvers.get(String(data.channel_id));
        if (resolvers) {
          console.log('Successfully joined channel:', data.channel_id);
          this.joinedChannels.add(String(data.channel_id));
          resolvers.resolve();
          this.joinChannelResolvers.delete(String(data.channel_id));
          this.processMessageQueue().catch(error => {
            console.error('Error processing message queue after join:', error);
          });
        }
      } else if (data.type === 'channel_left') {
        const channelId = String(data.channel_id);
        this.joinedChannels.delete(channelId);
        if (channelId === this.currentChannelId) {
          this.currentChannelId = null;
        }
      } else if (data.type === 'error') {
        console.error('WebSocket error message:', data);
        
        // Handle channel-specific errors
        if (data.code === 'channel_not_found' || data.message?.includes('channel')) {
          const channelId = this.currentChannelId;
          if (channelId) {
            const resolvers = this.joinChannelResolvers.get(channelId);
            if (resolvers) {
              resolvers.reject(new Error(data.message || 'Failed to join channel'));
              this.joinChannelResolvers.delete(channelId);
            }
          }
        }
        
        this.handleError({
          name: data.code || 'UNKNOWN_ERROR',
          message: data.message || data.content || 'Unknown error occurred'
        });
      } else if (data.type === 'user_status' || data.type === 'presence_update') {
        console.log('User status update:', data);
      }

      this.messageHandlers.forEach(handler => {
        try {
          handler(data);
        } catch (error) {
          console.error('Error in message handler:', error);
        }
      });
    } catch (error) {
      console.error('Error handling WebSocket message:', error);
      this.handleError(error);
    }
  };

  // Helper method to check if connected to a channel
  private isConnectedToChannel(channelId: string): boolean {
    return (
      this.socket?.readyState === WebSocket.OPEN &&
      this.joinedChannels.has(channelId)
    );
  }

  // Helper method to ensure connection is ready
  private ensureConnected(): void {
    if (!this.socket || this.socket.readyState !== WebSocket.OPEN) {
      throw new Error('WebSocket is not connected');
    }
  }
}

const wsService = new WebSocketService();
export default wsService; 