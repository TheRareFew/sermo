import { store } from '../../store';
import { handleUnauthorizedResponse } from './interceptor';

let auth0Token: string | null = null;

export interface ApiRequestOptions extends Omit<RequestInit, 'headers'> {
  requiresAuth?: boolean;
  headers?: Record<string, string>;
}

// Hardcode the API URL for now
export const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:8000';

// Get WebSocket URL from environment variable or fallback to localhost
const WS_BASE_URL = process.env.REACT_APP_WS_URL || 'ws://localhost:8000/ws';

export const getWebSocketUrl = () => {
  // If we're on HTTPS, use WSS
  if (window.location.protocol === 'https:' && WS_BASE_URL.startsWith('ws:')) {
    return WS_BASE_URL.replace('ws:', 'wss:');
  }
  return WS_BASE_URL;
};

export const decodeJwt = (token: string) => {
  try {
    const base64Url = token.split('.')[1];
    const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
    const jsonPayload = decodeURIComponent(atob(base64).split('').map(c => 
      '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2)
    ).join(''));
    return JSON.parse(jsonPayload);
  } catch (error) {
    console.error('Error decoding JWT:', error);
    return null;
  }
};

export const setAuth0Token = (token: string) => {
  auth0Token = token;
  // Log the decoded token
  const decoded = decodeJwt(token);
  console.log('Setting Auth0 token with payload:', {
    aud: decoded?.aud,
    iss: decoded?.iss,
    exp: decoded?.exp,
    scope: decoded?.scope
  });
};

export const getAuthToken = (): string | null => {
  // First try to get token from Auth0
  if (auth0Token) {
    console.log('Using Auth0 token for API request');
    return auth0Token;
  }

  // Fallback to Redux store token
  const state = store.getState();
  const token = state.auth.token;
  if (token) {
    console.log('Using Redux store token for API request');
    return token;
  }

  console.warn('No auth token available');
  return null;
};

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
    console.log(`Using token for ${endpoint}:`, {
      tokenStart: token.substring(0, 20) + '...',
      decodedToken: decodeJwt(token)
    });
    requestHeaders['Authorization'] = `Bearer ${token}`;
  }

  // Remove any leading slashes from the endpoint and API_URL
  const cleanEndpoint = endpoint.replace(/^\/+/, '');
  const cleanApiUrl = API_URL.replace(/\/+$/, '');
  
  // Construct the URL, ensuring we don't duplicate /api
  const url = cleanApiUrl.endsWith('/api') 
    ? `${cleanApiUrl}/${cleanEndpoint}`
    : `${cleanApiUrl}/api/${cleanEndpoint}`;
  
  console.log(`Making API request to ${url}`, {
    method: rest.method || 'GET',
    headers: requestHeaders,
    body: rest.body ? JSON.parse(rest.body as string) : undefined,
  });

  try {
    const response = await fetch(url, {
      headers: requestHeaders,
      credentials: 'include',
      redirect: 'follow',
      ...rest,
    });

    // Handle redirects manually if needed
    if (response.redirected) {
      console.log(`Request was redirected to: ${response.url}`);
    }

    if (response.status === 401) {
      console.error(`401 Unauthorized for ${endpoint}`, {
        headers: Object.fromEntries(response.headers.entries()),
        requestHeaders
      });
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