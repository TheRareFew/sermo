import { getAuthToken } from './auth';
import { handleUnauthorizedResponse } from './interceptor';

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
    body: rest.body ? JSON.parse(rest.body as string) : undefined,
  });

  try {
    const response = await fetch(url, {
      headers: requestHeaders,
      credentials: 'include',
      ...rest,
    });

    if (response.status === 401) {
      return handleUnauthorizedResponse({ status: 401 });
    }

    // Only log non-400 status codes as they might be expected business logic
    if (response.status !== 400) {
      console.log(`Response status for ${endpoint}:`, response.status);
      console.log(`Response headers for ${endpoint}:`, Object.fromEntries(response.headers.entries()));
    }

    let data;
    const contentType = response.headers.get('content-type');
    const responseText = await response.text();
    
    // Only log response text for non-400 status codes
    if (response.status !== 400) {
      console.log(`Raw response text for ${endpoint}:`, responseText);
    }

    try {
      if (responseText) {
        try {
          data = JSON.parse(responseText);
          // Only log parsed data for non-400 status codes
          if (response.status !== 400) {
            console.log(`Parsed response data for ${endpoint}:`, data);
          }
        } catch (parseError) {
          console.warn(`Response is not JSON for ${endpoint}, using raw text`);
          data = responseText;
        }
      } else {
        console.log(`Empty response for ${endpoint}`);
        data = null;
      }
    } catch (error) {
      console.error(`Error processing response for ${endpoint}:`, error);
      throw new Error(`Failed to process response: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }

    if (!response.ok) {
      // Only log non-400 errors as errors, log 400s as debug
      if (response.status === 400) {
        console.debug(`API 400 response for ${endpoint}:`, {
          status: response.status,
          statusText: response.statusText,
          data
        });
      } else {
        console.error(`API error for ${endpoint}:`, {
          status: response.status,
          statusText: response.statusText,
          data
        });
      }

      let errorMessage = 'An error occurred';
      if (typeof data === 'object' && data !== null) {
        errorMessage = JSON.stringify(data);
      } else if (typeof data === 'string') {
        errorMessage = data;
      }

      throw new Error(`API error (${response.status}): ${errorMessage}`);
    }

    if (data === null && !response.ok) {
      throw new Error(`API request failed with status ${response.status}`);
    }

    return data;
  } catch (error) {
    // Only log non-400 errors as errors
    if (error instanceof Error && !error.message.includes('API error (400)')) {
      console.error(`Request failed for ${endpoint}:`, {
        error,
        message: error instanceof Error ? error.message : 'Unknown error'
      });
    }
    throw error instanceof Error ? error : new Error('API request failed');
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