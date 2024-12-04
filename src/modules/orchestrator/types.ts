import { RecordingConfig } from "../recording/types";
import { APIConfig } from "../api/types";

export interface OrchestratorConfig {
  recording: RecordingConfig;
  api: APIConfig;
}

export enum OrchestratorState {
  INITIALIZING = "INITIALIZING",
  READY = "READY",
  RECORDING = "RECORDING",
  AI_SPEAKING = "AI_SPEAKING",
  PROCESSING_FUNCTION = "PROCESSING_FUNCTION",
  ERROR = "ERROR",
  DISCONNECTED = "DISCONNECTED",
}

export interface IOrchestratorCommands {
  startRecording(): void;
  stopRecording(): void;
  disconnect(): void;
}

// Delegate to handle specific function calls
export interface FunctionCallHandler {
  name: string;
  handler: (args: unknown) => Promise<unknown>;
}
