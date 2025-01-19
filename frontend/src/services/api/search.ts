import { API_URL, getAuthToken } from './utils';
import { SearchResult, ChannelSearchResult, MessageSearchResult, FileSearchResult } from '../../types';
import { searchCache } from '../cache/searchCache';

export const searchChannels = async (query: string): Promise<ChannelSearchResult[]> => {
  console.log(`Searching channels at: /search/channels?query=${query}`);
  const token = getAuthToken();
  if (!token) {
    throw new Error('Authentication required');
  }

  try {
    const response = await fetch(`${API_URL}/search/channels?query=${encodeURIComponent(query)}`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      credentials: 'include'
    });

    if (!response.ok) {
      throw new Error(`Search failed with status ${response.status}`);
    }

    return await response.json();
  } catch (error) {
    console.error('Channel search failed:', error);
    throw error;
  }
};

export const searchMessages = async (query: string): Promise<MessageSearchResult[]> => {
  console.log(`Searching messages at: /search/messages?query=${query}`);
  const token = getAuthToken();
  if (!token) {
    throw new Error('Authentication required');
  }

  try {
    const response = await fetch(`${API_URL}/search/messages?query=${encodeURIComponent(query)}`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      credentials: 'include'
    });

    if (!response.ok) {
      throw new Error(`Search failed with status ${response.status}`);
    }

    return await response.json();
  } catch (error) {
    console.error('Message search failed:', error);
    throw error;
  }
};

export const searchFiles = async (query: string): Promise<FileSearchResult[]> => {
  console.log(`Searching files at: /search/files?query=${query}`);
  const token = getAuthToken();
  if (!token) {
    throw new Error('Authentication required');
  }

  try {
    const response = await fetch(`${API_URL}/search/files?query=${encodeURIComponent(query)}`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      credentials: 'include'
    });

    if (!response.ok) {
      throw new Error(`Search failed with status ${response.status}`);
    }

    return await response.json();
  } catch (error) {
    console.error('File search failed:', error);
    throw error;
  }
};

export const searchAll = async (query: string): Promise<SearchResult> => {
  console.log('Performing search for query:', query);
  
  // Check cache first
  const cachedResults = searchCache.get(query);
  if (cachedResults) {
    console.log('Found cached results');
    return cachedResults;
  }

  // If not in cache, perform the search
  try {
    const [channels, messages, files] = await Promise.all([
      searchChannels(query),
      searchMessages(query),
      searchFiles(query)
    ]);

    const results = { channels, messages, files };
    
    // Cache the results
    searchCache.set(query, results);
    console.log('Search completed successfully');

    return results;
  } catch (error) {
    console.error('Search failed with error:', error);
    console.error('Request config:', (error as any)?.config);
    throw error;
  }
}; 