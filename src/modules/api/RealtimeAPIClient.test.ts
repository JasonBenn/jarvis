import { RealtimeAPIClient } from "./RealtimeAPIClient";
import WebSocket from "ws";

jest.mock("ws");

describe("RealtimeAPIClient", () => {
  const defaultConfig = {
    apiKey: "test-api-key",
    model: "gpt-4o-realtime-preview-2024-10-01",
    voice: "alloy",
    inputAudioFormat: "pcm16",
    outputAudioFormat: "pcm16",
  };

  let apiClient: RealtimeAPIClient;
  let mockOnAudioData: jest.Mock;
  let mockOnTranscript: jest.Mock;
  let mockOnFunctionCall: jest.Mock;
  let mockOnError: jest.Mock;
  let mockOnOpen: jest.Mock;
  let mockOnClose: jest.Mock;
  let mockWebSocket: jest.Mocked<WebSocket>;
  let mockSend: jest.Mock;

  beforeEach(() => {
    jest.clearAllMocks();

    // Set up event handler mocks
    mockOnAudioData = jest.fn();
    mockOnTranscript = jest.fn();
    mockOnFunctionCall = jest.fn();
    mockOnError = jest.fn();
    mockOnOpen = jest.fn();
    mockOnClose = jest.fn();

    // Set up WebSocket mock
    mockSend = jest.fn();
    mockWebSocket = {
      on: jest.fn(),
      send: mockSend,
      close: jest.fn(),
      readyState: WebSocket.OPEN,
    } as unknown as jest.Mocked<WebSocket>;

    const MockWebSocket = WebSocket as jest.MockedClass<typeof WebSocket>;
    (MockWebSocket as unknown as jest.Mock).mockImplementation(
      () => mockWebSocket
    );

    apiClient = new RealtimeAPIClient(defaultConfig, {
      onAudioData: mockOnAudioData,
      onTranscript: mockOnTranscript,
      onFunctionCall: mockOnFunctionCall,
      onError: mockOnError,
      onOpen: mockOnOpen,
      onClose: mockOnClose,
    });
  });

  describe("connection", () => {
    it("should connect with correct configuration", () => {
      apiClient.connect();

      expect(WebSocket).toHaveBeenCalledWith(
        expect.stringContaining(defaultConfig.model),
        expect.objectContaining({
          headers: expect.objectContaining({
            Authorization: `Bearer ${defaultConfig.apiKey}`,
          }),
        })
      );
    });

    it("should set up session on connection", () => {
      apiClient.connect();

      // Get the 'open' event handler and call it
      const onOpen = (mockWebSocket.on as jest.Mock).mock.calls.find(
        (call) => call[0] === "open"
      )[1];
      onOpen();

      expect(mockSend).toHaveBeenCalledWith(
        expect.stringContaining("session.update")
      );
      expect(mockOnOpen).toHaveBeenCalled();
    });
  });

  describe("message handling", () => {
    beforeEach(() => {
      apiClient.connect();
    });

    it("should handle audio data", () => {
      const onMessage = (mockWebSocket.on as jest.Mock).mock.calls.find(
        (call) => call[0] === "message"
      )[1];

      const testAudio = "test-audio-data";
      onMessage(
        JSON.stringify({
          type: "response.audio.delta",
          delta: testAudio,
        })
      );

      expect(mockOnAudioData).toHaveBeenCalledWith(
        Buffer.from(testAudio, "base64")
      );
    });

    it("should handle transcripts", () => {
      const onMessage = (mockWebSocket.on as jest.Mock).mock.calls.find(
        (call) => call[0] === "message"
      )[1];

      const testTranscript = "Hello, world!";
      onMessage(
        JSON.stringify({
          type: "response.audio_transcript.delta",
          delta: testTranscript,
        })
      );

      expect(mockOnTranscript).toHaveBeenCalledWith(testTranscript);
    });

    it("should handle function calls", () => {
      const onMessage = (mockWebSocket.on as jest.Mock).mock.calls.find(
        (call) => call[0] === "message"
      )[1];

      const testCallId = "test-call-id";
      const testArgs = '{"arg": "value"}';
      onMessage(
        JSON.stringify({
          type: "response.function_call_arguments.delta",
          call_id: testCallId,
          name: "test_function",
          arguments: testArgs,
        })
      );

      expect(mockOnFunctionCall).toHaveBeenCalledWith(
        "test_function",
        testArgs
      );
    });
  });

  describe("audio operations", () => {
    beforeEach(() => {
      apiClient.connect();
    });

    it("should send audio chunks", () => {
      const testChunk = Buffer.from([1, 2, 3, 4]);
      apiClient.sendAudioChunk(testChunk);

      expect(mockSend).toHaveBeenCalledWith(
        expect.stringContaining("input_audio_buffer.append")
      );
    });

    it("should commit audio and request response", () => {
      apiClient.commitAudio();

      expect(mockSend).toHaveBeenCalledWith(
        expect.stringContaining("input_audio_buffer.commit")
      );
      expect(mockSend).toHaveBeenCalledWith(
        expect.stringContaining("response.create")
      );
    });

    it("should cancel responses", () => {
      apiClient.commitAudio(); // Start a response
      apiClient.cancelResponse();

      expect(mockSend).toHaveBeenCalledWith(
        expect.stringContaining("response.cancel")
      );
    });
  });

  describe("function responses", () => {
    beforeEach(() => {
      apiClient.connect();
    });

    it("should send function responses correctly", () => {
      const testCallId = "test-call-id";
      const testResponse = { result: "success" };

      apiClient.sendFunctionResponse(testCallId, testResponse);

      expect(mockSend).toHaveBeenCalledWith(
        expect.stringContaining("function_call_output")
      );
      expect(mockSend).toHaveBeenCalledWith(
        expect.stringContaining(testCallId)
      );
    });
  });

  describe("error handling", () => {
    beforeEach(() => {
      apiClient.connect();
    });

    it("should handle WebSocket errors", () => {
      const onError = (mockWebSocket.on as jest.Mock).mock.calls.find(
        (call) => call[0] === "error"
      )[1];

      const testError = new Error("WebSocket error");
      onError(testError);

      expect(mockOnError).toHaveBeenCalledWith(testError);
    });

    it("should handle message parsing errors", () => {
      const onMessage = (mockWebSocket.on as jest.Mock).mock.calls.find(
        (call) => call[0] === "message"
      )[1];

      onMessage("invalid json");

      expect(mockOnError).toHaveBeenCalled();
    });
  });
});
