import * as fs from "fs";
import { AudioManager } from "./AudioManager";

const audioManager = new AudioManager();
audioManager.playTypingSound();
setTimeout(() => {
  audioManager.stopTypingSound();
}, 2000);

// play a voice from data/michael.raw
audioManager.playVoice(fs.readFileSync("data/michael.raw"));
