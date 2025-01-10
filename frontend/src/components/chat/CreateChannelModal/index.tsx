import React, { useState, useEffect } from 'react';
import styled from 'styled-components';
import { useDispatch, useSelector } from 'react-redux';
import Modal from '../../common/Modal';
import Input from '../../common/Input';
import Button from '../../common/Button';
import { createChannel } from '../../../services/api/chat';
import { addChannel, setActiveChannel } from '../../../store/chat/chatSlice';
import { RootState } from '../../../types';
import Checkbox from '../../common/Checkbox';
import Select from '../../common/Select';

interface CreateChannelModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const Form = styled.form`
  display: flex;
  flex-direction: column;
  gap: 16px;
`;

const Description = styled.div`
  font-family: 'Courier New', monospace;
  margin-bottom: 16px;
  color: ${props => props.theme.colors.text};
`;

const ErrorMessage = styled.div`
  color: ${props => props.theme.colors.error};
  font-family: 'Courier New', monospace;
  margin-top: 8px;
`;

const ButtonGroup = styled.div`
  display: flex;
  gap: 8px;
  justify-content: flex-end;
  margin-top: 8px;
`;

const ToggleGroup = styled.div`
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 16px;
`;

const MemberSelection = styled.div`
  margin-top: 16px;
`;

const CreateChannelModal: React.FC<CreateChannelModalProps> = ({ isOpen, onClose }) => {
  const dispatch = useDispatch();
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [isPublic, setIsPublic] = useState(true);
  const [selectedMembers, setSelectedMembers] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const users = useSelector((state: RootState) => {
    const userMap = state.chat.users;
    return Object.values(userMap || {});
  });
  const currentUser = useSelector((state: RootState) => state.auth.user);

  const memberOptions = users
    .filter(user => user?.id !== currentUser?.id)
    .map(user => ({
      value: user.id,
      label: user.username
    }));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsLoading(true);

    try {
      // Validate channel name
      const trimmedName = name.trim().toLowerCase();
      if (!trimmedName) {
        throw new Error('Channel name is required');
      }
      if (trimmedName.length < 2) {
        throw new Error('Channel name must be at least 2 characters long');
      }
      if (!/^[a-z0-9-_]+$/.test(trimmedName)) {
        throw new Error('Channel name can only contain letters, numbers, hyphens, and underscores');
      }

      // Create channel
      const newChannel = await createChannel({
        name: trimmedName,
        description: description.trim() || undefined,
        is_public: isPublic,
        member_ids: !isPublic ? [currentUser!.id, ...selectedMembers] : undefined
      });
      
      dispatch(addChannel(newChannel));
      dispatch(setActiveChannel(newChannel.id));
      onClose();
      resetForm();
    } catch (error) {
      setError(error instanceof Error ? error.message : 'Failed to create channel');
    } finally {
      setIsLoading(false);
    }
  };

  const resetForm = () => {
    setName('');
    setDescription('');
    setIsPublic(true);
    setSelectedMembers([]);
    setError(null);
  };

  const handleClose = () => {
    resetForm();
    onClose();
  };

  return (
    <Modal isOpen={isOpen} onClose={handleClose} title="Create Channel">
      <Description>
        Create a new channel for your team to collaborate in.
        Channel names must be lowercase and can only contain letters,
        numbers, hyphens, and underscores.
      </Description>
      <Form onSubmit={handleSubmit}>
        <Input
          label="Channel Name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="e.g., general, random, project-x"
          fullWidth
          autoFocus
        />
        <Input
          label="Description (Optional)"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="What's this channel about?"
          fullWidth
        />
        <ToggleGroup>
          <Checkbox
            checked={isPublic}
            onChange={(e) => setIsPublic(e.target.checked)}
            label="Public Channel"
          />
          <Description style={{ margin: 0, fontSize: '0.9em' }}>
            {isPublic 
              ? "Anyone can join this channel"
              : "Only invited members can join this channel"}
          </Description>
        </ToggleGroup>
        
        {!isPublic && (
          <MemberSelection>
            <Select
              label="Select Members"
              options={memberOptions}
              value={selectedMembers}
              onChange={(values) => setSelectedMembers(values)}
              isMulti
              placeholder="Select members to add..."
            />
          </MemberSelection>
        )}

        {error && <ErrorMessage>{error}</ErrorMessage>}
        <ButtonGroup>
          <Button
            type="button"
            variant="secondary"
            onClick={handleClose}
            disabled={isLoading}
          >
            Cancel
          </Button>
          <Button
            type="submit"
            disabled={isLoading}
          >
            {isLoading ? 'Creating...' : 'Create Channel'}
          </Button>
        </ButtonGroup>
      </Form>
    </Modal>
  );
};

export default CreateChannelModal; 