import { createSlice, PayloadAction } from '@reduxjs/toolkit';
import { ChatState, Message, Channel, User } from '../../types';

const initialState: ChatState = {
  activeChannelId: null,
  channels: [],
  messages: {},
  users: {},
  loading: false,
  error: null,
};

const chatSlice = createSlice({
  name: 'chat',
  initialState,
  reducers: {
    setActiveChannel: (state, action: PayloadAction<number>) => {
      state.activeChannelId = action.payload;
    },
    
    setChannels: (state, action: PayloadAction<Channel[]>) => {
      state.channels = action.payload;
    },
    
    addChannel: (state, action: PayloadAction<Channel>) => {
      state.channels.push(action.payload);
    },
    
    removeChannel: (state, action: PayloadAction<number>) => {
      state.channels = state.channels.filter(channel => channel.id !== action.payload);
      delete state.messages[action.payload];
    },
    
    setMessages: (state, action: PayloadAction<{ channelId: number; messages: Message[] }>) => {
      state.messages[action.payload.channelId] = action.payload.messages;
    },
    
    addMessage: (state, action: PayloadAction<Message>) => {
      const channelId = action.payload.channel_id;
      if (!state.messages[channelId]) {
        state.messages[channelId] = [];
      }
      state.messages[channelId].push(action.payload);
    },
    
    setUsers: (state, action: PayloadAction<User[]>) => {
      const users: { [userId: number]: User } = {};
      action.payload.forEach(user => {
        users[user.id] = user;
      });
      state.users = users;
    },
    
    updateUserStatus: (state, action: PayloadAction<{ userId: number; status: User['status'] }>) => {
      if (state.users[action.payload.userId]) {
        state.users[action.payload.userId].status = action.payload.status;
        state.users[action.payload.userId].last_seen = new Date().toISOString();
      }
    },
    
    setLoading: (state, action: PayloadAction<boolean>) => {
      state.loading = action.payload;
    },
    
    setError: (state, action: PayloadAction<string | null>) => {
      state.error = action.payload;
    },
  },
});

export const {
  setActiveChannel,
  setChannels,
  addChannel,
  removeChannel,
  setMessages,
  addMessage,
  setUsers,
  updateUserStatus,
  setLoading,
  setError,
} = chatSlice.actions;

export default chatSlice.reducer; 