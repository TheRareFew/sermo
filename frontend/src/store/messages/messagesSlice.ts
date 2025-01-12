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
      
      // Organize messages by parent/reply relationship
      const mainMessages: StoreMessage[] = [];
      const repliesByParentId: { [key: string]: StoreMessage[] } = {};

      // First pass: separate messages into main messages and replies
      messages.forEach(msg => {
        if (msg.parentId) {
          // This is a reply
          if (!repliesByParentId[msg.parentId]) {
            repliesByParentId[msg.parentId] = [];
          }
          repliesByParentId[msg.parentId].push(msg);
        } else {
          // This is a main message
          mainMessages.push(msg);
        }
      });

      // Second pass: attach replies to their parent messages
      mainMessages.forEach(msg => {
        if (repliesByParentId[msg.id]) {
          msg.replies = repliesByParentId[msg.id];
          msg.replyCount = repliesByParentId[msg.id].length;
          msg.repliesLoaded = true;
        }
      });

      // Update the state with organized messages
      state.messagesByChannel[channelId] = mainMessages;
      state.loading = false;
      state.error = null;
    },
    prependMessages: (state, action: PayloadAction<{ channelId: string; messages: StoreMessage[] }>) => {
      const { channelId, messages } = action.payload;
      if (!state.messagesByChannel[channelId]) {
        state.messagesByChannel[channelId] = [];
      }
      // Add messages to the beginning of the array, avoiding duplicates
      const existingIds = new Set(state.messagesByChannel[channelId].map(msg => msg.id));
      const newMessages = messages.filter(msg => !existingIds.has(msg.id));
      state.messagesByChannel[channelId] = [...newMessages, ...state.messagesByChannel[channelId]];
    },
    addMessage: (state, action: PayloadAction<{ channelId: string; message: StoreMessage }>) => {
      const { channelId, message } = action.payload;
      
      // Initialize channel messages array if it doesn't exist
      if (!state.messagesByChannel[channelId]) {
        state.messagesByChannel[channelId] = [];
      }

      // Check if message already exists
      const existingMessageIndex = state.messagesByChannel[channelId].findIndex(
        msg => msg.id === message.id
      );

      if (existingMessageIndex === -1) {
        // Add new message if it doesn't exist
        const newMessage = {
          ...message,
          replies: [],
          repliesLoaded: false,
          isExpanded: false,
          replyCount: message.replyCount || 0
        };
        
        state.messagesByChannel[channelId].push(newMessage);
        
        // Sort messages by creation time
        state.messagesByChannel[channelId].sort((a, b) => {
          const timeA = new Date(a.createdAt).getTime();
          const timeB = new Date(b.createdAt).getTime();
          return timeA - timeB;
        });

        // Update parent message if this is a reply
        if (message.parentId) {
          const parentMessage = state.messagesByChannel[channelId].find(
            msg => msg.id === message.parentId
          );
          if (parentMessage) {
            parentMessage.replyCount = (parentMessage.replyCount || 0) + 1;
            if (!parentMessage.replies) {
              parentMessage.replies = [];
            }
            parentMessage.replies.push(newMessage);
            // Sort replies by creation time
            parentMessage.replies.sort((a, b) => {
              const timeA = new Date(a.createdAt).getTime();
              const timeB = new Date(b.createdAt).getTime();
              return timeA - timeB;
            });
          }
        }
      } else {
        // Update existing message while preserving its state
        const existingMessage = state.messagesByChannel[channelId][existingMessageIndex];
        state.messagesByChannel[channelId][existingMessageIndex] = {
          ...message,
          replies: existingMessage.replies || [],
          repliesLoaded: existingMessage.repliesLoaded || false,
          isExpanded: existingMessage.isExpanded || false,
          replyCount: existingMessage.replyCount || 0
        };
      }
    },
    updateMessage: (state, action: PayloadAction<{ channelId: string; id: string; message: StoreMessage }>) => {
      const { channelId, id, message } = action.payload;
      const messages = state.messagesByChannel[channelId];
      if (!messages) return;

      // First check if it's a main message
      const index = messages.findIndex((msg: StoreMessage) => msg.id === id);
      if (index !== -1) {
        // Preserve existing state when updating
        const existingMessage = messages[index];
        messages[index] = {
          ...message,
          replies: existingMessage.replies || [],
          repliesLoaded: existingMessage.repliesLoaded || false,
          isExpanded: existingMessage.isExpanded || false,
          replyCount: existingMessage.replyCount || 0
        };
      } else {
        // Check if it's a reply to any message
        for (const mainMessage of messages) {
          if (mainMessage.replies) {
            const replyIndex = mainMessage.replies.findIndex(reply => reply.id === id);
            if (replyIndex !== -1) {
              // Preserve parent ID and other state when updating reply
              const existingReply = mainMessage.replies[replyIndex];
              mainMessage.replies[replyIndex] = {
                ...message,
                parentId: mainMessage.id,
                replies: existingReply.replies || [],
                repliesLoaded: existingReply.repliesLoaded || false,
                isExpanded: existingReply.isExpanded || false,
                replyCount: existingReply.replyCount || 0
              };
              break;
            }
          }
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
    setReplies: (state, action: PayloadAction<{ channelId: string; messageId: string; replies: StoreMessage[] }>) => {
      const { channelId, messageId, replies } = action.payload;
      const messages = state.messagesByChannel[channelId];
      if (messages) {
        const messageIndex = messages.findIndex((msg: StoreMessage) => msg.id === messageId);
        if (messageIndex !== -1) {
          // Create a new message object with the updated replies
          const updatedMessage = {
            ...messages[messageIndex],
            replies: [
              ...(messages[messageIndex].replies || []),
              ...replies.filter(reply => 
                !messages[messageIndex].replies?.some(existingReply => 
                  existingReply.id === reply.id
                )
              )
            ],
            repliesLoaded: true,
            isExpanded: true // Auto-expand when new replies are added
          };
          
          // Update reply count
          updatedMessage.replyCount = updatedMessage.replies.length;
          
          // Update the message in the array
          messages[messageIndex] = updatedMessage;
        }
      }
    },
    toggleExpanded: (state, action: PayloadAction<{ channelId: string; messageId: string }>) => {
      const { channelId, messageId } = action.payload;
      const messages = state.messagesByChannel[channelId];
      if (messages) {
        const message = messages.find((msg: StoreMessage) => msg.id === messageId);
        if (message) {
          message.isExpanded = !message.isExpanded;
        }
      }
    },
  },
});

export const {
  setMessages,
  prependMessages,
  addMessage,
  updateMessage,
  deleteMessage,
  addReaction,
  removeReaction,
  setReplies,
  toggleExpanded
} = messagesSlice.actions;

export default messagesSlice.reducer; 