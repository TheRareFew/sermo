import { createSlice, PayloadAction } from '@reduxjs/toolkit';
import { ChannelsState, Channel } from '../types';

const initialState: ChannelsState = {
  channels: [],
  activeChannel: null,
  loading: false,
  error: null,
};

const channelsSlice = createSlice({
  name: 'channels',
  initialState,
  reducers: {
    fetchChannelsStart: (state) => {
      state.loading = true;
      state.error = null;
    },
    fetchChannelsSuccess: (state, action: PayloadAction<Channel[]>) => {
      state.channels = action.payload;
      state.loading = false;
      state.error = null;
    },
    fetchChannelsFailure: (state, action: PayloadAction<string>) => {
      state.loading = false;
      state.error = action.payload;
    },
    setActiveChannel: (state, action: PayloadAction<Channel>) => {
      state.activeChannel = action.payload;
    },
    updateChannelUnreadCount: (state, action: PayloadAction<{ channelId: string; count: number }>) => {
      const channel = state.channels.find(c => c.id === action.payload.channelId);
      if (channel) {
        channel.unreadCount = action.payload.count;
      }
    },
    addChannel: (state, action: PayloadAction<Channel>) => {
      state.channels.push(action.payload);
    },
    removeChannel: (state, action: PayloadAction<string>) => {
      state.channels = state.channels.filter(channel => channel.id !== action.payload);
      if (state.activeChannel?.id === action.payload) {
        state.activeChannel = null;
      }
    },
  },
});

export const {
  fetchChannelsStart,
  fetchChannelsSuccess,
  fetchChannelsFailure,
  setActiveChannel,
  updateChannelUnreadCount,
  addChannel,
  removeChannel,
} = channelsSlice.actions;

export default channelsSlice.reducer; 