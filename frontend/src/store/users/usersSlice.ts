import { createSlice, PayloadAction } from '@reduxjs/toolkit';
import { UsersState, User } from '../../types';

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
    setUsers: (state, action: PayloadAction<User[]>) => {
      state.users = action.payload;
      state.onlineUsers = action.payload
        .filter(user => user.status === 'online')
        .map(user => user.id);
    },
    updateUserPresence: (state, action: PayloadAction<{ userId: string; status: User['status'] }>) => {
      const user = state.users.find(u => u.id === action.payload.userId);
      if (user) {
        user.status = action.payload.status;
        if (action.payload.status === 'online') {
          if (!state.onlineUsers.includes(user.id)) {
            state.onlineUsers.push(user.id);
          }
        } else {
          state.onlineUsers = state.onlineUsers.filter(id => id !== user.id);
        }
      }
    },
    removeUser: (state, action: PayloadAction<string>) => {
      state.users = state.users.filter(user => user.id !== action.payload);
      state.onlineUsers = state.onlineUsers.filter(id => id !== action.payload);
    },
  },
});

export const { setUsers, updateUserPresence, removeUser } = usersSlice.actions;
export default usersSlice.reducer; 