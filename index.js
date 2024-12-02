import WebSocket from "ws";
import fs from 'fs';
import decodeAudio from 'audio-decode';


const url = "wss://api.openai.com/v1/realtime?model=gpt-4o-realtime-preview-2024-10-01";
const ws = new WebSocket(url, {
    headers: {
        "Authorization": "Bearer " + process.env.OPENAI_API_KEY,
        "OpenAI-Beta": "realtime=v1",
    },
});

function logTime(message) {
    console.log(`${Date.now()} ${message}`);
}

ws.on("open", async function open() {
    logTime("Connected to server.");

    // Fills the audio buffer with the contents of three files,
// then asks the model to generate a response.
    const files = [
        './data/24khz.wav'
    ];
    
    for (const filename of files) {
        const audioFile = fs.readFileSync(filename);
        const audioBuffer = await decodeAudio(audioFile);
        const channelData = audioBuffer.getChannelData(0);
        const base64Chunk = base64EncodeAudio(channelData);
        ws.send(JSON.stringify({
            type: 'input_audio_buffer.append',
            audio: base64Chunk
        }));
        logTime(`Uploaded ${filename}`);
    };
    logTime("Uploaded audio chunks");
    
    ws.send(JSON.stringify({type: 'input_audio_buffer.commit'}));
    ws.send(JSON.stringify({type: 'response.create'}));
    logTime("Done");
});

ws.on("message", function incoming(message) {
    logTime(JSON.parse(message.toString()));
});

// Converts Float32Array of audio data to PCM16 ArrayBuffer
function floatTo16BitPCM(float32Array) {
    const buffer = new ArrayBuffer(float32Array.length * 2);
    const view = new DataView(buffer);
    for (let i = 0; i < float32Array.length; i++) {
        let s = Math.max(-1, Math.min(1, float32Array[i]));
        view.setInt16(i * 2, s < 0 ? s * 0x8000 : s * 0x7fff, true);
    }
    return buffer;
}

// Converts a Float32Array to base64-encoded PCM16 data
function base64EncodeAudio(float32Array) {
    const pcmBuffer = floatTo16BitPCM(float32Array);
    const bytes = new Uint8Array(pcmBuffer);
    
    // Process in smaller chunks (1MB chunks)
    const chunkSize = 1024 * 1024;
    let result = '';
    
    logTime(`Processing ${Math.ceil(bytes.length / chunkSize)} chunks`);
    for (let i = 0; i < bytes.length; i += chunkSize) {
        const chunk = bytes.slice(i, i + chunkSize);
        // Use Buffer for more efficient base64 encoding
        result += Buffer.from(chunk).toString('base64');
    }
    logTime(`Done processing ${Math.ceil(bytes.length / chunkSize)} chunks`);
    return result;
}
