import { EventEmitter } from "events";
import VAD from "node-vad";

interface VADOptions {
  mode?: number;
  sampleRate?: number;
}

interface SpeechEvent {
  state: boolean;
  start: boolean;
  end: boolean;
  startTime: number;
  duration: number;
}

export class VADManager extends EventEmitter {
  private vad: VAD;
  private speechDetectionPromise: { resolve: (value: boolean) => void } | null =
    null;

  constructor(options: VADOptions = {}) {
    super();
    this.vad = new VAD({ mode: options.mode || VAD.Mode.NORMAL });
  }

  waitForSpeech(): Promise<boolean> {
    return new Promise((resolve) => {
      this.speechDetectionPromise = { resolve };
    });
  }

  async processAudio(chunk: Buffer): Promise<void> {
    try {
      this.vad.processAudio(chunk).on("data", (event: SpeechEvent) => {
        this.emit("speech", event);

        if (event.state && this.speechDetectionPromise) {
          this.speechDetectionPromise.resolve(true);
          this.speechDetectionPromise = null;
        }
      });
    } catch (error) {
      this.emit("error", error);
    }
  }

  cleanup(): void {
    if (this.speechDetectionPromise) {
      this.speechDetectionPromise.resolve(false);
      this.speechDetectionPromise = null;
    }
  }
}
