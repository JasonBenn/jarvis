import { AudioManager } from "../audio/AudioManager";
import { RecordingManager } from "../recording/RecordingManager";
import { RealtimeAPIClient } from "../api/RealtimeAPIClient";
import {
  OrchestratorConfig,
  OrchestratorState,
  IOrchestratorCommands,
  FunctionCallHandler,
} from "./types";

export class Orchestrator implements IOrchestratorCommands {
  private audioManager: AudioManager;
  private recordingManager: RecordingManager;
  private apiClient: RealtimeAPIClient;
  private state: OrchestratorState = OrchestratorState.INITIALIZING;
  private functionHandlers: Map<string, FunctionCallHandler["handler"]>;
  private currentFunctionCallId: string | null = null;
  private onStateChange: (state: OrchestratorState) => void;

  constructor(
    config: OrchestratorConfig,
    functionHandlers: FunctionCallHandler[] = [],
    onStateChange: (state: OrchestratorState) => void
  ) {
    this.functionHandlers = new Map(
      functionHandlers.map((h) => [h.name, h.handler])
    );

    this.onStateChange = onStateChange;
    this.setState(OrchestratorState.READY);

    // Initialize all managers with their respective configs
    this.audioManager = new AudioManager();

    this.recordingManager = new RecordingManager(config.recording, {
      onData: this.handleRecordingData.bind(this),
      onError: this.handleError.bind(this),
    });

    this.apiClient = new RealtimeAPIClient(config.api, {
      onAudioData: this.handleAIAudio.bind(this),
      onFunctionCall: this.handleFunctionCall.bind(this),
      onFunctionCallComplete: this.handleFunctionCallComplete.bind(this),
      onError: this.handleError.bind(this),
      onOpen: () => this.setState(OrchestratorState.READY),
      onClose: () => this.setState(OrchestratorState.DISCONNECTED),
    });

    // Start connection
    this.apiClient.connect();
  }

  private setState(newState: OrchestratorState): void {
    if (this.state !== newState) {
      this.state = newState;
      this.onStateChange(newState);
    }
  }

  public startRecording(): void {
    if (this.state !== OrchestratorState.READY) {
      return;
    }

    this.recordingManager.start();
    this.setState(OrchestratorState.RECORDING);
  }

  public stopRecording(): void {
    if (this.state !== OrchestratorState.RECORDING) {
      return;
    }

    this.recordingManager.stop();
    this.apiClient.commitAudio();
    this.setState(OrchestratorState.READY);
  }

  public disconnect(): void {
    this.audioManager.cleanup();
    this.recordingManager.cleanup();
    this.apiClient.disconnect();
    this.setState(OrchestratorState.DISCONNECTED);
  }

  private handleRecordingData(chunk: Buffer): void {
    this.apiClient.sendAudioChunk(chunk);
  }

  private handleAIAudio(audioData: Buffer): void {
    if (this.state !== OrchestratorState.AI_SPEAKING) {
      this.setState(OrchestratorState.AI_SPEAKING);
    }
    this.audioManager.playVoice(audioData);
  }

  private async handleFunctionCall(
    name: string,
    argsStr: string
  ): Promise<void> {
    const handler = this.functionHandlers.get(name);
    if (!handler) {
      this.handleError(
        new Error(`No handler registered for function: ${name}`)
      );
      return;
    }

    try {
      this.setState(OrchestratorState.PROCESSING_FUNCTION);
      const args = JSON.parse(argsStr);
      const result = await handler(args);
      this.apiClient.sendFunctionResponse(this.currentFunctionCallId!, result);
    } catch (error) {
      this.handleError(
        error instanceof Error ? error : new Error(String(error))
      );
    }
  }

  private handleFunctionCallComplete(callId: string): void {
    this.currentFunctionCallId = callId;
  }

  private handleError(error: Error): void {
    this.setState(OrchestratorState.ERROR);
  }
}
