import { Orchestrator } from "./Orchestrator";
import { AudioManager } from "../audio/AudioManager";
import { RecordingManager } from "../recording/RecordingManager";
import { RealtimeAPIClient } from "../api/RealtimeAPIClient";
import { OrchestratorState } from "./types";

// Mock all dependent modules
jest.mock("../audio/AudioManager");
jest.mock("../recording/RecordingManager");
jest.mock("../api/RealtimeAPIClient");

describe("Orchestrator", () => {
  const defaultConfig = {
    audio: {
      channels: 1,
      bitDepth: 16,
      sampleRate: 24000,
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
      expect(RecordingManager).toHaveBeenCalled();
      expect(RealtimeAPIClient).toHaveBeenCalled();
    });
  });

  describe("recording control", () => {
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

  describe("cleanup", () => {
    it("should clean up all resources on disconnect", () => {
      orchestrator.disconnect();

      const audioManager = (AudioManager as unknown as jest.Mock).mock
        .instances[0];
      const recordingManager = (RecordingManager as unknown as jest.Mock).mock
        .instances[0];
      const apiClient = (RealtimeAPIClient as jest.Mock).mock.instances[0];

      expect(audioManager.cleanup).toHaveBeenCalled();
      expect(recordingManager.cleanup).toHaveBeenCalled();
      expect(apiClient.disconnect).toHaveBeenCalled();
    });
  });
});
