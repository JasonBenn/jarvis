export interface VADConfig {
    sampleRate: number;
    mode: VADMode;
    speechThreshold: number;
    debounceTime: number;
    silenceThreshold?: number;
  }
  
  export enum VADMode {
    NORMAL = 0,
    LOW_BITRATE = 1,
    AGGRESSIVE = 2,
    VERY_AGGRESSIVE = 3
  }
  
  export interface VADEvents {
    onSpeechStart?: () => void;
    onSpeechEnd?: () => void;
    onError?: (error: Error) => void;
  }
  
  export interface IVADManager {
    processAudio(audioData: Buffer): Promise<void>;
    setMode(mode: VADMode): void;
    setSpeechThreshold(threshold: number): void;
    cleanup(): void;
  }