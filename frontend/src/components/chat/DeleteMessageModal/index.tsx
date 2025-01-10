import React from 'react';
import styled from 'styled-components';
import Modal from '../../common/Modal';
import Button from '../../common/Button';

interface DeleteMessageModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  isDeleting: boolean;
}

const Content = styled.div`
  display: flex;
  flex-direction: column;
  gap: 16px;
`;

const Message = styled.div`
  font-family: 'Courier New', monospace;
  color: ${props => props.theme.colors.text};
  margin-bottom: 8px;
`;

const ButtonGroup = styled.div`
  display: flex;
  gap: 8px;
  justify-content: flex-end;
`;

const DeleteMessageModal: React.FC<DeleteMessageModalProps> = ({
  isOpen,
  onClose,
  onConfirm,
  isDeleting
}) => {
  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Delete Message"
    >
      <Content>
        <Message>
          Are you sure you want to delete this message? This action cannot be undone.
        </Message>
        <ButtonGroup>
          <Button
            variant="secondary"
            onClick={onClose}
            disabled={isDeleting}
          >
            Cancel
          </Button>
          <Button
            variant="danger"
            onClick={onConfirm}
            disabled={isDeleting}
          >
            {isDeleting ? 'Deleting...' : 'Delete'}
          </Button>
        </ButtonGroup>
      </Content>
    </Modal>
  );
};

export default DeleteMessageModal; 