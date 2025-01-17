import { Reaction, RawMessage, UserStatus, StoreMessage, RootState } from '../../types';
import { store } from '../../store';
import { addMessage, updateMessage, addReaction, removeReaction } from '../../store/messages/messagesSlice';
import { updateUserStatus } from '../../store/chat/chatSlice';
import { Store } from 'redux';
import { transformMessage } from '../../utils/messageTransform';
import { logout } from '../../store/auth/authSlice';

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

interface BaseWebSocketMessage {
  type: string;
  data?: any;
}

interface ReactionAddedMessage extends BaseWebSocketMessage {
  type: 'REACTION_ADDED';
  payload: {
    channelId: string;
    messageId: string;
    reaction: Reaction;
  };
}

interface ReactionRemovedMessage extends BaseWebSocketMessage {
  type: 'REACTION_REMOVED';
  payload: {
    channelId: string;
    messageId: string;
    userId: string;
    emoji: string;
  };
}

interface NewMessageMessage extends BaseWebSocketMessage {
  type: 'NEW_MESSAGE';
  channelId: string;
  message: RawMessage;
  isReply?: boolean;
  parentId?: string;
}

interface UpdateMessageMessage extends BaseWebSocketMessage {
  type: 'UPDATE_MESSAGE';
  channelId: string;
  id: string;
  updates: Partial<RawMessage>;
}

interface UserStatusMessage extends BaseWebSocketMessage {
  type: 'USER_STATUS';
  userId: string;
  status: UserStatus;
}

interface BotMessageMessage extends BaseWebSocketMessage {
  type: 'BOT_MESSAGE';
  channelId: string;
  message: RawMessage;
}

type WebSocketMessage = 
  | ReactionAddedMessage 
  | ReactionRemovedMessage 
  | NewMessageMessage 
  | UpdateMessageMessage 
  | UserStatusMessage 
  | BotMessageMessage
  | BaseWebSocketMessage;

function isReactionAddedMessage(message: WebSocketMessage): message is ReactionAddedMessage {
  return message.type === 'REACTION_ADDED' && 
         'payload' in message && 
         message.payload && 
         'channelId' in message.payload &&
         'messageId' in message.payload &&
         'reaction' in message.payload;
}

function isReactionRemovedMessage(message: WebSocketMessage): message is ReactionRemovedMessage {
  return message.type === 'REACTION_REMOVED' && 
         'payload' in message && 
         message.payload && 
         'channelId' in message.payload &&
         'messageId' in message.payload &&
         'userId' in message.payload &&
         'emoji' in message.payload;
}

function isNewMessageMessage(message: WebSocketMessage): message is NewMessageMessage {
  return message.type === 'NEW_MESSAGE' && 
         'channelId' in message && 
         'message' in message;
}

function isUpdateMessageMessage(message: WebSocketMessage): message is UpdateMessageMessage {
  return message.type === 'UPDATE_MESSAGE' && 
         'channelId' in message && 
         'id' in message && 
         'updates' in message;
}

function isUserStatusMessage(message: WebSocketMessage): message is UserStatusMessage {
  return message.type === 'USER_STATUS' && 
         'userId' in message && 
         'status' in message;
}

function isBotMessageMessage(message: WebSocketMessage): message is BotMessageMessage {
  return message.type === 'BOT_MESSAGE' && 
         'channelId' in message && 
         'message' in message;
}

export class WebSocketService {
  private static instance: WebSocketService | null = null;
  private ws: WebSocket | null = null;
  private pingInterval: NodeJS.Timeout | null = null;
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 5;
  private reconnectTimeout: NodeJS.Timeout | null = null;
  private channels: Set<string> = new Set();
  private store: Store | null = null;
  private pendingChannels: Set<string> = new Set();
  private isReconnecting = false;

  constructor(store: Store) {
    this.store = store;
    if (WebSocketService.instance) {
      return WebSocketService.instance;
    }
    WebSocketService.instance = this;
  }

  private getAuthToken(): string | null {
    const state = store.getState();
    return state.auth?.token || null;
  }

  private handleConnectionError() {
    console.error('WebSocket connection error - redirecting to login');
    if (this.store) {
      this.store.dispatch(logout());
      window.location.href = '/login';
    }
  }

  public connect() {
    if (this.ws?.readyState === WebSocket.OPEN) {
      console.log('WebSocket already connected, current channels:', Array.from(this.channels));
      return;
    }

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
        console.log('Current channels before rejoin:', Array.from(this.channels));
        this.reconnectAttempts = 0;
        this.isReconnecting = false;
        this.startPingInterval();
        
        // Rejoin all channels
        this.rejoinChannels();
      };

      this.ws.onmessage = (event) => {
        console.log('WebSocket message received:', event.data);
        this.handleMessage(event);
      };

      this.ws.onclose = (event) => {
        console.log('WebSocket disconnected with code:', event.code, 'reason:', event.reason);
        console.log('Channels at disconnect:', Array.from(this.channels));
        this.stopPingInterval();
        
        // If the close was due to an authentication error (code 1008), redirect to login
        if (event.code === 1008) {
          this.handleConnectionError();
        } else {
          this.handleReconnect();
        }
      };

      this.ws.onerror = (error) => {
        console.error('WebSocket error:', error);
        console.log('Channels at error:', Array.from(this.channels));
        
        // Handle connection error and redirect to login
        this.handleConnectionError();
        
        if (!this.isReconnecting) {
          this.handleReconnect();
        }
      };
    } catch (error) {
      console.error('Error creating WebSocket connection:', error);
      this.handleConnectionError();
      if (!this.isReconnecting) {
        this.handleReconnect();
      }
    }
  }

  private async rejoinChannels() {
    console.log('Rejoining channels:', Array.from(this.channels));
    
    // Wait a bit to ensure connection is stable
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    // Copy channels to pendingChannels
    this.pendingChannels = new Set(this.channels);
    console.log('Pending channels:', Array.from(this.pendingChannels));
    
    // Try to join each channel
    for (const channelId of Array.from(this.channels)) {
      try {
        console.log('Attempting to rejoin channel:', channelId);
        await this.joinChannel(channelId);
        this.pendingChannels.delete(channelId);
        console.log('Successfully rejoined channel:', channelId);
        console.log('Remaining pending channels:', Array.from(this.pendingChannels));
      } catch (error) {
        console.error(`Failed to rejoin channel ${channelId}:`, error);
      }
    }
  }

  private handleReconnect() {
    if (this.isReconnecting || this.reconnectAttempts >= this.maxReconnectAttempts) {
      return;
    }

    this.isReconnecting = true;
    this.reconnectAttempts++;
    console.log(`Attempting to reconnect (${this.reconnectAttempts}/${this.maxReconnectAttempts})`);
    console.log('Channels before reconnect:', Array.from(this.channels));
    
    // Store current channels
    const currentChannels = new Set(this.channels);
    
    // Clear existing timeout
    if (this.reconnectTimeout) {
      clearTimeout(this.reconnectTimeout);
    }
    
    this.reconnectTimeout = setTimeout(() => {
      this.connect();
      
      // After reconnection, verify channels are rejoined
      setTimeout(() => {
        console.log('Verifying channel subscriptions after reconnect');
        console.log('Current channels:', Array.from(this.channels));
        console.log('Expected channels:', Array.from(currentChannels));
        
        currentChannels.forEach(channelId => {
          if (!this.channels.has(channelId)) {
            console.log('Rejoining missing channel after reconnect:', channelId);
            this.joinChannel(channelId);
          }
        });
      }, 2000);
    }, Math.min(1000 * Math.pow(2, this.reconnectAttempts), 30000));
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
      const message: WebSocketMessage = JSON.parse(event.data);
      console.log('Parsed WebSocket message:', message);

      if (isReactionAddedMessage(message)) {
        const { channelId, messageId, reaction } = message.payload;
        store.dispatch(addReaction({ channelId, messageId, reaction }));
      } else if (isReactionRemovedMessage(message)) {
        const { channelId, messageId, userId, emoji } = message.payload;
        store.dispatch(removeReaction({ channelId, messageId, userId, emoji }));
      } else if (isNewMessageMessage(message)) {
        console.log('Handling NEW_MESSAGE:', message);
        const transformedMessage = transformMessage(message.message);
        
        if (this.store) {
          // Only add as a main message if it's not a reply
          if (!transformedMessage.parent_id) {
            this.store.dispatch(addMessage({
              channelId: message.channelId,
              message: transformedMessage
            }));
          } else {
            // For replies, only dispatch addMessage which will handle adding it to parent's replies
            this.store.dispatch(addMessage({
              channelId: message.channelId,
              message: transformedMessage
            }));
          }
        }
      } else if (isUpdateMessageMessage(message)) {
        console.log('Handling UPDATE_MESSAGE:', message);
        if (this.store) {
          // Only update specific fields that we know are safe
          const safeUpdates: Partial<StoreMessage> = {
            content: message.updates.content,
            reactions: message.updates.reactions || [],
            attachments: message.updates.attachments || [],
            has_attachments: (message.updates.attachments || []).length > 0,
            reply_count: message.updates.reply_count || 0,
            parent_id: message.updates.parent_id ? message.updates.parent_id.toString() : undefined
          };
          
          this.store.dispatch(updateMessage({
            channelId: message.channelId,
            messageId: message.id,
            message: safeUpdates
          }));
        }
      } else if (isUserStatusMessage(message)) {
        console.log('Handling USER_STATUS:', message);
        store.dispatch(updateUserStatus({
          userId: message.userId,
          status: message.status
        }));
      } else if (isBotMessageMessage(message)) {
        console.log('Handling BOT_MESSAGE:', message);
        const { channelId, message: botMessage } = message;
        const transformedMessage = transformMessage({
          ...botMessage,
          is_bot: true
        });
        
        if (this.store) {
          this.store.dispatch(addMessage({
            channelId,
            message: transformedMessage
          }));
        }
      }

      if (message.type === 'pong') {
        return;
      }

      console.warn('Unknown message type:', message.type);
    } catch (error) {
      console.error('Error handling WebSocket message:', error);
    }
  }

  public joinChannel(channelId: string) {
    console.log('Joining channel:', channelId);
    if (this.ws?.readyState === WebSocket.OPEN) {
      console.log('WebSocket is open, sending join_channel message');
      this.ws.send(JSON.stringify({
        type: 'join_channel',
        channelId
      }));
      this.channels.add(channelId);
      console.log('Current channels after join:', Array.from(this.channels));
    } else {
      console.warn('WebSocket not connected (state:', this.ws?.readyState, '), queueing channel join for:', channelId);
      this.pendingChannels.add(channelId);
      this.channels.add(channelId);
      if (!this.ws || this.ws.readyState === WebSocket.CLOSED) {
        this.connect();
      }
    }
  }

  public leaveChannel(channelId: string) {
    console.log('Leaving channel:', channelId);
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify({
        type: 'leave_channel',
        channelId
      }));
    } else {
      console.warn('WebSocket not connected, skipping leave message for channel:', channelId);
    }
    this.channels.delete(channelId);
    this.pendingChannels.delete(channelId);
    console.log('Current channels:', Array.from(this.channels));
  }

  public addReaction(channelId: string, messageId: string, emoji: string) {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
      console.error('WebSocket not connected');
      return;
    }

    const message = {
      type: 'add_reaction',
      channelId,
      messageId,
      emoji
    };

    this.ws.send(JSON.stringify(message));
  }

  public removeReaction(channelId: string, messageId: string, emoji: string) {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
      console.error('WebSocket not connected');
      return;
    }

    const message = {
      type: 'remove_reaction',
      channelId,
      messageId,
      emoji
    };

    this.ws.send(JSON.stringify(message));
  }
}

export default new WebSocketService(store); 