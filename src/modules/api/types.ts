import WebSocket from "ws";

export interface APIConfig {
  model?: string;
  toolDefinitions?: ToolDefinition[];
}

export interface ToolDefinition {
  name: string;
  type: string;
  description: string;
  parameters: {
    type: string;
    properties: Record<string, unknown>;
    required: string[];
  };
}

export interface APIEvents {
  onAudioData?: (audioData: Buffer) => void;
  onTranscript?: (text: string) => void;
  onFunctionCall?: (name: string, args: string) => void;
  onFunctionCallComplete?: (callId: string) => void;
  onError?: (error: Error) => void;
  onOpen?: () => void;
  onClose?: () => void;
}

export type APIMessage = {
  type: APIMessageType;
  [key: string]: unknown;
};

export enum APIMessageType {
  ResponseAudioDelta = "response.audio.delta",
  ResponseAudioTranscriptDelta = "response.audio_transcript.delta",
  ResponseFunctionCallArgumentsDelta = "response.function_call_arguments.delta",
  ResponseFunctionCallArgumentsDone = "response.function_call_arguments.done",
  Error = "error",
}
