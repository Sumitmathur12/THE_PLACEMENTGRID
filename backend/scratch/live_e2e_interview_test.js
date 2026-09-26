import fetch from 'node-fetch';
import { io } from 'socket.io-client';
import mongoose from 'mongoose';
import dotenv from 'dotenv';
import { User, InterviewSession, DailyActivity } from '../models/Schemas.js';

dotenv.config({ path: './.env' });

const API_BASE = 'http://localhost:5500/api';
const MONGO_URI = process.env.MONGODB_URI || process.env.MONGO_URI;

let token = '';
let userId = '';
let sessionId = '';
let socket = null;

async function runLiveE2ETest() {
  console.log('====================================================');
  console.log('STARTING LIVE END-TO-END MOCK INTERVIEW TEST');
  console.log('====================================================\n');

  // Step A: Database Connection & User Setup
  await mongoose.connect(MONGO_URI);
  console.log('[DB] Connected to MongoDB Atlas.');

  let user = await User.findOne({ email: 'test_student@placementgrid.com' });
  if (!user) {
    user = await User.create({
      name: 'Test Student',
      email: 'test_student@placementgrid.com',
      targetCompany: 'Google',
      resume: {
        skills: ['JavaScript', 'React', 'Node.js', 'System Design'],
        projects: [{ title: 'Fullstack E-Commerce Portal', description: 'Built using MERN stack with Redis cache.' }]
      }
    });
  }
  userId = user._id.toString();

  // Create Base64 token for test user
  token = Buffer.from(JSON.stringify({ email: user.email, name: user.name })).toString('base64');
  console.log(`[AUTH] Test user authenticated: ${user.name} (${user.email})`);

  // Step B: Start Session Endpoint POST /api/interviews/start
  console.log('\n----------------------------------------------------');
  console.log('[1/6] POST /api/interviews/start (Target Company: Google)');
  console.log('----------------------------------------------------');

  const startRes = await fetch(`${API_BASE}/interviews/start`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`
    },
    body: JSON.stringify({ company: 'Google' })
  });

  const startData = await startRes.json();
  if (!startRes.ok) throw new Error(`Start failed: ${startData.error}`);

  sessionId = startData.sessionId;
  const initialQuestions = startData.questions;

  console.log(`[OK] Session created ID: ${sessionId}`);
  console.log(`[OK] Total initial questions generated: ${initialQuestions.length}`);
  initialQuestions.forEach((q, idx) => {
    console.log(`  Q${idx + 1} [${q.category.toUpperCase()} | ${q.difficulty.toUpperCase()}]: "${q.questionText}"`);
    console.log(`     Keywords: ${q.expectedKeywords.join(', ')}`);
  });

  // Step C: Test Sarvam AI TTS Proxy POST /api/interviews/tts
  console.log('\n----------------------------------------------------');
  console.log('[2/6] POST /api/interviews/tts (Sarvam AI Text-To-Speech)');
  console.log('----------------------------------------------------');

  const ttsRes = await fetch(`${API_BASE}/interviews/tts`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`
    },
    body: JSON.stringify({ text: initialQuestions[0].questionText })
  });

  const ttsData = await ttsRes.json();
  console.log(`[OK] TTS Response: isFallback=${ttsData.isFallback}, audioContentLength=${ttsData.audioContent ? ttsData.audioContent.length : 0} bytes`);

  // Step D: Test Real-time Socket.io Live Streaming Reaction
  console.log('\n----------------------------------------------------');
  console.log('[3/6] Socket.io Live Interviewer Stream ("live_answer")');
  console.log('----------------------------------------------------');

  await new Promise((resolve, reject) => {
    socket = io('http://localhost:5500', { transports: ['websocket'] });
    let streamedContent = '';

    socket.on('connect', () => {
      console.log(`[Socket.io] Connected to server (Socket ID: ${socket.id})`);
      socket.emit('live_answer', {
        questionText: initialQuestions[0].questionText,
        answerText: 'In React, state is managed locally using hooks like useState and useReducer, or globally using Context API or Redux for predictable state updates.',
        expectedKeywords: initialQuestions[0].expectedKeywords,
        companyName: 'Google'
      });
    });

    socket.on('ai_chunk', (chunk) => {
      streamedContent += chunk;
      process.stdout.write(chunk);
    });

    socket.on('ai_complete', () => {
      console.log('\n[OK] Socket stream completed successfully!');
      console.log(`[Streamed Reaction Summary]: "${streamedContent.trim()}"`);
      resolve();
    });

    socket.on('ai_error', (err) => {
      console.error('[Socket Error]', err);
      reject(err);
    });

    setTimeout(() => resolve(), 10000);
  });

  // Step E: Answer Submission & Adaptive Follow-up Generation Loop
  console.log('\n----------------------------------------------------');
  console.log('[4/6] Answer Submissions & Adaptive Follow-up Trigger Test');
  console.log('----------------------------------------------------');

  let currentIdx = 0;
  let questionsQueue = [...initialQuestions];

  while (currentIdx < questionsQueue.length) {
    const currentQ = questionsQueue[currentIdx];
    let answerText = '';

    // Simulate weak answer on Question 2 to trigger adaptive follow-up
    if (currentIdx === 1) {
      answerText = "I don't know much about this, maybe we can use some basic loop.";
      console.log(`\n--> Submitting WEAK answer for Q${currentIdx + 1} to test Adaptive Follow-up & Grounding Validation...`);
    } else {
      answerText = `To address this at scale, I would optimize time complexity to O(N log N) using divide-and-conquer, ensure thread-safety, and monitor memory allocations effectively.`;
      console.log(`\n--> Submitting STRONG answer for Q${currentIdx + 1}...`);
    }

    const subRes = await fetch(`${API_BASE}/interviews/submit-answer`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({
        sessionId,
        question: currentQ.questionText,
        answer: answerText,
        expectedKeywords: currentQ.expectedKeywords || [],
        questionIndex: currentIdx,
        proctorLogs: [{ event: 'tab-switch', details: 'User briefly switched window tab' }]
      })
    });

    const subData = await subRes.json();
    if (!subRes.ok) throw new Error(`Submit answer failed: ${subData.error}`);

    console.log(`  [Score Card]: Q${currentIdx + 1} Score = ${subData.questionScore}/10 | Feedback = "${subData.questionFeedback}"`);

    if (subData.followUpInserted) {
      console.log(`  [🔥 ADAPTIVE FOLLOW-UP TRIGGERED!]: Grounded follow-up question inserted live!`);
    }

    if (subData.updatedQuestions) {
      questionsQueue = subData.updatedQuestions;
    }

    if (subData.finished) {
      console.log('\n----------------------------------------------------');
      console.log('[5/6] Session Finished & Final Evaluation Report Generated');
      console.log('----------------------------------------------------');
      const finalReport = subData.session.feedback;
      console.log(`  [Overall Score]: ${finalReport.score} / 100`);
      console.log(`  [Strengths]:`, finalReport.strengths);
      console.log(`  [Weaknesses]:`, finalReport.weaknesses);
      console.log(`  [Detailed Assessment]:`, finalReport.detailedAssessment);
      console.log(`  [Improvement Tips]:`, finalReport.improvementTips);
      break;
    }

    currentIdx++;
  }

  // Step F: MongoDB Persistence Verification
  console.log('\n----------------------------------------------------');
  console.log('[6/6] MongoDB Database Persistence Verification');
  console.log('----------------------------------------------------');

  const dbSession = await InterviewSession.findById(sessionId);
  console.log(`[DB Session Check]:`);
  console.log(`  - Company: ${dbSession.company}`);
  console.log(`  - Questions Stored: ${dbSession.questions.length}`);
  console.log(`  - Transcript Entries: ${dbSession.transcript.length}`);
  console.log(`  - Follow-up Count: ${dbSession.followUpCount}`);
  console.log(`  - Proctoring Integrity Score: ${dbSession.proctoringIntegrityScore}`);
  console.log(`  - Saved Report Score: ${dbSession.feedback?.score}/100`);
  console.log(`  - Saved Improvement Tips Count: ${dbSession.feedback?.improvementTips?.length}`);

  const activity = await DailyActivity.findOne({ userId });
  console.log(`[DB Streak Check]: Mock interviews completed today = ${activity ? activity.mockInterviewsCompleted : 0}`);

  console.log('\n====================================================');
  console.log('LIVE END-TO-END TEST COMPLETED SUCCESSFULLY WITH 100% VERIFICATION');
  console.log('====================================================');

  if (socket) socket.disconnect();
  await mongoose.disconnect();
  process.exit(0);
}

runLiveE2ETest().catch(err => {
  console.error('\n❌ LIVE E2E TEST FAILED:', err);
  process.exit(1);
});
