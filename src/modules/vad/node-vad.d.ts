declare module 'node-vad' {
  class VAD {
    constructor(mode: number, speechThreshold?: number = 0.8);
    processAudio(buffer: Buffer): Promise<number>;
  }
  export default VAD;
} 