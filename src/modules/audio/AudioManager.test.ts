import * as fs from "fs";
import { AudioManager } from "./AudioManager";
import path from "path";

describe("AudioManager", () => {
  let audioManager: AudioManager;
  let timeoutId: NodeJS.Timeout;

  beforeEach(() => {
    audioManager = new AudioManager();
    jest.clearAllMocks();
  });

  afterEach(() => {
    // Clean up timeout if it exists
    if (timeoutId) {
      clearTimeout(timeoutId);
    }
    // Ensure cleanup after each test
    audioManager.stopVoice();
  });

  describe("voice playback", () => {
    it("should correctly play voice data", () => {
      return new Promise<void>((done) => {
        const testAudioPath = path.join(process.cwd(), "data/michael.raw");
        const audioData = fs.readFileSync(testAudioPath);
        audioManager.initializeSpeaker();

        const speakerWriteSpy = jest.spyOn(audioManager["speaker"]!, "write");

        // playVoice for 0.1 seconds
        audioManager.playVoice(audioData.toString("base64"));

        timeoutId = setTimeout(() => {
          try {
            expect(speakerWriteSpy).toHaveBeenCalledWith(expect.any(Buffer));
            done();
          } finally {
            audioManager.stopVoice();
          }
        }, 100); // Reduced timeout to 100ms for faster tests
      });
    });

    it("should handle empty or invalid audio data", () => {
      expect(() => {
        audioManager.playVoice("");
      }).not.toThrow();
    });
  });
});
