import { AudioManager } from '../../../src/modules/audio/AudioManager';
import Speaker from 'speaker';

// Mock the speaker module
jest.mock('speaker');

describe('AudioManager', () => {
  const defaultConfig = {
    channels: 1,
    bitDepth: 16,
    sampleRate: 24000,
  };

  let audioManager: AudioManager;
  let mockOnDrain: jest.Mock;
  let mockOnError: jest.Mock;

  beforeEach(() => {
    // Clear all mocks
    jest.clearAllMocks();
    
    // Set up event handler mocks
    mockOnDrain = jest.fn();
    mockOnError = jest.fn();
    
    audioManager = new AudioManager(defaultConfig, {
      onDrain: mockOnDrain,
      onError: mockOnError
    });
  });

  afterEach(() => {
    audioManager.cleanup();
  });

  describe('initialization', () => {
    it('should create an instance with default config', () => {
      expect(audioManager).toBeDefined();
      expect(audioManager.isPlaying()).toBeFalsy();
    });

    it('should use default buffer size if not provided', () => {
      const managerWithoutBuffer = new AudioManager({
        channels: 1,
        bitDepth: 16,
        sampleRate: 24000
      });
      expect(managerWithoutBuffer).toBeDefined();
    });
  });

  describe('playback', () => {
    it('should handle empty buffer gracefully', () => {
      audioManager.play(Buffer.from([]));
      expect(Speaker).not.toHaveBeenCalled();
      expect(audioManager.isPlaying()).toBeFalsy();
    });

    it('should initialize speaker on first play', () => {
      const testBuffer = Buffer.from([1, 2, 3, 4]);
      audioManager.play(testBuffer);
      
      expect(Speaker).toHaveBeenCalledWith(expect.objectContaining(defaultConfig));
      expect(audioManager.isPlaying()).toBeTruthy();
    });

    it('should clean up resources on stop', () => {
      const testBuffer = Buffer.from([1, 2, 3, 4]);
      audioManager.play(testBuffer);
      audioManager.stop();
      
      expect(audioManager.isPlaying()).toBeFalsy();
    });
  });

  describe('cleanup', () => {
    it('should clean up all resources', () => {
      const testBuffer = Buffer.from([1, 2, 3, 4]);
      audioManager.play(testBuffer);
      audioManager.cleanup();
      
      expect(audioManager.isPlaying()).toBeFalsy();
    });

    it('should handle multiple cleanup calls safely', () => {
      audioManager.cleanup();
      audioManager.cleanup();
      
      expect(audioManager.isPlaying()).toBeFalsy();
    });
  });
});