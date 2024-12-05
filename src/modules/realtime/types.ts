import { WebSocket } from "ws";

export interface FunctionCallArguments {
  title: string;
  content: string;
  date?: string;
  filename?: string;
}

export interface OpenAIServerEvent {
  event_id: string;
  type: string;
  // Error event
  error?: {
    type: string;
    code: string;
    message: string;
    param: string | null;
    event_id?: string;
  };
  // Session events
  session?: {
    id: string;
    object: "realtime.session";
    model: string;
    modalities: string[];
    instructions?: string;
    voice?: string;
    input_audio_format?: string;
    output_audio_format?: string;
    input_audio_transcription?: {
      model: string;
    } | null;
    turn_detection?: {
      type: string;
      threshold: number;
      prefix_padding_ms: number;
      silence_duration_ms: number;
    } | null;
    tools: any[];
    tool_choice?: string;
    temperature?: number;
    max_response_output_tokens?: number | "inf";
  };
  // Conversation events
  conversation?: {
    id: string;
    object: "realtime.conversation";
  };
  previous_item_id?: string;
  item?: {
    id: string;
    object: "realtime.item";
    type: string;
    status: "completed" | "in_progress";
    role?: string;
    content?: Array<{
      type: string;
      text?: { value: string } | string;
      transcript?: string;
      audio?: string;
    }>;
    name?: string;
    call_id?: string;
  };
  // Audio buffer events
  audio_start_ms?: number;
  audio_end_ms?: number;
  item_id?: string;
  content_index?: number;
  // Response events
  response?: {
    id: string;
    object: "realtime.response";
    status: "in_progress" | "completed";
    status_details: any;
    output: any[];
    usage?: {
      total_tokens: number;
      input_tokens: number;
      output_tokens: number;
      input_token_details: {
        cached_tokens: number;
        text_tokens: number;
        audio_tokens: number;
        cached_tokens_details: {
          text_tokens: number;
          audio_tokens: number;
        };
      };
      output_token_details: {
        text_tokens: number;
        audio_tokens: number;
      };
    };
  };
  response_id?: string;
  output_index?: number;
  part?: {
    type: string;
    text?: string;
  };
  delta?: string;
  text?: string;
  transcript?: string;
  // Function call events
  call_id?: string;
  arguments?: string;
  // Rate limits
  rate_limits?: Array<{
    name: string;
    limit: number;
    remaining: number;
    reset_seconds: number;
  }>;
}

export interface IRealtimeClient {
  connect(): void;
  disconnect(): void;
  handleInterruption(): void;
  writeNote(
    title: string,
    content: string,
    date?: string
  ): Promise<{ success: boolean }>;
}
