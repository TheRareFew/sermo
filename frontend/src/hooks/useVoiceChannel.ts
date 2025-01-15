import { useEffect, useRef, useState } from 'react';
import { VoiceService } from '../services/voice';
import { useAuth } from '../contexts/AuthContext';
import { User } from '../types';

interface VoiceParticipant extends User {
  isSpeaking: boolean;
  isMuted: boolean;
}

export const useVoiceChannel = ({ channelId }: { channelId: string }) => {
  const { user } = useAuth();
  const [isConnected, setIsConnected] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [participants, setParticipants] = useState<VoiceParticipant[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [connectionStatus, setConnectionStatus] = useState<'connecting' | 'connected' | 'disconnected' | 'error'>('disconnected');
  
  const voiceService = useRef<VoiceService | null>(null);

  useEffect(() => {
    if (!channelId || !user) return;

    const initializeVoiceChannel = async () => {
      try {
        setConnectionStatus('connecting');
        
        // Initialize Voice service
        voiceService.current = new VoiceService({
          channelId,
          userId: user.id,
          signalingUrl: `${process.env.REACT_APP_WS_URL}/voice/${channelId}`
        });

        // Set up event listeners
        voiceService.current.on('initialized', () => {
          setIsConnected(true);
          setConnectionStatus('connected');
          // Reset participants list when initializing
          setParticipants([{
            ...user,
            isSpeaking: false,
            isMuted: false
          }]);
        });

        voiceService.current.on('error', (err) => {
          setError(err.message);
          setConnectionStatus('error');
        });

        voiceService.current.on('disconnected', () => {
          setConnectionStatus('disconnected');
          setIsConnected(false);
          setParticipants([]); // Clear participants on disconnect
        });

        voiceService.current.on('voiceActivity', (isActive) => {
          setParticipants(prev => prev.map(p => 
            p.id === user.id ? { ...p, isSpeaking: isActive } : p
          ));
        });

        // Initialize the service
        await voiceService.current.initialize();

      } catch (err) {
        setError('Failed to initialize voice channel. Please check your microphone permissions.');
        setConnectionStatus('error');
        console.error('Error initializing voice channel:', err);
      }
    };

    initializeVoiceChannel();

    // Cleanup
    return () => {
      if (voiceService.current) {
        voiceService.current.disconnect();
        voiceService.current = null;
      }
      setParticipants([]);
      setIsConnected(false);
      setConnectionStatus('disconnected');
    };
  }, [channelId, user]);

  const toggleMute = () => {
    if (voiceService.current) {
      const isMutedNow = voiceService.current.toggleMute();
      setIsMuted(isMutedNow);
    }
  };

  const leaveChannel = () => {
    if (voiceService.current) {
      voiceService.current.disconnect();
      setIsConnected(false);
      setConnectionStatus('disconnected');
      setParticipants([]);
    }
  };

  return {
    isConnected,
    isMuted,
    error,
    connectionStatus,
    participants,
    toggleMute,
    leaveChannel
  };
}; 