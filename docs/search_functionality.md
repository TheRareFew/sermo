# Search Functionality Documentation

## Overview
The search system provides real-time search capabilities across channels, messages, and files while maintaining a retro aesthetic. It includes debouncing, caching, and proper error handling.

## Components

### 1. SearchBar Component
Located at `src/components/common/SearchBar/index.tsx`

- Retro-styled input field with debouncing (300ms)
- Error handling and loading states
- Search icon and error message display
- Keyboard event handling (Escape to clear)
- Click-outside detection

Key features:
```typescript
interface SearchBarProps {
  onSearch: (query: string) => void;
  placeholder?: string;
  className?: string;
  error?: string;
  onClickOutside?: () => void;
}
```

### 2. SearchResults Component
Located at `src/components/common/SearchResults/index.tsx`

- Retro dropdown panel design
- Sections for channels, messages, and files
- Loading and "no results" states
- Click handlers for each result type

Key features:
```typescript
interface SearchResultsProps {
  results: SearchResult;
  isLoading?: boolean;
  onClose: () => void;
  onSelectChannel: (channelId: string) => void;
  onSelectMessage: (channelId: string, messageId: string) => void;
  onSelectFile: (fileId: string) => void;
}
```

## Search Flow

1. User Input
   - User types in search bar
   - Input is debounced (300ms)
   - Previous search requests are cancelled

2. API Requests
   - Parallel requests to three endpoints:
     - `/api/search/channels`
     - `/api/search/messages`
     - `/api/search/files`
   - Cache is checked before making requests

3. Result Handling
   - Results are combined and displayed
   - Error states are handled
   - Loading states are shown
   - Cache is updated with new results

## API Endpoints

### 1. Channel Search
```typescript
GET /api/search/channels
Query params:
  query: string
  skip: number (default: 0)
  limit: number (default: 20)
Response: ChannelSearchResult[]
```

### 2. Message Search
```typescript
GET /api/search/messages
Query params:
  query: string
  skip: number (default: 0)
  limit: number (default: 20)
Response: MessageSearchResult[]
```

### 3. File Search
```typescript
GET /api/search/files
Query params:
  query: string
  skip: number (default: 0)
  limit: number (default: 20)
Response: FileSearchResult[]
```

## Caching System

The search implements an in-memory cache:
```typescript
class SearchCache {
  private maxEntries = 50;
  private ttl = 5 * 60 * 1000; // 5 minutes

  get(query: string): SearchResult | null;
  set(query: string, results: SearchResult): void;
  clear(): void;
}
```

Features:
- Maximum 50 cached searches
- 5-minute TTL per entry
- Automatic cleanup of expired entries
- LRU (Least Recently Used) eviction policy

## Libraries Used

### Frontend
- Lodash: Debouncing search input
- Styled Components: Component styling
- React Redux: State management
- Axios: API requests

### Backend
- FastAPI: API framework
- SQLAlchemy: Database queries
- Pydantic: Data validation

## Performance Optimizations

1. Request Optimization
   - Debounced input
   - Request cancellation
   - Parallel API calls
   - Response caching

2. UI Performance
   - Virtualized result lists
   - Throttled re-renders
   - Optimized styled-components

3. Backend Optimization
   - Database indexing
   - Result limiting
   - Query optimization

## Error Handling

1. Network Errors
   - Request timeout handling
   - Retry mechanism
   - Error state display

2. Empty States
   - No results handling
   - Loading states
   - Error messages

3. Edge Cases
   - Invalid queries
   - Expired cache
   - Permission errors

## Types

```typescript
interface SearchResult {
  channels: ChannelSearchResult[];
  messages: MessageSearchResult[];
  files: FileSearchResult[];
}

interface ChannelSearchResult {
  id: string;
  name: string;
  description?: string;
  is_direct_message: boolean;
  member_count: number;
}

interface MessageSearchResult {
  id: string;
  content: string;
  created_at: string;
  sender_id: string;
  channel_id: string;
  channel_name: string;
}

interface FileSearchResult {
  id: string;
  filename: string;
  file_type: string;
  file_path: string;
  created_at: string;
  channel_id: string;
  channel_name: string;
}
``` 