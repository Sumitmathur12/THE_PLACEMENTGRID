import fetch from 'node-fetch';
const email = 'verify_e2e@placementgrid.com';
const token = Buffer.from(JSON.stringify({ email })).toString('base64');

console.log('Testing Sarvam TTS endpoint...');
const res = await fetch('http://localhost:5500/api/interviews/tts', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + token },
  body: JSON.stringify({ text: 'Hello, welcome to your Google mock interview. Are you ready to begin?' })
});
const data = await res.json();

if (!res.ok) {
  console.error('HTTP Error:', res.status, JSON.stringify(data));
  process.exit(1);
}

if (data.isFallback) {
  console.error('FAIL - TTS returned fallback (isFallback=true). Error:', data.error);
  process.exit(1);
}

if (!data.audioContent) {
  console.error('FAIL - audioContent is empty/null');
  process.exit(1);
}

const audioBytes = Buffer.from(data.audioContent, 'base64');
console.log('PASS - Sarvam TTS working!');
console.log('  isFallback:', data.isFallback);
console.log('  audioContent length (bytes):', audioBytes.length, '(non-zero = real audio data)');
console.log('  Audio format: WAV/PCM (Sarvam bulbul:v1 en-IN)');
