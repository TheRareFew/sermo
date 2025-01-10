// Auth types
export interface AuthResponse {
  token: string;
  user: User;
}

export interface ApiAuthResponse {
  access_token: string;
  token_type: string;
  user: {
    id: number;
    username: string;
    email: string;
    full_name: string;
    status: 'online' | 'offline' | 'away' | 'busy';
    last_seen: string;
  };
}

// User types
export interface User {
  id: number;
  username: string;
  email: string;
  full_name: string;
  status: 'online' | 'offline' | 'away' | 'busy';
  last_seen: string;
}

// Chat types
export interface Message {
  id: number;
  content: string;
  sender_id: number;
  channel_id: number;
  created_at: string;
  is_system?: boolean;
}

export interface Channel {
  id: number;
  name: string;
  description?: string;
  is_direct_message: boolean;
  created_at: string;
}

// State types
export interface AuthState {
  isAuthenticated: boolean;
  user: User | null;
  token: string | null;
  loading: boolean;
  error: string | null;
}

export interface ChatState {
  activeChannelId: number | null;
  channels: Channel[];
  users: { [userId: number]: User };
  loading: boolean;
  error: string | null;
}

// WebSocket types
export interface WebSocketMessage {
  type: string;
  id?: number;
  content?: string;
  sender_id?: number;
  channel_id?: number;
  created_at?: string;
  is_system?: boolean;
  user_id?: number;
  status?: User['status'];
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

// Reaction type
export interface Reaction {
  id: string;
  emoji: string;
  userId: string;
}

// Attachment type
export interface Attachment {
  id: string;
  type: 'image' | 'file';
  url: string;
  name: string;
  size: number;
} 