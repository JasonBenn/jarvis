import WebSocket from "ws";
import fs from 'fs';
import dotenv from 'dotenv';
import Speaker from 'speaker';
import fetch from 'node-fetch';

dotenv.config();

class RealtimeClient {
    constructor(apiKey) {
        this.apiKey = apiKey;
        this.functionCallBuffers = new Map(); // Buffer for accumulating function call arguments
    }

    async writeNote(title, content, date = new Date().toISOString().split('T')[0]) {
        try {
            const response = await fetch('https://tutor.mleclub.com/api/append-note', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    title,
                    content,
                    date
                })
            });

            if (!response.ok) {
                return { success: false, error: `HTTP ${response.status} error writing note: ${response.statusText}` }
            }

            return { success: true }
        } catch (error) {
            return { success: false, error: `Error writing note: ${error}` }
        }
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
            this.ws.send(JSON.stringify({
                type: 'session.update',
                session: {
                    modalities: ['text', 'audio'],
                    voice: 'alloy',
                    input_audio_format: 'pcm16',
                    output_audio_format: 'pcm16',
                    turn_detection: null,
                    tools: [{
                        name: 'write_note',
                        type: 'function',
                        description: 'An external API that appends a brief personal note to an existing document, usually just a couple paragraphs or less of thoughts. The content should be lightly cleaned up by removing "um" etc, but otherwise don\'t editorialize at all. Also generate a concise title for the note - just an evocative phrase or two that captures the essence of the note.',
                        parameters: {
                            type: 'object',
                            properties: {
                                filename: {
                                    type: 'string',
                                    description: 'The filename to append to. Should be one of the following: "Aliveness", "2024-W49", "Love, dating"'
                                },
                                content: {
                                    type: 'string',
                                    description: 'The content of the note'
                                },
                                title: {
                                    type: 'string',
                                    description: 'A concise title - half a sentence or so - that briefly describes the most salient part of the note. Use lowercase except for proper nouns.'
                                },
                                date: {
                                    type: 'string',
                                    description: 'Optional date for the note in YYYY-MM-DD format. Only use this if the description specifies a date other than today. This might be approximate or relative - just choose a date that approximately captures the spirit of the request.'
                                }
                            },
                            required: ['title', 'content']
                        }
                    }]
                }
            }));

            this.uploadAudio('./data/sasha-note.raw');
        };

        this.ws.onmessage = async (event) => {
            const data = JSON.parse(event.data);
            await this.handleEvent(data);
        };

        this.ws.onerror = (error) => {
            console.error('🔴 WebSocket error:', error.message || error);
            console.error('Full error:', JSON.stringify(error, null, 2));
        };

        this.ws.onclose = () => {
            console.log('🔵 Connection closed');
            if (this.speaker) {
                this.speaker.end();
            }
            gracefulShutdown();
        };
    }

    initializeSpeaker() {
        this.speaker = new Speaker({
            channels: 1,
            bitDepth: 16,
            sampleRate: 24000
        });
    }

    async handleEvent(event) {
        const timestamp = new Date().toISOString().split('T')[1].slice(0, -1);
        console.log(`${timestamp} [${event.type}]`);

        switch (event.type) {
            case 'response.audio.delta':
                if (!this.speaker) {
                    console.log('🔊 Initializing speaker');
                    this.initializeSpeaker();
                }
                this.handleAudioDelta(event.delta);
                break;

            case 'response.function_call_arguments.delta':
                this.handleFunctionCallDelta(event);
                break;

            case 'response.function_call_arguments.done':
                console.log('🔧 Function call done:', event.arguments);
                await this.handleFunctionCallDone(event);
                break;

            case 'response.done':
                if (this.speaker) {
                    console.log('🔊 Finished speaking');
                    this.speaker.end();
                }
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
                        event.item.content || 
                        '<no text>');
                }
                break;
            case 'error':
                console.error('🔴 Error:', event.error);
                break;
        }
    }

    handleFunctionCallDelta(event) {
        // Initialize buffer if it doesn't exist for this call
        if (!this.functionCallBuffers.has(event.call_id)) {
            this.functionCallBuffers.set(event.call_id, '');
        }

        // Append the delta to the buffer
        const currentBuffer = this.functionCallBuffers.get(event.call_id);
        this.functionCallBuffers.set(event.call_id, currentBuffer + event.delta);
    }

    async handleFunctionCallDone(event) {
        try {
            const args = JSON.parse(event.arguments);
            
            if (event.name === 'write_note') {
                const result = await this.writeNote(args.title, args.content, args.date);
                
                console.log('🔧 Function call response:', result);
                this.ws.send(JSON.stringify({
                    type: 'conversation.item.create',
                    item: {
                        type: 'function_call_output',
                        call_id: event.call_id,
                        output: JSON.stringify(result)
                    }
                }));
                this.ws.send(JSON.stringify({type: 'response.create'}));
            }
        } catch (error) {
            console.error('Error handling function call:', error);
            
            // Send error response
            this.ws.send(JSON.stringify({
                type: 'function_call.response',
                call_id: event.call_id,
                response: JSON.stringify({ 
                    success: false, 
                    error: error.message 
                })
            }));
        }

        // Clear the buffer for this call
        this.functionCallBuffers.delete(event.call_id);
    }

    handleAudioDelta(base64Audio) {
        const buffer = Buffer.from(base64Audio, 'base64');
        this.speaker.write(buffer);
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

function gracefulShutdown() {
    console.log('🔊 Graceful shutdown');
    client.disconnect();
    process.exit(0);
}

process.on('SIGINT', gracefulShutdown);