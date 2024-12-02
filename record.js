import recorder from 'node-record-lpcm16';
import fs from 'fs';

console.log('Recording... Press Ctrl+C to stop.');

const recording = recorder.record({
    sampleRate: 24000,  // Match Realtime API requirements
    channels: 1,
    audioType: 'raw',   // Direct PCM16 output
});

// Save as raw PCM file (no WAV header)
recording.stream().pipe(fs.createWriteStream('data/24khz.raw'));

process.on('SIGINT', () => {
    console.log('\nStopping recording...');
    recording.stop();
    process.exit();
});