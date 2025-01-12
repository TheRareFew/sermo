import React, { useState, useCallback, useRef, useEffect } from 'react';
import styled from 'styled-components';
import { debounce } from '../../../utils/debounce';

const SearchContainer = styled.div`
  display: flex;
  align-items: center;
  gap: 8px;
  position: relative;
`;

const SearchInput = styled.input<{ hasError?: boolean }>`
  background: ${props => props.theme.colors.background};
  border: 2px solid ${props => props.hasError ? props.theme.colors.error : props.theme.colors.border};
  color: ${props => props.theme.colors.text};
  font-family: 'VT323', monospace;
  padding: 4px 8px;
  width: 200px;
  font-size: 0.875rem;
  outline: none;

  &:focus {
    border-color: ${props => props.hasError ? props.theme.colors.error : props.theme.colors.primary};
  }

  &::placeholder {
    color: ${props => props.theme.colors.textSecondary};
  }
`;

const SearchIcon = styled.span<{ hasError?: boolean }>`
  color: ${props => props.hasError ? props.theme.colors.error : props.theme.colors.textSecondary};
  font-size: 1rem;
  position: absolute;
  right: 8px;
  top: 50%;
  transform: translateY(-50%);
  pointer-events: none;
`;

const ErrorMessage = styled.div`
  position: absolute;
  top: 100%;
  left: 0;
  right: 0;
  margin-top: 4px;
  padding: 4px;
  background: ${props => props.theme.colors.error};
  color: ${props => props.theme.colors.background};
  font-size: 0.75rem;
  z-index: 1001;
  text-align: center;
  font-family: 'VT323', monospace;
`;

interface SearchBarProps {
  onSearch: (query: string) => void;
  placeholder?: string;
  className?: string;
  error?: string;
  onClickOutside?: () => void;
}

const SearchBar: React.FC<SearchBarProps> = ({
  onSearch,
  placeholder = "SEARCH...",
  className,
  error,
  onClickOutside
}) => {
  const [query, setQuery] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const debouncedSearch = useCallback(
    debounce((searchQuery: string) => {
      onSearch(searchQuery);
    }, 300),
    [onSearch]
  );

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newQuery = e.target.value;
    setQuery(newQuery);
    debouncedSearch(newQuery);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Escape') {
      setQuery('');
      debouncedSearch('');
      inputRef.current?.blur();
    }
  };

  // Handle click outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        onClickOutside?.();
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [onClickOutside]);

  // Cleanup debounced function on unmount
  useEffect(() => {
    // No cleanup needed for our custom debounce implementation
  }, []);

  return (
    <SearchContainer ref={containerRef} className={className}>
      <SearchInput
        ref={inputRef}
        type="text"
        value={query}
        onChange={handleChange}
        onKeyDown={handleKeyDown}
        placeholder={placeholder}
        hasError={!!error}
      />
      <SearchIcon hasError={!!error}>⌕</SearchIcon>
      {error && <ErrorMessage>{error}</ErrorMessage>}
    </SearchContainer>
  );
};

export default SearchBar; 