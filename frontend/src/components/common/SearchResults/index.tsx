import React from 'react';
import styled from 'styled-components';
import { SearchResult, MessageSearchResult, ChannelSearchResult, FileSearchResult } from '../../../types';

interface SearchResultsProps {
  results: SearchResult;
  isLoading?: boolean;
  onClose: () => void;
  onSelectChannel: (channelId: string) => void;
  onSelectMessage: (channelId: string, messageId: string) => void;
  onSelectFile: (fileId: string) => void;
}

const ResultsContainer = styled.div`
  position: absolute;
  top: 100%;
  left: 0;
  right: 0;
  background: #2b2b2b;
  border: 1px solid #444;
  border-radius: 4px;
  max-height: 400px;
  overflow-y: auto;
  z-index: 1000;
  margin-top: 4px;
  box-shadow: 0 4px 8px rgba(0, 0, 0, 0.2);
`;

const Section = styled.div`
  padding: 8px;
`;

const SectionTitle = styled.h3`
  margin: 0;
  padding: 8px;
  color: #888;
  font-size: 14px;
  font-weight: normal;
  border-bottom: 1px solid #444;
`;

const ResultItem = styled.div`
  padding: 8px;
  cursor: pointer;
  transition: background-color 0.2s;

  &:hover {
    background-color: #3a3a3a;
  }
`;

const ResultTitle = styled.div`
  color: #ddd;
  font-weight: bold;
  margin-bottom: 4px;
`;

const ResultContent = styled.div`
  color: #888;
  font-size: 14px;
`;

const NoResults = styled.div`
  padding: 16px;
  text-align: center;
  color: #888;
`;

const LoadingText = styled.div`
  padding: 16px;
  text-align: center;
  color: #888;
`;

const MessageResult = styled(ResultItem)`
  border-left: 2px solid transparent;
  
  &:hover {
    border-left-color: ${props => props.theme.colors.primary};
  }
`;

const MessageContent = styled(ResultContent)`
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  max-width: 100%;
`;

const SearchResults: React.FC<SearchResultsProps> = ({
  results,
  isLoading,
  onClose,
  onSelectChannel,
  onSelectMessage,
  onSelectFile
}) => {
  if (isLoading) {
    return (
      <ResultsContainer>
        <LoadingText>Searching...</LoadingText>
      </ResultsContainer>
    );
  }

  if (!results || (
    results.channels.length === 0 &&
    results.messages.length === 0 &&
    results.files.length === 0
  )) {
    return (
      <ResultsContainer>
        <NoResults>No results found</NoResults>
      </ResultsContainer>
    );
  }

  return (
    <ResultsContainer>
      {results.channels.length > 0 && (
        <Section>
          <SectionTitle>Channels</SectionTitle>
          {results.channels.map((channel: ChannelSearchResult) => (
            <ResultItem key={channel.id} onClick={() => onSelectChannel(channel.id)}>
              <ResultTitle># {channel.name}</ResultTitle>
              <ResultContent>{channel.description || 'No description'}</ResultContent>
            </ResultItem>
          ))}
        </Section>
      )}

      {results.messages.length > 0 && (
        <Section>
          <SectionTitle>Messages</SectionTitle>
          {results.messages.map((message: MessageSearchResult) => (
            <MessageResult
              key={message.id}
              onClick={() => onSelectMessage(message.channel_id, message.id)}
              title="Click to view in channel"
            >
              <ResultTitle>
                {message.channel_name ? `#${message.channel_name}` : 'Unknown Channel'}
              </ResultTitle>
              <MessageContent>
                <strong>{message.sender_id || 'Unknown User'}:</strong> {message.content}
              </MessageContent>
            </MessageResult>
          ))}
        </Section>
      )}

      {results.files.length > 0 && (
        <Section>
          <SectionTitle>Files</SectionTitle>
          {results.files.map((file: FileSearchResult) => (
            <ResultItem key={file.id} onClick={() => onSelectFile(file.id)}>
              <ResultTitle>{file.filename}</ResultTitle>
              <ResultContent>{file.file_type} - {file.file_path}</ResultContent>
            </ResultItem>
          ))}
        </Section>
      )}
    </ResultsContainer>
  );
};

export default SearchResults; 