export interface RecordingConfig {
  sampleRate?: number;
  channels?: number;
  audioType?: "raw" | "wav"; // We could add more types later if needed
}

export interface RecordingEvents {
  onData?: (chunk: Buffer) => void;
  onError?: (error: Error) => void;
  onStart?: () => void;
  onStop?: () => void;
}

export interface IRecordingManager {
  isRecording(): boolean;
  start(): void;
  stop(): void;
  cleanup(): void;
}

// Types from node-record-lpcm16
export interface RecordInstance {
  stream(): NodeJS.ReadableStream;
  stop(): void;
}
