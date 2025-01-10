// Base types
export interface User {
  id: string;
  username: string;
  email: string;
  full_name: string;
  status: 'online' | 'offline' | 'away' | 'busy';
  last_seen: string;
}

export interface Channel {
  id: string;
  name: string;
  description?: string;
  is_direct_message: boolean;
  created_at: string;
  unreadCount: number;
}

export interface Message {
  id: string;
  content: string;
  sender_id: string;
  channel_id: string;
  created_at: string;
  is_system?: boolean;
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
}

// Attachment type
export interface Attachment {
  id: string;
  type: 'image' | 'file';
  url: string;
  name: string;
  size: number;
}

// Reaction type
export interface Reaction {
  id: string;
  emoji: string;
  userId: string;
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

// WebSocket types
export interface WebSocketMessage {
  type: string;
  id?: string;
  content?: string;
  sender_id?: string;
  channel_id?: string;
  created_at?: string;
  is_system?: boolean;
  user_id?: string;
  status?: User['status'];
  message?: Message;
}

// Root State type
export interface RootState {
  auth: AuthState;
  chat: ChatState;
  messages: MessagesState;
  users: UsersState;
} 