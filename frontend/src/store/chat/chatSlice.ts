import { createSlice, PayloadAction } from '@reduxjs/toolkit';
import { ChatState, Channel, User } from '../../types';

const initialState: ChatState = {
  channels: [],
  activeChannelId: null,
  users: {},
  loading: false,
  error: null
};

const chatSlice = createSlice({
  name: 'chat',
  initialState,
  reducers: {
    setChannels: (state, action: PayloadAction<Channel[]>) => {
      state.channels = action.payload;
    },
    setActiveChannel: (state, action: PayloadAction<string>) => {
      state.activeChannelId = action.payload;
    },
    addChannel: (state, action: PayloadAction<Channel>) => {
      state.channels.push(action.payload);
    },
    removeChannel: (state, action: PayloadAction<string>) => {
      state.channels = state.channels.filter(channel => channel.id !== action.payload);
      if (state.activeChannelId === action.payload) {
        state.activeChannelId = null;
      }
    },
    setUsers: (state, action: PayloadAction<{ [key: string]: User }>) => {
      state.users = action.payload;
    },
    updateUserStatus: (state, action: PayloadAction<{ userId: string; status: 'online' | 'offline' | 'away' | 'busy' }>) => {
      if (state.users[action.payload.userId]) {
        state.users[action.payload.userId].status = action.payload.status;
      }
    },
    updateChannelUnreadCount: (state, action: PayloadAction<{ channelId: string; count: number }>) => {
      const channel = state.channels.find(ch => ch.id === action.payload.channelId);
      if (channel) {
        channel.unreadCount = action.payload.count;
      }
    },
    setLoading: (state, action: PayloadAction<boolean>) => {
      state.loading = action.payload;
    },
    setError: (state, action: PayloadAction<string | null>) => {
      state.error = action.payload;
    }
  }
});

export const {
  setChannels,
  setActiveChannel,
  addChannel,
  removeChannel,
  setUsers,
  updateUserStatus,
  updateChannelUnreadCount,
  setLoading,
  setError
} = chatSlice.actions;

export default chatSlice.reducer; 