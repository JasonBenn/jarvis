declare module "speaker" {
  import { Writable } from "stream";

  interface SpeakerOptions {
    channels?: number;
    bitDepth?: number;
    sampleRate?: number;
    signed?: boolean;
    float?: boolean;
    samplesPerFrame?: number;
    device?: string | null;
  }

  class Speaker extends Writable {
    constructor(options?: SpeakerOptions);

    // Event listeners
    on(event: "open" | "flush" | "close", listener: () => void): this;
  }

  export = Speaker;
} 