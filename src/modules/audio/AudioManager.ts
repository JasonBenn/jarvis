import wav from "wav";
import Speaker from "speaker";
import { createReadStream } from "fs";
import { Readable } from "stream";

export interface IAudioManager {
  playVoice(base64Audio: string): void;
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

  initializeSpeaker() {
    this.speaker = new Speaker({
      channels: 1,
      bitDepth: 16,
      sampleRate: 24000,
    });
  }

  playVoice(base64Audio: string) {
    const buffer = Buffer.from(base64Audio, "base64");

    if (!this.speaker || this.speaker.destroyed) {
      console.log("🔊 Initializing speaker");
      this.initializeSpeaker();
    }

    this.speaker!.write(buffer);
  }

  stopVoice() {
    if (this.speaker) {
      this.speaker.close(true);
      this.speaker = null;
    }
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
    this.isPlayingAudio = false;
    this.stopVoice();
    this.stopTypingSound();
  }

  public isPlaying(): boolean {
    return this.isPlayingAudio;
  }
}
