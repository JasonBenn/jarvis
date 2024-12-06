import WebSocket from "ws";
import fs from 'fs';
import dotenv from 'dotenv';
import Speaker from 'speaker';
import recorder from 'node-record-lpcm16';
import wav from 'wav';
import { createReadStream } from 'fs';
import readline from 'readline';
import { Writable } from 'stream';

dotenv.config();

class RealtimeClient {
    constructor(apiKey) {
        this.apiKey = apiKey;
        this.functionCallBuffers = new Map();
        this.isRecording = false;
        this.recordingStream = null;
        this.typingSoundStream = null;
        this.typingSpeaker = null;
        this.isAISpeaking = false;
        this.lastUserSpeechTime = 0;
        this.audioQueue = [];
        this.isPlayingAudio = false;
        
        // Set up keyboard input handling
        readline.emitKeypressEvents(process.stdin);
        process.stdin.setRawMode(true);
        
        process.stdin.on('keypress', (str, key) => {
            if (key.name === 'space') {
                console.log('Space pressed - stopping recording and requesting response');
                this.stopRecordingAndRequestResponse();
            } else if (key.ctrl && key.name === 'c') {
                gracefulShutdown();
            }
        });
    }

    async writeNote(title, content, date = new Date().toISOString().split('T')[0]) {
        // Return dummy successful response
        return { success: true };
    }

    handleInterruption() {
        console.log('🛑 Interrupting AI response');
        this.isAISpeaking = false;
        
        // Stop current audio playback
        if (this.speaker) {
            this.speaker.close(true);
            this.speaker = null;
        }
        
        // Cancel current AI response
        if (this.ws && this.ws.readyState === WebSocket.OPEN) {
            this.ws.send(JSON.stringify({type: 'response.cancel'}));
            
            // Start a new recording session after a brief delay
            setTimeout(() => {
                this.startRecording();
            }, 100);
        }
    }

    startRecording() {
        if (this.isRecording) {
            console.log('Already recording...');
            return;
        }

        this.isRecording = true;
        console.log('🎤 Starting recording... (Press SPACE to stop and get response)');

        this.recordingStream = recorder.record({
            sampleRate: 24000,
            channels: 1,
            audioType: 'raw'
        });

        // Pipe audio to WebSocket
        this.recordingStream.stream()
            .on('data', (chunk) => {
                // Send to WebSocket if connected
                if (this.ws && this.ws.readyState === WebSocket.OPEN) {
                    this.ws.send(JSON.stringify({
                        type: 'input_audio_buffer.append',
                        audio: chunk.toString('base64')
                    }));
                }
            });
    }

    stopRecording() {
        if (!this.isRecording) {
            console.log('Not currently recording...');
            return;
        }

        console.log('🎤 Stopping recording...');
        this.isRecording = false;
        
        if (this.recordingStream) {
            this.recordingStream.stop();
            this.recordingStream = null;
        }
    }

    stopRecordingAndRequestResponse() {
        if (this.isRecording) {
            this.stopRecording();
            if (this.ws && this.ws.readyState === WebSocket.OPEN) {
                this.ws.send(JSON.stringify({type: 'input_audio_buffer.commit'}));
                this.ws.send(JSON.stringify({type: 'response.create'}));
            }
        }
    }

    playTypingSound() {
        this.typingSpeaker = new Speaker({
            channels: 2,
            bitDepth: 16,
            sampleRate: 44100
        });

        const reader = new wav.Reader();
        
        this.typingSoundStream = createReadStream('data/typing.wav')
            .pipe(reader)
            .pipe(this.typingSpeaker);

        this.typingSoundStream.on('end', () => {
            if (this.functionCallBuffers.size > 0) {
                this.playTypingSound();
            }
        });
    }

    stopTypingSound() {
        if (this.typingSoundStream) {
            this.typingSoundStream.destroy();
            this.typingSoundStream = null;
        }
        if (this.typingSpeaker) {
            this.typingSpeaker.close(true);
            this.typingSpeaker = null;
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

            this.startRecording();
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
            this.stopRecording();
            this.stopTypingSound();
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
            sampleRate: 24000,
            bufferSize: 4096
        });
        
        this.speaker.on('drain', () => {
            console.log('🔊 Audio buffer drained');
        });
    }

    async handleEvent(event) {
        const timestamp = new Date().toISOString().split('T')[1].slice(0, -1);
        console.log(`${timestamp} [${event.type}]`);

        switch (event.type) {
            case 'response.audio.delta':
                // Stop typing sound when AI starts speaking
                this.stopTypingSound();
                this.isAISpeaking = true;
                
                if (!this.speaker || this.speaker.destroyed) {
                    console.log('🔊 Initializing speaker');
                    this.initializeSpeaker();
                }
                this.handleAudioDelta(event.delta);
                break;

            case 'response.function_call_arguments.delta':
                if (this.functionCallBuffers.size === 0) {
                    console.log('⌨️ Starting typing sound...');
                    this.playTypingSound();
                }
                this.handleFunctionCallDelta(event);
                break;

            case 'response.function_call_arguments.done':
                console.log('🔧 Function call done:', event.arguments);
                await this.handleFunctionCallDone(event);
                break;

            case 'response.done':
                console.log('🔊 Response complete');
                this.isAISpeaking = false;
                
                // Clean up speaker if it's still around
                if (this.speaker) {
                    this.speaker.end();
                    this.speaker = null;
                }
                
                // Start recording again after response is done
                this.startRecording();
                break;

            case 'conversation.item.created':
                const itemType = event.item.type;
                const itemId = event.item.id;
                
                if (itemType === 'message') {
                    if (event.item.role === 'assistant') {
                        const text = event.item.content?.[0]?.text?.value;
                        console.log(`🤖 Assistant message [${itemId}]: ${text || 'generating response...'}`);
                    } else if (event.item.role === 'user') {
                        const transcript = event.item.content?.[0]?.transcript;
                        console.log(`👤 User message [${itemId}]: ${transcript || 'processing audio...'}`);
                    }
                } else if (itemType === 'function_call') {
                    console.log(`🔧 Function call [${itemId}]: ${event.item.name}`);
                } else if (itemType === 'function_call_output') {
                    console.log(`📤 Function output [${itemId}] for call ${event.item.call_id}`);
                }
                break;
                
            case 'error':
                console.error('🔴 Error:', event.error);
                break;
        }
    }

    handleFunctionCallDelta(event) {
        if (!this.functionCallBuffers.has(event.call_id)) {
            this.functionCallBuffers.set(event.call_id, '');
        }

        const currentBuffer = this.functionCallBuffers.get(event.call_id);
        this.functionCallBuffers.set(event.call_id, currentBuffer + event.delta);
    }

    async handleFunctionCallDone(event) {
        try {
            const args = JSON.parse(event.arguments);
            
            if (event.name === 'write_note') {
                const result = await this.writeNote(args.title, args.content, args.date);
                
                console.log('🔧 Function call response:', result);
                
                // Send function output
                const outputEvent = {
                    type: 'conversation.item.create',
                    item: {
                        type: 'function_call_output',
                        call_id: event.call_id,
                        output: JSON.stringify(result)
                    }
                };
                console.log('📤 Sending function output:', outputEvent);
                this.ws.send(JSON.stringify(outputEvent));
                
                // Request next response
                this.ws.send(JSON.stringify({type: 'response.create'}));
            }
        } catch (error) {
            console.error('Error handling function call:', error);
            
            this.ws.send(JSON.stringify({
                type: 'conversation.item.create',
                item: {
                    type: 'function_call_output',
                    call_id: event.call_id,
                    output: JSON.stringify({ 
                        success: false, 
                        error: error.message 
                    })
                }
            }));
        }

        this.functionCallBuffers.delete(event.call_id);
    }

    handleAudioDelta(base64Audio) {
        if (!this.isAISpeaking) return;  // Don't play if we've been interrupted
        
        const buffer = Buffer.from(base64Audio, 'base64');
        if (buffer.length === 0) {
            if (this.speaker) {
                this.speaker.end();
                this.speaker = null;
            }
            return;
        }

        if (!this.speaker || this.speaker.destroyed) {
            console.log('🔊 Initializing speaker');
            this.initializeSpeaker();
        }

        try {
            this.speaker.write(buffer);
        } catch (error) {
            console.error('Error playing audio:', error);
        }
    }

    disconnect() {
        this.stopRecording();
        this.stopTypingSound();
        this.isAISpeaking = false;
        this.isPlayingAudio = false;
        this.audioQueue = [];
        if (this.ws) {
            this.ws.close();
        }
        if (this.speaker) {
            this.speaker.end();
            this.speaker = null;
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