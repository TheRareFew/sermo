# WebSocket Analysis Report for Sermo Chat Application

## Overview
The application implements real-time communication using WebSocket connections for chat messaging and user presence tracking. The implementation spans both frontend and backend components with a focus on reliability and proper message handling.

## Core Components

### 1. WebSocket Service (Frontend)
Located in:

[CODE START]
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
  private lastHeartbeatResponse: number = Date.now()
[CODE END]

Key features:
- Connection management with automatic reconnection
- Message queue system for handling disconnections
- Heartbeat mechanism for connection health monitoring
- Channel-based message routing
- Error handling and logging
- Type-safe message handling

### 2. Backend WebSocket Handler
Located in:

[CODE START]
from fastapi import APIRouter, WebSocket, WebSocketDisconnect, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import Dict, Set, Optional
import json
import logging
from datetime import datetime, UTC
from pydantic import BaseModel, Field, ValidationError
import asyncio

from ...models.user import User
from ...models.channel import Channel
from ...models.message import Message as MessageModel
from ..deps import get_db, get_current_user
from ...schemas.message import MessageCreate
from .messages import create_message

router = APIRouter()
logger = logging.getLogger(__name__)

# Constants
MAX_MESSAGE_LENGTH = 4096  # 4KB max message length
VALID_STATUS_VALUES = {"online", "offline", "away", "busy"}

# Pydantic models for WebSocket messages
class StatusUpdateMessage(BaseModel):
    type: str = Field("status_update")
    status: str

class ChannelJoinMessage(BaseModel):
    type: str = Field("join_channel")
    channel_id: int

class ChannelLeaveMessage(BaseModel):
    type: str = Field("leave_channel")
    channel_id: int

class ChatMessage(BaseModel):
    type: str = Field("message")
    channel_id: int
    content: str = Field(..., max_length=MAX_MESSAGE_LENGTH)
class ConnectionManager:
    def __init__(self):
        # user_id -> WebSocket
        self.active_connections: Dict[int, WebSocket] = {}
        # channel_id -> Set[user_id]
        self.channel_members: Dict[int, Set[int]] = {}
        # channel_id -> Dict[user_id, WebSocket]
        self.channel_connections: Dict[int, Dict[int, WebSocket]] = {}
        logger.debug("ConnectionManager initialized")
[CODE END]

Features:
- Connection management for multiple clients
- Channel membership validation
- Message broadcasting to channel members
- Error handling and logging
- Support for public/private channels

## Message Types

The application defines a comprehensive set of WebSocket message types:

[CODE START]
// WebSocket message types
export type WebSocketMessageType = 
  | 'join'
  | 'joined'
  | 'message'
  | 'message_sent'
  | 'message_updated'
  | 'new_message'
  | 'new_reply'
  | 'message_deleted'
  | 'channel_created'
  | 'channel_updated'
  | 'channel_deleted'
  | 'unread_count_updated'
  | 'user_status'
  | 'error'
  | 'ping'
  | 'pong';

export interface WebSocketMessageData {
  channel_id?: number;
  message_id?: string;
  content?: string;
  id?: string;
  user_id?: string;
  status?: UserStatus;
  count?: number;
  message?: RawMessage;
  error?: string;
  parent_id?: string;
}

export interface WebSocketMessage {
  type: WebSocketMessageType;
  data?: WebSocketMessageData;
  message?: string; // For error messages
}
[CODE END]

## Implementation Details

### 1. Connection Management

The frontend WebSocket service implements:
- Automatic reconnection with exponential backoff
- Connection state monitoring
- Channel-based subscription system
- Message queuing during disconnections

Key implementation:

[CODE START]
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
[CODE END]

### 2. Message Handling

Two main components handle message processing:

1. MainLayout Component:

[CODE START]
// Handle WebSocket messages
useEffect(() => {
  if (!activeChannelId) return;

  const handleWebSocketMessage = (message: WebSocketMessage) => {
    console.log('MainLayout received WebSocket message:', message);

    // Helper function to check if message belongs to current channel
    const isMessageForCurrentChannel = (msg: WebSocketMessage): boolean => {
      if (msg.data?.channel_id) {
        const channelId = msg.data.channel_id.toString();
        console.log('Message channel ID:', channelId, 'Active channel ID:', activeChannelId);
        return channelId === activeChannelId;
      }
      return true; // For other message types like user_status
    };

    // Skip messages not meant for current channel
    if (!isMessageForCurrentChannel(message)) {
      console.log('Ignoring message from different channel');
      return;
    }

    // Log the message type and content for debugging
    console.log('Processing message type:', message.type);
    if (message.data) {
      console.log('Message data:', message.data);
    }

    try {
      switch (message.type) {
        case 'channel_created':
        case 'channel_updated':
          if (message.data?.message) {
            console.log('Adding/updating channel:', message.data.message);
            dispatch(addChannel(message.data.message as unknown as Channel));
          }
          break;
        // ... more cases
      }
    } catch (error) {
      console.error('Error processing WebSocket message:', error);
      dispatch(setError('Error processing message from server'));
    }
  };
});
[CODE END]

### 3. Testing

The application includes comprehensive WebSocket testing:

[CODE START]
class MockWebSocket:
    """Mock WebSocket class for testing"""
    def __init__(self):
        self.messages = []  # Outgoing messages
        self.message_queue = []  # Incoming messages
        self.message_received = asyncio.Event()
        self.connected = False
        self.closed = False
        self.close_code = None
        self.receive_side_effect = None
        self.disconnect_after_connect = False
        self.disconnect_after_message = False
        self._logger = logging.getLogger("MockWebSocket")

    async def accept(self):
        self._logger.info("Accepting connection")
        self.connected = True
        if self.disconnect_after_connect:
            self._logger.info("Disconnecting after connect")
            await self.close(1000)
            raise WebSocketDisconnect(code=1000)

    async def close(self, code=1000):
        self._logger.info(f"Closing connection with code {code}")
        self.connected = False
        self.closed = True
        self.close_code = code

    async def send_json(self, data: dict):
        self._logger.info(f"Sending JSON: {data}")
        if not self.connected:
            self._logger.warning("Attempting to send on closed connection")
            raise WebSocketDisconnect(code=1000)
        self.messages.append(data)
        self.message_received.set()
        if self.disconnect_after_message:
            self._logger.info("Disconnecting after message")
            await self.close(1000)
            raise WebSocketDisconnect(code=1000)
[CODE END]

Features tested:
- Connection handling
- Message delivery
- Error scenarios
- Channel access control
- Message validation

## Known Issues and Areas for Improvement

1. Message Delivery Issues:

[CODE START]
// services/messageQueue.ts
export class MessageQueue {
  private queue: Map<string, WebSocketMessage[]> = new Map();
  
  addMessage(channelId: string, message: WebSocketMessage) {
    if (!this.queue.has(channelId)) {
      this.queue.set(channelId, []);
    }
    this.queue.get(channelId)?.push(message);
  }
  
  processQueue(channelId: string) {
    const messages = this.queue.get(channelId) || [];
    this.queue.set(channelId, []);
    return messages;
  }
}
[CODE END]
## Security Considerations

1. Authentication
- JWT token validation for WebSocket connections
- Channel access verification
- Member permission checking

2. Message Validation
- Content length limits
- Message type validation
- Channel membership verification

## Performance Optimizations

1. Current Implementations:
- Message queuing for offline/disconnected states
- Heartbeat mechanism for connection health
- Channel-based message routing

2. Needed Improvements:
- Message batching for bulk operations
- Better reconnection strategy
- Improved error recovery
- Message delivery confirmation

## Documentation

The API endpoints and WebSocket events are well documented:

[CODE START]
{
  "type": "message",
  "message": {
    "id": "string",
    "content": "string",
    "channel_id": "string",
    "sender_id": "string",
    "created_at": "string"
  }
}
[CODE END]

### Channel Events
The WebSocket connection handles various channel-related events:

#### Message Events
- `message`: New message in a channel
- `channel_access_denied`: User doesn't have access to the channel
- `error`: General error message

#### Channel Access Events
- `join_channel`: User joins a channel
- `leave_channel`: User leaves a channel

#### Error Codes
- `4001`: Channel access denied
- `4002`: Authentication failed
- `1003`: Unsupported operation

### WebSocket Message Format
[CODE START]
{
  "type": "message",
  "message": {
    "id": "string",
    "content": "string",
    "channel_id": "string",
    "sender_id": "string",
    "created_at": "string"
  }
}
[CODE END]

## Recommendations

1. **Connection Stability**
- Implement WebSocket connection pooling
- Add better connection state management
- Improve reconnection logic

2. **Message Handling**
- Add message acknowledgment system
- Implement message delivery guarantees
- Add message ordering guarantees

3. **Performance**
- Implement message batching
- Add compression for large messages
- Optimize channel subscription management

4. **Monitoring**
- Add better logging for WebSocket events
- Implement connection metrics
- Add performance monitoring

5. **Testing**
- Add more edge case tests
- Implement load testing
- Add connection stress testing

Example implementation for improved connection pooling:

[CODE START]
class WebSocketPool {
  private pools: Map<string, WebSocket[]> = new Map();
  private maxPoolSize = 5;
  
  async getConnection(channelId: string): Promise<WebSocket> {
    let pool = this.pools.get(channelId) || [];
    
    // Find available connection or create new one
    const connection = pool.find(ws => ws.readyState === WebSocket.OPEN) 
      || await this.createConnection(channelId);
    
    // Manage pool size
    if (pool.length >= this.maxPoolSize) {
      const oldConnection = pool.shift();
      oldConnection?.close();
    }
    
    pool.push(connection);
    this.pools.set(channelId, pool);
    
    return connection;
  }
  
  private async createConnection(channelId: string): Promise<WebSocket> {
    const ws = new WebSocket(`ws://localhost:8000/ws/chat?channel=${channelId}`);
    await new Promise((resolve) => {
      ws.onopen = resolve;
    });
    return ws;
  }
}
[CODE END]

The WebSocket implementation provides a solid foundation for real-time communication but needs improvements in message delivery reliability and connection stability. The architecture supports future scaling and feature additions while maintaining a clean separation of concerns.