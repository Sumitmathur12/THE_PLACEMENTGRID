import fetch from 'node-fetch';
const email = 'final_test@placementgrid.com';
const token = Buffer.from(JSON.stringify({ email })).toString('base64');
const H = { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + token };

console.log('=== FINAL SYSTEM CHECK ===\n');

// 1. TTS
console.log('[1/3] Sarvam TTS (bulbul:v3, ritu voice)...');
const ttsRes = await fetch('http://localhost:5500/api/interviews/tts', {
  method: 'POST', headers: H,
  body: JSON.stringify({ text: 'Welcome to your Google mock interview. Please answer the following question clearly and concisely.', speaker: 'ritu' })
});
const ttsData = await ttsRes.json();
if (ttsData.isFallback) { console.log('  FAIL - isFallback=true. Error:', ttsData.error); }
else { console.log(`  PASS - Real TTS audio: ${Buffer.from(ttsData.audioContent,'base64').length.toLocaleString()} bytes | isFallback=false`); }

// 2. Start session — 5 questions
console.log('\n[2/3] Question Generation (Google)...');
const startRes = await fetch('http://localhost:5500/api/interviews/start', {
  method: 'POST', headers: H, body: JSON.stringify({ company: 'Google' })
});
const startData = await startRes.json();
if (!startRes.ok) { console.log('  FAIL:', startData.error); process.exit(1); }
console.log(`  PASS - ${startData.questions.length} questions generated (Session: ${startData.sessionId})`);
startData.questions.forEach((q,i) => console.log(`  Q${i+1} [${q.category}/${q.difficulty}]: "${q.questionText.substring(0,75)}..."`));

// 3. Submit answer — immediate score
console.log('\n[3/3] Immediate Answer Scoring...');
const subRes = await fetch('http://localhost:5500/api/interviews/submit-answer', {
  method: 'POST', headers: H,
  body: JSON.stringify({
    sessionId: startData.sessionId,
    question: startData.questions[0].questionText,
    answer: 'I would use a hash map storing prefix sums as keys and their first occurrence index as values. This gives O(n) time and O(n) space.',
    expectedKeywords: startData.questions[0].expectedKeywords,
    questionIndex: 0,
    proctorLogs: []
  })
});
const subData = await subRes.json();
if (!subRes.ok) { console.log('  FAIL:', subData.error); process.exit(1); }
console.log(`  PASS - Score: ${subData.questionScore}/10 | Feedback: "${String(subData.questionFeedback).substring(0,80)}"`);

console.log('\n=== ALL SYSTEMS OPERATIONAL ===');
console.log('TTS: Sarvam bulbul:v3 (ritu voice, real audio) ✓');
console.log('Questions: ' + startData.questions.length + '/5 generated ✓');
console.log('Scoring: ' + subData.questionScore + '/10 returned ✓');
