import { api } from './base';
import { SearchResult, ChannelSearchResult, MessageSearchResult, FileSearchResult } from '../../types';
import { searchCache } from '../cache/searchCache';

export const searchChannels = async (query: string): Promise<ChannelSearchResult[]> => {
  const url = `/search/channels?query=${encodeURIComponent(query)}`;
  console.log('Searching channels at:', url);
  const response = await api.get(url);
  return response.data;
};

export const searchMessages = async (query: string): Promise<MessageSearchResult[]> => {
  const url = `/search/messages?query=${encodeURIComponent(query)}`;
  console.log('Searching messages at:', url);
  const response = await api.get(url);
  return response.data;
};

export const searchFiles = async (query: string): Promise<FileSearchResult[]> => {
  const url = `/search/files?query=${encodeURIComponent(query)}`;
  console.log('Searching files at:', url);
  const response = await api.get(url);
  return response.data;
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