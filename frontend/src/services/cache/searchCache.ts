import { SearchResult } from '../../types';

interface CacheEntry {
  results: SearchResult;
  timestamp: number;
}

class SearchCache {
  private cache: Map<string, CacheEntry>;
  private maxEntries: number;
  private ttl: number; // Time to live in milliseconds

  constructor(maxEntries = 50, ttlMinutes = 5) {
    this.cache = new Map();
    this.maxEntries = maxEntries;
    this.ttl = ttlMinutes * 60 * 1000;
  }

  get(query: string): SearchResult | null {
    const entry = this.cache.get(query);
    if (!entry) return null;

    // Check if entry has expired
    if (Date.now() - entry.timestamp > this.ttl) {
      this.cache.delete(query);
      return null;
    }

    return entry.results;
  }

  set(query: string, results: SearchResult): void {
    // Remove oldest entry if cache is full
    if (this.cache.size >= this.maxEntries) {
      const oldestKey = this.cache.keys().next().value;
      this.cache.delete(oldestKey);
    }

    this.cache.set(query, {
      results,
      timestamp: Date.now()
    });
  }

  clear(): void {
    this.cache.clear();
  }
}

export const searchCache = new SearchCache(); 