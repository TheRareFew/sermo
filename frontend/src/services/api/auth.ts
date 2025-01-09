import { User } from '../../store/types';

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

interface AuthResponse {
  user: User;
  token: string;
}

interface ApiError {
  detail?: string | { msg: string }[];
  message?: string;
}

const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:8000';

const formatErrorMessage = (error: ApiError): string => {
  if (typeof error.detail === 'string') {
    return error.detail;
  }
  if (Array.isArray(error.detail)) {
    return error.detail.map(err => err.msg).join(', ');
  }
  if (!error.detail && !error.message) {
    return 'Please enter both username and password';
  }
  return error.message || 'An error occurred';
};

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
    throw new Error(formatErrorMessage(data));
  }

  // Store the token in localStorage
  localStorage.setItem('auth_token', data.token);
  return data;
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
    throw new Error(formatErrorMessage(data));
  }

  // Store the token in localStorage
  localStorage.setItem('auth_token', data.token);
  return data;
};

export const forgotPassword = async (email: string): Promise<void> => {
  const response = await fetch(`${API_URL}/api/auth/forgot-password`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ email }),
    credentials: 'include',
  });

  const data = await response.json();

  if (!response.ok) {
    throw new Error(formatErrorMessage(data));
  }
};

export const logout = async (): Promise<void> => {
  const token = localStorage.getItem('auth_token');
  if (!token) return;

  try {
    const response = await fetch(`${API_URL}/api/auth/logout`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      credentials: 'include',
    });

    if (!response.ok) {
      const data = await response.json();
      throw new Error(formatErrorMessage(data));
    }
  } finally {
    // Always remove the token from localStorage
    localStorage.removeItem('auth_token');
  }
};

// Helper function to get the auth token
export const getAuthToken = (): string | null => {
  return localStorage.getItem('auth_token');
};

// Helper function to check if user is authenticated
export const isAuthenticated = (): boolean => {
  return !!getAuthToken();
}; 