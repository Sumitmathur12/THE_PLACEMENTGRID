import { io } from 'socket.io-client';

const socket = io('http://localhost:5500', { transports: ['websocket'] });

let chunks = '';
socket.on('connect', () => {
  console.log('Socket connected:', socket.id);
  socket.emit('live_answer', {
    questionText: 'Explain how you would optimize database queries in MongoDB.',
    answerText: 'We can create compound indexes on frequently queried fields, use explain() to analyze the query execution plan, and leverage projection to avoid returning unnecessary data.',
    expectedKeywords: ['indexing', 'explain', 'projection'],
    companyName: 'Google'
  });
});

socket.on('ai_chunk', (chunk) => {
  process.stdout.write(chunk);
  chunks += chunk;
});

socket.on('ai_complete', () => {
  console.log('\n\n[SUCCESS] ai_complete received. Total chars:', chunks.length);
  socket.disconnect();
  process.exit(chunks.length > 0 ? 0 : 1);
});

socket.on('ai_error', (err) => {
  console.error('\n[ERROR] ai_error:', err);
  socket.disconnect();
  process.exit(1);
});

setTimeout(() => {
  console.error('\n[TIMEOUT] 15s timeout waiting for socket reaction');
  socket.disconnect();
  process.exit(1);
}, 15000);
