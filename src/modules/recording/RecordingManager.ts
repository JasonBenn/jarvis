import recorder from "node-record-lpcm16";
import {
  RecordingConfig,
  RecordingEvents,
  IRecordingManager,
  RecordInstance,
} from "./types";
import { Readable } from "stream";

export class RecordingManager implements IRecordingManager {
  private config: RecordingConfig;
  private events: RecordingEvents;
  private recording: RecordInstance | null = null;
  private stream: Readable | null = null;
  private _isRecording: boolean = false;

  constructor(config: RecordingConfig = {}, events: RecordingEvents = {}) {
    this.config = {
      sampleRate: 16000,
      channels: 1,
      audioType: "raw",
      ...config,
    };
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
        audioType: this.config.audioType,
      });

      this.stream = this.recording.stream() as Readable;

      this.stream.on("data", (chunk: Buffer) => {
        this.events?.onData?.(chunk);
      });

      this.stream.on("error", (error: Error) => {
        this.events?.onError?.(error);
      });

      this._isRecording = true;
      this.events?.onStart?.();
    } catch (error) {
      this.events?.onError?.(error as Error);
    }
  }

  public stop(): void {
    if (!this._isRecording) {
      return;
    }

    this.recording?.stop();
    this.stream?.removeAllListeners();
    this.recording = null;
    this.stream = null;
    this._isRecording = false;
    this.events?.onStop?.();
  }

  public cleanup(): void {
    this.stop();
  }
}
