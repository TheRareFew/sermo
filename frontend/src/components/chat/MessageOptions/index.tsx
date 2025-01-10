import React, { useState, useEffect, useRef } from 'react';
import styled from 'styled-components';

interface MessageOptionsProps {
  onDelete: () => void;
  onReply: () => void;
  canDelete: boolean;
  canReply: boolean;
}

const OptionsContainer = styled.div`
  position: relative;
  display: inline-block;
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

const MessageOptions: React.FC<MessageOptionsProps> = ({
  onDelete,
  onReply,
  canDelete,
  canReply,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setIsOpen(false);
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

  if (!canDelete && !canReply) {
    return null;
  }

  return (
    <OptionsContainer ref={menuRef}>
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