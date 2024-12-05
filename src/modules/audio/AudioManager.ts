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
    this.speaker = new Speaker({
      channels: 1,
      bitDepth: 16,
      sampleRate: 24000,
    });

    this.speaker.write(Buffer.from(audioData), () => {
      console.info("Speaker data written");
    });

    this.speaker.on("close", () => {
      this.stopVoice();
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

    this.typingSoundStream = createReadStream("data/typing.wav");
    this.typingSoundStream.pipe(this.typingSpeaker);
    this.typingSoundStream.on("end", () => {
      this.stopTypingSound();
    });
  }

  stopTypingSound() {
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
