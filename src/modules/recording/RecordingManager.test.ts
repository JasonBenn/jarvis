import { RecordingManager } from "./RecordingManager";
import recorder from "node-record-lpcm16";
import { Readable } from "stream";

jest.mock("node-record-lpcm16");

describe("RecordingManager", () => {
  const defaultConfig = {
    sampleRate: 24000,
    channels: 1,
    audioType: "raw" as const,
  };

  let recordingManager: RecordingManager;
  let mockOnData: jest.Mock;
  let mockOnError: jest.Mock;
  let mockOnStart: jest.Mock;
  let mockOnStop: jest.Mock;
  let mockStream: Partial<Readable>;
  let mockRecord: jest.Mock;

  beforeEach(() => {
    jest.clearAllMocks();

    // Set up event handler mocks
    mockOnData = jest.fn();
    mockOnError = jest.fn();
    mockOnStart = jest.fn();
    mockOnStop = jest.fn();

    // Set up stream mock
    mockStream = {
      on: jest.fn(),
      removeAllListeners: jest.fn(),
    };

    // Set up recorder mock
    mockRecord = jest.fn().mockReturnValue({
      stream: () => mockStream,
      stop: jest.fn(),
    });
    (recorder.record as jest.Mock) = mockRecord;

    recordingManager = new RecordingManager(defaultConfig, {
      onData: mockOnData,
      onError: mockOnError,
      onStart: mockOnStart,
      onStop: mockOnStop,
    });
  });

  describe("initialization", () => {
    it("should create an instance with config", () => {
      expect(recordingManager).toBeDefined();
      expect(recordingManager.isRecording()).toBeFalsy();
    });
  });

  describe("recording", () => {
    it("should start recording with correct config", () => {
      recordingManager.start();

      expect(mockRecord).toHaveBeenCalledWith(defaultConfig);
      expect(mockOnStart).toHaveBeenCalled();
      expect(recordingManager.isRecording()).toBeTruthy();
    });

    it("should not start recording if already recording", () => {
      recordingManager.start();
      recordingManager.start();

      expect(mockRecord).toHaveBeenCalledTimes(1);
      expect(mockOnStart).toHaveBeenCalledTimes(1);
    });

    it("should stop recording", () => {
      recordingManager.start();
      recordingManager.stop();

      expect(mockOnStop).toHaveBeenCalled();
      expect(recordingManager.isRecording()).toBeFalsy();
    });

    it("should handle audio data", () => {
      recordingManager.start();

      // Get the 'data' event handler and call it with a buffer
      const onData = (mockStream.on as jest.Mock).mock.calls.find(
        (call) => call[0] === "data"
      )[1];
      const testBuffer = Buffer.from([1, 2, 3, 4]);
      onData(testBuffer);

      expect(mockOnData).toHaveBeenCalledWith(testBuffer);
    });
  });

  describe("error handling", () => {
    it("should handle recording start errors", () => {
      const error = new Error("Failed to start recording");
      mockRecord.mockImplementationOnce(() => {
        throw error;
      });

      recordingManager.start();

      expect(mockOnError).toHaveBeenCalledWith(error);
      expect(recordingManager.isRecording()).toBeFalsy();
    });
  });

  describe("cleanup", () => {
    it("should clean up resources", () => {
      recordingManager.start();
      recordingManager.cleanup();

      expect(mockOnStop).toHaveBeenCalled();
      expect(recordingManager.isRecording()).toBeFalsy();
      expect(mockStream.removeAllListeners).toHaveBeenCalled();
    });

    it("should handle multiple cleanup calls safely", () => {
      recordingManager.cleanup();
      recordingManager.cleanup();

      expect(recordingManager.isRecording()).toBeFalsy();
    });
  });
});
