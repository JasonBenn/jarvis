import { AudioManager } from "./AudioManager";

const audioManager = new AudioManager();
audioManager.playTypingSound();
setTimeout(() => {
  audioManager.stopTypingSound();
}, 2000);
