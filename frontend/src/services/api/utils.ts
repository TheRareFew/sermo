import { getAuthToken } from './auth';

export interface ApiRequestOptions extends Omit<RequestInit, 'headers'> {
  requiresAuth?: boolean;
  headers?: Record<string, string>;
}

export const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:8000';

export async function apiRequest<T>(
  endpoint: string,
  options: ApiRequestOptions = {}
): Promise<T> {
  const { requiresAuth = true, headers = {}, ...rest } = options;
  
  const requestHeaders: Record<string, string> = {
    'Content-Type': 'application/json',
    ...headers,
  };

  if (requiresAuth) {
    const token = getAuthToken();
    if (!token) {
      throw new Error('No auth token available');
    }
    requestHeaders['Authorization'] = `Bearer ${token}`;
    console.log('Using token for request:', token);
    console.log('Request headers:', requestHeaders);
  }

  const response = await fetch(`${API_URL}${endpoint}`, {
    headers: requestHeaders,
    credentials: 'include',
    ...rest,
  });

  console.log('Response status:', response.status);

  let data;
  const contentType = response.headers.get('content-type');
  if (contentType && contentType.includes('application/json')) {
    data = await response.json();
    console.log('Response data:', data);
  } else {
    data = await response.text();
    console.log('Response text:', data);
  }

  if (!response.ok) {
    throw new Error(data.detail || data || 'An error occurred');
  }

  return data;
}

export function getAuthHeaders(): Record<string, string> {
  const token = getAuthToken();
  if (!token) {
    throw new Error('No auth token available');
  }
  
  return {
    'Authorization': `Bearer ${token}`,
    'Content-Type': 'application/json',
  };
} 