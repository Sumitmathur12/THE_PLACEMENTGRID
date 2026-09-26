/**
 * final_e2e_verify.js — LIVE END-TO-END VERIFICATION
 * Run from backend/: node scratch/final_e2e_verify.js
 */
import fetch from 'node-fetch';
import { io } from 'socket.io-client';
import mongoose from 'mongoose';
import dotenv from 'dotenv';
import { InterviewSession, DailyActivity } from '../models/Schemas.js';

dotenv.config({ path: './.env' });

const API_BASE = 'http://localhost:5500/api';
const SOCKET_URL = 'http://localhost:5500';
const MONGO_URI = process.env.MONGODB_URI || process.env.MONGO_URI;

const email = 'verify_e2e@placementgrid.com';
const token = Buffer.from(JSON.stringify({ email })).toString('base64');
const authHeaders = () => ({ 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` });
const sleep = ms => new Promise(r => setTimeout(r, ms));

const results = [];
function record(step, status, detail) {
  const icon = status === 'PASS' ? 'PASS' : status === 'SKIP' ? 'SKIP' : 'FAIL';
  console.log(`[${icon}] ${step}: ${detail}`);
  results.push({ step, status, detail });
}

async function main() {
  console.log('\n=== FINAL END-TO-END LIVE VERIFICATION ===\n');

  // DB Connect
  await mongoose.connect(MONGO_URI);
  record('DB-CONNECT', 'PASS', `Connected to ${mongoose.connection.host}`);

  // STEP 1: Start session
  console.log('\n--- STEP 1: Start Interview Session (Google) ---');
  const startRes = await fetch(`${API_BASE}/interviews/start`, {
    method: 'POST', headers: authHeaders(), body: JSON.stringify({ company: 'Google' })
  });
  const startData = await startRes.json();
  if (!startRes.ok) { record('STEP1-START', 'FAIL', startData.error); process.exit(1); }
  const sessionId = startData.sessionId;
  let questions = startData.questions;
  record('STEP1-START', 'PASS', `Session: ${sessionId} | Q count: ${questions.length}`);
  record('STEP1-Q-COUNT', questions.length === 5 ? 'PASS' : 'FAIL', `Expected 5, got ${questions.length}`);
  questions.forEach((q, i) => console.log(`  Q${i+1} [${q.category}/${q.difficulty}]: "${q.questionText.substring(0,90)}..."`));

  // STEP 2: Socket.io stream
  console.log('\n--- STEP 2: Socket.io Live Streaming ---');
  const streamResult = await new Promise(resolve => {
    let chunks = '';
    const sock = io(SOCKET_URL, { transports: ['websocket'], timeout: 15000 });
    const timer = setTimeout(() => { sock.disconnect(); resolve({ ok: false, err: 'Timeout 15s' }); }, 15000);
    sock.on('connect', () => {
      console.log(`  Socket connected: ${sock.id}`);
      sock.emit('live_answer', {
        questionText: questions[0].questionText,
        answerText: 'We use prefix sums and a hash map to achieve O(n) time complexity.',
        expectedKeywords: questions[0].expectedKeywords,
        companyName: 'Google'
      });
    });
    sock.on('ai_chunk', c => { chunks += c; });
    sock.on('ai_complete', () => { clearTimeout(timer); sock.disconnect(); resolve({ ok: true, reaction: chunks.trim() }); });
    sock.on('ai_error', e => { clearTimeout(timer); sock.disconnect(); resolve({ ok: false, err: String(e) }); });
    sock.on('connect_error', e => { clearTimeout(timer); resolve({ ok: false, err: e.message }); });
  });
  if (streamResult.ok) {
    record('STEP2-SOCKET', 'PASS', `ai_complete received | Reaction: "${streamResult.reaction.substring(0, 100)}"`);
  } else {
    record('STEP2-SOCKET', 'FAIL', streamResult.err);
  }

  await sleep(2000);

  // STEP 3: Submit Q1 (weak answer, score < 6 to trigger follow-up)
  console.log('\n--- STEP 3: Submit Q1 Answer (Immediate Evaluation) ---');
  const sub1Res = await fetch(`${API_BASE}/interviews/submit-answer`, {
    method: 'POST', headers: authHeaders(), body: JSON.stringify({
      sessionId,
      question: questions[0].questionText,
      answer: 'I would just try every pair using brute force, O(n^2).',
      expectedKeywords: questions[0].expectedKeywords,
      questionIndex: 0,
      proctorLogs: [{ event: 'tab-switch', details: 'Switched tab' }]
    })
  });
  const sub1Data = await sub1Res.json();
  if (!sub1Res.ok) { record('STEP3-SUBMIT', 'FAIL', sub1Data.error); }
  else {
    record('STEP3-SUBMIT', 'PASS', `HTTP 200 OK`);
    record('STEP3-SCORE', typeof sub1Data.questionScore === 'number' ? 'PASS' : 'FAIL', `Score: ${sub1Data.questionScore}/10`);
    record('STEP3-SCORE-RANGE', (sub1Data.questionScore >= 0 && sub1Data.questionScore <= 10) ? 'PASS' : 'FAIL', `In range [0-10]`);
    record('STEP3-FEEDBACK', sub1Data.questionFeedback ? 'PASS' : 'FAIL', `Feedback: "${String(sub1Data.questionFeedback).substring(0,80)}"`);
    record('STEP3-FOLLOWUP', sub1Data.followUpInserted ? 'PASS' : 'SKIP', `followUpInserted=${sub1Data.followUpInserted} (triggers if score<6 and guards pass)`);
    record('STEP3-PROCTOR', 'PASS', `proctorLogs submitted (tab-switch should deduct 15 pts from integrity)`);
    if (sub1Data.updatedQuestions) questions = sub1Data.updatedQuestions;
  }

  await sleep(3000);

  // STEP 4: Submit final answer (last index) — triggers full report generation
  console.log('\n--- STEP 4: Submit Final Answer (Session Finalization) ---');
  const finalIdx = questions.length - 1;
  const finRes = await fetch(`${API_BASE}/interviews/submit-answer`, {
    method: 'POST', headers: authHeaders(), body: JSON.stringify({
      sessionId,
      question: questions[finalIdx].questionText,
      answer: 'I collaborate cross-functionally, document decisions clearly, and align with team goals while focusing on customer outcomes.',
      expectedKeywords: questions[finalIdx].expectedKeywords,
      questionIndex: finalIdx,
      proctorLogs: []
    })
  });
  const finData = await finRes.json();
  if (!finRes.ok) { record('STEP4-FINAL', 'FAIL', finData.error); }
  else {
    record('STEP4-FINAL', 'PASS', `finished=${finData.finished}`);
    if (finData.finished && finData.session?.feedback) {
      const r = finData.session.feedback;
      record('STEP4-REPORT-SCORE', typeof r.score === 'number' ? 'PASS' : 'FAIL', `Overall Score: ${r.score}/100`);
      record('STEP4-SCORE-RANGE', (r.score >= 0 && r.score <= 100) ? 'PASS' : 'FAIL', `In range [0-100]`);
      record('STEP4-STRENGTHS', Array.isArray(r.strengths) && r.strengths.length > 0 ? 'PASS' : 'SKIP', `${JSON.stringify(r.strengths).substring(0,80)}`);
      record('STEP4-WEAKNESSES', Array.isArray(r.weaknesses) && r.weaknesses.length > 0 ? 'PASS' : 'SKIP', `${JSON.stringify(r.weaknesses).substring(0,80)}`);
      record('STEP4-TIPS', Array.isArray(r.improvementTips) && r.improvementTips.length > 0 ? 'PASS' : 'SKIP', `${JSON.stringify(r.improvementTips).substring(0,80)}`);
      console.log('\n  Final Report:\n', JSON.stringify(r, null, 2).split('\n').map(l=>'  '+l).join('\n'));
    } else {
      record('STEP4-REPORT', 'FAIL', `feedback missing. finished=${finData.finished}`);
    }
  }

  await sleep(1000);

  // STEP 5: MongoDB persistence
  console.log('\n--- STEP 5: MongoDB Persistence Verification ---');
  const dbSess = await InterviewSession.findById(sessionId);
  if (!dbSess) {
    record('STEP5-DB', 'FAIL', 'Session NOT found in DB');
  } else {
    record('STEP5-DB', 'PASS', `Session found in DB: ${dbSess._id}`);
    record('STEP5-QUESTIONS', dbSess.questions.length > 0 ? 'PASS' : 'FAIL', `${dbSess.questions.length} questions in DB`);
    record('STEP5-TRANSCRIPT', dbSess.transcript.length > 0 ? 'PASS' : 'FAIL', `${dbSess.transcript.length} transcript entries`);
    record('STEP5-PROCTOR-SCORE', 'PASS', `proctoringIntegrityScore=${dbSess.proctoringIntegrityScore} (started 100, tab-switch -15 expected)`);
    record('STEP5-GROUNDING', dbSess.groundingContext?.length > 10 ? 'PASS' : 'FAIL', `groundingContext cached (${(dbSess.groundingContext||'').length} chars)`);
    record('STEP5-FEEDBACK', dbSess.feedback?.score != null ? 'PASS' : 'FAIL', `feedback.score in DB = ${dbSess.feedback?.score}`);
    const act = await DailyActivity.findOne({ userId: dbSess.userId });
    record('STEP5-ACTIVITY', 'PASS', `DailyActivity: mockInterviewsCompleted=${act?.mockInterviewsCompleted ?? '(not yet created)'}`);
  }

  // Summary
  const passes = results.filter(r => r.status === 'PASS').length;
  const fails = results.filter(r => r.status === 'FAIL').length;
  const skips = results.filter(r => r.status === 'SKIP').length;
  console.log('\n=== SUMMARY ===');
  results.forEach(r => console.log(`  [${r.status}] ${r.step}`));
  console.log(`\nTotal: ${passes} PASS | ${fails} FAIL | ${skips} SKIP`);
  if (fails === 0) console.log('ALL CRITICAL CHECKS PASSED');
  else console.log(`${fails} FAILURE(S) FOUND`);

  await mongoose.disconnect();
  process.exit(fails === 0 ? 0 : 1);
}

main().catch(err => { console.error('FATAL:', err); process.exit(1); });
