declare module "node-record-lpcm16" {
  interface RecordOptions {
    sampleRate?: number;
    channels?: number;
    audioType?: "raw" | "wav";
  }

  interface Recorder {
    stream: () => NodeJS.ReadableStream;
    stop: () => void;
  }

  function record(options?: RecordOptions): Recorder;

  export default { record };
}
