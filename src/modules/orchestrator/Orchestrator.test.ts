import { Orchestrator } from "./Orchestrator";
import { AudioManager } from "../audio/AudioManager";
import { VADManager } from "../vad/VADManager";
import { RecordingManager } from "../recording/RecordingManager";
import { RealtimeAPIClient } from "../api/RealtimeAPIClient";
import { OrchestratorState } from "./types";

// Mock all dependent modules
jest.mock("../audio/AudioManager");
jest.mock("../vad/VADManager");
jest.mock("../recording/RecordingManager");
jest.mock("../api/RealtimeAPIClient");

describe("Orchestrator", () => {
  const defaultConfig = {
    audio: {
      channels: 1,
      bitDepth: 16,
      sampleRate: 24000,
    },
    vad: {
      sampleRate: 24000,
      mode: 0,
      speechThreshold: 0.8,
      silenceThreshold: 0.3,
      debounceTime: 500,
    },
    recording: {
      sampleRate: 24000,
      channels: 1,
      audioType: "raw" as const,
    },
    api: {
      apiKey: "test-key",
      model: "test-model",
      voice: "alloy",
      inputAudioFormat: "pcm16",
      outputAudioFormat: "pcm16",
    },
  };

  let orchestrator: Orchestrator;
  let mockOnStateChange: jest.Mock;
  let mockOnError: jest.Mock;
  let mockFunctionHandler: jest.Mock;

  beforeEach(() => {
    jest.clearAllMocks();

    mockOnStateChange = jest.fn();
    mockOnError = jest.fn();
    mockFunctionHandler = jest.fn();

    orchestrator = new Orchestrator(
      defaultConfig,
      {
        onStateChange: mockOnStateChange,
        onError: mockOnError,
      },
      [
        {
          name: "test_function",
          handler: mockFunctionHandler,
        },
      ],
      () => {}
    );
  });

  describe("initialization", () => {
    it("should initialize all managers and connect to API", async () => {
      expect(AudioManager).toHaveBeenCalled();
      expect(VADManager).toHaveBeenCalled();
      expect(RecordingManager).toHaveBeenCalled();
      expect(RealtimeAPIClient).toHaveBeenCalled();
    });
  });

  describe("recording control", () => {
    it("should start recording when ready", () => {
      // Simulate API connection ready
      const apiClient = (RealtimeAPIClient as jest.Mock).mock.instances[0];
      apiClient.onOpen?.();

      orchestrator.startRecording();

      const recordingManager = (RecordingManager as jest.Mock).mock
        .instances[0];
      expect(recordingManager.start).toHaveBeenCalled();
      expect(mockOnStateChange).toHaveBeenCalledWith(
        OrchestratorState.RECORDING
      );
    });

    it("should not start recording when not ready", () => {
      orchestrator.startRecording();

      const recordingManager = (RecordingManager as jest.Mock).mock
        .instances[0];
      expect(recordingManager.start).not.toHaveBeenCalled();
    });

    it("should stop recording and commit audio", () => {
      // Set up recording state
      const apiClient = (RealtimeAPIClient as jest.Mock).mock.instances[0];
      apiClient.onOpen?.();
      orchestrator.startRecording();

      orchestrator.stopRecording();

      const recordingManager = (RecordingManager as jest.Mock).mock
        .instances[0];
      expect(recordingManager.stop).toHaveBeenCalled();
      expect(apiClient.commitAudio).toHaveBeenCalled();
    });
  });

  describe("AI interruption", () => {
    it("should interrupt AI when user starts speaking", () => {
      // Simulate AI speaking state
      const apiClient = (RealtimeAPIClient as jest.Mock).mock.instances[0];
      apiClient.onOpen?.();
      apiClient.onAudioData?.(Buffer.from([1, 2, 3, 4]));

      // Simulate user speech detection
      const vadManager = (VADManager as unknown as jest.Mock).mock.instances[0];
      vadManager.onSpeechStart?.();

      const audioManager = (AudioManager as unknown as jest.Mock).mock
        .instances[0];
      expect(audioManager.stop).toHaveBeenCalled();
      expect(apiClient.cancelResponse).toHaveBeenCalled();
    });
  });

  describe("function handling", () => {
    it("should handle function calls", async () => {
      const apiClient = (RealtimeAPIClient as jest.Mock).mock.instances[0];
      const testArgs = { test: "value" };
      const testResult = { success: true };

      mockFunctionHandler.mockResolvedValueOnce(testResult);

      // Simulate function call
      apiClient.onFunctionCallComplete?.("test-call-id");
      await apiClient.onFunctionCall?.(
        "test_function",
        JSON.stringify(testArgs)
      );

      expect(mockFunctionHandler).toHaveBeenCalledWith(testArgs);
      expect(apiClient.sendFunctionResponse).toHaveBeenCalledWith(
        "test-call-id",
        testResult
      );
    });

    it("should handle function call errors", async () => {
      const apiClient = (RealtimeAPIClient as jest.Mock).mock.instances[0];
      const error = new Error("Function error");

      mockFunctionHandler.mockRejectedValueOnce(error);

      // Simulate function call
      apiClient.onFunctionCallComplete?.("test-call-id");
      await apiClient.onFunctionCall?.("test_function", "{}");

      expect(mockOnError).toHaveBeenCalledWith(error);
      expect(mockOnStateChange).toHaveBeenCalledWith(OrchestratorState.ERROR);
    });
  });

  describe("cleanup", () => {
    it("should clean up all resources on disconnect", () => {
      orchestrator.disconnect();

      const audioManager = (AudioManager as unknown as jest.Mock).mock
        .instances[0];
      const vadManager = (VADManager as unknown as jest.Mock).mock.instances[0];
      const recordingManager = (RecordingManager as unknown as jest.Mock).mock
        .instances[0];
      const apiClient = (RealtimeAPIClient as jest.Mock).mock.instances[0];

      expect(audioManager.cleanup).toHaveBeenCalled();
      expect(vadManager.cleanup).toHaveBeenCalled();
      expect(recordingManager.cleanup).toHaveBeenCalled();
      expect(apiClient.disconnect).toHaveBeenCalled();
      expect(mockOnStateChange).toHaveBeenCalledWith(
        OrchestratorState.DISCONNECTED
      );
    });
  });
});
