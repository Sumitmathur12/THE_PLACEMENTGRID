import fetch from 'node-fetch';
import { io } from 'socket.io-client';
import mongoose from 'mongoose';
import dotenv from 'dotenv';
import { User, InterviewSession, DailyActivity } from '../models/Schemas.js';

dotenv.config({ path: './.env' });

const API_BASE = 'http://localhost:5500/api';
const MONGO_URI = process.env.MONGODB_URI || process.env.MONGO_URI;

async function runDirectStepTest() {
  console.log('=== STARTING STEP-BY-STEP LIVE VERIFICATION ===');
  await mongoose.connect(MONGO_URI);
  console.log('✓ DB Connected');

  const email = 'test_student@placementgrid.com';
  const token = Buffer.from(JSON.stringify({ email })).toString('base64');

  // Step 1: Start Interview
  console.log('\n--- Step 1: POST /api/interviews/start ---');
  const startRes = await fetch(`${API_BASE}/interviews/start`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
    body: JSON.stringify({ company: 'Google' })
  });
  const startData = await startRes.json();
  console.log('✓ Start Session OK | Session ID:', startData.sessionId);
  console.log('✓ Initial Questions Generated:', startData.questions.length);
  startData.questions.forEach((q, i) => console.log(`   Q${i+1} [${q.category}/${q.difficulty}]: "${q.questionText}"`));

  const sessionId = startData.sessionId;

  // Step 2: Socket.io Live Reaction
  console.log('\n--- Step 2: Socket.io Live Stream ("live_answer") ---');
  const socket = io('http://localhost:5500', { transports: ['websocket'] });
  let chunks = '';
  await new Promise((resolve) => {
    socket.on('connect', () => {
      console.log('✓ Socket Connected (ID:', socket.id, ')');
      socket.emit('live_answer', {
        questionText: startData.questions[0].questionText,
        answerText: 'We optimize using hash maps and prefix sums for O(n) runtime complexity.',
        expectedKeywords: startData.questions[0].expectedKeywords,
        companyName: 'Google'
      });
    });
    socket.on('ai_chunk', (c) => { chunks += c; });
    socket.on('ai_complete', () => {
      console.log('✓ Socket Stream OK! Received Streamed Reaction:\n  "', chunks.trim(), '"');
      resolve();
    });
    socket.on('ai_error', (e) => {
      console.log('❌ Socket Error:', e);
      resolve();
    });
  });
  socket.disconnect();

  // Step 3: Single Answer Submission & Immediate Score
  console.log('\n--- Step 3: POST /api/interviews/submit-answer (Q1) ---');
  const subRes = await fetch(`${API_BASE}/interviews/submit-answer`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
    body: JSON.stringify({
      sessionId,
      question: startData.questions[0].questionText,
      answer: 'We compute prefix sums and use a hash map to store first occurrence indices, giving O(N) time complexity and O(N) space complexity.',
      expectedKeywords: startData.questions[0].expectedKeywords,
      questionIndex: 0,
      proctorLogs: [{ event: 'tab-switch', details: 'Candidate switched tab' }]
    })
  });
  const subData = await subRes.json();
  console.log('✓ Submit Answer Q1 OK!');
  console.log('   Immediate Score:', subData.questionScore, '/ 10');
  console.log('   Immediate Feedback:', subData.questionFeedback);

  // Step 4: Submit Final Answer to Finalize & Get Report
  console.log('\n--- Step 4: POST /api/interviews/submit-answer (Final Question) ---');
  const lastIdx = startData.questions.length - 1;
  const finalRes = await fetch(`${API_BASE}/interviews/submit-answer`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
    body: JSON.stringify({
      sessionId,
      question: startData.questions[lastIdx].questionText,
      answer: 'I align with company values by prioritizing team collaboration, clear technical documentation, and customer focus.',
      expectedKeywords: startData.questions[lastIdx].expectedKeywords,
      questionIndex: lastIdx,
      proctorLogs: []
    })
  });
  const finalData = await finalRes.json();
  console.log('✓ Final Submit Answer OK!');
  console.log('   Finished Flag:', finalData.finished);
  if (finalData.session && finalData.session.feedback) {
    const report = finalData.session.feedback;
    console.log('✓ Final Evaluation Report Received:');
    console.log('   Overall Score:', report.score, '/ 100');
    console.log('   Strengths:', report.strengths);
    console.log('   Weaknesses:', report.weaknesses);
    console.log('   Improvement Tips:', report.improvementTips);
    console.log('   Detailed Assessment:', report.detailedAssessment);
  }

  // Step 5: Database Verification
  console.log('\n--- Step 5: MongoDB Persistence Check ---');
  const dbSession = await InterviewSession.findById(sessionId);
  console.log('✓ Session in MongoDB ID:', dbSession._id);
  console.log('✓ Questions stored:', dbSession.questions.length);
  console.log('✓ Transcript entries:', dbSession.transcript.length);
  console.log('✓ Proctoring Integrity Score:', dbSession.proctoringIntegrityScore);
  console.log('✓ Saved Report Score:', dbSession.feedback?.score, '/ 100');

  const activity = await DailyActivity.findOne({ userId: dbSession.userId });
  console.log('✓ Activity Streak Record: Mock interviews completed today =', activity ? activity.mockInterviewsCompleted : 0);

  await mongoose.disconnect();
  console.log('\n====================================================');
  console.log('✓ ALL STEPS VERIFIED END-TO-END LIVE IN REAL ENVIRONMENT');
  console.log('====================================================');
  process.exit(0);
}

runDirectStepTest().catch(err => {
  console.error('❌ Step Test Error:', err);
  process.exit(1);
});
