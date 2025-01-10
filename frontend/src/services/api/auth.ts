import { AuthResponse, ApiAuthResponse } from '../../types';
import { apiRequest, API_URL } from './utils';

interface LoginCredentials {
  username: string;
  password: string;
}

interface SignupCredentials {
  username: string;
  email: string;
  password: string;
  full_name: string;
}

interface ApiError {
  detail: string;
  [key: string]: any;
}

const formatErrorMessage = (error: ApiError): string => {
  if (typeof error.detail === 'string') {
    return error.detail;
  }
  return 'An error occurred during authentication';
};

const transformAuthResponse = (apiResponse: ApiAuthResponse): AuthResponse => ({
  user: apiResponse.user,
  token: apiResponse.access_token
});

export const login = async (credentials: LoginCredentials): Promise<AuthResponse> => {
  // Convert credentials to FormData as expected by the backend
  const formData = new URLSearchParams();
  formData.append('username', credentials.username);
  formData.append('password', credentials.password);

  const response = await fetch(`${API_URL}/api/auth/login`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: formData.toString(),
    credentials: 'include',
  });

  const data = await response.json();

  if (!response.ok) {
    throw new Error(formatErrorMessage(data as any));
  }

  // Store the token in localStorage
  localStorage.setItem('auth_token', data.access_token);
  console.log('Stored token:', data.access_token); // Debug log
  return transformAuthResponse(data);
};

export const signup = async (credentials: SignupCredentials): Promise<AuthResponse> => {
  const response = await fetch(`${API_URL}/api/auth/register`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(credentials),
    credentials: 'include',
  });

  const data = await response.json();

  if (!response.ok) {
    throw new Error(formatErrorMessage(data as any));
  }

  // Store the token in localStorage
  localStorage.setItem('auth_token', data.access_token);
  console.log('Stored token:', data.access_token); // Debug log
  return transformAuthResponse(data);
};

export const forgotPassword = async (email: string): Promise<void> => {
  await apiRequest('/api/auth/forgot-password', {
    method: 'POST',
    body: JSON.stringify({ email }),
    requiresAuth: false,
  });
};

export const logout = async (): Promise<void> => {
  await apiRequest('/api/auth/logout', {
    method: 'POST',
  });
  localStorage.removeItem('auth_token');
};

// Helper function to get the auth token
export const getAuthToken = (): string | null => {
  const token = localStorage.getItem('auth_token');
  return token ? token : null;
};

// Helper function to check if user is authenticated
export const isAuthenticated = (): boolean => {
  const token = getAuthToken();
  if (!token) return false;
  
  try {
    // Basic validation - check if token is expired
    const payload = JSON.parse(atob(token.split('.')[1]));
    const expirationTime = payload.exp * 1000; // Convert to milliseconds
    return Date.now() < expirationTime;
  } catch (error) {
    console.error('Error validating token:', error);
    return false;
  }
}; 