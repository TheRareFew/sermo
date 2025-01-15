import { EventEmitter } from 'events';
import { getAuthToken } from '../api/auth';

interface WebRTCConfig {
  channelId: string;
  userId: string;
  signalingUrl: string;
}

interface VoiceStatePayload {
  speaking: boolean;
  muted: boolean;
  channel_id?: string;
}

interface RTCPayload {
  sdp?: string;
  type?: string;
  candidate?: RTCIceCandidateInit;
}

interface ParticipantsPayload {
  participants: Array<{
    id: string;
    username: string;
    status?: string;
  }>;
  channel_id?: string;
}

interface UserPayload {
  user: {
    id: string;
    username: string;
    status?: string;
  };
  channel_id?: string;
}

interface VoiceActivityPayload {
  isActive: boolean;
  channel_id?: string;
}

interface ChannelPayload {
  channel_id: string;
}

type SignalingPayload = VoiceStatePayload | RTCPayload | ParticipantsPayload | UserPayload | VoiceActivityPayload | ChannelPayload;

interface BackendSignalingMessage {
  type: 'join' | 'leave' | 'offer' | 'answer' | 'ice-candidate' | 'voice-activity' | 'voice_state' | 'participants_list' | 'voice_state_update' | 'participant-mute' | 'participant-unmute';
  from_user_id?: string;
  user_id?: string;
  to_user_id?: string;
  channel_id?: string;
  event?: 'joined' | 'left' | 'state_changed';
  payload?: SignalingPayload;
  state?: VoiceStatePayload;
}

interface InternalSignalingMessage {
  type: 'join' | 'leave' | 'offer' | 'answer' | 'ice-candidate' | 'voice-activity' | 'voice_state' | 'participants_list' | 'voice_state_update' | 'participant-mute' | 'participant-unmute';
  from_user_id: string;
  to_user_id?: string;
  channel_id?: string;
  payload: SignalingPayload;
}

class WebRTCService extends EventEmitter {
  private peerConnections: { [userId: string]: RTCPeerConnection } = {};
  private localStream: MediaStream | null = null;
  private channelId: string;
  private userId: string;
  private signalingUrl: string;
  private ws: WebSocket | null = null;
  private connectedPeers: Set<string> = new Set();
  private audioContext: AudioContext | null = null;
  private audioAnalyser: AnalyserNode | null = null;
  private voiceActivityDetectionInterval: number | null = null;
  private reconnectAttempts: number = 0;
  private maxReconnectAttempts: number = 5;
  private reconnectTimeout: number | null = null;
  private isReconnecting: boolean = false;
  private participants: Array<{
    id: string;
    username: string;
    status?: string;
  }> = [];
  private isMuted: boolean = false;
  private lastVoiceState: { speaking: boolean; muted: boolean } | null = null;
  private voiceStateDebounceTimeout: number | null = null;
  private readonly VOICE_ACTIVITY_THRESHOLD = 5;
  private readonly VOICE_ACTIVITY_DEBOUNCE_MS = 50;
  private readonly VOICE_ACTIVITY_SMOOTHING = 0.1;
  private readonly VOICE_CHECK_INTERVAL_MS = 20;
  private iceCandidates: Map<string, Array<any>> = new Map();

  constructor(config: WebRTCConfig) {
    super();
    this.channelId = config.channelId;
    this.userId = config.userId;
    this.signalingUrl = config.signalingUrl;
  }

  async initialize(): Promise<void> {
    try {
      console.log('Initializing WebRTC service...', {
        channelId: this.channelId,
        userId: this.userId,
        signalingUrl: this.signalingUrl
      });

      // Get user media with noise suppression and echo cancellation
      this.localStream = await navigator.mediaDevices.getUserMedia({ 
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
          // Add advanced constraints for better audio quality
          advanced: [
            { noiseSuppression: true },
            { autoGainControl: true },
            { channelCount: 1 }, // Mono audio for better performance
            { sampleRate: 48000 } // Higher sample rate for better quality
          ]
        },
        video: false 
      });

      console.log('Audio stream obtained:', this.localStream.getAudioTracks()[0].label);

      // Set up audio level monitoring
      this.setupVoiceActivityDetection();

      // Connect to signaling server
      try {
        await this.connectToSignalingServer();
        console.log('Successfully connected to signaling server');
      } catch (error) {
        console.error('Failed to connect to signaling server:', error);
        this.handleSignalingError(error);
      }

      this.emit('initialized');
      console.log('WebRTC service initialized successfully');
    } catch (error) {
      console.error('Error initializing WebRTC service:', error);
      this.emit('error', error);
      throw error;
    }
  }

  private handleSignalingError(error: any): void {
    console.error('Signaling error:', error);
    
    if (this.reconnectAttempts < this.maxReconnectAttempts && !this.isReconnecting) {
      this.isReconnecting = true;
      const delay = Math.min(1000 * Math.pow(2, this.reconnectAttempts), 10000);
      console.log(`Attempting to reconnect in ${delay}ms (attempt ${this.reconnectAttempts + 1}/${this.maxReconnectAttempts})`);
      
      if (this.reconnectTimeout) {
        clearTimeout(this.reconnectTimeout);
      }
      
      this.reconnectTimeout = window.setTimeout(async () => {
        try {
          this.reconnectAttempts++;
          await this.connectToSignalingServer();
          this.isReconnecting = false;
          this.reconnectAttempts = 0;
          console.log('Successfully reconnected to signaling server');
        } catch (err) {
          this.handleSignalingError(err);
        }
      }, delay);
    } else if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      console.error('Max reconnection attempts reached');
      this.emit('error', new Error('Failed to connect to voice server after multiple attempts'));
    }
  }

  private async createPeerConnection(userId: string): Promise<RTCPeerConnection> {
    console.log('Creating peer connection for user:', userId);
    
    const isFirefox = navigator.userAgent.toLowerCase().includes('firefox');
    console.log('Browser detected:', isFirefox ? 'Firefox' : 'Other');
    
    const peerConnection = new RTCPeerConnection({
      iceServers: [
        // Public STUN servers
        { urls: 'stun:stun.l.google.com:19302' },
        { urls: 'stun:stun1.l.google.com:19302' },
        {
          urls: 'turn:turn.sermo.app:3478',
          username: 'sermo',
          credential: 'sermo123'
        }
      ],
      iceTransportPolicy: 'all',
      bundlePolicy: 'max-bundle',
      rtcpMuxPolicy: 'require',
      iceCandidatePoolSize: 10
    });

    // Add debugging for ICE connection
    peerConnection.oniceconnectionstatechange = () => {
      console.log('ICE connection state changed:', {
        userId,
        state: peerConnection.iceConnectionState,
        candidates: this.iceCandidates.get(userId) || []
      });
    };

    // Track ICE candidates for debugging
    this.iceCandidates.set(userId, []);
    peerConnection.onicecandidate = (event) => {
      if (event.candidate) {
        // Store candidate for debugging
        const candidates = this.iceCandidates.get(userId) || [];
        candidates.push({
          type: event.candidate.type,
          protocol: event.candidate.protocol,
          address: event.candidate.address,
          port: event.candidate.port,
          candidate: event.candidate.candidate
        });
        this.iceCandidates.set(userId, candidates);

        console.log('Generated ICE candidate:', {
          userId,
          type: event.candidate.type,
          protocol: event.candidate.protocol,
          address: event.candidate.address,
          port: event.candidate.port,
          candidate: event.candidate.candidate
        });

        this.sendSignalingMessage({
          type: 'ice-candidate',
          from_user_id: this.userId,
          to_user_id: userId,
          payload: {
            candidate: event.candidate
          }
        });
      } else {
        console.log('Finished gathering ICE candidates for:', userId, {
          totalCandidates: this.iceCandidates.get(userId)?.length || 0
        });
      }
    };

    // Handle remote tracks
    peerConnection.ontrack = (event) => {
      console.log('Received remote track from:', userId, {
        kind: event.track.kind,
        enabled: event.track.enabled,
        muted: event.track.muted,
        readyState: event.track.readyState,
        id: event.track.id
      });

      // Create a new MediaStream for the track
      const remoteStream = new MediaStream([event.track]);
      
      // Ensure track is enabled and unmuted
      event.track.enabled = true;
      
      // Log the new stream details
      console.log('Created new MediaStream for remote track:', {
        streamId: remoteStream.id,
        active: remoteStream.active,
        tracks: remoteStream.getTracks().map(t => ({
          kind: t.kind,
          enabled: t.enabled,
          muted: t.muted,
          readyState: t.readyState,
          id: t.id
        }))
      });

      // Monitor track status
      event.track.onended = () => {
        console.log('Remote track ended:', userId);
        this.emit('track:ended', userId);
      };

      event.track.onmute = () => {
        console.log('Remote track muted:', userId);
        this.emit('track:muted', userId);
      };

      event.track.onunmute = () => {
        console.log('Remote track unmuted:', userId);
        this.emit('track:unmuted', userId);
      };

      // Emit the track event with the new stream
      this.emit('track', remoteStream, userId);
      this.connectedPeers.add(userId);
    };

    // Monitor connection state
    peerConnection.onconnectionstatechange = () => {
      const state = peerConnection.connectionState;
      console.log(`Connection state change with ${userId}:`, {
        state,
        iceState: peerConnection.iceConnectionState,
        signalingState: peerConnection.signalingState,
        transceivers: peerConnection.getTransceivers().map(t => ({
          mid: t.mid,
          direction: t.direction,
          currentDirection: t.currentDirection
        }))
      });
      
      if (state === 'connected') {
        console.log('Connection established, checking media flow');
        this.checkMediaFlow(peerConnection, userId);
      } else if (state === 'failed') {
        console.log('Connection failed, attempting to recreate peer connection');
        this.handleConnectionFailure(userId);
      }
    };

    // Monitor ICE gathering state
    peerConnection.onicegatheringstatechange = () => {
      console.log('ICE gathering state changed:', {
        userId,
        state: peerConnection.iceGatheringState
      });
    };

    // Monitor signaling state
    peerConnection.onsignalingstatechange = () => {
      console.log('Signaling state changed:', {
        userId,
        state: peerConnection.signalingState
      });
    };

    return peerConnection;
  }

  private async checkMediaFlow(peerConnection: RTCPeerConnection, userId: string): Promise<void> {
    try {
      const stats = await peerConnection.getStats();
      let hasInboundAudio = false;
      let hasOutboundAudio = false;

            stats.forEach(report => {
        if (report.type === 'inbound-rtp' && report.kind === 'audio') {
          hasInboundAudio = true;
        }
        if (report.type === 'outbound-rtp' && report.kind === 'audio') {
          hasOutboundAudio = true;
        }
      });

      console.log('Media flow check:', {
        userId,
        hasInboundAudio,
        hasOutboundAudio,
        transceivers: peerConnection.getTransceivers().map(t => ({
          mid: t.mid,
          currentDirection: t.currentDirection,
          direction: t.direction
        }))
      });
          } catch (error) {
      console.error('Error checking media flow:', error);
    }
  }

  private logMediaState(peerConnection: RTCPeerConnection, userId: string): void {
    console.log('Current media state:', {
      userId,
      senders: peerConnection.getSenders().map(s => ({
        trackType: s.track?.kind,
        trackEnabled: s.track?.enabled,
        trackMuted: s.track?.muted,
        trackId: s.track?.id
      })),
      receivers: peerConnection.getReceivers().map(r => ({
        trackType: r.track?.kind,
        trackEnabled: r.track?.enabled,
        trackMuted: r.track?.muted,
        trackId: r.track?.id
      })),
      transceivers: peerConnection.getTransceivers().map(t => ({
        mid: t.mid,
        currentDirection: t.currentDirection,
        direction: t.direction
      }))
    });
  }

  private async handleConnectionFailure(userId: string): Promise<void> {
    console.log('Handling connection failure for user:', userId);
    
    // Clean up existing connection
    this.cleanupPeerConnection(userId);
    
    try {
      // Create new peer connection
      const newPeerConnection = await this.createPeerConnection(userId);
      this.peerConnections[userId] = newPeerConnection;
      
      // Initiate new connection
      await this.initiatePeerConnection(userId);
    } catch (error) {
      console.error('Failed to recover connection:', error);
      this.emit('error', new Error(`Failed to reconnect with user ${userId}`));
    }
  }

  private handleTrackEnded(userId: string): void {
    console.log('Handling track ended for user:', userId);
    // Attempt to renegotiate the connection
    this.initiatePeerConnection(userId).catch(error => {
      console.error('Failed to renegotiate connection:', error);
    });
  }

  private setupVoiceActivityDetection(): void {
    if (!this.localStream) return;

    this.audioContext = new AudioContext();
    const mediaStreamSource = this.audioContext.createMediaStreamSource(this.localStream);
    this.audioAnalyser = this.audioContext.createAnalyser();
    
    // Adjust analyser settings for better voice detection
    this.audioAnalyser.fftSize = 2048;
    this.audioAnalyser.smoothingTimeConstant = this.VOICE_ACTIVITY_SMOOTHING;
    this.audioAnalyser.minDecibels = -90;
    this.audioAnalyser.maxDecibels = -10;
    
    // Connect the source to the analyser and then to the destination
    mediaStreamSource.connect(this.audioAnalyser);
    // Don't connect to destination as it would create a feedback loop
    // Instead, ensure the original stream is used for peer connection
    
    const dataArray = new Uint8Array(this.audioAnalyser.frequencyBinCount);
    let lastVoiceActivityState = false;
    let smoothedAverage = 0;
    let consecutiveSilentFrames = 0;
    const SILENT_FRAME_THRESHOLD = 5;

    const checkAudioLevel = () => {
      if (this.audioAnalyser) {
        this.audioAnalyser.getByteFrequencyData(dataArray);
        
        // Calculate average volume in human voice frequency range (85-255 Hz)
        const voiceFreqStart = Math.floor(85 * this.audioAnalyser.fftSize / this.audioContext!.sampleRate);
        const voiceFreqEnd = Math.floor(255 * this.audioAnalyser.fftSize / this.audioContext!.sampleRate);
        let sum = 0;
        let count = 0;
        let maxValue = 0;
        
        for (let i = voiceFreqStart; i < voiceFreqEnd; i++) {
          const value = dataArray[i];
          sum += value;
          count++;
          maxValue = Math.max(maxValue, value);
        }
        
        const instantAverage = sum / count;
        
        // Apply smoothing
        smoothedAverage = smoothedAverage * this.VOICE_ACTIVITY_SMOOTHING + 
                         instantAverage * (1 - this.VOICE_ACTIVITY_SMOOTHING);
        
        // Consider both average and peak values
        const isActive = smoothedAverage > this.VOICE_ACTIVITY_THRESHOLD || maxValue > this.VOICE_ACTIVITY_THRESHOLD * 2;

        // Add hysteresis to prevent rapid switching
        if (!isActive) {
          consecutiveSilentFrames++;
        } else {
          consecutiveSilentFrames = 0;
        }

        const shouldUpdateState = isActive !== lastVoiceActivityState && 
                                (!isActive ? consecutiveSilentFrames >= SILENT_FRAME_THRESHOLD : true);

        if (shouldUpdateState) {
          lastVoiceActivityState = isActive;
          
          // Clear any existing timeout
          if (this.voiceStateDebounceTimeout !== null) {
            window.clearTimeout(this.voiceStateDebounceTimeout);
          }

          // Debounce the state update
          this.voiceStateDebounceTimeout = window.setTimeout(() => {
            const newState = {
              speaking: isActive,
              muted: this.localStream?.getAudioTracks()[0]?.enabled === false
            };

            // Only send if state has changed
            if (!this.lastVoiceState || 
                this.lastVoiceState.speaking !== newState.speaking || 
                this.lastVoiceState.muted !== newState.muted) {
              
              this.lastVoiceState = newState;
              
              console.log('Voice activity detected:', {
                instantAverage,
                smoothedAverage,
                maxValue,
                threshold: this.VOICE_ACTIVITY_THRESHOLD,
                isActive,
                consecutiveSilentFrames
              });
              
              this.emit('voiceActivity', this.userId, isActive);
              
              // Send voice state update
              this.sendSignalingMessage({
                type: 'voice_state',
                from_user_id: this.userId,
                channel_id: this.channelId,
                payload: newState
              });
            }
          }, this.VOICE_ACTIVITY_DEBOUNCE_MS);
        }
      }
    };

    this.voiceActivityDetectionInterval = window.setInterval(checkAudioLevel, this.VOICE_CHECK_INTERVAL_MS);
  }

  private async connectToSignalingServer(): Promise<void> {
    const token = getAuthToken();
    if (!token) {
      throw new Error('No authentication token found');
    }

    // Remove the /ws prefix if it exists in REACT_APP_WS_URL
    const baseUrl = process.env.REACT_APP_WS_URL?.replace(/\/ws$/, '');
    // Construct the WebSocket URL correctly
    const wsUrl = `${baseUrl}/ws/voice/${this.channelId}?token=${encodeURIComponent(token)}`;
    
    console.log('Attempting to connect to signaling server at:', wsUrl);
    
    // Close existing connection if any
    if (this.ws) {
      console.log('Closing existing WebSocket connection');
      this.ws.close();
      this.ws = null;

      // Clean up existing peer connections
      Object.keys(this.peerConnections).forEach(peerId => {
        this.cleanupPeerConnection(peerId);
      });
    }

    return new Promise((resolve, reject) => {
      try {
        this.ws = new WebSocket(wsUrl);
        console.log('WebSocket instance created');

        this.ws.onopen = () => {
          console.log('WebSocket connection established, sending join message');
          // Send join message with user info
          this.sendJoinMessage();

          // Request participants list immediately after joining
          this.sendParticipantsListRequest();

          this.emit('signaling:connected');
          resolve();
        };

        this.ws.onclose = (event) => {
          console.log('WebSocket connection closed:', event);
          this.handleWebSocketClose(event);
        };

        this.ws.onerror = (error) => {
          console.error('WebSocket error:', error);
          this.handleWebSocketError(error);
          reject(error);
        };

        this.ws.onmessage = async (event: MessageEvent) => {
          try {
            const message: BackendSignalingMessage = JSON.parse(event.data);
            console.log('Received WebSocket message:', message);
            await this.handleSignalingMessage(message);
          } catch (error) {
            console.error('Error handling WebSocket message:', error);
          }
        };

      } catch (error) {
        console.error('Error creating WebSocket connection:', error);
        reject(error);
      }
    });
  }

  private handleWebSocketClose(event: CloseEvent): void {
    console.log('WebSocket connection closed:', {
      code: event.code,
      reason: event.reason,
      wasClean: event.wasClean
    });
    
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
    
    // Clean up all peer connections
    Object.keys(this.peerConnections).forEach(peerId => {
      this.cleanupPeerConnection(peerId);
    });

    this.emit('signaling:disconnected', event);
    
    // Attempt to reconnect if not a clean close
    if (!event.wasClean && !this.isReconnecting) {
      this.handleSignalingError(new Error('WebSocket connection closed unexpectedly'));
    }
  }

  private handleWebSocketError(error: Event): void {
    console.error('WebSocket error:', error);
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
    this.emit('signaling:error', error);
  }

  private async handleSignalingMessage(message: BackendSignalingMessage): Promise<void> {
    const type = message.type;
    const from = message.from_user_id || message.user_id || '';
    const payload = message.payload || message.state;
    
    console.log('Handling signaling message:', {
      type,
      from,
      payload,
      currentUserId: this.userId
    });

    switch (type) {
      case 'join':
        if (message.payload && 'user' in message.payload) {
          const joiningUser = message.payload.user;
          console.log('User joined:', joiningUser);
          this.emit('participantJoined', joiningUser);
          
          // If we're the existing user, we initiate the connection to the new user
          if (joiningUser.id !== this.userId) {
            console.log('We are existing user, initiating connection to new user:', joiningUser.id);
            await this.initiatePeerConnection(joiningUser.id);
          }
        }
        break;

      case 'participants_list':
        if (message.payload && 'participants' in message.payload) {
          this.participants = message.payload.participants;
          console.log('Received participants list:', {
            participants: this.participants,
            currentUserId: this.userId
          });
          this.emit('participantsUpdated', this.participants);
          
          // Set up connections with existing participants
          const connectionPromises = this.participants
            .filter(p => p.id !== this.userId) // Don't connect to ourselves
            .map(async participant => {
              if (!this.peerConnections[participant.id]) {
                console.log('Initiating connection to existing participant:', participant.id);
                await this.initiatePeerConnection(participant.id);
              }
            });
          
          await Promise.all(connectionPromises);
        }
        break;

      case 'offer':
        if (message.payload && 'sdp' in message.payload && message.payload.sdp && from) {
          console.log('Received offer from:', from, {
            sdp: message.payload.sdp,
            currentUserId: this.userId
          });
          const desc = new RTCSessionDescription({ 
            type: 'offer',
            sdp: message.payload.sdp 
          });
          await this.handleOffer(desc, from);
        }
        break;

      case 'answer':
        if (message.payload && 'sdp' in message.payload && message.payload.sdp && from) {
          console.log('Received answer from:', from, {
            sdp: message.payload.sdp,
            currentUserId: this.userId
          });
          const desc = new RTCSessionDescription({ 
            type: 'answer',
            sdp: message.payload.sdp 
          });
          await this.handleAnswer(desc, from);
        }
        break;

      case 'ice-candidate':
        if (message.payload && 'candidate' in message.payload && message.payload.candidate && from) {
          console.log('Received ICE candidate from:', from, {
            candidate: message.payload.candidate,
            currentUserId: this.userId
          });
          await this.handleIceCandidate(from, message.payload.candidate);
        }
        break;

      case 'leave':
        if (from) {
          console.log('Participant left:', from);
          this.cleanupPeerConnection(from);
          this.emit('participantLeft', from);
        }
        break;

      default:
        console.log('Unhandled message type:', type);
        break;
    }
  }

  private async handleOffer(desc: RTCSessionDescriptionInit, fromUserId: string) {
    try {
      console.log('Handling offer from:', fromUserId);
      console.log('Original offer SDP:', desc.sdp);
      
      let peerConnection = this.peerConnections[fromUserId];
      
      if (!peerConnection) {
        console.log('Creating new peer connection for offer');
        peerConnection = await this.createPeerConnection(fromUserId);
        this.peerConnections[fromUserId] = peerConnection;
      } else {
        console.log('Using existing peer connection for:', fromUserId);
      }

      const isFirefox = navigator.userAgent.toLowerCase().includes('firefox');

      // Check if we need to rollback any existing local description
      if (peerConnection.signalingState !== 'stable') {
        console.log('Signaling state not stable, rolling back');
        if (!isFirefox) {
          // Chrome can handle rollback
          await Promise.all([
            peerConnection.setLocalDescription({ type: 'rollback' }),
            peerConnection.setRemoteDescription(new RTCSessionDescription(desc))
          ]);
        } else {
          // Firefox needs sequential operations
          await peerConnection.setRemoteDescription(new RTCSessionDescription(desc));
        }
      } else {
        await peerConnection.setRemoteDescription(new RTCSessionDescription(desc));
      }

      console.log('Creating answer');
      const answer = await peerConnection.createAnswer();
      
      console.log('Setting local description (answer):', {
        type: answer.type,
        sdp: answer.sdp
      });
      await peerConnection.setLocalDescription(answer);
      
      // Send the answer immediately
      console.log('Sending answer to:', fromUserId);
      this.sendSignalingMessage({
        type: 'answer',
        from_user_id: this.userId,
        to_user_id: fromUserId,
        payload: {
          type: answer.type,
          sdp: answer.sdp
        }
      });

      // Log connection state and media state
      this.logMediaState(peerConnection, fromUserId);

    } catch (error) {
      console.error('Error handling offer:', error);
    }
  }

  private async handleAnswer(desc: RTCSessionDescriptionInit, fromUserId: string) {
    const peerConnection = this.peerConnections[fromUserId];
    if (peerConnection) {
      try {
        console.log('Setting remote description (answer) from:', fromUserId);
        console.log('Answer SDP:', desc.sdp);
        
        await peerConnection.setRemoteDescription(new RTCSessionDescription(desc));
        console.log('Remote description set successfully');
        
        // Log connection state after setting remote description
        console.log('Connection state after setting remote description:', {
          iceConnectionState: peerConnection.iceConnectionState,
          connectionState: peerConnection.connectionState,
          signalingState: peerConnection.signalingState,
          iceGatheringState: peerConnection.iceGatheringState,
          transceivers: peerConnection.getTransceivers().map(t => ({
            mid: t.mid,
            currentDirection: t.currentDirection,
            direction: t.direction
          }))
        });
      } catch (error) {
        console.error('Error handling answer:', error);
      }
    } else {
      console.warn('No peer connection found for:', fromUserId);
    }
  }

  private async handleIceCandidate(from: string, candidate: RTCIceCandidateInit): Promise<void> {
    const peerConnection = this.peerConnections[from];
    if (peerConnection) {
      try {
        console.log('Adding ICE candidate from:', from, {
          type: candidate.candidate ? candidate.candidate.split(' ')[7] : 'null',
          candidate: candidate.candidate
        });

        // For local testing, prioritize host candidates
        if (candidate.candidate && candidate.candidate.includes('typ host')) {
          console.log('Prioritizing host candidate for local testing');
          await peerConnection.addIceCandidate(new RTCIceCandidate(candidate));
        } else {
          // Queue other candidates to be added after host candidates
          setTimeout(async () => {
            try {
              await peerConnection.addIceCandidate(new RTCIceCandidate(candidate));
              console.log('Added delayed ICE candidate');
            } catch (error) {
              console.error('Error adding delayed ICE candidate:', error);
            }
          }, 100);
        }

        // Log current transceivers after adding ICE candidate
        console.log('Transceivers after adding ICE candidate:', 
          peerConnection.getTransceivers().map(t => ({
            mid: t.mid,
            currentDirection: t.currentDirection,
            direction: t.direction
          }))
        );
      } catch (error) {
        console.error('Error handling ICE candidate:', error);
      }
    } else {
      console.warn('Received ICE candidate but no peer connection exists for:', from);
    }
  }

  private async initiatePeerConnection(userId: string): Promise<void> {
    try {
      console.log('Initiating peer connection with:', userId, {
        currentUserId: this.userId,
        existingConnections: Object.keys(this.peerConnections)
      });
      
      // Check if we already have a connection
      let peerConnection = this.peerConnections[userId];
      if (!peerConnection) {
        peerConnection = await this.createPeerConnection(userId);
        this.peerConnections[userId] = peerConnection;
      } else {
        console.log('Using existing peer connection for:', userId);
      }

      // Ensure we have a local stream
      if (!this.localStream) {
        console.log('Getting local media stream');
        this.localStream = await navigator.mediaDevices.getUserMedia({ 
          audio: {
            echoCancellation: true,
            noiseSuppression: true,
            autoGainControl: true,
            advanced: [
              { noiseSuppression: true },
              { autoGainControl: true },
              { channelCount: 1 },
              { sampleRate: 48000 }
            ]
          },
          video: false 
        });
      }
      
      // Add tracks to peer connection
      const audioTracks = this.localStream.getAudioTracks();
      audioTracks.forEach(track => {
        console.log('Adding track to peer connection:', track.label);
        peerConnection.addTrack(track, this.localStream!);
      });
      
      const isFirefox = navigator.userAgent.toLowerCase().includes('firefox');
      
      // Create and set local description
      console.log('Creating offer for:', userId);
      const offerOptions: RTCOfferOptions = {
        offerToReceiveAudio: true
      };
      
      if (!isFirefox) {
        Object.assign(offerOptions, { iceRestart: true });
      }
      
      const offer = await peerConnection.createOffer(offerOptions);
      
      console.log('Setting local description (offer) for:', userId, {
        type: offer.type,
        sdp: offer.sdp
      });
      await peerConnection.setLocalDescription(offer);
      
      // Send the offer immediately
      console.log('Sending initial offer to:', userId);
      this.sendSignalingMessage({
        type: 'offer',
        from_user_id: this.userId,
        to_user_id: userId,
        payload: {
          type: offer.type,
          sdp: offer.sdp
        }
      });

      // Log the state after setup
      console.log('Connection state after initiating:', {
        userId,
        iceConnectionState: peerConnection.iceConnectionState,
        connectionState: peerConnection.connectionState,
        signalingState: peerConnection.signalingState,
        iceGatheringState: peerConnection.iceGatheringState,
        transceivers: peerConnection.getTransceivers().map(t => ({
          mid: t.mid,
          currentDirection: t.currentDirection,
          direction: t.direction
        }))
      });

    } catch (error) {
      console.error('Error initiating peer connection:', error);
      throw error;
    }
  }

  private cleanupPeerConnection(userId: string): void {
    const peerConnection = this.peerConnections[userId];
    if (peerConnection) {
      peerConnection.close();
      delete this.peerConnections[userId];
    }
  }

  private sendSignalingMessage(message: InternalSignalingMessage): void {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      // Format message according to backend expectations
      const formattedMessage: BackendSignalingMessage = {
        type: message.type,
        from_user_id: message.from_user_id,
        to_user_id: message.to_user_id,
        channel_id: message.channel_id,
        payload: message.payload
      };
      
      console.log('Sending signaling message:', formattedMessage);
      this.ws.send(JSON.stringify(formattedMessage));
    } else {
      console.warn('WebSocket not connected, message not sent:', message);
    }
  }

  toggleMute(): boolean {
    if (this.localStream) {
      const audioTrack = this.localStream.getAudioTracks()[0];
      audioTrack.enabled = !audioTrack.enabled;
      this.isMuted = !audioTrack.enabled;
      
      this.sendSignalingMessage({
        type: audioTrack.enabled ? 'participant-unmute' : 'participant-mute',
        from_user_id: this.userId,
        payload: {}
      });

      return this.isMuted;
    }
    return false;
  }

  public disconnect(): void {
    console.log('Disconnecting from voice channel');
    
    // Send leave message
    this.sendSignalingMessage({
      type: 'leave',
      from_user_id: this.userId,
      payload: { channel_id: this.channelId }
    });

    // Cleanup peer connections
    Object.keys(this.peerConnections).forEach(peerId => {
      this.cleanupPeerConnection(peerId);
    });

    // Close WebSocket
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }

    // Stop local stream
    if (this.localStream) {
      this.localStream.getTracks().forEach(track => track.stop());
      this.localStream = null;
    }

    // Clear voice activity detection
    if (this.voiceActivityDetectionInterval) {
      clearInterval(this.voiceActivityDetectionInterval);
    }

    // Close audio context
    if (this.audioContext) {
      this.audioContext.close();
      this.audioContext = null;
      this.audioAnalyser = null;
    }

    if (this.voiceStateDebounceTimeout !== null) {
      window.clearTimeout(this.voiceStateDebounceTimeout);
      this.voiceStateDebounceTimeout = null;
    }
    
    this.lastVoiceState = null;
  }

  private sendJoinMessage() {
    this.sendSignalingMessage({
      type: 'join',
      from_user_id: this.userId,
      payload: { 
        channel_id: this.channelId,
        user: {
          id: this.userId,
          username: 'User ' + this.userId
        }
      } as UserPayload
    });
  }

  private sendParticipantsListRequest() {
    this.sendSignalingMessage({
      type: 'participants_list',
      from_user_id: this.userId,
      payload: { 
        channel_id: this.channelId 
      } as ChannelPayload
    });
  }

  private sendVoiceStateMessage(isActive: boolean) {
    this.sendSignalingMessage({
      type: 'voice_state',
      from_user_id: this.userId,
      channel_id: this.channelId,
      payload: {
        speaking: isActive,
        muted: this.isMuted,
        channel_id: this.channelId
      } as VoiceStatePayload
    });
  }

  private sendLeaveMessage() {
    this.sendSignalingMessage({
      type: 'leave',
      from_user_id: this.userId,
      payload: { 
        channel_id: this.channelId 
      } as ChannelPayload
    });
  }

  // Add method to check ICE connection status
  private checkIceConnection(peerConnection: RTCPeerConnection, userId: string): void {
    console.log('Checking ICE connection for:', userId, {
      iceConnectionState: peerConnection.iceConnectionState,
      iceGatheringState: peerConnection.iceGatheringState,
      connectionState: peerConnection.connectionState,
      signalingState: peerConnection.signalingState,
      localDescription: peerConnection.localDescription?.type,
      remoteDescription: peerConnection.remoteDescription?.type,
      candidates: this.iceCandidates.get(userId)
    });
  }
}

export default WebRTCService; 