import wav from "wav";
import Speaker from "speaker";
import { createReadStream } from "fs";
import { Readable } from "stream";
export interface IAudioManager {
  playVoice(audioData: Buffer): void;
  stopVoice(): void;
  playTypingSound(): void;
  stopTypingSound(): void;
  cleanup(): void;
}

export class AudioManager implements IAudioManager {
  private speaker: Speaker | null = null;
  private typingSpeaker: Speaker | null = null;
  private typingSoundStream: Readable | null = null;

  playVoice(audioData: Buffer) {
    if (this.speaker) {
      this.stopVoice();
    }

    if (!this.speaker) {
      this.speaker = new Speaker({
        channels: 1,
        bitDepth: 16,
        sampleRate: 24000,
      });
    }

    this.speaker.write(audioData);

    this.speaker.on("close", () => {
      console.log("🔊 Audio buffer drained");
    });
  }

  stopVoice(): void {
    if (this.speaker) {
      this.speaker.removeAllListeners();
      this.speaker.end();
      this.speaker = null;
    }
  }

  playTypingSound() {
    if (this.typingSpeaker) {
      this.stopTypingSound();
    }

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

    reader.on("close", () => {
      this.playTypingSound();
    });
  }

  stopTypingSound() {
    if (this.typingSoundStream) {
      this.typingSoundStream.removeAllListeners();
      this.typingSoundStream = null;
    }
    if (this.typingSpeaker) {
      this.typingSpeaker.removeAllListeners();
      this.typingSpeaker.end();
      this.typingSpeaker = null;
    }
  }

  public cleanup(): void {
    this.stopVoice();
    this.stopTypingSound();
  }
}
