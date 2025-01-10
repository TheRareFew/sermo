import React, { useState } from 'react';
import styled from 'styled-components';
import { useSelector } from 'react-redux';
import Modal from '../../common/Modal';
import Button from '../../common/Button';
import Select from '../../common/Select';
import { RootState, Channel, User } from '../../../types';
import { addChannelMember, removeChannelMember } from '../../../services/api/chat';

interface ChannelSettingsProps {
  isOpen: boolean;
  onClose: () => void;
  channel: Channel;
}

const Container = styled.div`
  display: flex;
  flex-direction: column;
  gap: 24px;
`;

const Section = styled.div`
  display: flex;
  flex-direction: column;
  gap: 16px;
`;

const SectionTitle = styled.h3`
  margin: 0;
  font-size: 1rem;
  text-transform: uppercase;
  color: ${props => props.theme.colors.primary};
  font-family: 'Courier New', monospace;
  border-bottom: 1px solid ${props => props.theme.colors.border};
  padding-bottom: 8px;
`;

const Description = styled.p`
  margin: 0;
  color: ${props => props.theme.colors.textLight};
  font-family: 'Courier New', monospace;
  font-size: 0.875rem;
`;

const MemberList = styled.div`
  display: flex;
  flex-direction: column;
  gap: 8px;
`;

const MemberItem = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 8px;
  background: ${props => props.theme.colors.backgroundDark};
  border: 1px solid ${props => props.theme.colors.border};
  font-family: 'Courier New', monospace;
  position: relative;
`;

const MemberName = styled.span`
  color: ${props => props.theme.colors.text};
  flex: 1;
  margin-right: 8px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
`;

const RemoveButton = styled(Button)`
  padding: 2px 8px;
  font-size: 0.75rem;
  min-width: 70px;
`;

const ErrorMessage = styled.div`
  color: ${props => props.theme.colors.error};
  font-family: 'Courier New', monospace;
  margin-top: 8px;
  padding: 8px;
  border: 1px solid ${props => props.theme.colors.error};
  background-color: ${props => `${props.theme.colors.error}10`};
`;

const LoadingOverlay = styled.div`
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background-color: ${props => `${props.theme.colors.background}80`};
  display: flex;
  align-items: center;
  justify-content: center;
  font-family: 'Courier New', monospace;
  color: ${props => props.theme.colors.primary};
`;

const ChannelSettings: React.FC<ChannelSettingsProps> = ({
  isOpen,
  onClose,
  channel
}) => {
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [loadingMemberId, setLoadingMemberId] = useState<string | null>(null);

  const currentUser = useSelector((state: RootState) => state.auth.user);
  const allUsers = useSelector((state: RootState) => {
    const userMap = state.chat.users || {};
    return Object.values(userMap);
  });
  const channelMembers = useSelector((state: RootState) => {
    const channelUsers = state.chat.users || {};
    return Object.values(channelUsers).filter(user => 
      channel.members?.includes(user.id)
    );
  });

  const nonMembers = allUsers.filter(user => 
    !channel.members?.includes(user.id) && user.id !== currentUser?.id
  );

  const memberOptions = nonMembers.map(user => ({
    value: user.id,
    label: user.username
  }));

  const handleAddMember = async (userId: string) => {
    if (!channel.id || isLoading) return;

    setError(null);
    setIsLoading(true);
    setLoadingMemberId(userId);

    try {
      await addChannelMember(channel.id, userId);
      // The channel members will be updated through WebSocket
    } catch (error) {
      setError('Failed to add member. Please try again.');
    } finally {
      setIsLoading(false);
      setLoadingMemberId(null);
    }
  };

  const handleRemoveMember = async (userId: string) => {
    if (!channel.id || isLoading) return;

    setError(null);
    setIsLoading(true);
    setLoadingMemberId(userId);

    try {
      await removeChannelMember(channel.id, userId);
      // The channel members will be updated through WebSocket
    } catch (error) {
      setError('Failed to remove member. Please try again.');
    } finally {
      setIsLoading(false);
      setLoadingMemberId(null);
    }
  };

  const isCreator = channel.created_by_id === currentUser?.id;

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={`#${channel.name} Settings`}>
      <Container>
        <Section>
          <SectionTitle>Channel Type</SectionTitle>
          <Description>
            This is a {channel.is_public ? 'public' : 'private'} channel.
            {channel.is_public 
              ? ' Anyone can join this channel.'
              : ' Only invited members can join this channel.'}
          </Description>
        </Section>

        {!channel.is_public && (
          <Section>
            <SectionTitle>Members</SectionTitle>
            <Description>
              {isCreator 
                ? 'Manage channel members. You can add or remove members.'
                : 'View channel members. Only the channel creator can manage members.'}
            </Description>

            {isCreator && (
              <Select
                label="Add Members"
                options={memberOptions}
                value={[]}
                onChange={(values) => {
                  if (values.length > 0) {
                    handleAddMember(values[values.length - 1]);
                  }
                }}
                isMulti={false}
                placeholder="Select a user to add..."
                disabled={isLoading}
              />
            )}

            <MemberList>
              {channelMembers.map((member) => (
                <MemberItem key={member.id}>
                  <MemberName>{member.username}</MemberName>
                  {isCreator && member.id !== currentUser?.id && (
                    <RemoveButton
                      variant="danger"
                      size="small"
                      onClick={() => handleRemoveMember(member.id)}
                      disabled={isLoading || loadingMemberId === member.id}
                    >
                      {loadingMemberId === member.id ? '...' : 'Remove'}
                    </RemoveButton>
                  )}
                  {loadingMemberId === member.id && (
                    <LoadingOverlay>...</LoadingOverlay>
                  )}
                </MemberItem>
              ))}
            </MemberList>

            {error && <ErrorMessage>{error}</ErrorMessage>}
          </Section>
        )}
      </Container>
    </Modal>
  );
};

export default ChannelSettings; 