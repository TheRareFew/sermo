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
  formData.append('grant_type', 'password');

  // Make a direct fetch call to the exact URL we want
  const response = await fetch('http://localhost:8000/api/auth/login', {
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
  const response = await apiRequest<ApiAuthResponse>('auth/register', {
    method: 'POST',
    body: JSON.stringify(credentials),
    requiresAuth: false,
  });

  // Store the token in localStorage
  localStorage.setItem('auth_token', response.access_token);
  console.log('Stored token:', response.access_token); // Debug log
  return transformAuthResponse(response);
};

export const forgotPassword = async (email: string): Promise<void> => {
  await apiRequest('/auth/forgot-password', {
    method: 'POST',
    body: JSON.stringify({ email }),
    requiresAuth: false,
  });
};

export const logout = async (): Promise<void> => {
  await apiRequest('/auth/logout', {
    method: 'POST',
  });
  localStorage.removeItem('auth_token');
};

export const getAuthToken = (): string | null => {
  const token = localStorage.getItem('auth_token');
  return token ? token : null;
};

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