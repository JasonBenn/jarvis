import WebSocket from 'ws';
import { APIConfig, APIEvents, APIMessage, IRealtimeAPIClient } from './types';

export class RealtimeAPIClient implements IRealtimeAPIClient {
  private ws: WebSocket | null = null;
  private readonly config: APIConfig;
  private readonly events: APIEvents;
  private responseInProgress: boolean = false;

  constructor(config: APIConfig, events: APIEvents = {}) {
    this.config = config;
    this.events = events;
  }

  public connect(): void {
    const wsUrl = `wss://api.openai.com/v1/realtime?model=${this.config.model}`;
    
    this.ws = new WebSocket(wsUrl, {
      headers: {
        'Authorization': `Bearer ${this.config.apiKey}`,
        'OpenAI-Beta': 'realtime=v1'
      }
    });

    this.setupWebSocketHandlers();
    this.initializeSession();
  }

  private setupWebSocketHandlers(): void {
    if (!this.ws) return;

    this.ws.on('open', () => {
      this.events.onOpen?.();
    });

    this.ws.on('message', (data: WebSocket.Data) => {
      try {
        const message = JSON.parse(data.toString()) as APIMessage;
        this.handleMessage(message);
      } catch (error) {
        this.events.onError?.(error instanceof Error ? error : new Error('Failed to parse message'));
      }
    });

    this.ws.on('error', (error: Error) => {
      this.events.onError?.(error);
    });

    this.ws.on('close', () => {
      this.events.onClose?.();
    });
  }

  private initializeSession(): void {
    const sessionConfig = {
      type: 'session.update',
      session: {
        modalities: ['text', 'audio'],
        voice: this.config.voice,
        input_audio_format: this.config.inputAudioFormat,
        output_audio_format: this.config.outputAudioFormat,
        turn_detection: null,
        tools: this.config.toolDefinitions || []
      }
    };

    this.sendMessage(sessionConfig);
  }

  private handleMessage(message: APIMessage): void {
    switch (message.type) {
      case 'response.audio.delta':
        if ('delta' in message) {
          const audioBuffer = Buffer.from(message.delta as string, 'base64');
          this.events.onAudioData?.(audioBuffer);
        }
        break;

      case 'response.audio_transcript.delta':
        if ('delta' in message) {
          this.events.onTranscript?.(message.delta as string);
        }
        break;

      case 'response.function_call_arguments.delta':
        if ('call_id' in message && 'arguments' in message) {
          this.events.onFunctionCall?.(
            message.name as string,
            message.arguments as string
          );
        }
        break;

      case 'response.function_call_arguments.done':
        if ('call_id' in message) {
          this.events.onFunctionCallComplete?.(message.call_id as string);
        }
        break;

      case 'error':
        this.events.onError?.(new Error(JSON.stringify(message)));
        break;
    }
  }

  private sendMessage(message: unknown): void {
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(message));
    } else {
      this.events.onError?.(new Error('WebSocket is not connected'));
    }
  }

  public disconnect(): void {
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
  }

  public isConnected(): boolean {
    return this.ws?.readyState === WebSocket.OPEN;
  }

  public sendAudioChunk(chunk: Buffer): void {
    this.sendMessage({
      type: 'input_audio_buffer.append',
      audio: chunk.toString('base64')
    });
  }

  public commitAudio(): void {
    this.sendMessage({ type: 'input_audio_buffer.commit' });
    this.sendMessage({ type: 'response.create' });
    this.responseInProgress = true;
  }

  public cancelResponse(): void {
    if (this.responseInProgress) {
      this.sendMessage({ type: 'response.cancel' });
      this.responseInProgress = false;
    }
  }

  public sendFunctionResponse(callId: string, response: unknown): void {
    this.sendMessage({
      type: 'conversation.item.create',
      item: {
        type: 'function_call_output',
        call_id: callId,
        output: JSON.stringify(response)
      }
    });
  }
}