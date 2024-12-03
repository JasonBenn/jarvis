import recorder from 'node-record-lpcm16';
import fs from 'fs';

console.log('Recording... Press Ctrl+C to stop.');

const recording = recorder.record({
    sampleRate: 24000,  // Match Realtime API requirements
    channels: 1,
    audioType: 'raw',   // Direct PCM16 output
});

// Save as raw PCM file (no WAV header)
const outputFile = `data/${Date.now()}.raw`;
recording.stream().pipe(fs.createWriteStream(outputFile));

process.on('SIGINT', () => {
    console.log('\nStopping recording...');
    recording.stop();
    process.exit();
});