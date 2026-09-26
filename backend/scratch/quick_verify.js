import fetch from 'node-fetch';
import { io } from 'socket.io-client';
import mongoose from 'mongoose';
import dotenv from 'dotenv';
import { User, InterviewSession, DailyActivity } from '../models/Schemas.js';

dotenv.config({ path: './.env' });

const API_BASE = 'http://localhost:5500/api';
const MONGO_URI = process.env.MONGODB_URI || process.env.MONGO_URI;

const delay = (ms) => new Promise(r => setTimeout(r, ms));

async function runQuickTest() {
  console.log('=== STARTING VERIFICATION RUN ===');
  await mongoose.connect(MONGO_URI);
  console.log('[DB Connected]');

  const email = 'test_student@placementgrid.com';
  const token = Buffer.from(JSON.stringify({ email })).toString('base64');

  // 1. Start Session
  const startRes = await fetch(`${API_BASE}/interviews/start`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
    body: JSON.stringify({ company: 'Tesla' })
  });
  const startData = await startRes.json();
  console.log('[1/4 Start Session OK] ID:', startData.sessionId, '| Q Count:', startData.questions.length);

  const sessionId = startData.sessionId;

  // 2. Socket.io Live Stream Test
  const socket = io('http://localhost:5500', { transports: ['websocket'] });
  let socketStreamed = '';
  await new Promise((resolve) => {
    socket.on('connect', () => {
      console.log('[2/4 Socket.io Connected]');
      socket.emit('live_answer', {
        questionText: startData.questions[0].questionText,
        answerText: 'We optimize performance using batch processing, vectorization, and caching.',
        expectedKeywords: startData.questions[0].expectedKeywords,
        companyName: 'Tesla'
      });
    });
    socket.on('ai_chunk', (chunk) => { socketStreamed += chunk; });
    socket.on('ai_complete', () => {
      console.log('[2/4 Socket Stream OK] Reaction:', socketStreamed.trim());
      resolve();
    });
    socket.on('ai_error', (err) => {
      console.log('[Socket Error]', err);
      resolve();
    });
  });
  socket.disconnect();

  // 3. Submit Answers
  console.log('[3/4 Submitting Answers with 2s cooldown...]');
  let questions = [...startData.questions];
  for (let i = 0; i < questions.length; i++) {
    const q = questions[i];
    const isWeak = (i === 0); // make Q1 weak to test follow-up
    const answer = isWeak 
      ? 'I am not sure about Tesla manufacturing standards.' 
      : 'I would design the system with high fault tolerance, clean modular APIs, and structured telemetry.';

    console.log(`Submitting Q${i + 1} (${isWeak ? 'WEAK' : 'STRONG'})...`);
    const subRes = await fetch(`${API_BASE}/interviews/submit-answer`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
      body: JSON.stringify({
        sessionId,
        question: q.questionText,
        answer,
        expectedKeywords: q.expectedKeywords || [],
        questionIndex: i,
        proctorLogs: []
      })
    });
    const subData = await subRes.json();
    console.log(`  -> Q${i + 1} Result: Score=${subData.questionScore}/10 | Feedback="${subData.questionFeedback}" | FollowUpInserted=${subData.followUpInserted || false}`);

    if (subData.updatedQuestions) {
      questions = subData.updatedQuestions;
    }

    if (subData.finished) {
      console.log('[4/4 Session Finished & Evaluated OK!]');
      console.log('Final Report Score:', subData.session.feedback.score, '/ 100');
      console.log('Strengths:', subData.session.feedback.strengths);
      console.log('Weaknesses:', subData.session.feedback.weaknesses);
      console.log('Improvement Tips:', subData.session.feedback.improvementTips);
      break;
    }

    await delay(2000); // 2s cooldown between Groq API calls to stay within rate limits
  }

  // Database verification
  const savedSession = await InterviewSession.findById(sessionId);
  console.log('\n=== MONGODB PERSISTENCE VERIFICATION ===');
  console.log('Saved Session ID:', savedSession._id);
  console.log('Saved Questions Count:', savedSession.questions.length);
  console.log('Saved Transcript Length:', savedSession.transcript.length);
  console.log('Saved Report Score:', savedSession.feedback?.score);
  console.log('Saved Improvement Tips:', savedSession.feedback?.improvementTips);

  await mongoose.disconnect();
  console.log('\n=== VERIFICATION COMPLETE ===');
  process.exit(0);
}

runQuickTest().catch(err => {
  console.error('Test error:', err);
  process.exit(1);
});
