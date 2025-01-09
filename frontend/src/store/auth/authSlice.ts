import { createSlice, PayloadAction } from '@reduxjs/toolkit';
import { AuthState, User } from '../types';
import { getAuthToken } from '../../services/api/auth';

const initialState: AuthState = {
  isAuthenticated: !!getAuthToken(),
  user: null,
  token: getAuthToken(),
  loading: false,
  error: null,
};

const authSlice = createSlice({
  name: 'auth',
  initialState,
  reducers: {
    // Login actions
    loginStart: (state) => {
      state.loading = true;
      state.error = null;
    },
    loginSuccess: (state, action: PayloadAction<{ user: User; token: string }>) => {
      state.isAuthenticated = true;
      state.user = action.payload.user;
      state.token = action.payload.token;
      state.loading = false;
      state.error = null;
    },
    loginFailure: (state, action: PayloadAction<string>) => {
      state.loading = false;
      state.error = action.payload;
    },

    // Signup actions
    signupStart: (state) => {
      state.loading = true;
      state.error = null;
    },
    signupSuccess: (state, action: PayloadAction<{ user: User; token: string }>) => {
      state.isAuthenticated = true;
      state.user = action.payload.user;
      state.token = action.payload.token;
      state.loading = false;
      state.error = null;
    },
    signupFailure: (state, action: PayloadAction<string>) => {
      state.loading = false;
      state.error = action.payload;
    },

    // Logout action
    logout: (state) => {
      state.isAuthenticated = false;
      state.user = null;
      state.token = null;
      state.loading = false;
      state.error = null;
    },

    // Clear error action
    clearError: (state) => {
      state.error = null;
    },

    // Update user status
    updateUserStatus: (state, action: PayloadAction<{ status: User['status'] }>) => {
      if (state.user) {
        state.user.status = action.payload.status;
      }
    },
  },
});

export const {
  loginStart,
  loginSuccess,
  loginFailure,
  signupStart,
  signupSuccess,
  signupFailure,
  logout,
  clearError,
  updateUserStatus,
} = authSlice.actions;

export default authSlice.reducer; 