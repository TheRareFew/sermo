// Auth types
export interface AuthResponse {
  user: User;
  token: string;  // This is the access_token from the backend
  refresh_token?: string;
}

export interface ApiAuthResponse {
  access_token: string;
  token_type: string;
  refresh_token: string;
  user?: User;
}

// User types
export interface User {
  id: number;
  username: string;
  email: string;
  full_name: string;
  status?: 'online' | 'offline' | 'away' | 'busy';
  last_seen?: string;
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
  description: string | null;
  is_direct_message: boolean;
  created_at: string;
  created_by_id: number;
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
  messages: { [channelId: number]: Message[] };
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
  status?: 'online' | 'offline' | 'away' | 'busy';
  [key: string]: any;
} 