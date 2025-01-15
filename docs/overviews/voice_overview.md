# Voice Features Overview

This document provides an overview of the project's voice features, covering the implementation of voice channels, audio streaming over WebSockets, and related functionalities. The goal is to help you understand how voice communication is integrated into the application.

## Table of Contents

- [Introduction](#introduction)
- [Frontend Components](#frontend-components)
  - [VoiceChannel Component](#voicechannel-component)
  - [useVoiceChannel Hook](#usevoicechannel-hook)
- [Services](#services)
  - [Voice Service](#voice-service)
  - [WebRTC Service](#webrtc-service)
- [API Integration](#api-integration)
- [State Management](#state-management)
- [Directory Structure](#directory-structure)
- [Conclusion](#conclusion)

## Introduction

The project implements voice communication features that allow users to join voice channels, transmit and receive audio, and interact in real-time. The voice functionality leverages WebSockets, WebRTC, and audio processing APIs to enable seamless voice communication between users.

## Frontend Components

### VoiceChannel Component

**Path:** `frontend/src/components/voice/VoiceChannel/index.tsx`

The `VoiceChannel` component is the main interface for users interacting with voice channels. It handles the UI for displaying participants, controls for muting/unmuting, and displays the connection status.

**Key Features:**

- Displays a list of participants in the voice channel.
- Indicates which participants are currently speaking.
- Provides controls for muting/unmuting the microphone.
- Shows connection status (`connecting`, `connected`, `disconnected`, `error`).

**Code Snippet:**

[CODE START]
import React from 'react';
import { useVoiceChannel } from '../../../hooks/useVoiceChannel';

const VoiceChannel = ({ channelId }) => {
  const {
    isConnected,
    isMuted,
    error,
    connectionStatus,
    participants,
    toggleMute,
    leaveChannel,
  } = useVoiceChannel({ channelId });

  return (
    <div>
      <h2>Voice Channel</h2>
      <div>Status: {connectionStatus}</div>
      {error && <div>Error: {error}</div>}
      <ul>
        {participants.map((participant) => (
          <li key={participant.id}>
            {participant.username} {participant.isSpeaking && '(speaking)'}
          </li>
        ))}
      </ul>
      <button onClick={toggleMute}>{isMuted ? 'Unmute' : 'Mute'}</button>
      <button onClick={leaveChannel}>Leave Channel</button>
    </div>
  );
};

export default VoiceChannel;
[CODE END]

### useVoiceChannel Hook

**Path:** `frontend/src/hooks/useVoiceChannel.ts`

The `useVoiceChannel` hook encapsulates the logic for connecting to a voice channel, managing the voice service, and handling participants' state.

**Responsibilities:**

- Initializes the `VoiceService` with the given channel ID and user information.
- Manages connection status and error handling.
- Tracks participants, their speaking status, and whether they are muted.
- Provides functions to toggle mute and leave the channel.

**Code Snippet:**

[CODE START]
import { useEffect, useRef, useState } from 'react';
import { VoiceService } from '../services/voice';
import { useAuth } from '../contexts/AuthContext';

export const useVoiceChannel = ({ channelId }) => {
  const { user } = useAuth();
  const [isConnected, setIsConnected] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [participants, setParticipants] = useState([]);
  const [error, setError] = useState(null);
  const [connectionStatus, setConnectionStatus] = useState('disconnected');

  const voiceService = useRef(null);

  useEffect(() => {
    if (!channelId || !user) return;

    const initializeVoiceChannel = async () => {
      try {
        setConnectionStatus('connecting');
        voiceService.current = new VoiceService({
          channelId,
          userId: user.id,
          signalingUrl: `${process.env.REACT_APP_WS_URL}/voice/${channelId}`,
        });

        voiceService.current.on('initialized', () => {
          setIsConnected(true);
          setConnectionStatus('connected');
          setParticipants([
            {
              ...user,
              isSpeaking: false,
              isMuted: false,
            },
          ]);
        });

        voiceService.current.on('error', (err) => {
          setError(err.message);
          setConnectionStatus('error');
        });

        voiceService.current.on('disconnected', () => {
          setConnectionStatus('disconnected');
          setIsConnected(false);
          setParticipants([]);
        });

        voiceService.current.on('voiceActivity', (isActive) => {
          setParticipants((prev) =>
            prev.map((p) =>
              p.id === user.id ? { ...p, isSpeaking: isActive } : p
            )
          );
        });

        await voiceService.current.initialize();
      } catch (err) {
        setError(
          'Failed to initialize voice channel. Please check your microphone permissions.'
        );
        setConnectionStatus('error');
        console.error('Error initializing voice channel:', err);
      }
    };

    initializeVoiceChannel();

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
    leaveChannel,
  };
};
[CODE END]

## Services

### Voice Service

**Path:** `frontend/src/services/voice/index.ts`

The `VoiceService` class handles low-level audio processing, capturing, and transmitting voice data over WebSockets.

**Key Responsibilities:**

- Captures audio from the user's microphone using the MediaStream API.
- Processes audio data for voice activity detection.
- Sends audio data to the server via WebSocket connection.
- Handles incoming audio data and plays it back using the AudioContext API.
- Manages reconnection logic and error handling.

**Code Snippet:**

[CODE START]
import { EventEmitter } from 'events';

export class VoiceService extends EventEmitter {
  constructor(config) {
    this.channelId = config.channelId;
    this.userId = config.userId;
    this.signalingUrl = config.signalingUrl;
    // Other initializations...
  }

  async initialize() {
    // Get user media with audio constraints...
    this.localStream = await navigator.mediaDevices.getUserMedia({ audio: true });
    // Set up audio processing...
    await this.setupAudioProcessing();
    // Connect to signaling server...
    await this.connectToSignalingServer();
  }

  async setupAudioProcessing() {
    // Create AudioContext and set up AnalyserNode for voice activity detection...
  }

  async connectToSignalingServer() {
    this.ws = new WebSocket(this.signalingUrl);
    // Set up WebSocket event handlers...
  }

  toggleMute() {
    // Toggle mute state and update audio tracks...
  }

  disconnect() {
    // Close connections and clean up resources...
  }

  // Additional methods for handling audio data...
}
[CODE END]

### WebRTC Service

**Path:** `frontend/src/services/webrtc/index.ts`

The `WebRTCService` handles peer-to-peer connections for transmitting audio streams between users using WebRTC APIs.

**Responsibilities:**

- Manages `RTCPeerConnection` instances for each connected peer.
- Handles signaling messages over WebSocket for exchanging SDP offers, answers, and ICE candidates.
- Manages local and remote audio streams.
- Facilitates voice activity detection and state updates.

**Note:** The `WebRTCService` integrates closely with the signaling server to manage peer connections and establish direct media streams between users.

**Code Snippet:**

[CODE START]
import { EventEmitter } from 'events';

class WebRTCService extends EventEmitter {
  constructor(config) {
    this.channelId = config.channelId;
    this.userId = config.userId;
    this.signalingUrl = config.signalingUrl;
    // Other initializations...
  }

  async initialize() {
    // Set up local media stream...
    this.localStream = await navigator.mediaDevices.getUserMedia({ audio: true });
    // Connect to signaling server...
    this.ws = new WebSocket(this.signalingUrl);
    // Set up event handlers for signaling messages...
  }

  async createPeerConnection(peerUserId) {
    const peerConnection = new RTCPeerConnection(/* Configuration */);
    // Handle ICE candidates and track events...
    return peerConnection;
  }

  // Methods for handling offers, answers, and ICE candidates...
}
export default WebRTCService;
[CODE END]

## API Integration

The voice features interact with the backend via WebSockets for signaling and data transmission. The frontend establishes a WebSocket connection to specific endpoints provided by the backend for voice communication.

**WebSocket URL:**

- `ws://localhost:8000/ws/voice/{channel_id}`: Used for voice signaling and data transmission.

**Authentication:**

- The `VoiceService` includes the authentication token in the connection headers to ensure secure communication with the backend.

## State Management

The voice components and services maintain their own state, primarily using React's `useState` and `useEffect` hooks.

- `isConnected`: Indicates if the user is connected to the voice channel.
- `participants`: An array of participants in the voice channel along with their speaking and mute status.
- `connectionStatus`: Represents the current connection state (`connecting`, `connected`, `disconnected`, `error`).
- `isMuted`: Indicates if the user's microphone is muted.

**Example Usage in `VoiceChannel` Component:**

[CODE START]
const {
  isConnected,
  isMuted,
  error,
  connectionStatus,
  participants,
  toggleMute,
  leaveChannel,
} = useVoiceChannel({ channelId });
[CODE END]

## Directory Structure

[CODE START]
frontend/
├── src/
    ├── components/
    │   └── voice/
    │       └── VoiceChannel/
    │           └── index.tsx
    ├── hooks/
    │   └── useVoiceChannel.ts
    ├── services/
    │   ├── voice/
    │   │   └── index.ts
    │   ├── webrtc/
    │   │   └── index.ts
    └── ...
[CODE END]

## Conclusion

The voice features are an integral part of the application, enabling real-time voice communication between users. The implementation involves several components and services that work together to capture, transmit, and receive audio streams. Understanding these components and how they interact will help in maintaining and extending the voice functionalities.
