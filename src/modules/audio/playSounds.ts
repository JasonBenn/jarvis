import * as fs from "fs";
import { AudioManager } from "./AudioManager";

const audioManager = new AudioManager();
// audioManager.playTypingSound();

audioManager.playVoice(
  fs
    .readFileSync("data/michael.raw")
    .slice(0, 24000 * 5)
    .toString("base64"),
  () => {
    console.log("🎤 callback");
  }
);

// audioManager.stopVoice();

// setTimeout(() => {
//   console.log("🔊 Closing speaker", audioManager.speaker);
//   audioManager.speaker?.close(true);
//   console.log("🔊 Closing typing speaker", audioManager.typingSpeaker);
//   audioManager.typingSpeaker?.close(true);
// }, 2000);
