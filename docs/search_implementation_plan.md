# Search Implementation Plan

## 1. Create Search Components

### SearchBar Component
- [x] Create new component `src/components/common/SearchBar/index.tsx`
- [x] Style with retro theme matching existing components:
```typescript
const SearchContainer = styled.div display: flex; align-items: center; gap: 8px; position: relative;;
const SearchInput = styled.input background: ${props => props.theme.colors.background}; border: 2px solid ${props => props.theme.colors.border}; color: ${props => props.theme.colors.text}; font-family: 'VT323', monospace; padding: 4px 8px; width: 200px; font-size: 0.875rem;;
```


### SearchResults Component
- [x] Create new component `src/components/common/SearchResults/index.tsx`
- [x] Style as a retro dropdown panel
- [x] Add sections for channels, messages, and files
- [x] Add loading state indicator
- [x] Add "no results" state

## 2. Update Types & API

### Add Types
- [x] Create search result interfaces in `types.ts`:
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


### Add API Service
- [x] Add search functions to `services/api/search.ts`:
```typescript
export const searchAll = async (query: string): Promise<SearchResult> => {
const [channels, messages, files] = await Promise.all([
searchChannels(query),
searchMessages(query),
searchFiles(query)
]);
return { channels, messages, files };
};
```


## 3. Update MainLayout Component

### Add Search to Header
- [x] Update ChatHeader in MainLayout
- [x] Add SearchBar component before ChannelActions
- [x] Add state for search query and results
- [x] Add handlers for search input and selection

### Add Search Logic
- [x] Add debounced search function
- [x] Add loading state management
- [x] Add error handling
- [x] Handle search result selection:
  - [x] Channel: Switch to channel
  - [ ] Message: Switch to channel and scroll to message
  - [ ] File: Open file in new tab/download

## 4. Implementation Details

### Search Behavior
- [x] Trigger search after 300ms of typing
- [x] Clear results when input is empty
- [x] Close results when clicking outside
- [x] Handle keyboard navigation (up/down/enter)
- [x] Show max 5 results per category
- [x] Add "View all results" option

### Error Handling
- [x] Add error state to SearchBar
- [x] Show error message in results panel
- [x] Add retry mechanism
- [x] Handle network timeouts

### Performance
- [x] Implement request cancellation for pending searches
- [x] Cache recent search results
- [x] Add loading states per category
- [x] Optimize re-renders

## 5. Polish & Testing

### Visual Polish
- [x] Add search icon
- [x] Add category icons
- [x] Add hover states
- [x] Add focus styles
- [x] Add animations for results panel

### Testing
- [ ] Add unit tests for search components
- [ ] Add integration tests for search flow
- [ ] Test error scenarios
- [ ] Test keyboard navigation
- [ ] Test mobile responsiveness