import React, { useRef, useEffect } from 'react';
import styled from 'styled-components';

const MenuContainer = styled.div`
  position: absolute;
  top: 0;
  right: 24px;
  background: ${props => props.theme.background};
  border: 2px solid #000;
  border-right-color: #fff;
  border-bottom-color: #fff;
  box-shadow: 2px 2px 0 rgba(0, 0, 0, 0.5);
  min-width: 120px;
  font-family: 'VT323', monospace;
  z-index: 100;
`;

const MenuItem = styled.button`
  width: 100%;
  padding: 8px 12px;
  background: none;
  border: none;
  text-align: left;
  font-family: inherit;
  font-size: 1em;
  cursor: pointer;
  color: ${props => props.theme.text};

  &:hover {
    background: ${props => props.theme.primary};
    color: ${props => props.theme.background};
  }

  &.danger {
    color: #ff0000;
    &:hover {
      background: #ff0000;
      color: ${props => props.theme.background};
    }
  }
`;

interface MessageOptionsProps {
  isOpen: boolean;
  onClose: () => void;
  onDelete: () => void;
}

const MessageOptions: React.FC<MessageOptionsProps> = ({
  isOpen,
  onClose,
  onDelete,
}) => {
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        onClose();
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <MenuContainer ref={menuRef}>
      <MenuItem className="danger" onClick={onDelete}>
        Delete Message
      </MenuItem>
    </MenuContainer>
  );
};

export default MessageOptions; 