import { createSlice, PayloadAction } from '@reduxjs/toolkit';
import { MessagesState, Reaction, StoreMessage } from '../types';
import { Message as ApiMessage } from '../../types';

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
      console.log('Starting message fetch');
      state.loading = true;
      state.error = null;
    },
    fetchMessagesSuccess: (state, action: PayloadAction<{ channelId: string; messages: StoreMessage[] }>) => {
      console.log('Message fetch success:', action.payload);
      // Sort messages by createdAt in ascending order (oldest first)
      const sortedMessages = action.payload.messages.sort((a, b) => 
        new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
      );

      state.messagesByChannel[action.payload.channelId] = sortedMessages;
      state.loading = false;
      state.error = null;
      console.log('Updated message state:', state.messagesByChannel);
    },
    fetchMessagesFailure: (state, action: PayloadAction<string>) => {
      console.log('Message fetch failed:', action.payload);
      state.loading = false;
      state.error = action.payload;
    },
    addMessage: (state, action: PayloadAction<StoreMessage>) => {
      console.log('Adding message:', action.payload);
      const { channelId } = action.payload;
      if (!state.messagesByChannel[channelId]) {
        state.messagesByChannel[channelId] = [];
      }
      // Check if message already exists
      const existingMessageIndex = state.messagesByChannel[channelId].findIndex(
        msg => msg.id === action.payload.id
      );
      if (existingMessageIndex === -1) {
        // Add new message at the end (it's the newest)
        state.messagesByChannel[channelId].push(action.payload);
        // Sort messages by createdAt
        state.messagesByChannel[channelId].sort((a, b) => 
          new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
        );
        console.log('Updated message state after add:', state.messagesByChannel);
      } else {
        console.log('Message already exists:', action.payload);
      }
    },
    updateMessage: (state, action: PayloadAction<StoreMessage>) => {
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
          // Check if reaction already exists
          const existingReactionIndex = message.reactions.findIndex(
            r => r.id === reaction.id || (r.emoji === reaction.emoji && r.userId === reaction.userId)
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