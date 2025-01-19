import { Reaction, RawMessage, UserStatus, StoreMessage, RootState } from '../../types';
import { store } from '../../store';
import { addMessage, updateMessage, addReaction, removeReaction } from '../../store/messages/messagesSlice';
import { updateUserStatus } from '../../store/chat/chatSlice';
import { Store } from '@reduxjs/toolkit';
import { transformMessage } from '../../utils/messageTransform';
import { logout } from '../../store/auth/authSlice';
import { getWebSocketUrl } from '../api/utils';
import { useAuth0 } from '@auth0/auth0-react';

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
  private static ws: WebSocket | null = null;
  private static pingInterval: NodeJS.Timeout | null = null;
  private static reconnectAttempts = 0;
  private static maxReconnectAttempts = 5;
  private static reconnectTimeout: NodeJS.Timeout | null = null;
  private static channels: Set<string> = new Set();
  private static store: Store | null = null;
  private static pendingChannels: Set<string> = new Set();
  private static isReconnecting = false;
  private static auth0Token: string | null = null;

  private constructor() {}

  public static initialize(store: Store) {
    if (!WebSocketService.instance) {
      WebSocketService.instance = new WebSocketService();
      WebSocketService.store = store;
    }
    return WebSocketService.instance;
  }

  public static setAuth0Token(token: string) {
    WebSocketService.auth0Token = token;
  }

  private static getAuthToken(): string | null {
    // First try to get token from Auth0
    if (WebSocketService.auth0Token) {
      console.log('Using Auth0 token');
      return WebSocketService.auth0Token;
    }

    // Fallback to Redux store token
    const state = store.getState() as RootState;
    const token = state.auth?.token;
    if (token) {
      console.log('Using token from Redux store');
      return token;
    }

    console.warn('No auth token available');
    return null;
  }

  private static handleConnectionError() {
    console.error('WebSocket connection error - redirecting to login');
    if (WebSocketService.store) {
      WebSocketService.store.dispatch(logout());
      window.location.href = '/login';
    }
  }

  public static async connect() {
    if (WebSocketService.ws?.readyState === WebSocket.OPEN) {
      console.log('WebSocket already connected');
      return;
    }

    const token = WebSocketService.getAuthToken();
    if (!token) {
      console.warn('No auth token available, skipping WebSocket connection');
      return;
    }

    const wsUrl = `${getWebSocketUrl()}?token=${token}`;
    console.log('Connecting to WebSocket');
    
    try {
      WebSocketService.ws = new WebSocket(wsUrl);
      
      WebSocketService.ws.onopen = () => {
        console.log('WebSocket connected successfully');
        WebSocketService.reconnectAttempts = 0;
        WebSocketService.isReconnecting = false;
        WebSocketService.startPingInterval();
        WebSocketService.rejoinChannels();
      };

      WebSocketService.ws.onmessage = (event) => {
        WebSocketService.handleMessage(event);
      };

      WebSocketService.ws.onclose = (event) => {
        console.log('WebSocket disconnected with code:', event.code);
        WebSocketService.stopPingInterval();
        
        if (event.code === 1008) {
          WebSocketService.handleConnectionError();
        } else {
          WebSocketService.handleReconnect();
        }
      };

      WebSocketService.ws.onerror = (error) => {
        console.error('WebSocket error:', error);
        WebSocketService.handleConnectionError();
        
        if (!WebSocketService.isReconnecting) {
          WebSocketService.handleReconnect();
        }
      };
    } catch (error) {
      console.error('Error establishing WebSocket connection:', error);
      WebSocketService.handleConnectionError();
    }
  }

  public static async joinChannel(channelId: string) {
    if (!WebSocketService.ws || WebSocketService.ws.readyState !== WebSocket.OPEN) {
      console.warn('WebSocket not connected, cannot join channel');
      return;
    }

    console.log('Joining channel:', channelId);
    WebSocketService.channels.add(channelId);
    WebSocketService.ws.send(JSON.stringify({ type: 'JOIN_CHANNEL', channelId }));
  }

  public static leaveChannel(channelId: string) {
    if (!WebSocketService.ws || WebSocketService.ws.readyState !== WebSocket.OPEN) {
      console.warn('WebSocket not connected, cannot leave channel');
      return;
    }

    console.log('Leaving channel:', channelId);
    WebSocketService.channels.delete(channelId);
    WebSocketService.ws.send(JSON.stringify({ type: 'LEAVE_CHANNEL', channelId }));
  }

  private static async rejoinChannels() {
    console.log('Rejoining channels:', Array.from(WebSocketService.channels));
    
    // Wait a bit to ensure connection is stable
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    // Copy channels to pendingChannels
    WebSocketService.pendingChannels = new Set(WebSocketService.channels);
    console.log('Pending channels:', Array.from(WebSocketService.pendingChannels));
    
    // Try to join each channel
    for (const channelId of Array.from(WebSocketService.channels)) {
      try {
        console.log('Attempting to rejoin channel:', channelId);
        await WebSocketService.joinChannel(channelId);
        WebSocketService.pendingChannels.delete(channelId);
        console.log('Successfully rejoined channel:', channelId);
        console.log('Remaining pending channels:', Array.from(WebSocketService.pendingChannels));
      } catch (error) {
        console.error(`Failed to rejoin channel ${channelId}:`, error);
      }
    }
  }

  private static handleReconnect() {
    if (WebSocketService.isReconnecting || WebSocketService.reconnectAttempts >= WebSocketService.maxReconnectAttempts) {
      return;
    }

    WebSocketService.isReconnecting = true;
    WebSocketService.reconnectAttempts++;
    console.log(`Attempting to reconnect (${WebSocketService.reconnectAttempts}/${WebSocketService.maxReconnectAttempts})`);
    console.log('Channels before reconnect:', Array.from(WebSocketService.channels));
    
    // Store current channels
    const currentChannels = new Set(WebSocketService.channels);
    
    // Clear existing timeout
    if (WebSocketService.reconnectTimeout) {
      clearTimeout(WebSocketService.reconnectTimeout);
    }
    
    WebSocketService.reconnectTimeout = setTimeout(() => {
      WebSocketService.connect();
      
      // After reconnection, verify channels are rejoined
      setTimeout(() => {
        console.log('Verifying channel subscriptions after reconnect');
        WebSocketService.rejoinChannels();
      }, 2000);
    }, 1000 * Math.min(WebSocketService.reconnectAttempts, 5));
  }

  private static startPingInterval() {
    if (WebSocketService.pingInterval) {
      clearInterval(WebSocketService.pingInterval);
    }
    
    WebSocketService.pingInterval = setInterval(() => {
      if (WebSocketService.ws?.readyState === WebSocket.OPEN) {
        WebSocketService.ws.send(JSON.stringify({ type: 'PING' }));
      }
    }, 30000);
  }

  private static stopPingInterval() {
    if (WebSocketService.pingInterval) {
      clearInterval(WebSocketService.pingInterval);
      WebSocketService.pingInterval = null;
    }
  }

  private static handleMessage(event: MessageEvent) {
    try {
      const message: WebSocketMessage = JSON.parse(event.data);
      console.log('Received WebSocket message:', message);

      if (isReactionAddedMessage(message)) {
        WebSocketService.handleReactionAdded(message);
      } else if (isReactionRemovedMessage(message)) {
        WebSocketService.handleReactionRemoved(message);
      } else if (isNewMessageMessage(message)) {
        WebSocketService.handleNewMessage(message);
      } else if (isUpdateMessageMessage(message)) {
        WebSocketService.handleUpdateMessage(message);
      } else if (isUserStatusMessage(message)) {
        WebSocketService.handleUserStatus(message);
      } else if (isBotMessageMessage(message)) {
        WebSocketService.handleBotMessage(message);
      } else if (message.type === 'PONG') {
        console.log('Received PONG');
      } else {
        console.warn('Unknown message type:', message.type);
      }
    } catch (error) {
      console.error('Error handling WebSocket message:', error);
    }
  }

  private static handleReactionAdded(message: ReactionAddedMessage) {
    if (WebSocketService.store) {
      WebSocketService.store.dispatch(addReaction({
        channelId: message.payload.channelId,
        messageId: message.payload.messageId,
        reaction: message.payload.reaction
      }));
    }
  }

  private static handleReactionRemoved(message: ReactionRemovedMessage) {
    if (WebSocketService.store) {
      WebSocketService.store.dispatch(removeReaction({
        channelId: message.payload.channelId,
        messageId: message.payload.messageId,
        userId: message.payload.userId,
        emoji: message.payload.emoji
      }));
    }
  }

  private static handleNewMessage(message: NewMessageMessage) {
    if (WebSocketService.store) {
      const transformedMessage = transformMessage(message.message);
      WebSocketService.store.dispatch(addMessage({
        channelId: message.channelId,
        message: transformedMessage
      }));
    }
  }

  private static handleUpdateMessage(message: UpdateMessageMessage) {
    if (WebSocketService.store) {
      const transformedUpdates: Partial<StoreMessage> = {
        content: message.updates.content,
        reactions: message.updates.reactions || [],
        attachments: message.updates.attachments || [],
        has_attachments: (message.updates.attachments || []).length > 0,
        reply_count: message.updates.reply_count || 0,
        parent_id: message.updates.parent_id ? message.updates.parent_id.toString() : undefined
      };
      WebSocketService.store.dispatch(updateMessage({
        channelId: message.channelId,
        messageId: message.id,
        message: transformedUpdates
      }));
    }
  }

  private static handleUserStatus(message: UserStatusMessage) {
    if (WebSocketService.store) {
      WebSocketService.store.dispatch(updateUserStatus({
        userId: message.userId,
        status: message.status
      }));
    }
  }

  private static handleBotMessage(message: BotMessageMessage) {
    if (WebSocketService.store) {
      const transformedMessage = transformMessage(message.message);
      WebSocketService.store.dispatch(addMessage({
        channelId: message.channelId,
        message: transformedMessage
      }));
    }
  }

  public static disconnect() {
    console.log('Disconnecting WebSocket');
    if (WebSocketService.ws) {
      WebSocketService.ws.close();
      WebSocketService.ws = null;
    }
    WebSocketService.stopPingInterval();
    WebSocketService.channels.clear();
    WebSocketService.pendingChannels.clear();
    WebSocketService.reconnectAttempts = 0;
    WebSocketService.isReconnecting = false;
    if (WebSocketService.reconnectTimeout) {
      clearTimeout(WebSocketService.reconnectTimeout);
      WebSocketService.reconnectTimeout = null;
    }
  }
}

export default WebSocketService; 