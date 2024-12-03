import WebSocket from 'ws';

export interface APIConfig {
  apiKey: string;
  model: string;
  voice: string;
  inputAudioFormat: string;
  outputAudioFormat: string;
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
  type: string;
  [key: string]: unknown;
}

export interface IRealtimeAPIClient {
  connect(): void;
  disconnect(): void;
  isConnected(): boolean;
  sendAudioChunk(chunk: Buffer): void;
  commitAudio(): void;
  cancelResponse(): void;
  sendFunctionResponse(callId: string, response: unknown): void;
}