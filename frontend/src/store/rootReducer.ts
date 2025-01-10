import { combineReducers } from '@reduxjs/toolkit';
import authReducer from './auth/authSlice';
import chatReducer from './chat/chatSlice';
import messagesReducer from './messages/messagesSlice';

const rootReducer = combineReducers({
  auth: authReducer,
  chat: chatReducer,
  messages: messagesReducer,
});

export type RootState = ReturnType<typeof rootReducer>;
export default rootReducer; 