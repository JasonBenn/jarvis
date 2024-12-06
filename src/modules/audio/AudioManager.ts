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
  private audioBufferStream: Readable | null = null;
  private isPlayingAudio: boolean = false;
  private pushChunkTimeoutId: NodeJS.Timeout | null = null;

  private readonly SPEAKER_BITRATE = 24000;

  initializeSpeaker() {
    if (this.speaker) {
      this.stopVoice();
    }

    this.speaker = new Speaker({
      channels: 2,
      bitDepth: 16,
      sampleRate: this.SPEAKER_BITRATE,
    });

    this.audioBufferStream = new Readable({
      read() {},
    });

    this.audioBufferStream.pipe(this.speaker);
  }

  async playVoice(audioData: Buffer): Promise<void> {
    try {
      if (!this.speaker || !this.audioBufferStream) {
        this.initializeSpeaker();
      }

      this.isPlayingAudio = true;

      const stereoData = this.convertMonoToStereo(audioData);

      const CHUNK_SIZE = this.SPEAKER_BITRATE * 0.25 * 4;

      let offset = 0;

      const pushChunk = () => {
        if (!this.isPlayingAudio || !this.audioBufferStream) {
          return;
        }

        if (offset >= stereoData.length) {
          this.audioBufferStream.push(null);
          return;
        }

        const chunk = stereoData.slice(offset, offset + CHUNK_SIZE);

        const canPush = this.audioBufferStream.push(chunk);
        offset += CHUNK_SIZE;

        if (canPush) {
          this.pushChunkTimeoutId = setTimeout(pushChunk, 10);
        } else {
          this.audioBufferStream.once("drain", () => {
            this.pushChunkTimeoutId = setTimeout(pushChunk, 10);
          });
        }
      };

      pushChunk();
    } catch (error) {
      console.error("Error in playVoice:", error);
      this.stopVoice();
      throw error;
    }
  }

  private convertMonoToStereo(monoData: Buffer): Buffer {
    const monoSamples = Buffer.from(monoData);
    const stereoSamples = Buffer.alloc(monoSamples.length * 2);

    for (let i = 0; i < monoSamples.length; i += 2) {
      const sample = monoSamples.readInt16LE(i);

      stereoSamples.writeInt16LE(sample, i * 2);
      stereoSamples.writeInt16LE(sample, i * 2 + 2);
    }

    return stereoSamples;
  }

  stopVoice(): void {
    console.log("🔊 Stopping voice");
    this.isPlayingAudio = false;

    if (this.pushChunkTimeoutId) {
      clearTimeout(this.pushChunkTimeoutId);
      this.pushChunkTimeoutId = null;
    }

    if (this.audioBufferStream) {
      this.audioBufferStream.unpipe();
      this.audioBufferStream.destroy();
      this.audioBufferStream = null;
    }

    if (this.speaker) {
      this.speaker.removeAllListeners();
      try {
        this.speaker.end();
      } catch (e) {
        console.error("Error ending speaker:", e);
      }
      try {
        this.speaker.destroy();
      } catch (e) {
        console.error("Error destroying speaker:", e);
      }
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
