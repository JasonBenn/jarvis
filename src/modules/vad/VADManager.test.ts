import { VADManager } from './VADManager';
import { VADMode, VADConfig } from './types';
import VAD from 'node-vad';

jest.mock('node-vad');

describe('VADManager', () => {
  const defaultConfig = {
    sampleRate: 24000,
    mode: VADMode.NORMAL,
    speechThreshold: 0.8,
    silenceThreshold: 0.3,
    debounceTime: 500
  };

  let vadManager: VADManager;
  let mockOnSpeechStart: jest.Mock;
  let mockOnSpeechEnd: jest.Mock;
  let mockOnError: jest.Mock;
  let mockProcessAudio: jest.Mock;

  beforeEach(() => {
    jest.clearAllMocks();

    mockOnSpeechStart = jest.fn();
    mockOnSpeechEnd = jest.fn();
    mockOnError = jest.fn();
    mockProcessAudio = jest.fn();

    // Mock VAD processAudio method
    (VAD as jest.Mock).mockImplementation(() => ({
      processAudio: mockProcessAudio
    }));

    vadManager = new VADManager(defaultConfig, {
      onSpeechStart: mockOnSpeechStart,
      onSpeechEnd: mockOnSpeechEnd,
      onError: mockOnError
    });
  });

  describe('speech detection', () => {
    it('should trigger speech start event when probability exceeds threshold', async () => {
      mockProcessAudio.mockResolvedValueOnce(0.9);
      
      await vadManager.processAudio(Buffer.from([1, 2, 3, 4]));
      
      expect(mockOnSpeechStart).toHaveBeenCalled();
      expect(mockOnSpeechEnd).not.toHaveBeenCalled();
    });

    it('should trigger speech end event when probability falls below threshold', async () => {
      // First detect speech
      mockProcessAudio.mockResolvedValueOnce(0.9);
      await vadManager.processAudio(Buffer.from([1, 2, 3, 4]));
      
      // Then detect silence
      mockProcessAudio.mockResolvedValueOnce(0.2);
      await vadManager.processAudio(Buffer.from([1, 2, 3, 4]));
      
      expect(mockOnSpeechStart).toHaveBeenCalledTimes(1);
      expect(mockOnSpeechEnd).toHaveBeenCalledTimes(1);
    });

    it('should respect debounce time', async () => {
      mockProcessAudio.mockResolvedValue(0.9);
      
      await vadManager.processAudio(Buffer.from([1, 2, 3, 4]));
      await vadManager.processAudio(Buffer.from([1, 2, 3, 4]));
      
      expect(mockOnSpeechStart).toHaveBeenCalledTimes(1);
    });
  });

  describe('cleanup', () => {
    it('should reset state on cleanup', async () => {
      // First detect speech
      mockProcessAudio.mockResolvedValueOnce(0.9);
      await vadManager.processAudio(Buffer.from([1, 2, 3, 4]));
      
      // Perform cleanup
      vadManager.cleanup();
      
      // Should trigger speech start again after cleanup
      mockProcessAudio.mockResolvedValueOnce(0.9);
      await vadManager.processAudio(Buffer.from([1, 2, 3, 4]));
      
      expect(mockOnSpeechStart).toHaveBeenCalledTimes(2);
    });
  });
});