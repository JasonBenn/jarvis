import dotenv from "dotenv";
import { RealtimeClient } from "./modules/realtime/RealtimeClient";

dotenv.config();

const client = new RealtimeClient();

client.connect();

process.on("SIGINT", () => {
  console.log("🔊 Graceful shutdown");
  client.disconnect();
  process.exit(0);
});
