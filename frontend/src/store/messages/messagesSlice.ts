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

const processMessages = (messages: StoreMessage[]) => {
  const repliesByParentId: { [key: string]: StoreMessage[] } = {};
  const mainMessages: StoreMessage[] = [];

  messages.forEach(message => {
    if (message.parent_id) {
      // This is a reply
      if (!repliesByParentId[message.parent_id]) {
        repliesByParentId[message.parent_id] = [];
      }
      repliesByParentId[message.parent_id].push({
        ...message,
        reactions: message.reactions || [],
        attachments: message.attachments || [],
        reply_count: 0,
        isExpanded: false,
        repliesLoaded: false
      });
    } else {
      // This is a main message
      mainMessages.push({
        ...message,
        reactions: message.reactions || [],
        attachments: message.attachments || [],
        reply_count: message.reply_count || 0,
        isExpanded: false,
        repliesLoaded: false,
        replies: []
      });
    }
  });

  // Add replies to their parent messages
  mainMessages.forEach(message => {
    if (repliesByParentId[message.id]) {
      message.replies = repliesByParentId[message.id];
      message.reply_count = repliesByParentId[message.id].length;
    }
  });

  // Sort messages by created_at timestamp
  mainMessages.sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());

  return mainMessages;
};

export const messagesSlice = createSlice({
  name: 'messages',
  initialState,
  reducers: {
    setMessages: (state, action: PayloadAction<{ channelId: string; messages: StoreMessage[] }>) => {
      const { channelId, messages } = action.payload;
      
      // Process messages to handle replies and sorting
      const mainMessages = processMessages(messages);
      state.messagesByChannel[channelId] = mainMessages;
    },

    prependMessages: (state, action: PayloadAction<{ channelId: string; messages: StoreMessage[]; replace?: boolean }>) => {
      const { channelId, messages, replace } = action.payload;
      
      if (!state.messagesByChannel[channelId]) {
        state.messagesByChannel[channelId] = [];
      }

      const mainMessages = processMessages(messages);

      if (replace) {
        state.messagesByChannel[channelId] = mainMessages;
      } else {
        state.messagesByChannel[channelId] = [...mainMessages, ...state.messagesByChannel[channelId]];
      }
    },

    addMessage: (state, action: PayloadAction<{ channelId: string; message: StoreMessage }>) => {
      const { channelId, message } = action.payload;

      if (!state.messagesByChannel[channelId]) {
        state.messagesByChannel[channelId] = [];
      }

      // Check if message already exists
      const existingMessageIndex = state.messagesByChannel[channelId].findIndex(m => m.id === message.id);
      
      if (existingMessageIndex !== -1) {
        // Update existing message instead of adding a new one
        state.messagesByChannel[channelId][existingMessageIndex] = {
          ...state.messagesByChannel[channelId][existingMessageIndex],
          ...message,
          reactions: message.reactions || state.messagesByChannel[channelId][existingMessageIndex].reactions,
          attachments: message.attachments || state.messagesByChannel[channelId][existingMessageIndex].attachments,
          reply_count: message.reply_count || state.messagesByChannel[channelId][existingMessageIndex].reply_count,
          replies: state.messagesByChannel[channelId][existingMessageIndex].replies || []
        };
        return;
      }

      // If this is a reply, update the parent message's reply count and replies array
      if (message.parent_id) {
        const parentIndex = state.messagesByChannel[channelId].findIndex(
          m => m.id === message.parent_id
        );
        if (parentIndex !== -1) {
          const parent = state.messagesByChannel[channelId][parentIndex];
          parent.reply_count = (parent.reply_count || 0) + 1;
          parent.replies = [...(parent.replies || []), {
            ...message,
            reactions: message.reactions || [],
            attachments: message.attachments || [],
            reply_count: 0,
            isExpanded: false,
            repliesLoaded: false
          }];
        }
      }

      // Add the message to the main array only if it's not a reply
      if (!message.parent_id) {
        // If this is a server response for a temporary message, replace the temp message
        if (!message.isTemp) {
          const tempIndex = state.messagesByChannel[channelId].findIndex(
            m => m.isTemp && m.content === message.content
          );
          if (tempIndex !== -1) {
            // Replace the temporary message with the server response
            state.messagesByChannel[channelId][tempIndex] = {
              ...message,
              reactions: message.reactions || [],
              attachments: message.attachments || [],
              reply_count: message.reply_count || 0,
              isExpanded: false,
              repliesLoaded: false,
              replies: message.replies || []
            };
          } else {
            // Add as a new message
            state.messagesByChannel[channelId].push({
              ...message,
              reactions: message.reactions || [],
              attachments: message.attachments || [],
              reply_count: message.reply_count || 0,
              isExpanded: false,
              repliesLoaded: false,
              replies: message.replies || []
            });
          }
        } else {
          // Add temporary message
          state.messagesByChannel[channelId].push({
            ...message,
            reactions: message.reactions || [],
            attachments: message.attachments || [],
            reply_count: message.reply_count || 0,
            isExpanded: false,
            repliesLoaded: false,
            replies: message.replies || []
          });
        }
      }
    },

    deleteMessage: (state, action: PayloadAction<{ channelId: string; messageId: string }>) => {
      const { channelId, messageId } = action.payload;
      if (state.messagesByChannel[channelId]) {
        state.messagesByChannel[channelId] = state.messagesByChannel[channelId].filter(message => message.id !== messageId);
      }
    },

    updateMessage: (state, action: PayloadAction<{ channelId: string; messageId: string; message: Partial<StoreMessage> }>) => {
      const { channelId, messageId, message } = action.payload;
      const messageIndex = state.messagesByChannel[channelId]?.findIndex(m => m.id === messageId);
      if (messageIndex !== undefined && messageIndex !== -1) {
        state.messagesByChannel[channelId][messageIndex] = {
          ...state.messagesByChannel[channelId][messageIndex],
          ...message,
          reactions: message.reactions || state.messagesByChannel[channelId][messageIndex].reactions || [],
          attachments: message.attachments || state.messagesByChannel[channelId][messageIndex].attachments || []
        };
      }
    },

    addReaction: (state, action: PayloadAction<{ channelId: string; messageId: string; reaction: Reaction }>) => {
      const { channelId, messageId, reaction } = action.payload;
      const messages = state.messagesByChannel[channelId];
      if (!messages) return;

      // First, try to find the message in the main messages array
      const messageIndex = messages.findIndex(m => m.id === messageId);
      if (messageIndex !== -1) {
        const message = messages[messageIndex];
        if (!message.reactions) {
          message.reactions = [];
        }
        
        const existingIndex = message.reactions.findIndex(r => 
          r.userId === reaction.userId && r.emoji === reaction.emoji
        );
        
        if (existingIndex === -1) {
          message.reactions = [...message.reactions, reaction];
        }
        return;
      }

      // If not found in main messages, look for it in replies
      for (const mainMessage of messages) {
        if (mainMessage.replies) {
          const replyIndex = mainMessage.replies.findIndex(r => r.id === messageId);
          if (replyIndex !== -1) {
            const reply = mainMessage.replies[replyIndex];
            if (!reply.reactions) {
              reply.reactions = [];
            }

            const existingIndex = reply.reactions.findIndex(r =>
              r.userId === reaction.userId && r.emoji === reaction.emoji
            );

            if (existingIndex === -1) {
              reply.reactions = [...reply.reactions, reaction];
            }
            return;
          }
        }
      }
    },

    removeReaction: (state, action: PayloadAction<{ channelId: string; messageId: string; userId: string; emoji: string }>) => {
      const { channelId, messageId, userId, emoji } = action.payload;
      const messages = state.messagesByChannel[channelId];
      if (!messages) return;

      // First, try to find the message in the main messages array
      const messageIndex = messages.findIndex(m => m.id === messageId);
      if (messageIndex !== -1) {
        const message = messages[messageIndex];
        if (!message.reactions) return;
        
        message.reactions = message.reactions.filter(r => 
          !(r.userId === userId && r.emoji === emoji)
        );
        return;
      }

      // If not found in main messages, look for it in replies
      for (const mainMessage of messages) {
        if (mainMessage.replies) {
          const replyIndex = mainMessage.replies.findIndex(r => r.id === messageId);
          if (replyIndex !== -1) {
            const reply = mainMessage.replies[replyIndex];
            if (!reply.reactions) return;

            reply.reactions = reply.reactions.filter(r =>
              !(r.userId === userId && r.emoji === emoji)
            );
            return;
          }
        }
      }
    },

    toggleReplies: (state, action: PayloadAction<{ channelId: string; messageId: string }>) => {
      const { channelId, messageId } = action.payload;
      const messages = state.messagesByChannel[channelId];
      if (!messages) return;

      const messageIndex = messages.findIndex(m => m.id === messageId);
      if (messageIndex === -1) return;

      const newState = !messages[messageIndex].isExpanded;
      
      messages[messageIndex] = {
        ...messages[messageIndex],
        isExpanded: newState
      };
    }
  }
});

export const { 
  setMessages,
  prependMessages, 
  addMessage, 
  deleteMessage,
  updateMessage,
  addReaction,
  removeReaction,
  toggleReplies
} = messagesSlice.actions;

export default messagesSlice.reducer; 