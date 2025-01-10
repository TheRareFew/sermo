import { createSlice, PayloadAction } from '@reduxjs/toolkit';
import { ChannelsState, Channel } from '../../types';

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
    setChannels: (state, action: PayloadAction<Channel[]>) => {
      state.channels = action.payload;
      state.loading = false;
      state.error = null;
    },
    setActiveChannel: (state, action: PayloadAction<Channel>) => {
      state.activeChannel = action.payload;
    },
    addChannel: (state, action: PayloadAction<Channel>) => {
      state.channels.push(action.payload);
    },
    updateChannelUnreadCount: (state, action: PayloadAction<{ channelId: string; count: number }>) => {
      const channel = state.channels.find((c: Channel) => c.id === action.payload.channelId);
      if (channel) {
        channel.unreadCount = action.payload.count;
      }
    },
    setLoading: (state, action: PayloadAction<boolean>) => {
      state.loading = action.payload;
      state.error = null;
    },
    removeChannel: (state, action: PayloadAction<string>) => {
      state.channels = state.channels.filter((channel: Channel) => channel.id !== action.payload);
      if (state.activeChannel?.id === action.payload) {
        state.activeChannel = null;
      }
    },
  },
});

export const {
  setChannels,
  setActiveChannel,
  addChannel,
  updateChannelUnreadCount,
  setLoading,
  removeChannel,
} = channelsSlice.actions;

export default channelsSlice.reducer; 