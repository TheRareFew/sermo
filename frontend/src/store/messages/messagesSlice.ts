import { createSlice, PayloadAction } from '@reduxjs/toolkit';
import { MessagesState, Reaction, StoreMessage } from '../../types';

const initialState: MessagesState = {
  messagesByChannel: {},
  loading: false,
  error: null,
};

const messagesSlice = createSlice({
  name: 'messages',
  initialState,
  reducers: {
    setMessages: (state, action: PayloadAction<{ channelId: string; messages: StoreMessage[] }>) => {
      const { channelId, messages } = action.payload;
      state.messagesByChannel[channelId] = messages;
      state.loading = false;
      state.error = null;
    },
    addMessage: (state, action: PayloadAction<StoreMessage>) => {
      const { channelId } = action.payload;
      
      // Initialize channel messages array if it doesn't exist
      if (!state.messagesByChannel[channelId]) {
        state.messagesByChannel[channelId] = [];
      }

      // Check if message already exists
      const existingMessageIndex = state.messagesByChannel[channelId].findIndex(
        (msg: StoreMessage) => msg.id === action.payload.id
      );

      if (existingMessageIndex === -1) {
        // Add new message
        state.messagesByChannel[channelId].push(action.payload);
      }
    },
    updateMessage: (state, action: PayloadAction<{ channelId: string; id: string; message: StoreMessage }>) => {
      const { channelId, id } = action.payload;
      const messages = state.messagesByChannel[channelId];
      if (messages) {
        const index = messages.findIndex((msg: StoreMessage) => msg.id === id);
        if (index !== -1) {
          messages[index] = action.payload.message;
        }
      }
    },
    deleteMessage: (state, action: PayloadAction<{ channelId: string; messageId: string }>) => {
      const { channelId, messageId } = action.payload;
      const messages = state.messagesByChannel[channelId];
      if (messages) {
        state.messagesByChannel[channelId] = messages.filter((msg: StoreMessage) => msg.id !== messageId);
      }
    },
    addReaction: (state, action: PayloadAction<{ channelId: string; messageId: string; reaction: Reaction }>) => {
      const { channelId, messageId, reaction } = action.payload;
      const messages = state.messagesByChannel[channelId];
      if (messages) {
        const message = messages.find((msg: StoreMessage) => msg.id === messageId);
        if (message) {
          // Check if reaction already exists
          const existingReactionIndex = message.reactions.findIndex(
            (r: Reaction) => r.id === reaction.id || (r.emoji === reaction.emoji && r.userId === reaction.userId)
          );
          if (existingReactionIndex === -1) {
            message.reactions.push(reaction);
          }
        }
      }
    },
    removeReaction: (state, action: PayloadAction<{ channelId: string; messageId: string; reactionId: string }>) => {
      const { channelId, messageId, reactionId } = action.payload;
      const messages = state.messagesByChannel[channelId];
      if (messages) {
        const message = messages.find((msg: StoreMessage) => msg.id === messageId);
        if (message) {
          message.reactions = message.reactions.filter((reaction: Reaction) => reaction.id !== reactionId);
        }
      }
    },
  },
});

export const {
  setMessages,
  addMessage,
  updateMessage,
  deleteMessage,
  addReaction,
  removeReaction,
} = messagesSlice.actions;

export default messagesSlice.reducer; 