import React, { useRef, useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import styled from 'styled-components';
import { useVoiceChannel } from '../../../hooks/useVoiceChannel';

// Types
interface VoiceChannelProps {
  channelId?: string;
}

const VoiceChannelContainer = styled.div`
  display: flex;
  flex-direction: column;
  background: #2f3136;
  border-radius: 8px;
  padding: 16px;
  color: #ffffff;
  gap: 16px;
`;

const ParticipantList = styled.div`
  display: flex;
  flex-direction: column;
  gap: 8px;
`;

const ParticipantItem = styled.div<{ $isSpeaking: boolean }>`
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px;
  background: ${props => props.$isSpeaking ? '#36393f' : 'transparent'};
  border-radius: 4px;
  transition: background 0.2s;

  .speaking-indicator {
    width: 8px;
    height: 8px;
    border-radius: 50%;
    background: ${props => props.$isSpeaking ? '#43b581' : '#747f8d'};
    transition: background 0.2s;
  }

  .username {
    flex: 1;
  }

  .status-icons {
    display: flex;
    gap: 4px;
  }
`;

const Controls = styled.div`
  display: flex;
  gap: 8px;
  padding: 8px;
  background: #202225;
  border-radius: 4px;
`;

const ControlButton = styled.button<{ $active?: boolean }>`
  background: ${props => props.$active ? '#43b581' : '#36393f'};
  color: #ffffff;
  border: none;
  border-radius: 4px;
  padding: 8px;
  cursor: pointer;
  transition: background 0.2s;

  &:hover {
    background: ${props => props.$active ? '#3ca374' : '#40444b'};
  }

  &:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }
`;

const StatusIndicator = styled.div<{ $status: 'connecting' | 'connected' | 'disconnected' | 'error' }>`
  padding: 8px;
  border-radius: 4px;
  background: ${props => {
    switch (props.$status) {
      case 'connecting': return '#faa61a';
      case 'connected': return '#43b581';
      case 'disconnected': return '#747f8d';
      case 'error': return '#f04747';
      default: return '#36393f';
    }
  }};
  margin-bottom: 8px;
`;

const VolumeSlider = styled.input`
  width: 80px;
  margin-left: 8px;
  cursor: pointer;
`;

const ErrorMessage = styled.div`
  color: #f04747;
  padding: 8px;
  margin-top: 8px;
  background: rgba(240, 71, 71, 0.1);
  border-radius: 4px;
  font-size: 14px;
`;

const RetryButton = styled(ControlButton)`
  background: #f04747;
  margin-top: 8px;
  width: 100%;
`;

const VoiceChannel: React.FC<VoiceChannelProps> = ({ channelId }) => {
  const { id } = useParams();
  const actualChannelId = channelId || id;
  const [participantVolumes, setParticipantVolumes] = useState<{ [key: string]: number }>({});

  const {
    isConnected,
    isMuted,
    error,
    connectionStatus,
    participants,
    toggleMute,
    leaveChannel
  } = useVoiceChannel({ 
    channelId: actualChannelId || ''
  });

  const handleVolumeChange = (userId: string, volume: number) => {
    setParticipantVolumes(prev => ({ ...prev, [userId]: volume }));
  };

  const getStatusText = (status: 'connecting' | 'connected' | 'disconnected' | 'error') => {
    switch (status) {
      case 'connecting': return 'Connecting to voice...';
      case 'connected': return 'Connected to voice';
      case 'disconnected': return 'Disconnected from voice';
      case 'error': return 'Error connecting to voice';
      default: return 'Unknown status';
    }
  };

  return (
    <VoiceChannelContainer>
      <StatusIndicator $status={connectionStatus}>
        {getStatusText(connectionStatus)}
      </StatusIndicator>

      {error && (
        <ErrorMessage>
          {error}
        </ErrorMessage>
      )}

      <ParticipantList>
        {participants.map(participant => (
          <ParticipantItem 
            key={participant.id} 
            $isSpeaking={participant.isSpeaking}
          >
            <div className="speaking-indicator" />
            <div className="username">{participant.username}</div>
            <div className="status-icons">
              {participant.isMuted && (
                <span role="img" aria-label="muted">🔇</span>
              )}
              <VolumeSlider
                type="range"
                min="0"
                max="1"
                step="0.1"
                value={participantVolumes[participant.id] || 1}
                onChange={(e) => handleVolumeChange(participant.id, parseFloat(e.target.value))}
              />
            </div>
          </ParticipantItem>
        ))}
      </ParticipantList>

      <Controls>
        <ControlButton
          onClick={toggleMute}
          $active={isMuted}
          disabled={!isConnected}
        >
          {isMuted ? '🔇 Unmute' : '🎤 Mute'}
        </ControlButton>
        <ControlButton
          onClick={leaveChannel}
          disabled={!isConnected}
        >
          🚪 Leave
        </ControlButton>
      </Controls>
    </VoiceChannelContainer>
  );
};

export default VoiceChannel; 