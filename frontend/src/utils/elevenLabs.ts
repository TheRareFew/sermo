const ELEVENLABS_API_URL = 'https://api.elevenlabs.io/v1';

class ElevenLabsService {
  private apiKey: string;
  private voiceId: string;

  constructor() {
    this.apiKey = process.env.REACT_APP_ELEVENLABS_API_KEY || '';
    this.voiceId = process.env.REACT_APP_ELEVENLABS_VOICE_ID || '';

    // Validate credentials on initialization
    if (!this.apiKey) {
      console.error('ElevenLabs API key is not set in environment variables');
    }
    if (!this.voiceId) {
      console.error('ElevenLabs Voice ID is not set in environment variables');
    }
  }

  private validateCredentials(): void {
    if (!this.apiKey || !this.voiceId) {
      throw new Error('ElevenLabs API credentials are not properly configured');
    }
  }

  async playTextAudio(text: string): Promise<void> {
    try {
      // Validate credentials before making the request
      this.validateCredentials();

      console.log('Initiating text-to-speech request for:', text.substring(0, 50) + '...');

      const response = await fetch(
        `${ELEVENLABS_API_URL}/text-to-speech/${this.voiceId}/stream`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'xi-api-key': this.apiKey,
          },
          body: JSON.stringify({
            text,
            model_id: 'eleven_monolingual_v1',
            voice_settings: {
              stability: 0.5,
              similarity_boost: 0.75,
            },
          }),
        }
      );

      if (!response.ok) {
        const errorText = await response.text();
        console.error('ElevenLabs API error response:', errorText);
        throw new Error(`ElevenLabs API error: ${response.status} - ${response.statusText}`);
      }

      console.log('Successfully received audio stream response');

      const arrayBuffer = await response.arrayBuffer();
      if (!arrayBuffer || arrayBuffer.byteLength === 0) {
        throw new Error('Received empty audio data from ElevenLabs API');
      }

      const audioBlob = new Blob([arrayBuffer], { type: 'audio/mpeg' });
      const audioUrl = URL.createObjectURL(audioBlob);
      const audio = new Audio(audioUrl);

      return new Promise((resolve, reject) => {
        audio.oncanplaythrough = () => {
          console.log('Audio is ready to play');
        };

        audio.onended = () => {
          console.log('Audio playback completed');
          URL.revokeObjectURL(audioUrl);
          resolve();
        };

        audio.onerror = (error) => {
          console.error('Audio playback error:', error);
          URL.revokeObjectURL(audioUrl);
          reject(new Error('Failed to play audio: ' + error.toString()));
        };

        console.log('Starting audio playback');
        audio.play().catch((error) => {
          console.error('Failed to start audio playback:', error);
          URL.revokeObjectURL(audioUrl);
          reject(error);
        });
      });
    } catch (error) {
      console.error('Error in playTextAudio:', error);
      throw error;
    }
  }
}

export const elevenLabsService = new ElevenLabsService(); 