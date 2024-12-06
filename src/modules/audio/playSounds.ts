import * as fs from "fs";
import { AudioManager } from "./AudioManager";

const audioManager = new AudioManager();
audioManager.playTypingSound();

audioManager.playVoice(fs.readFileSync("data/michael.raw").toString("base64"));

setTimeout(() => {
  console.log("🔊 Closing speaker", audioManager.speaker);
  audioManager.speaker?.close(true);
  console.log("🔊 Closing typing speaker", audioManager.typingSpeaker);
  audioManager.typingSpeaker?.close(true);
}, 2000);
