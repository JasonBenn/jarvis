import dotenv from "dotenv";
import { RealtimeAPIClient } from "./modules/api/RealtimeAPIClient";
dotenv.config();

const client = new RealtimeAPIClient({
  apiKey: process.env.OPENAI_API_KEY!,
});
client.connect();

function gracefulShutdown() {
  console.log("🔊 Graceful shutdown");
  client.disconnect();
  process.exit(0);
}

process.on("SIGINT", gracefulShutdown);
