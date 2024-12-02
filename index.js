import WebSocket from "ws";
import fs from 'fs';
import dotenv from 'dotenv';

dotenv.config();

class RealtimeClient {
    constructor(apiKey) {
        this.apiKey = apiKey;
        this.audioContext = new (window.AudioContext || window.webkitAudioContext)();
        this.audioQueue = [];
        this.isPlaying = false;
    }

    connect() {
        this.ws = new WebSocket('wss://api.openai.com/v1/realtime?model=gpt-4o-realtime-preview-2024-10-01');
        
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
            console.error('🔴 WebSocket error:', error);
        };

        this.ws.onclose = () => {
            console.log('🔵 Connection closed');
        };
    }

    handleEvent(event) {
        // Log event type with timestamp
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
            // Add other event handlers as needed
        }
    }

    async uploadAudio(filename) {
        const rawData = fs.readFileSync(filename);
        const chunkSize = 1024 * 1024;  // 1MB chunks for better network efficiency
        
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

    async handleAudioDelta(base64Audio) {
        // Convert base64 to ArrayBuffer
        const binaryString = atob(base64Audio);
        const len = binaryString.length;
        const bytes = new Uint8Array(len);
        for (let i = 0; i < len; i++) {
            bytes[i] = binaryString.charCodeAt(i);
        }

        // Convert to audio data
        const audioBuffer = await this.audioContext.decodeAudioData(bytes.buffer);
        
        // Queue the audio
        this.audioQueue.push(audioBuffer);
        
        // Start playing if not already playing
        if (!this.isPlaying) {
            this.playNextInQueue();
        }
    }

    async playNextInQueue() {
        if (this.audioQueue.length === 0) {
            this.isPlaying = false;
            return;
        }

        this.isPlaying = true;
        const audioBuffer = this.audioQueue.shift();
        
        const source = this.audioContext.createBufferSource();
        source.buffer = audioBuffer;
        source.connect(this.audioContext.destination);
        
        source.onended = () => {
            this.playNextInQueue();
        };
        
        source.start();
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
        if (this.audioContext) {
            this.audioContext.close();
        }
    }
}


const client = new RealtimeClient(process.env.OPENAI_API_KEY);
client.connect();

// To send audio:
client.sendAudioBuffer(base64AudioData);
client.commitAudioBuffer();
client.createResponse();

// To cleanup:
client.disconnect();
