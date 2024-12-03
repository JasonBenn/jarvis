import VAD from 'node-vad';
import { VADConfig, VADEvents, VADMode, IVADManager } from './types';

export class VADManager implements IVADManager {
  private vad: VAD;
  private config: VADConfig;
  private readonly events: VADEvents;
  private lastSpeechTime: number = 0;
  private isSpeaking: boolean = false;

  constructor(config: VADConfig, events: VADEvents = {}) {
    this.config = {
      ...config,
      debounceTime: config.debounceTime || 500,
    };

    this.events = events;
    this.vad = new VAD(this.config.mode, this.config.sampleRate);
  }

  public async processAudio(audioData: Buffer): Promise<void> {
    try {
      const speechProb = await this.vad.processAudio(audioData);
      const now = Date.now();

      // Check if we've exceeded the debounce time
      const timeElapsed = now - this.lastSpeechTime;

      if (speechProb > this.config.speechThreshold && timeElapsed > this.config.debounceTime) {
        if (!this.isSpeaking) {
          this.isSpeaking = true;
          this.events.onSpeechStart?.();
        }
        this.lastSpeechTime = now;
      } else if (speechProb <= this.config.speechThreshold && this.isSpeaking) {
        this.isSpeaking = false;
        this.events.onSpeechEnd?.();
      }
    } catch (error) {
      this.events.onError?.(error instanceof Error ? error : new Error(String(error)));
    }
  }

  public setMode(mode: VADMode): void {
    this.config.mode = mode;
    this.vad = new VAD(mode, this.config.sampleRate);
  }

  public setSpeechThreshold(threshold: number): void {
    if (threshold < 0 || threshold > 1) {
      throw new Error('Speech threshold must be between 0 and 1');
    }
    this.config.speechThreshold = threshold;
  }

  public cleanup(): void {
    this.isSpeaking = false;
    this.lastSpeechTime = 0;
    // Currently node-vad doesn't expose a cleanup method
    // If it did in the future, we would call it here
  }
}