import React, { useEffect } from 'react';
import ReactDOM from 'react-dom';
import styled from 'styled-components';

interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
}

const Overlay = styled.div`
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background-color: rgba(0, 0, 0, 0.75);
  display: flex;
  justify-content: center;
  align-items: center;
  z-index: ${props => props.theme.zIndex.modal};
`;

const ModalContainer = styled.div`
  background-color: ${props => props.theme.colors.background};
  border: 2px solid ${props => props.theme.colors.border};
  position: relative;
  max-width: 500px;
  width: 100%;
  margin: 20px;
`;

const ModalHeader = styled.div`
  padding: 8px;
  background-color: ${props => props.theme.colors.text};
  color: ${props => props.theme.colors.background};
  display: flex;
  justify-content: space-between;
  align-items: center;
  text-transform: uppercase;
  font-family: 'VT323', monospace;
`;

const Title = styled.h2`
  margin: 0;
  font-size: 1.2rem;
  font-weight: normal;
`;

const CloseButton = styled.button`
  background: none;
  border: none;
  color: ${props => props.theme.colors.background};
  cursor: pointer;
  font-family: 'VT323', monospace;
  font-size: 1.2rem;
  padding: 0;

  &:hover {
    color: ${props => props.theme.colors.error};
  }
`;

const Content = styled.div`
  padding: 16px;
`;

const Modal: React.FC<ModalProps> = ({
  isOpen,
  onClose,
  title,
  children
}) => {
  useEffect(() => {
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onClose();
      }
    };

    if (isOpen) {
      document.addEventListener('keydown', handleEscape);
      document.body.style.overflow = 'hidden';
    }

    return () => {
      document.removeEventListener('keydown', handleEscape);
      document.body.style.overflow = 'unset';
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const modalRoot = document.getElementById('modal-root');
  if (!modalRoot) return null;

  return ReactDOM.createPortal(
    <Overlay onClick={onClose}>
      <ModalContainer onClick={e => e.stopPropagation()}>
        <ModalHeader>
          <Title>{title}</Title>
          <CloseButton onClick={onClose}>×</CloseButton>
        </ModalHeader>
        <Content>
          {children}
        </Content>
      </ModalContainer>
    </Overlay>,
    modalRoot
  );
};

export default Modal; 