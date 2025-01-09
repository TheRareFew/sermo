import { combineReducers } from '@reduxjs/toolkit';
import authReducer from './auth/authSlice';
import chatReducer from './chat/chatSlice';

const rootReducer = combineReducers({
  auth: authReducer,
  chat: chatReducer,
});

export type RootState = ReturnType<typeof rootReducer>;
export default rootReducer; 