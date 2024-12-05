import { RecordingManager } from "./RecordingManager";
import fs from "fs";

const filepath = `${process.cwd()}/data/test.wav`;

const recordingManager = new RecordingManager(
  {},
  {
    // create the file if it doesn't exist
    onStart: () => {
      if (!fs.existsSync(filepath)) {
        fs.writeFileSync(filepath, "");
      }
      console.log("Recording started");
    },
    // log the length of the file and delete it
    onStop: () => {
      const file = fs.readFileSync(filepath);
      console.log("Recording stopped", file.length);
      fs.unlinkSync(filepath);
    },
    onError: (error) => console.error("Recording error:", error),
    onData: (chunk) => {
      fs.appendFileSync(filepath, chunk);
    },
  }
);

// Start recording
recordingManager.start();

// Stop after 1.5 seconds
setTimeout(() => {
  recordingManager.stop();
  recordingManager.cleanup();
}, 1500);
