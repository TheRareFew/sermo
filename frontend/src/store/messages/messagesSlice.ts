import { createSlice, PayloadAction } from '@reduxjs/toolkit';
import { MessagesState, Message, Reaction } from '../types';

const initialState: MessagesState = {
  messagesByChannel: {},
  loading: false,
  error: null,
};

const messagesSlice = createSlice({
  name: 'messages',
  initialState,
  reducers: {
    fetchMessagesStart: (state) => {
      state.loading = true;
      state.error = null;
    },
    fetchMessagesSuccess: (state, action: PayloadAction<{ channelId: string; messages: Message[] }>) => {
      state.messagesByChannel[action.payload.channelId] = action.payload.messages;
      state.loading = false;
      state.error = null;
    },
    fetchMessagesFailure: (state, action: PayloadAction<string>) => {
      state.loading = false;
      state.error = action.payload;
    },
    addMessage: (state, action: PayloadAction<Message>) => {
      const { channelId } = action.payload;
      if (!state.messagesByChannel[channelId]) {
        state.messagesByChannel[channelId] = [];
      }
      state.messagesByChannel[channelId].push(action.payload);
    },
    updateMessage: (state, action: PayloadAction<Message>) => {
      const { channelId, id } = action.payload;
      const messages = state.messagesByChannel[channelId];
      if (messages) {
        const index = messages.findIndex(msg => msg.id === id);
        if (index !== -1) {
          messages[index] = action.payload;
        }
      }
    },
    deleteMessage: (state, action: PayloadAction<{ channelId: string; messageId: string }>) => {
      const { channelId, messageId } = action.payload;
      const messages = state.messagesByChannel[channelId];
      if (messages) {
        state.messagesByChannel[channelId] = messages.filter(msg => msg.id !== messageId);
      }
    },
    addReaction: (state, action: PayloadAction<{ channelId: string; messageId: string; reaction: Reaction }>) => {
      const { channelId, messageId, reaction } = action.payload;
      const messages = state.messagesByChannel[channelId];
      if (messages) {
        const message = messages.find(msg => msg.id === messageId);
        if (message) {
          message.reactions.push(reaction);
        }
      }
    },
    removeReaction: (state, action: PayloadAction<{ channelId: string; messageId: string; reactionId: string }>) => {
      const { channelId, messageId, reactionId } = action.payload;
      const messages = state.messagesByChannel[channelId];
      if (messages) {
        const message = messages.find(msg => msg.id === messageId);
        if (message) {
          message.reactions = message.reactions.filter(reaction => reaction.id !== reactionId);
        }
      }
    },
  },
});

export const {
  fetchMessagesStart,
  fetchMessagesSuccess,
  fetchMessagesFailure,
  addMessage,
  updateMessage,
  deleteMessage,
  addReaction,
  removeReaction,
} = messagesSlice.actions;

export default messagesSlice.reducer; 