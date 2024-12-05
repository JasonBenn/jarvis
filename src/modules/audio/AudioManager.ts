import Speaker from "speaker";
import { createReadStream } from "fs";
import { Readable } from "stream";

export interface IAudioManager {
  playVoice(audioData: Buffer): Promise<void>;
  stopVoice(): void;
  playTypingSound(): Promise<void>;
  stopTypingSound(): void;
  cleanup(): void;
  isPlaying(): boolean;
}

export class AudioManager implements IAudioManager {
  private speaker: Speaker | null = null;
  private typingSpeaker: Speaker | null = null;
  private typingSoundStream: Readable | null = null;
  private isPlayingAudio: boolean = false;

  initializeSpeaker() {
    if (this.speaker) {
      this.stopVoice();
    }

    this.speaker = new Speaker({
      channels: 1,
      bitDepth: 16,
      sampleRate: 24000,
    });
  }

  async playVoice(audioData: Buffer): Promise<void> {
    this.isPlayingAudio = true;
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
      if (!this.speaker) return resolve();

      this.speaker.once("error", reject);
      this.speaker.once("close", () => {
        this.stopVoice();
        resolve();
      });

      this.speaker.write(audioData);
    });
  }

  stopVoice(): void {
    console.log("🔊 Stopping voice");
    this.isPlayingAudio = false;
    if (this.speaker) {
      this.speaker.removeAllListeners();
      this.speaker.end();
      this.speaker.destroy();
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
      if (this.typingSpeaker) {
        this.stopTypingSound();
      }

      this.typingSpeaker = new Speaker({
        channels: 2,
        bitDepth: 16,
        sampleRate: 44100,
      });

      this.typingSpeaker.setMaxListeners(20);

      this.typingSoundStream = createReadStream("data/typing.wav");

      const errorHandler = (error: Error) => {
        this.typingSoundStream?.removeListener("end", endHandler);
        reject(error);
      };

      const endHandler = () => {
        this.typingSoundStream?.removeListener("error", errorHandler);
        this.stopTypingSound();
        resolve();
      };

      this.typingSoundStream.once("error", errorHandler);
      this.typingSoundStream.once("end", endHandler);
      this.typingSoundStream.pipe(this.typingSpeaker);
    });
  }

  stopTypingSound(): void {
    console.log("🔊 Stopping typing sound");
    if (this.typingSpeaker) {
      this.typingSpeaker.removeAllListeners();
      this.typingSpeaker.end();
      this.typingSpeaker = null;
    }
    if (this.typingSoundStream) {
      this.typingSoundStream.removeAllListeners();
      this.typingSoundStream.destroy();
      this.typingSoundStream.unpipe();
      this.typingSoundStream = null;
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
