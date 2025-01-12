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

  const handleChannelClick = (channel: ChannelSearchResult) => {
    onSelectChannel(channel.id);
    onClose();
  };

  const handleMessageClick = (message: MessageSearchResult) => {
    onSelectMessage(message.channel_id, message.id);
    onClose();
  };

  const handleFileClick = (file: FileSearchResult) => {
    onSelectFile(file.id);
    onClose();
  };

  return (
    <ResultsContainer>
      {results.channels.length > 0 && (
        <Section>
          <SectionTitle>Channels</SectionTitle>
          {results.channels.map(channel => (
            <ResultItem key={channel.id} onClick={() => handleChannelClick(channel)}>
              <ResultTitle>#{channel.name}</ResultTitle>
              {channel.description && (
                <ResultContent>{channel.description}</ResultContent>
              )}
            </ResultItem>
          ))}
        </Section>
      )}

      {results.messages.length > 0 && (
        <Section>
          <SectionTitle>Messages</SectionTitle>
          {results.messages.map(message => (
            <ResultItem key={message.id} onClick={() => handleMessageClick(message)}>
              <ResultTitle>#{message.channel_name}</ResultTitle>
              <ResultContent>{message.content}</ResultContent>
            </ResultItem>
          ))}
        </Section>
      )}

      {results.files.length > 0 && (
        <Section>
          <SectionTitle>Files</SectionTitle>
          {results.files.map(file => (
            <ResultItem key={file.id} onClick={() => handleFileClick(file)}>
              <ResultTitle>{file.filename}</ResultTitle>
              <ResultContent>#{file.channel_name}</ResultContent>
            </ResultItem>
          ))}
        </Section>
      )}
    </ResultsContainer>
  );
};

export default SearchResults; 