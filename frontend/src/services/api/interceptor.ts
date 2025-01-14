import { store } from '../../store';
import { logout } from '../../store/auth/authSlice';

export const handleUnauthorizedResponse = (error: any) => {
  if (error.status === 401) {
    // Clear auth state and redirect to login
    store.dispatch(logout());
    window.location.href = '/login';
  }
  return Promise.reject(error);
}; 