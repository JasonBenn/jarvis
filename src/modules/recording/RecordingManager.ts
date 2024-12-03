import recorder from 'node-record-lpcm16';
import { RecordingConfig, RecordingEvents, IRecordingManager, RecordInstance } from './types';
import { Readable } from 'stream';

export class RecordingManager implements IRecordingManager {
  private config: RecordingConfig;
  private events: RecordingEvents;
  private recording: RecordInstance | null = null;
  private stream: Readable | null = null;
  private _isRecording: boolean = false;

  constructor(config: RecordingConfig, events: RecordingEvents = {}) {
    this.config = config;
    this.events = events;
  }

  public isRecording(): boolean {
    return this._isRecording;
  }

  public start(): void {
    if (this._isRecording) {
      return;
    }

    try {
      this.recording = recorder.record({
        sampleRate: this.config.sampleRate,
        channels: this.config.channels,
        audioType: this.config.audioType
      });

      this.stream = this.recording.stream() as Readable;
      
      this.stream.on('data', (chunk: Buffer) => {
        this.events.onData?.(chunk);
      });

      this.stream.on('error', (error: Error) => {
        this.handleError(error);
      });

      this._isRecording = true;
      this.events.onStart?.();
    } catch (error) {
      this.handleError(error instanceof Error ? error : new Error(String(error)));
    }
  }

  public stop(): void {
    if (!this._isRecording) {
      return;
    }

    try {
      this.recording?.stop();
      this.stream?.removeAllListeners();
      this.recording = null;
      this.stream = null;
      this._isRecording = false;
      this.events.onStop?.();
    } catch (error) {
      this.handleError(error instanceof Error ? error : new Error(String(error)));
    }
  }

  public cleanup(): void {
    this.stop();
  }

  private handleError(error: Error): void {
    this.events.onError?.(error);
    // Always stop recording on error
    if (this._isRecording) {
      this.stop();
    }
  }
}