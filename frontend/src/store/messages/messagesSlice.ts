import { createSlice, PayloadAction } from '@reduxjs/toolkit';
import { StoreMessage, Reaction } from '../../types';

interface MessagesState {
  messagesByChannel: {
    [channelId: string]: StoreMessage[];
  };
  loading: boolean;
  error: string | null;
}

const initialState: MessagesState = {
  messagesByChannel: {},
  loading: false,
  error: null
};

const messagesSlice = createSlice({
  name: 'messages',
  initialState,
  reducers: {
    setMessages: (state, action: PayloadAction<{ channelId: string; messages: StoreMessage[] }>) => {
      const { channelId, messages } = action.payload;
      console.log('Setting messages for channel:', channelId, messages);
      
      // First, separate replies from main messages
      const mainMessages: StoreMessage[] = [];
      const repliesByParentId: { [key: string]: StoreMessage[] } = {};

      messages.forEach(message => {
        if (message.parentId) {
          // This is a reply
          if (!repliesByParentId[message.parentId]) {
            repliesByParentId[message.parentId] = [];
          }
          repliesByParentId[message.parentId].push({
            ...message,
            reactions: message.reactions || [],
            attachments: message.attachments || [],
            replyCount: 0,
            isExpanded: false,
            repliesLoaded: false
          });
        } else {
          // This is a main message
          mainMessages.push({
            ...message,
            reactions: message.reactions || [],
            attachments: message.attachments || [],
            replyCount: message.replyCount || 0,
            isExpanded: false,
            repliesLoaded: false,
            replies: []
          });
        }
      });

      // Now attach replies to their parent messages
      mainMessages.forEach(message => {
        if (repliesByParentId[message.id]) {
          message.replies = repliesByParentId[message.id];
          message.replyCount = repliesByParentId[message.id].length;
        }
      });

      state.messagesByChannel[channelId] = mainMessages;
      console.log('Updated messages state:', state.messagesByChannel[channelId]);
    },
    addMessage: (state, action: PayloadAction<{ channelId: string; message: StoreMessage }>) => {
      const { channelId, message } = action.payload;
      console.log('Adding message:', { channelId, message });
      if (!state.messagesByChannel[channelId]) {
        state.messagesByChannel[channelId] = [];
      }

      // If this is a reply, update the parent message's reply count and replies array
      if (message.parentId) {
        const parentIndex = state.messagesByChannel[channelId].findIndex(
          m => m.id === message.parentId
        );
        if (parentIndex !== -1) {
          const parent = state.messagesByChannel[channelId][parentIndex];
          parent.replyCount = (parent.replyCount || 0) + 1;
          parent.replies = [...(parent.replies || []), {
            ...message,
            reactions: message.reactions || [],
            attachments: message.attachments || [],
            replyCount: 0,
            isExpanded: false,
            repliesLoaded: false
          }];
          // Update the parent message
          state.messagesByChannel[channelId][parentIndex] = { ...parent };
        }
      }

      // Add the message to the main array only if it's not a reply
      if (!message.parentId) {
        state.messagesByChannel[channelId].push({
          ...message,
          reactions: message.reactions || [],
          attachments: message.attachments || [],
          replyCount: message.replyCount || 0,
          isExpanded: false,
          repliesLoaded: false,
          replies: message.replies || []
        });
      }
      
      console.log('Updated messages state:', state.messagesByChannel[channelId]);
    },
    prependMessages: (state, action: PayloadAction<{ channelId: string; messages: StoreMessage[] }>) => {
      const { channelId, messages } = action.payload;
      console.log('Prepending messages:', { channelId, messages });
      if (!state.messagesByChannel[channelId]) {
        state.messagesByChannel[channelId] = [];
      }
      state.messagesByChannel[channelId].unshift(...messages.map(message => ({
        ...message,
        reactions: message.reactions || [],
        attachments: message.attachments || [],
        replyCount: message.replyCount || 0,
        isExpanded: false,
        repliesLoaded: false
      })));
      console.log('Updated messages state:', state.messagesByChannel[channelId]);
    },
    updateMessage: (state, action: PayloadAction<{ channelId: string; messageId: string; message: Partial<StoreMessage> }>) => {
      const { channelId, messageId, message } = action.payload;
      console.log('Updating message:', { channelId, messageId, message });
      const messageIndex = state.messagesByChannel[channelId]?.findIndex(m => m.id === messageId);
      if (messageIndex !== undefined && messageIndex !== -1) {
        state.messagesByChannel[channelId][messageIndex] = {
          ...state.messagesByChannel[channelId][messageIndex],
          ...message,
          reactions: message.reactions || state.messagesByChannel[channelId][messageIndex].reactions || [],
          attachments: message.attachments || state.messagesByChannel[channelId][messageIndex].attachments || []
        };
        console.log('Updated message:', state.messagesByChannel[channelId][messageIndex]);
      }
    },
    deleteMessage: (state, action: PayloadAction<{ channelId: string; messageId: string }>) => {
      const { channelId, messageId } = action.payload;
      if (state.messagesByChannel[channelId]) {
        state.messagesByChannel[channelId] = state.messagesByChannel[channelId].filter(message => message.id !== messageId);
      }
    },
    toggleReplies: (state, action: PayloadAction<{ channelId: string; messageId: string }>) => {
      const { channelId, messageId } = action.payload;
      console.log('toggleReplies reducer:', { channelId, messageId });
      
      const messages = state.messagesByChannel[channelId];
      if (!messages) {
        console.warn('Channel not found:', channelId);
        return;
      }

      const messageIndex = messages.findIndex(m => m.id === messageId);
      if (messageIndex === -1) {
        console.warn('Message not found:', messageId);
        return;
      }

      console.log('Current message state:', messages[messageIndex]);
      
      // Toggle the isExpanded state
      messages[messageIndex] = {
        ...messages[messageIndex],
        isExpanded: !messages[messageIndex].isExpanded
      };
      
      // Force a state update by creating a new array reference
      state.messagesByChannel[channelId] = [...messages];
      
      console.log('Updated message state:', messages[messageIndex]);
    },
    addReaction: (state, action: PayloadAction<{ channelId: string; messageId: string; reaction: Reaction }>) => {
      const { channelId, messageId, reaction } = action.payload;
      console.log('Adding reaction:', {
        channelId,
        messageId,
        reaction
      });
      
      const messages = state.messagesByChannel[channelId];
      if (!messages) {
        console.warn('Channel not found:', channelId);
        return;
      }

      const messageIndex = messages.findIndex(m => m.id === messageId);
      if (messageIndex === -1) {
        console.warn('Message not found:', messageId);
        return;
      }

      const message = messages[messageIndex];
      if (!message.reactions) {
        message.reactions = [];
      }
      
      const existingIndex = message.reactions.findIndex(r => 
        r.userId === reaction.userId && r.emoji === reaction.emoji
      );
      console.log('Existing reaction index:', existingIndex);
      
      if (existingIndex === -1) {
        message.reactions = [...message.reactions, reaction];
        state.messagesByChannel[channelId] = [...messages];
        console.log('Added reaction, new state:', state.messagesByChannel[channelId][messageIndex]);
      } else {
        console.log('Reaction already exists, skipping');
      }
    },
    removeReaction: (state, action: PayloadAction<{ channelId: string; messageId: string; userId: string; emoji: string }>) => {
      const { channelId, messageId, userId, emoji } = action.payload;
      console.log('Removing reaction:', {
        channelId,
        messageId,
        userId,
        emoji
      });
      
      const messages = state.messagesByChannel[channelId];
      if (!messages) {
        console.warn('Channel not found:', channelId);
        return;
      }

      const messageIndex = messages.findIndex(m => m.id === messageId);
      if (messageIndex === -1) {
        console.warn('Message not found:', messageId);
        return;
      }

      const message = messages[messageIndex];
      if (!message.reactions) {
        console.warn('Message has no reactions:', messageId);
        return;
      }
      
      const initialLength = message.reactions.length;
      message.reactions = message.reactions.filter(r => 
        !(r.userId === userId && r.emoji === emoji)
      );
      
      if (message.reactions.length !== initialLength) {
        state.messagesByChannel[channelId] = [...messages];
        console.log('Removed reaction, new state:', state.messagesByChannel[channelId][messageIndex]);
      } else {
        console.log('No reaction was removed');
      }
    },
  },
});

export const { 
  setMessages, 
  addMessage, 
  prependMessages, 
  updateMessage, 
  deleteMessage, 
  toggleReplies,
  addReaction,
  removeReaction
} = messagesSlice.actions;

export default messagesSlice.reducer; 