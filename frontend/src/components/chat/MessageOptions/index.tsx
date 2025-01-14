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

interface PickerPosition {
  top?: number;
  bottom?: number;
  right?: number;
}

const OptionsContainer = styled.div`
  position: relative;
  display: inline-flex;
  align-items: center;
  gap: 2px;
`;

const MenuTrigger = styled.button`
  background: none;
  border: 1px solid #444;
  color: ${props => props.theme.colors.text};
  cursor: pointer;
  font-family: 'Courier New', monospace;
  padding: 0px 4px;
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
  padding: 0px 4px;
`;

const EmojiPickerWrapper = styled.div<{ position: PickerPosition }>`
  position: fixed;
  ${props => props.position.top !== undefined && `top: ${props.position.top}px`};
  ${props => props.position.bottom !== undefined && `bottom: ${props.position.bottom}px`};
  ${props => props.position.right !== undefined && `right: ${props.position.right}px`};
  z-index: 9999;
  margin: 4px;
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
  const [pickerPosition, setPickerPosition] = useState<PickerPosition>({ right: 0 });
  const emojiButtonRef = useRef<HTMLButtonElement>(null);
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

  useEffect(() => {
    if (showEmojiPicker && emojiButtonRef.current) {
      const buttonRect = emojiButtonRef.current.getBoundingClientRect();
      const spaceAbove = buttonRect.top;
      const spaceBelow = window.innerHeight - buttonRect.bottom;
      const pickerHeight = 435; // Approximate height of the emoji picker
      const rightOffset = window.innerWidth - buttonRect.right;

      if (spaceAbove > pickerHeight || spaceAbove > spaceBelow) {
        // Show above the button
        setPickerPosition({
          bottom: window.innerHeight - buttonRect.top,
          right: rightOffset
        });
      } else {
        // Show below the button
        setPickerPosition({
          top: buttonRect.bottom,
          right: rightOffset
        });
      }
    }
  }, [showEmojiPicker]);

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
        ref={emojiButtonRef}
        onClick={toggleEmojiPicker}
        aria-label="Add reaction"
      >
        :-)
      </EmojiButton>
      
      {showEmojiPicker && (
        <EmojiPickerWrapper position={pickerPosition}>
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