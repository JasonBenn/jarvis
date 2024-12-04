import { AudioConfig } from '../audio/types';
import { VADConfig } from '../vad/types';
import { RecordingConfig } from '../recording/types';
import { APIConfig } from '../api/types';

export interface OrchestratorConfig {
  audio: AudioConfig;
  vad: VADConfig;
  recording: RecordingConfig;
  api: APIConfig;
}

export interface OrchestratorEvents {
  onReady?: () => void;
  onError?: (error: Error) => void;
  onStateChange?: (state: OrchestratorState) => void;
}

export enum OrchestratorState {
  INITIALIZING = 'INITIALIZING',
  READY = 'READY',
  RECORDING = 'RECORDING',
  AI_SPEAKING = 'AI_SPEAKING',
  PROCESSING_FUNCTION = 'PROCESSING_FUNCTION',
  ERROR = 'ERROR',
  DISCONNECTED = 'DISCONNECTED'
}

export interface IOrchestratorCommands {
  startRecording(): void;
  stopRecording(): void;
  interruptAI(): void;
  disconnect(): void;
}

// Delegate to handle specific function calls
export interface FunctionCallHandler {
  name: string;
  handler: (args: unknown) => Promise<unknown>;
}