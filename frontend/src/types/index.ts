// User Types
export type UserStatus = 'online' | 'offline' | 'away' | 'busy';

export interface User {
  id: string;
  username: string;
  status: UserStatus;
  avatar_url?: string;
  isBot?: boolean;
}

// Base types
export interface Channel {
  id: string;
  name: string;
  description?: string;
  is_direct_message: boolean;
  is_public: boolean;
  created_at: string;
  created_by_id: string;
  members: string[];
  unreadCount: number;
}

export interface RawMessage {
  id: string | number;
  content: string;
  // Support both camelCase and snake_case
  channelId?: string;
  channel_id?: string;
  userId?: string;
  sender_id?: string;
  createdAt?: string;
  created_at?: string;
  updatedAt?: string;
  updated_at?: string;
  parentId?: string | null;
  parent_id?: string | null;
  replyCount?: number;
  reply_count?: number;
  isExpanded?: boolean;
  repliesLoaded?: boolean;
  replies?: StoreMessage[];
  reactions: Reaction[];
  attachments: any[];
  user?: User;
  isBot?: boolean;
}

export interface Message {
  id: string;
  content: string;
  sender_id: string;
  channel_id: string;
  created_at: string;
  updated_at?: string;
  is_system?: boolean;
  parent_id?: string;
  reply_count?: number;
  reactions: Reaction[];
  attachments: Attachment[];
  has_attachments: boolean;
}

// Store Message type
export interface StoreMessage {
  id: string;
  content: string;
  channelId: string;
  userId: string;
  reactions: Reaction[];
  attachments: Attachment[];
  createdAt: string;
  updatedAt: string;
  parentId?: string;
  replyCount: number;
  isExpanded?: boolean;
  repliesLoaded?: boolean;
  replies?: StoreMessage[];
  has_attachments: boolean;
  isBot?: boolean;
  showReplies?: boolean;
}

// Attachment type
export interface Attachment {
  id: number;
  filename: string;
  file_type: string;
  file_path: string;
  message_id: number;
  file_size: number;
  created_at: string;
  updated_at: string;
}

// Reaction type
export interface RawReaction {
  id?: string | number;
  user_id?: string | number;
  userId?: string;
  emoji?: string;
  created_at?: string;
  createdAt?: string;
  message_id?: string | number;
}

export interface Reaction {
  id: string;
  messageId: string;
  userId: string;
  emoji: string;
  createdAt: string;
}

// Auth types
export interface AuthResponse {
  token: string;
  user: User;
}

export interface ApiAuthResponse {
  access_token: string;
  token_type: string;
  user: {
    id: string;
    username: string;
    email: string;
    full_name: string;
    status: 'online' | 'offline' | 'away' | 'busy';
    last_seen: string;
  };
}

// State types
export interface AuthState {
  isAuthenticated: boolean;
  user: User | null;
  token: string | null;
  loading: boolean;
  error: string | null;
}

export interface ChannelsState {
  channels: Channel[];
  activeChannel: Channel | null;
  loading: boolean;
  error: string | null;
}

export interface ChatState {
  activeChannelId: string | null;
  channels: Channel[];
  users: { [key: string]: User };
  loading: boolean;
  error: string | null;
}

export interface MessagesState {
  messagesByChannel: {
    [channelId: string]: StoreMessage[];
  };
  loading: boolean;
  error: string | null;
}

export interface UsersState {
  users: User[];
  onlineUsers: string[];
  loading: boolean;
  error: string | null;
}

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
  | 'pong'
  | 'reaction_added'
  | 'reaction_removed';

export interface WebSocketMessageData {
  channel_id?: number;
  message_id?: string;
  content?: string;
  id?: string | number;
  user_id?: string;
  status?: UserStatus;
  count?: number;
  message?: RawMessage;
  error?: string;
  parent_id?: string;
  reaction?: Reaction;
  emoji?: string;
}

export interface WebSocketMessage {
  type: WebSocketMessageType;
  data?: WebSocketMessageData;
  message?: string; // For error messages
}

// Root State type
export interface RootState {
  auth: AuthState;
  chat: ChatState;
  messages: MessagesState;
  users: UsersState;
}

export interface SearchResult {
  channels: ChannelSearchResult[];
  messages: MessageSearchResult[];
  files: FileSearchResult[];
}

export interface ChannelSearchResult {
  id: string;
  name: string;
  description?: string;
  is_direct_message: boolean;
  member_count: number;
}

export interface MessageSearchResult {
  id: string;
  content: string;
  created_at: string;
  sender_id: string;
  channel_id: string;
  channel_name: string;
}

export interface FileSearchResult {
  id: string;
  filename: string;
  file_type: string;
  file_path: string;
  created_at: string;
  channel_id: string;
  channel_name: string;
} 