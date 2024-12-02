import WebSocket from "ws";
import fs from 'fs';
import dotenv from 'dotenv';
import Speaker from 'speaker';

dotenv.config();

class RealtimeClient {
    constructor(apiKey) {
        this.apiKey = apiKey;
        // Create speaker instance with correct audio format
        this.speaker = new Speaker({
            channels: 1,
            bitDepth: 16,
            sampleRate: 24000  // OpenAI's audio is 24kHz PCM
        });
    }

    connect() {
        this.ws = new WebSocket('wss://api.openai.com/v1/realtime?model=gpt-4o-realtime-preview-2024-10-01', {
            headers: {
                'Authorization': `Bearer ${this.apiKey}`,
                "OpenAI-Beta": "realtime=v1",

            }
        });
        
        this.ws.onopen = () => {
            console.log('🌐 Connected to OpenAI Realtime API');
            // Send initial configuration
            this.ws.send(JSON.stringify({
                type: 'session.update',
                session: {
                    modalities: ['text', 'audio'],
                    voice: 'alloy',
                    input_audio_format: 'pcm16',
                    output_audio_format: 'pcm16',
                    turn_detection: {
                        type: 'server_vad',
                        threshold: 0.5,
                        prefix_padding_ms: 300,
                        silence_duration_ms: 500
                    }
                }
            }));

            this.uploadAudio('./data/24khz.raw');
        };

        this.ws.onmessage = async (event) => {
            const data = JSON.parse(event.data);
            this.handleEvent(data);
        };

        this.ws.onerror = (error) => {
            console.error('🔴 WebSocket error:', error.message || error);
            // Log the full error object for debugging
            console.error('Full error:', JSON.stringify(error, null, 2));
        };

        this.ws.onclose = () => {
            console.log('🔵 Connection closed');
            // Clean up speaker on connection close
            this.speaker.end();
        };
    }

    handleEvent(event) {
        const timestamp = new Date().toISOString().split('T')[1].slice(0, -1);
        console.log(`${timestamp} [${event.type}]`);

        switch (event.type) {
            case 'response.audio.delta':
                this.handleAudioDelta(event.delta);
                break;
            case 'conversation.item.created':
                if (event.item.role === 'assistant') {
                    console.log('🤖 Assistant:', 
                        event.item.content?.[0]?.text?.value || 
                        event.item.content?.[0]?.transcript || 
                        '<no text>');
                } else if (event.item.role === 'user') {
                    console.log('👤 User:', 
                        event.item.content?.[0]?.text?.value || 
                        event.item.content?.[0]?.transcript || 
                        '<no text>');
                }
                break;
            case 'error':
                console.error('🔴 Error:', event.error);
                break;
        }
    }

    async uploadAudio(filename) {
        const rawData = fs.readFileSync(filename);
        const chunkSize = 1024 * 1024;  // 1MB chunks
        
        for (let i = 0; i < rawData.length; i += chunkSize) {
            const chunk = rawData.slice(i, Math.min(i + chunkSize, rawData.length));
            this.ws.send(JSON.stringify({
                type: 'input_audio_buffer.append',
                audio: chunk.toString('base64')
            }));
        }
        
        this.ws.send(JSON.stringify({type: 'input_audio_buffer.commit'}));
        this.ws.send(JSON.stringify({type: 'response.create'}));
    }

    handleAudioDelta(base64Audio) {
        // Convert base64 to buffer and play directly through speaker
        const buffer = Buffer.from(base64Audio, 'base64');
        this.speaker.write(buffer);
    }

    // Method to send audio buffer
    sendAudioBuffer(audioData) {
        if (this.ws.readyState === WebSocket.OPEN) {
            this.ws.send(JSON.stringify({
                type: 'input_audio_buffer.append',
                audio: audioData  // Base64 encoded audio data
            }));
        }
    }

    // Method to commit audio buffer
    commitAudioBuffer() {
        if (this.ws.readyState === WebSocket.OPEN) {
            this.ws.send(JSON.stringify({
                type: 'input_audio_buffer.commit'
            }));
        }
    }

    // Method to create a response
    createResponse() {
        if (this.ws.readyState === WebSocket.OPEN) {
            this.ws.send(JSON.stringify({
                type: 'response.create'
            }));
        }
    }

    // Cleanup method
    disconnect() {
        if (this.ws) {
            this.ws.close();
        }
        if (this.speaker) {
            this.speaker.end();
        }
    }
}

const client = new RealtimeClient(process.env.OPENAI_API_KEY);
client.connect();

// Graceful shutdown
process.on('SIGINT', () => {
    console.log('\nGracefully shutting down...');
    client.disconnect();
    process.exit();
});