import * as fs from "fs";
import { AudioManager } from "./AudioManager";

const audioManager = new AudioManager();
audioManager.playTypingSound();
// setTimeout(() => {
//   audioManager.stopTypingSound();
// }, 2000);

// play a voice from data/michael.raw
audioManager.playVoice(fs.readFileSync("data/michael.raw"));

// Enable stdin
process.stdin.resume();
process.stdin.setEncoding("utf8");
process.stdin.setRawMode(true);

// Make TypeScript happy with the setRawMode
(process.stdin as any).setRawMode(true);

// when i push space, interrupt the voice
process.stdin.on("data", (data) => {
  const key = data.toString();
  console.log("Pressed key:", key.charCodeAt(0)); // Debug: see what character code we're getting
  // if key is ctrl-c, exit
  if (key === "\u0003") {
    process.exit(0);
  }
  // if key is space, interrupt the voice
  if (key === " " || key === "\u0020") {
    audioManager.stopTypingSound();
    audioManager.stopVoice();
    console.log("🛑 Interrupting both sounds");
  }
});
