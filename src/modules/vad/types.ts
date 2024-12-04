import * as VAD from "node-vad";

export interface VADConfig {
  sampleRate: number;
  mode: VAD.VADOptions["mode"];
  debounceTime: number;
}
