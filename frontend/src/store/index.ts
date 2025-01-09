import { configureStore } from '@reduxjs/toolkit';
import authReducer from './auth/authSlice';
import channelsReducer from './channels/channelsSlice';
import messagesReducer from './messages/messagesSlice';
import usersReducer from './users/usersSlice';

export const store = configureStore({
  reducer: {
    auth: authReducer,
    channels: channelsReducer,
    messages: messagesReducer,
    users: usersReducer,
  },
  middleware: (getDefaultMiddleware) =>
    getDefaultMiddleware({
      serializableCheck: {
        // Ignore these action types
        ignoredActions: ['auth/login/fulfilled', 'auth/logout/fulfilled'],
      },
    }),
});

export type AppDispatch = typeof store.dispatch; 