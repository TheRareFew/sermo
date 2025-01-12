import React, { useState, useEffect, useRef } from 'react';
import styled from 'styled-components';
import data from '@emoji-mart/data';
import Picker from '@emoji-mart/react';

interface MessageOptionsProps {
  messageId: string;
  onDelete: () => void;
  onReply: () => void;
  canDelete: boolean;
  canReply: boolean;
  onReactionAdd?: (emoji: string) => void;
  onReactionRemove?: (emoji: string) => void;
}

const OptionsContainer = styled.div`
  position: relative;
  display: inline-flex;
  align-items: center;
  gap: 4px;
`;

const MenuTrigger = styled.button`
  background: none;
  border: 1px solid #444;
  color: ${props => props.theme.colors.text};
  cursor: pointer;
  font-family: 'Courier New', monospace;
  padding: 2px 6px;
  font-size: inherit;

  &:hover {
    background-color: ${props => props.theme.colors.hover};
    border-color: ${props => props.theme.colors.primary};
  }
`;

const OptionsMenu = styled.div<{ isOpen: boolean }>`
  position: absolute;
  right: 0;
  bottom: 100%;
  background-color: ${props => props.theme.colors.background};
  border: 2px solid ${props => props.theme.colors.border};
  display: ${({ isOpen }) => isOpen ? 'block' : 'none'};
  z-index: 10;
  min-width: 120px;
  font-family: 'Courier New', monospace;
  margin-bottom: 4px;
`;

const MenuItem = styled.button`
  background: none;
  border: none;
  color: ${props => props.theme.colors.text};
  cursor: pointer;
  padding: 4px 8px;
  width: 100%;
  text-align: left;
  display: block;
  font-family: inherit;
  font-size: inherit;

  &:hover {
    background-color: ${props => props.theme.colors.hover};
    color: ${props => props.theme.colors.primary};
  }
`;

const EmojiButton = styled(MenuTrigger)`
  padding: 2px 4px;
`;

const EmojiPickerWrapper = styled.div`
  position: absolute;
  bottom: 100%;
  right: 0;
  margin-bottom: 4px;
  z-index: 100;
`;

const MessageOptions: React.FC<MessageOptionsProps> = ({
  messageId,
  onDelete,
  onReply,
  canDelete,
  canReply,
  onReactionAdd,
  onReactionRemove
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setIsOpen(false);
        setShowEmojiPicker(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  const handleClose = () => {
    setIsOpen(false);
  };

  const handleDelete = () => {
    onDelete();
    handleClose();
  };

  const handleReply = () => {
    onReply();
    handleClose();
  };

  const handleEmojiSelect = (emoji: any) => {
    onReactionAdd?.(emoji.native);
    setShowEmojiPicker(false);
  };

  const toggleEmojiPicker = () => {
    setShowEmojiPicker(!showEmojiPicker);
    setIsOpen(false);
  };

  if (!canDelete && !canReply) {
    return null;
  }

  return (
    <OptionsContainer ref={menuRef}>
      <EmojiButton 
        onClick={toggleEmojiPicker}
        title="Add reaction"
      >
        :-)
      </EmojiButton>
      {showEmojiPicker && (
        <EmojiPickerWrapper>
          <Picker 
            data={data} 
            onEmojiSelect={handleEmojiSelect}
            theme="dark"
          />
        </EmojiPickerWrapper>
      )}
      <MenuTrigger onClick={() => setIsOpen(!isOpen)}>[...]</MenuTrigger>
      <OptionsMenu isOpen={isOpen}>
        {canReply && (
          <MenuItem onClick={handleReply}>[R]eply</MenuItem>
        )}
        {canDelete && (
          <MenuItem onClick={handleDelete}>[D]elete</MenuItem>
        )}
      </OptionsMenu>
    </OptionsContainer>
  );
};

export default MessageOptions; 