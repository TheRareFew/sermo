import { getAuthToken } from './auth';

export interface ApiRequestOptions extends Omit<RequestInit, 'headers'> {
  requiresAuth?: boolean;
  headers?: Record<string, string>;
}

// Hardcode the API URL for now
export const API_URL = 'http://localhost:8000/api';

export async function apiRequest<T>(
  endpoint: string,
  options: ApiRequestOptions = {}
): Promise<T> {
  const { requiresAuth = true, headers = {}, ...rest } = options;
  
  const requestHeaders: Record<string, string> = {
    'Content-Type': 'application/json',
    'Accept': 'application/json',
    ...headers,
  };

  if (requiresAuth) {
    const token = getAuthToken();
    if (!token) {
      console.error('No auth token available');
      throw new Error('No auth token available');
    }
    requestHeaders['Authorization'] = `Bearer ${token}`;
  }

  // Remove any leading slashes from the endpoint
  const cleanEndpoint = endpoint.replace(/^\/+/, '');
  const url = `${API_URL}/${cleanEndpoint}`;
  
  console.log(`Making API request to ${url}`, {
    method: rest.method || 'GET',
    headers: requestHeaders,
  });

  try {
    const response = await fetch(url, {
      headers: requestHeaders,
      credentials: 'include',
      ...rest,
    });

    console.log(`Response status for ${endpoint}:`, response.status);
    console.log(`Response headers for ${endpoint}:`, Object.fromEntries(response.headers.entries()));

    let data;
    const contentType = response.headers.get('content-type');
    
    try {
      if (contentType && contentType.includes('application/json')) {
        data = await response.json();
        console.log(`Response data for ${endpoint}:`, JSON.stringify(data, null, 2));
      } else {
        data = await response.text();
        console.log(`Response text for ${endpoint}:`, data);
        // Try to parse as JSON anyway in case the content-type header is wrong
        try {
          data = JSON.parse(data);
          console.log(`Parsed text response as JSON for ${endpoint}:`, data);
        } catch {
          // Not JSON, keep as text
        }
      }
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
      console.error(`Error parsing response for ${endpoint}:`, error);
      throw new Error(`Failed to parse response: ${errorMessage}`);
    }

    if (!response.ok) {
      console.error(`API error for ${endpoint}:`, data);
      throw new Error(typeof data === 'object' ? JSON.stringify(data) : data || 'An error occurred');
    }

    return data;
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
    console.error(`Request failed for ${endpoint}:`, error);
    throw new Error(`API request failed: ${errorMessage}`);
  }
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