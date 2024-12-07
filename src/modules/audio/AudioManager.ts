import wav from "wav";
import Speaker from "speaker";
import { createReadStream } from "fs";
import { Readable } from "stream";

export interface IAudioManager {
  playVoice(base64Audio: string, onVoiceFinishCallback?: () => void): void;
  stopVoice(): void;
  playTypingSound(): void;
  stopTypingSound(): void;
  cleanup(): void;
  isPlaying(): boolean;
}

export class AudioManager implements IAudioManager {
  speaker: Speaker | null = null;
  typingSpeaker: Speaker | null = null;
  private typingSoundStream: Readable | null = null;
  private isPlayingAudio: boolean = false;
  private finishTimeout: NodeJS.Timeout | null = null;
  private remainingDuration: number = 0;
  private lastCallback?: () => void;

  initializeSpeaker() {
    this.speaker = new Speaker({
      channels: 1,
      sampleRate: 24000,
      bitDepth: 16,
    });
  }

  private calculateVoiceDuration(bufferLength: number): number {
    // Duration in seconds = (bytes / (bitDepth/8) / channels) / sampleRate
    const sampleRate = 24000;
    const bitDepth = 16;
    const channels = 1;
    return bufferLength / (bitDepth / 8) / channels / sampleRate;
  }

  private updateFinishTimeout(durationSecs: number, callback?: () => void) {
    const now = Date.now();

    // Clear existing timeout
    if (this.finishTimeout) {
      clearTimeout(this.finishTimeout);
      this.finishTimeout = null;
    }

    // Add new duration to remaining time
    this.remainingDuration += durationSecs;

    // Store callback if provided
    if (callback) {
      this.lastCallback = callback;
    }

    // Set new timeout for total remaining duration
    this.finishTimeout = setTimeout(() => {
      console.log("🎤 Audio finished playing");
      this.isPlayingAudio = false;
      this.remainingDuration = 0;
      if (this.lastCallback) {
        this.lastCallback();
        this.lastCallback = undefined;
      }
    }, this.remainingDuration * 1000);

    console.log(`🎤 Updated duration: ${this.remainingDuration} seconds`);
  }

  playVoice(base64Audio: string, onVoiceFinishCallback?: () => void) {
    const buffer = Buffer.from(base64Audio, "base64");

    if (!this.speaker || this.speaker.destroyed) {
      console.log("🔊 Initializing speaker");
      this.initializeSpeaker();
    }

    const durationSecs = this.calculateVoiceDuration(buffer.length);
    this.updateFinishTimeout(durationSecs, onVoiceFinishCallback);

    this.isPlayingAudio = true;
    this.speaker!.write(buffer);
  }

  stopVoice() {
    if (this.finishTimeout) {
      clearTimeout(this.finishTimeout);
      this.finishTimeout = null;
    }

    if (this.speaker) {
      this.speaker.close(true);
      this.speaker = null;
    }

    this.remainingDuration = 0;
    this.lastCallback = undefined;
    this.isPlayingAudio = false;
  }

  playTypingSound() {
    this.typingSpeaker = new Speaker({
      channels: 2,
      bitDepth: 16,
      sampleRate: 44100,
    });

    const reader = new wav.Reader();
    createReadStream("data/typing.wav")
      .pipe(reader)
      .on("format", () => {
        reader.pipe(this.typingSpeaker!);
      });
  }

  stopTypingSound() {
    if (this.typingSoundStream) {
      this.typingSoundStream.destroy();
      this.typingSoundStream = null;
    }
    if (this.typingSpeaker) {
      this.typingSpeaker.close(true);
      this.typingSpeaker = null;
    }
  }

  public cleanup(): void {
    if (this.finishTimeout) {
      clearTimeout(this.finishTimeout);
      this.finishTimeout = null;
    }
    this.remainingDuration = 0;
    this.lastCallback = undefined;
    this.isPlayingAudio = false;
    this.stopVoice();
    this.stopTypingSound();
  }

  public isPlaying(): boolean {
    return this.isPlayingAudio;
  }
}
