import path from "path";
import fs from "fs";
import { VADManager } from "./VADManager";

const vadManager = new VADManager({
  mode: 0, // VAD.Mode.NORMAL
  sampleRate: 16000,
});

const inputStream = fs.createReadStream(
  path.resolve(process.cwd(), "data/michael.raw")
);

vadManager.on("speech", (event) => {
  console.log(event.state);
});

inputStream.on("data", async (chunk: Buffer) => {
  await vadManager.processAudio(chunk);
});

inputStream.on("end", () => {
  vadManager.cleanup();
});
