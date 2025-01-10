import React, { useState } from 'react';
import styled from 'styled-components';
import { StoreMessage } from '../../../types';

interface ReplyModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (content: string) => void;
  parentMessage: StoreMessage;
}

const ModalOverlay = styled.div<{ isOpen: boolean }>`
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background-color: rgba(0, 0, 0, 0.5);
  display: ${props => props.isOpen ? 'flex' : 'none'};
  justify-content: center;
  align-items: center;
  z-index: 1000;
`;

const ModalContent = styled.div`
  background-color: ${props => props.theme.colors.background};
  border: 2px solid ${props => props.theme.colors.border};
  padding: 16px;
  width: 90%;
  max-width: 500px;
  font-family: 'Courier New', monospace;
`;

const Title = styled.h2`
  color: ${props => props.theme.colors.primary};
  margin: 0 0 16px 0;
  font-size: 1.2em;
`;

const ParentMessage = styled.div`
  color: ${props => props.theme.colors.secondary};
  background-color: ${props => props.theme.colors.hover};
  padding: 8px;
  margin-bottom: 16px;
  border-left: 2px solid ${props => props.theme.colors.border};
`;

const TextArea = styled.textarea`
  width: 100%;
  min-height: 100px;
  padding: 8px;
  margin-bottom: 16px;
  background-color: ${props => props.theme.colors.background};
  color: ${props => props.theme.colors.text};
  border: 1px solid ${props => props.theme.colors.border};
  font-family: 'Courier New', monospace;
  resize: vertical;

  &:focus {
    outline: none;
    border-color: ${props => props.theme.colors.primary};
  }
`;

const ButtonContainer = styled.div`
  display: flex;
  justify-content: flex-end;
  gap: 8px;
`;

const Button = styled.button<{ primary?: boolean }>`
  background-color: ${props => props.primary ? props.theme.colors.primary : 'transparent'};
  color: ${props => props.primary ? props.theme.colors.background : props.theme.colors.text};
  border: 1px solid ${props => props.theme.colors.border};
  padding: 8px 16px;
  cursor: pointer;
  font-family: 'Courier New', monospace;

  &:hover {
    background-color: ${props => props.primary ? props.theme.colors.primaryHover : props.theme.colors.hover};
  }
`;

const ReplyModal: React.FC<ReplyModalProps> = ({
  isOpen,
  onClose,
  onSubmit,
  parentMessage
}) => {
  const [content, setContent] = useState('');

  const handleSubmit = () => {
    if (content.trim()) {
      onSubmit(content.trim());
      setContent('');
      onClose();
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && e.ctrlKey) {
      handleSubmit();
    } else if (e.key === 'Escape') {
      onClose();
    }
  };

  return (
    <ModalOverlay isOpen={isOpen} onClick={onClose}>
      <ModalContent onClick={e => e.stopPropagation()}>
        <Title>Reply to Message</Title>
        <ParentMessage>
          {parentMessage.content}
        </ParentMessage>
        <TextArea
          value={content}
          onChange={e => setContent(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Type your reply here... (Ctrl+Enter to send)"
          autoFocus
        />
        <ButtonContainer>
          <Button onClick={onClose}>Cancel</Button>
          <Button primary onClick={handleSubmit}>Reply</Button>
        </ButtonContainer>
      </ModalContent>
    </ModalOverlay>
  );
};

export default ReplyModal; 