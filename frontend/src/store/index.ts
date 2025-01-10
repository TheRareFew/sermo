import { configureStore } from '@reduxjs/toolkit';
import authReducer from './auth/authSlice';
import chatReducer from './chat/chatSlice';
import messagesReducer from './messages/messagesSlice';

export const store = configureStore({
  reducer: {
    auth: authReducer,
    chat: chatReducer,
    messages: messagesReducer,
  },
  middleware: (getDefaultMiddleware) =>
    getDefaultMiddleware({
      serializableCheck: {
        // Ignore these action types
        ignoredActions: ['auth/login/fulfilled', 'auth/logout/fulfilled'],
      },
    }),
});

export type RootState = ReturnType<typeof store.getState>;
export type AppDispatch = typeof store.dispatch; 