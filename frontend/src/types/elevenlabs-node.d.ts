declare module 'elevenlabs-node' {
  interface ElevenLabsOptions {
    apiKey: string | undefined;
    voiceId: string | undefined;
  }

  interface TextToSpeechOptions {
    textInput: string;
    responseType: 'stream';
  }

  interface AudioStreamResponse {
    on(event: 'data', callback: (chunk: Buffer) => void): void;
    on(event: 'end', callback: () => void): void;
    on(event: 'error', callback: (error: Error) => void): void;
  }

  class ElevenLabs {
    constructor(options: ElevenLabsOptions);
    textToSpeechStream(options: TextToSpeechOptions): Promise<AudioStreamResponse>;
  }

  export default ElevenLabs;
} 