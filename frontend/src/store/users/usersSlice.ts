import { createSlice, PayloadAction } from '@reduxjs/toolkit';
import { UsersState, User } from '../types';

const initialState: UsersState = {
  users: [],
  onlineUsers: [],
  loading: false,
  error: null,
};

const usersSlice = createSlice({
  name: 'users',
  initialState,
  reducers: {
    fetchUsersStart: (state) => {
      state.loading = true;
      state.error = null;
    },
    fetchUsersSuccess: (state, action: PayloadAction<User[]>) => {
      state.users = action.payload;
      state.loading = false;
      state.error = null;
    },
    fetchUsersFailure: (state, action: PayloadAction<string>) => {
      state.loading = false;
      state.error = action.payload;
    },
    updateUserPresence: (state, action: PayloadAction<{ userId: string; status: User['status'] }>) => {
      const user = state.users.find(u => u.id === action.payload.userId);
      if (user) {
        user.status = action.payload.status;
        if (action.payload.status === 'online') {
          if (!state.onlineUsers.includes(action.payload.userId)) {
            state.onlineUsers.push(action.payload.userId);
          }
        } else {
          state.onlineUsers = state.onlineUsers.filter(id => id !== action.payload.userId);
        }
      }
    },
    addUser: (state, action: PayloadAction<User>) => {
      const exists = state.users.some(user => user.id === action.payload.id);
      if (!exists) {
        state.users.push(action.payload);
        if (action.payload.status === 'online') {
          state.onlineUsers.push(action.payload.id);
        }
      }
    },
    removeUser: (state, action: PayloadAction<string>) => {
      state.users = state.users.filter(user => user.id !== action.payload);
      state.onlineUsers = state.onlineUsers.filter(id => id !== action.payload);
    },
  },
});

export const {
  fetchUsersStart,
  fetchUsersSuccess,
  fetchUsersFailure,
  updateUserPresence,
  addUser,
  removeUser,
} = usersSlice.actions;

export default usersSlice.reducer; 