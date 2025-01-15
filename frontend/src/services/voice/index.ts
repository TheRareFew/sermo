import { EventEmitter } from 'events';
import { getAuthToken } from '../api/auth';

interface VoiceServiceConfig {
  channelId: string;
  userId: string;
  signalingUrl: string;
}

interface VoiceStatePayload {
  speaking: boolean;
  muted: boolean;
  channel_id?: string;
}

interface VoiceActivityPayload {
  isActive: boolean;
  channel_id?: string;
}

export class VoiceService extends EventEmitter {
  private channelId: string;
  private userId: string;
  private signalingUrl: string;
  private ws: WebSocket | null = null;
  private localStream: MediaStream | null = null;
  private audioContext: AudioContext | null = null;
  private audioAnalyser: AnalyserNode | null = null;
  private scriptProcessor: ScriptProcessorNode | null = null;
  private isMuted: boolean = false;
  private reconnectAttempts: number = 0;
  private maxReconnectAttempts: number = 5;
  private isReconnecting: boolean = false;
  private readonly VOICE_ACTIVITY_THRESHOLD = 5;
  private readonly VOICE_ACTIVITY_SMOOTHING = 0.1;

  constructor(config: VoiceServiceConfig) {
    super();
    this.channelId = config.channelId;
    this.userId = config.userId;
    this.signalingUrl = config.signalingUrl;
  }

  async initialize(): Promise<void> {
    try {
      console.log('Initializing Voice service...', {
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

      // Set up audio processing
      await this.setupAudioProcessing();

      // Connect to signaling server
      try {
        await this.connectToSignalingServer();
        console.log('Successfully connected to signaling server');
      } catch (error) {
        console.error('Failed to connect to signaling server:', error);
        this.handleSignalingError(error);
      }

      this.emit('initialized');
      console.log('Voice service initialized successfully');
    } catch (error) {
      console.error('Error initializing Voice service:', error);
      this.emit('error', error);
      throw error;
    }
  }

  private async setupAudioProcessing(): Promise<void> {
    if (!this.localStream) return;

    this.audioContext = new AudioContext();
    const source = this.audioContext.createMediaStreamSource(this.localStream);
    
    // Create analyser for voice activity detection
    this.audioAnalyser = this.audioContext.createAnalyser();
    this.audioAnalyser.smoothingTimeConstant = this.VOICE_ACTIVITY_SMOOTHING;
    this.audioAnalyser.fftSize = 1024;

    // Create script processor for sending audio data
    this.scriptProcessor = this.audioContext.createScriptProcessor(4096, 1, 1);
    
    // Connect the audio nodes
    source.connect(this.audioAnalyser);
    this.audioAnalyser.connect(this.scriptProcessor);
    this.scriptProcessor.connect(this.audioContext.createGain());

    // Set up audio processing callback
    this.scriptProcessor.onaudioprocess = (e) => {
      if (this.isMuted) return;

      // Get audio data
      const inputData = e.inputBuffer.getChannelData(0);
      
      // Check voice activity
      const dataArray = new Uint8Array(this.audioAnalyser!.frequencyBinCount);
      this.audioAnalyser!.getByteFrequencyData(dataArray);
      const average = dataArray.reduce((a, b) => a + b) / dataArray.length;
      const isActive = average > this.VOICE_ACTIVITY_THRESHOLD;

      if (isActive) {
        console.log('Voice activity detected:', {
          average,
          threshold: this.VOICE_ACTIVITY_THRESHOLD
        });
      }

      // Only send data if there's voice activity
      if (isActive) {
        // Convert Float32Array to Int16Array for PCM data
        const pcmData = new Int16Array(inputData.length);
        for (let i = 0; i < inputData.length; i++) {
          pcmData[i] = Math.min(1, Math.max(-1, inputData[i])) * 0x7FFF;
        }

        // Send voice data
        this.sendVoiceData(pcmData.buffer);
      }

      // Emit voice activity state
      this.emit('voiceActivity', isActive);
    };
  }

  private async connectToSignalingServer(): Promise<void> {
    const token = getAuthToken();
    if (!token) {
      throw new Error('No auth token available');
    }

    const wsUrl = `${this.signalingUrl}?token=${token}&channel_id=${this.channelId}`;
    
    return new Promise((resolve, reject) => {
      try {
        this.ws = new WebSocket(wsUrl);
        this.ws.binaryType = 'arraybuffer';

        this.ws.onopen = () => {
          console.log('Voice WebSocket connected');
          this.reconnectAttempts = 0;
          this.isReconnecting = false;
          resolve();
        };

        this.ws.onclose = () => {
          console.log('Voice WebSocket closed');
          this.handleReconnect();
        };

        this.ws.onerror = (error) => {
          console.error('Voice WebSocket error:', error);
          reject(error);
        };

        this.ws.onmessage = (event) => {
          console.log('Received WebSocket message:', {
            type: typeof event.data,
            isArrayBuffer: event.data instanceof ArrayBuffer,
            size: event.data instanceof ArrayBuffer ? event.data.byteLength : event.data.length
          });

          if (event.data instanceof ArrayBuffer) {
            // Handle incoming voice data
            this.handleVoiceData(event.data);
          } else if (typeof event.data === 'string') {
            try {
              const jsonData = JSON.parse(event.data);
              console.log('Received JSON message:', jsonData);
            } catch (e) {
              console.error('Failed to parse JSON message:', e);
            }
          }
        };
      } catch (error) {
        reject(error);
      }
    });
  }

  private handleSignalingError(error: any): void {
    console.error('Signaling error:', error);
    
    if (this.reconnectAttempts < this.maxReconnectAttempts && !this.isReconnecting) {
      this.isReconnecting = true;
      const delay = Math.min(1000 * Math.pow(2, this.reconnectAttempts), 10000);
      console.log(`Attempting to reconnect in ${delay}ms (attempt ${this.reconnectAttempts + 1}/${this.maxReconnectAttempts})`);
      
      setTimeout(async () => {
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

  private handleReconnect(): void {
    if (!this.isReconnecting) {
      this.handleSignalingError(new Error('WebSocket disconnected'));
    }
  }

  private sendVoiceData(data: ArrayBuffer): void {
    if (this.ws?.readyState === WebSocket.OPEN && !this.isMuted) {
      console.log('Sending voice data:', {
        size: data.byteLength,
        isMuted: this.isMuted,
        wsState: this.ws.readyState
      });
      try {
        this.ws.send(data);
        console.log('Voice data sent successfully');
      } catch (e) {
        console.error('Failed to send voice data:', e);
      }
    }
  }

  private handleVoiceData(data: ArrayBuffer): void {
    console.log('Received voice data:', {
      size: data.byteLength
    });
    // Create audio context if it doesn't exist
    if (!this.audioContext) {
      console.log('Creating new AudioContext');
      this.audioContext = new AudioContext();
    }

    try {
      // Convert the incoming PCM data back to audio
      const pcmData = new Int16Array(data);
      const floatData = new Float32Array(pcmData.length);
      for (let i = 0; i < pcmData.length; i++) {
        floatData[i] = pcmData[i] / 0x7FFF;
      }

      // Create an audio buffer and play it
      const audioBuffer = this.audioContext.createBuffer(1, floatData.length, this.audioContext.sampleRate);
      audioBuffer.getChannelData(0).set(floatData);

      const source = this.audioContext.createBufferSource();
      source.buffer = audioBuffer;
      source.connect(this.audioContext.destination);
      console.log('Playing audio buffer:', {
        length: floatData.length,
        sampleRate: this.audioContext.sampleRate,
        duration: audioBuffer.duration
      });
      source.start();
      console.log('Audio playback started');
    } catch (e) {
      console.error('Failed to process or play voice data:', e);
    }
  }

  toggleMute(): boolean {
    this.isMuted = !this.isMuted;
    if (this.localStream) {
      this.localStream.getAudioTracks().forEach(track => {
        track.enabled = !this.isMuted;
      });
    }
    return this.isMuted;
  }

  disconnect(): void {
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }

    if (this.scriptProcessor) {
      this.scriptProcessor.disconnect();
      this.scriptProcessor = null;
    }

    if (this.audioAnalyser) {
      this.audioAnalyser.disconnect();
      this.audioAnalyser = null;
    }

    if (this.audioContext) {
      this.audioContext.close();
      this.audioContext = null;
    }

    if (this.localStream) {
      this.localStream.getTracks().forEach(track => track.stop());
      this.localStream = null;
    }

    this.emit('disconnected');
  }
} 