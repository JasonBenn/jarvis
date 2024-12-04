declare module "node-vad" {
  export interface VADOptions {
    mode?: Mode;
    sampleRate?: number;
  }

  export default class VAD {
    static Mode: {
      NORMAL: 0;
      LOW_BITRATE: 1;
      AGGRESSIVE: 2;
      VERY_AGGRESSIVE: 3;
    };
    constructor(options?: VADOptions);
    processAudio(buffer: Buffer): EventEmitter;
  }
}
