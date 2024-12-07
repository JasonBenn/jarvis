import WebSocket from "ws";
import { FunctionCallDone, IRealtimeClient, OpenAIServerEvent } from "./types";
import { AudioManager } from "../audio/AudioManager";
import { RecordingManager } from "../recording/RecordingManager";
import { getTools, writeNote } from "../tools/Tools";

export class RealtimeClient implements IRealtimeClient {
  private ws: WebSocket | null = null;
  private audioManager: AudioManager;
  private recordingManager: RecordingManager;
  private functionCallBuffers = new Map();

  constructor() {
    this.audioManager = new AudioManager();
    this.recordingManager = new RecordingManager(
      {},
      {
        onData: this.handleRecordingData.bind(this),
        onError: console.error,
      }
    );

    this.setupKeyboardControls();
  }

  private setupKeyboardControls(): void {
    process.stdin.setRawMode(true);
    process.stdin.resume();
    process.stdin.setEncoding("utf8");
    process.stdin.on("data", (key) => {
      if (key.toString() === " ") {
        if (this.audioManager.isPlaying()) {
          console.log(
            "Still playing audio - I would normally interrupt, but ignoring for now bc bugs"
          );
          //   this.handleInterruption();
        } else {
          console.log(
            "Space pressed - stopping recording and requesting response"
          );
          this.stopRecordingAndRequestResponse();
        }
      } else if (key.toString() === "\u0003") {
        this.disconnect();
        process.exit(0);
      }
    });
  }

  private handleRecordingData(chunk: Buffer): void {
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(
        JSON.stringify({
          type: "input_audio_buffer.append",
          audio: chunk.toString("base64"),
        })
      );
    }
  }

  public handleInterruption(): void {
    console.log("🛑 Interrupting AI response");
    this.audioManager.stopVoice();
    this.audioManager.stopTypingSound();

    if (this.ws?.readyState === WebSocket.OPEN) {
      console.log("🛑 Sending response.cancel");
      this.ws.send(JSON.stringify({ type: "response.cancel" }));
      this.recordingManager.start();
    }
  }

  private stopRecordingAndRequestResponse(): void {
    if (this.recordingManager.isRecording()) {
      this.recordingManager.stop();
      if (this.ws?.readyState === WebSocket.OPEN) {
        this.ws.send(JSON.stringify({ type: "input_audio_buffer.commit" }));
        this.ws.send(JSON.stringify({ type: "response.create" }));
      }
    }
  }

  public connect(): void {
    this.ws = new WebSocket(
      "wss://api.openai.com/v1/realtime?model=gpt-4o-realtime-preview-2024-10-01",
      {
        headers: {
          Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
          "OpenAI-Beta": "realtime=v1",
        },
      }
    );
    console.log("🌐 Connecting to OpenAI Realtime API");

    this.ws.onopen = () => {
      console.log("🌐 Connected to OpenAI Realtime API");
      this.ws?.send(
        JSON.stringify({
          type: "session.update",
          session: {
            modalities: ["text", "audio"],
            voice: "alloy",
            instructions:
              "You are a helpful assistant for a realtime audio chat. Speak quickly and concisely.",
            input_audio_format: "pcm16",
            output_audio_format: "pcm16",
            turn_detection: null,
            tools: getTools(),
          },
        })
      );

      this.recordingManager.start();
    };

    this.ws.onmessage = async (event) => {
      const data = JSON.parse(event.data.toString()) as OpenAIServerEvent;
      await this.handleEvent(data);
    };

    this.ws.onerror = (error) => {
      console.error("🔴 WebSocket error:", error.message || error);
      console.error("Full error:", JSON.stringify(error, null, 2));
    };

    this.ws.onclose = () => {
      console.log("🔵 Connection closed");
      this.disconnect();
    };
  }

  private async handleEvent(event: OpenAIServerEvent): Promise<void> {
    const timestamp = new Date().toISOString().split("T")[1].slice(0, -1);
    console.log(`${timestamp} [${event.type}]`);

    switch (event.type) {
      case "response.audio.delta":
        try {
          await this.audioManager.playVoice(event.delta!, () =>
            this.recordingManager.start()
          );
        } catch (error) {
          console.error("Error playing audio:", error);
        }
        break;

      case "response.function_call_arguments.delta":
        if (this.functionCallBuffers.size === 0) {
          console.log("⌨️ Starting typing sound...");
          this.audioManager.playTypingSound();
        }
        this.handleFunctionCallDelta(event);
        break;

      case "response.function_call_arguments.done":
        console.log("🔧 Function call done:", event.arguments);
        await this.handleFunctionCallDone(event as FunctionCallDone);
        break;

      case "response.done":
        console.log("🔊 Response complete");
        break;

      case "conversation.item.created":
        const item = event.item!;

        if (item.type === "message") {
          if (item.role === "assistant") {
            const text =
              typeof item.content?.[0]?.text === "string"
                ? item.content?.[0]?.text
                : item.content?.[0]?.text?.value;
            console.log(
              `🤖 Assistant message [${item.id}]: ${text || "generating response..."}`
            );
          } else if (item.role === "user") {
            const transcript = item.content?.[0]?.transcript;
            console.log(
              `👤 User message [${item.id}]: ${
                transcript || "processing audio..."
              }`
            );
          }
        } else if (item.type === "function_call") {
          console.log(`🔧 Function call [${item.id}]: ${item.name}`);
        } else if (item.type === "function_call_output") {
          console.log(
            `📤 Function output [${item.id}] for call ${item.call_id}`
          );
        }
        break;

      case "error":
        console.error("🔴 Error:", event.error);
        break;
    }
  }

  handleFunctionCallDelta(event: OpenAIServerEvent) {
    if (!this.functionCallBuffers.has(event.call_id)) {
      this.functionCallBuffers.set(event.call_id, "");
    }

    const currentBuffer = this.functionCallBuffers.get(event.call_id);
    this.functionCallBuffers.set(event.call_id, currentBuffer + event.delta);
  }

  async handleFunctionCallDone(event: FunctionCallDone) {
    try {
      const args = JSON.parse(event.arguments || "");

      if (event.name === "write_note") {
        const result = await writeNote(
          args.title,
          args.content,
          args.filename,
          args.date
        );

        console.log("🔧 Function call response:", result);

        // Send function output
        const outputEvent = {
          type: "conversation.item.create",
          item: {
            type: "function_call_output",
            call_id: event.call_id,
            output: JSON.stringify(result),
          },
        };
        console.log("📤 Sending function output:", outputEvent);
        this.ws?.send(JSON.stringify(outputEvent));

        // Request next response
        this.ws?.send(JSON.stringify({ type: "response.create" }));
      }
    } catch (error) {
      console.error("Error handling function call:", error);

      this.ws?.send(
        JSON.stringify({
          type: "conversation.item.create",
          item: {
            type: "function_call_output",
            call_id: event.call_id,
            output: JSON.stringify({
              success: false,
              error: (error as Error).message || String(error),
            }),
          },
        })
      );
    }

    this.functionCallBuffers.delete(event.call_id);
  }
  public disconnect(): void {
    this.recordingManager.cleanup();
    this.audioManager.cleanup();

    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
  }
}
