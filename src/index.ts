import dotenv from "dotenv";
import { Orchestrator } from "./modules/orchestrator/Orchestrator";

dotenv.config();

const orchestrator = new Orchestrator();
orchestrator.start();
console.log("🔊 Orchestrator started");

function gracefulShutdown() {
  console.log("🔊 Graceful shutdown");
  orchestrator.stop();
  process.exit(0);
}

process.on("SIGINT", gracefulShutdown);
