import wav from "wav";
import Speaker from "speaker";
import { createReadStream } from "fs";
import { Readable } from "stream";

export interface IAudioManager {
  playVoice(audioData: Buffer): Promise<void>;
  stopVoice(): void;
  playTypingSound(): Promise<void>;
  stopTypingSound(): void;
  cleanup(): void;
}

export class AudioManager implements IAudioManager {
  private speaker: Speaker | null = null;
  private typingSpeaker: Speaker | null = null;
  private typingSoundStream: Readable | null = null;

  initializeSpeaker() {
    this.speaker = new Speaker({
      channels: 1,
      bitDepth: 16,
      sampleRate: 24000,
    });
  }

  async playVoice(audioData: Buffer): Promise<void> {
    if (!this.speaker) {
      this.initializeSpeaker();
    }

    try {
      await this.writeToSpeaker(audioData);
    } catch (error) {
      this.stopVoice();
      throw error;
    }
  }

  private writeToSpeaker(audioData: Buffer): Promise<void> {
    return new Promise<void>((resolve, reject) => {
      this.speaker!.once("error", reject);
      this.speaker!.once("close", () => {
        this.stopVoice();
        resolve();
      });

      this.speaker!.write(Buffer.from(audioData));
    });
  }

  stopVoice(): void {
    if (this.speaker) {
      this.speaker.removeAllListeners();
      this.speaker.end();
      this.speaker = null;
    }
  }

  async playTypingSound(): Promise<void> {
    if (this.typingSpeaker) {
      this.stopTypingSound();
    }

    try {
      await this.playTypingSoundFile();
    } catch (error) {
      this.stopTypingSound();
      throw error;
    }
  }

  private playTypingSoundFile(): Promise<void> {
    return new Promise<void>((resolve, reject) => {
      this.typingSpeaker = new Speaker({
        channels: 2,
        bitDepth: 16,
        sampleRate: 44100,
      });

      this.typingSoundStream = createReadStream("data/typing.wav");

      this.typingSoundStream.once("error", reject);
      this.typingSoundStream.once("end", () => {
        this.stopTypingSound();
        resolve();
      });

      this.typingSoundStream.pipe(this.typingSpeaker);
    });
  }

  stopTypingSound(): void {
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
