import { VADManager } from "./VADManager";
import VAD from "node-vad";
import fs from "fs";
import path from "path";

jest.mock("node-vad");

describe("VADManager", () => {
  let vadManager: VADManager;
  let mockProcessAudio: jest.Mock;

  beforeEach(() => {
    jest.clearAllMocks();

    mockProcessAudio = jest.fn().mockReturnValue({
      on: jest.fn((event, callback) => {
        if (event === "data") {
          callback({
            state: true,
            start: true,
            end: false,
            startTime: Date.now(),
            duration: 0,
          });
        }
      }),
    });

    (VAD as unknown as jest.Mock).mockImplementation(() => ({
      processAudio: mockProcessAudio,
    }));

    vadManager = new VADManager({ mode: VAD.Mode.NORMAL });
  });

  it("should emit speech event and resolve promise when speech is detected", async () => {
    const onSpeech = jest.fn();
    vadManager.on("speech", onSpeech);

    const speechPromise = vadManager.waitForSpeech();
    await vadManager.processAudio(Buffer.from([1, 2, 3, 4]));

    const result = await speechPromise;
    expect(result).toBe(true);
    expect(onSpeech).toHaveBeenCalledWith(
      expect.objectContaining({
        state: true,
        start: true,
        end: false,
        startTime: expect.any(Number),
        duration: 0,
      })
    );
  });

  it("should resolve promise with false on cleanup if no speech detected", async () => {
    const speechPromise = vadManager.waitForSpeech();
    vadManager.cleanup();

    const result = await speechPromise;
    expect(result).toBe(false);
  });
});
