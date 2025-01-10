import { createSlice, PayloadAction } from '@reduxjs/toolkit';
import { ChatState, Channel, User } from '../../types';

const initialState: ChatState = {
  activeChannelId: null,
  channels: [],
  users: {} as { [key: string]: User },
  loading: false,
  error: null,
};

const chatSlice = createSlice({
  name: 'chat',
  initialState,
  reducers: {
    setActiveChannel: (state, action: PayloadAction<string>) => {
      console.log('Setting active channel:', action.payload);
      state.activeChannelId = action.payload;
    },
    
    setChannels: (state, action: PayloadAction<Channel[]>) => {
      console.log('Setting channels:', action.payload);
      state.channels = action.payload;
    },
    
    addChannel: (state, action: PayloadAction<Channel>) => {
      console.log('Adding channel:', action.payload);
      state.channels.push(action.payload);
    },
    
    removeChannel: (state, action: PayloadAction<string>) => {
      console.log('Removing channel:', action.payload);
      state.channels = state.channels.filter(channel => channel.id !== action.payload);
    },
    
    setUsers: (state, action: PayloadAction<User[]>) => {
      console.log('Setting users:', action.payload);
      state.users = action.payload.reduce((acc, user) => {
        acc[user.id] = user;
        return acc;
      }, {} as { [key: string]: User });
    },
    
    updateUserStatus: (state, action: PayloadAction<{ userId: string; status: User['status'] }>) => {
      console.log('Updating user status:', action.payload);
      const user = state.users[action.payload.userId];
      if (user) {
        user.status = action.payload.status;
        user.last_seen = new Date().toISOString();
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
  setUsers,
  updateUserStatus,
  setLoading,
  setError,
} = chatSlice.actions;

export default chatSlice.reducer; 