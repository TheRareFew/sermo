import axios from 'axios';
import { getAuthToken } from './utils';

// Create axios instance with default config
export const api = axios.create({
  baseURL: process.env.REACT_APP_API_URL,
  headers: {
    'Content-Type': 'application/json',
  },
  withCredentials: true, // Important for sending cookies
});

// Add request interceptor to include auth token
api.interceptors.request.use((config: any) => {
  const token = getAuthToken();
  if (token && config.headers) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
}, (error) => {
  return Promise.reject(error);
});

// Add response interceptor to handle errors
api.interceptors.response.use(
  (response) => response,
  (error: any) => {
    if (error?.response?.status === 401) {
      // Clear token and redirect to login only if we're not already on the login page
      if (!window.location.pathname.includes('/login')) {
        localStorage.removeItem('auth_token');
        window.location.href = '/login';
      }
    }
    return Promise.reject(error);
  }
); 