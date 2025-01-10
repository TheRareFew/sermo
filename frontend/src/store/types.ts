// Auth State
export interface AuthState {
  isAuthenticated: boolean;
  user: User | null;
  token: string | null;
  loading: boolean;
  error: string | null;
}

// User Type
export interface User {
  id: string;
  username: string;
  email: string;
  avatar?: string;
  status?: 'online' | 'away' | 'offline';
}

// Channel State
export interface ChannelsState {
  channels: Channel[];
  activeChannel: Channel | null;
  loading: boolean;
  error: string | null;
}

// Channel Type
export interface Channel {
  id: string;
  name: string;
  description?: string;
  isPrivate: boolean;
  members: string[];
  unreadCount: number;
  createdAt: string;
  updatedAt: string;
}

// Messages State
export interface MessagesState {
  messagesByChannel: {
    [channelId: string]: StoreMessage[];
  };
  loading: boolean;
  error: string | null;
}

// Store Message Type
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

// Attachment Type
export interface Attachment {
  id: string;
  type: 'image' | 'file';
  url: string;
  name: string;
  size: number;
}

// Reaction Type
export interface Reaction {
  id: string;
  emoji: string;
  userId: string;
}

// Users State
export interface UsersState {
  users: User[];
  onlineUsers: string[];
  loading: boolean;
  error: string | null;
}

// Root State
export interface RootState {
  auth: AuthState;
  chat: ChatState;
  messages: MessagesState;
  users: UsersState;
}

// Chat State
export interface ChatState {
  activeChannelId: number | null;
  channels: Channel[];
  users: { [userId: number]: User };
  loading: boolean;
  error: string | null;
} 