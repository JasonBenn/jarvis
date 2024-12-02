const AudioRecorder = require('node-audiorecorder');
const fs = require('fs');

// Audio recording options
const options = {
  program: 'rec',     // Try "arecord" on Linux or "rec" on macOS
  device: null,       // Recording device to use, null = default
  bits: 16,          // Sample size (bits)
  channels: 1,       // Number of channels
  encoding: 'signed-integer',
  rate: 24000,       // Sample rate
  type: 'wav',        // Format type
  silence: 0 // Remove silence detection parameters
};

// Create new instance
const recorder = new AudioRecorder(options, console);

// File path to save the recording
const fileName = `data/recording-${new Date().toISOString().replace(/[:.]/g, '-')}.wav`;
const fileStream = fs.createWriteStream(fileName);

console.log('Recording... Press Ctrl+C to stop.');

// Start recording
recorder.start().stream().pipe(fileStream);

// Handle interruption
process.on('SIGINT', () => {
  console.log('\nStopping recording...');
  recorder.stop();
  fileStream.end();
  process.exit();
});

// Log errors
recorder.on('error', error => {
  console.error('Recording error:', error);
  process.exit(1);
});