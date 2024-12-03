import Speaker from 'speaker';
import { AudioConfig, AudioManagerEvents, IAudioManager, SpeakerInstance } from './types';

export class AudioManager implements IAudioManager {
  private speaker: SpeakerInstance | null = null;
  private readonly config: AudioConfig;
  private readonly events: AudioManagerEvents;
  private _isPlaying: boolean = false;

  constructor(config: AudioConfig, events: AudioManagerEvents = {}) {
    this.config = {
      ...config,
      bufferSize: config.bufferSize || 4096  // Default buffer size
    };
    this.events = events;
  }

  private initializeSpeaker(): void {
    if (this.speaker) {
      this.cleanup();
    }

    this.speaker = new Speaker({
      channels: this.config.channels,
      bitDepth: this.config.bitDepth,
      sampleRate: this.config.sampleRate,
    });

    // Set up event handlers
    this.speaker.on('drain', () => {
      this.events.onDrain?.();
    });

    this.speaker.on('error', (error: Error) => {
      this.events.onError?.(error);
      this.cleanup();
    });
  }

  public isPlaying(): boolean {
    return this._isPlaying;
  }

  public play(buffer: Buffer): void {
    try {
      if (!buffer || buffer.length === 0) {
        return;
      }

      if (!this.speaker || this.speaker.destroyed) {
        this.initializeSpeaker();
      }

      this._isPlaying = true;
      this.speaker?.write(buffer);
    } catch (error) {
      this.events.onError?.(error instanceof Error ? error : new Error(String(error)));
      this.cleanup();
    }
  }

  public stop(): void {
    if (this.speaker && this._isPlaying) {
      this._isPlaying = false;
      this.speaker.end();
      this.speaker = null;
    }
  }

  public cleanup(): void {
    this.stop();
    if (this.speaker) {
      this.speaker.removeAllListeners();
      if (!this.speaker.destroyed) {
        this.speaker.end();
      }
      this.speaker = null;
    }
    this._isPlaying = false;
  }
}