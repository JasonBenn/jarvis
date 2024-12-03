import Speaker from 'speaker';

export interface AudioConfig {
  channels: number;
  bitDepth: number;
  sampleRate: number;
  bufferSize?: number;
}

export interface AudioManagerEvents {
  onDrain?: () => void;
  onError?: (error: Error) => void;
}

export interface IAudioManager {
  isPlaying(): boolean;
  play(buffer: Buffer): void;
  stop(): void;
  cleanup(): void;
}

export type SpeakerInstance = Speaker;