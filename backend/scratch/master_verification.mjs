import fetch from 'node-fetch';
import { io } from 'socket.io-client';
import mongoose from 'mongoose';
import dotenv from 'dotenv';
import { InterviewSession, DailyActivity, User } from '../models/Schemas.js';

dotenv.config({ path: './.env' });

const API_BASE = 'http://localhost:5500/api';
const SOCKET_URL = 'http://localhost:5500';
const MONGO_URI = process.env.MONGODB_URI || process.env.MONGO_URI;

const email = 'master_student@placementgrid.com';
const token = Buffer.from(JSON.stringify({ email })).toString('base64');
const authHeaders = () => ({ 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` });
const sleep = ms => new Promise(r => setTimeout(r, ms));

const audit = [];
function logCheck(id, description, passed, details) {
  const status = passed ? 'PASS' : 'FAIL';
  console.log(`[${status}] [${id}] ${description} -> ${details}`);
  audit.push({ id, description, passed, details });
}

async function runMasterAudit() {
  console.log('================================================================');
  console.log('       THE_PLACEMENTGRID MOCK INTERVIEW MASTER VERIFICATION     ');
  console.log('================================================================\n');

  // 0. Connect to MongoDB
  await mongoose.connect(MONGO_URI);
  logCheck('DB_CONNECT', 'MongoDB Atlas Connection', mongoose.connection.readyState === 1, `Host: ${mongoose.connection.host}`);

  // Setup test user with candidate profile (resume skills & projects)
  let testUser = await User.findOne({ email });
  if (!testUser) {
    testUser = await User.create({
      name: 'Master Candidate',
      email,
      collegeName: 'IIT Delhi',
      branch: 'Computer Science',
      rollNumber: 'CS2026-001',
      targetCompany: 'Google',
      resume: {
        skills: ['JavaScript', 'React', 'Node.js', 'MongoDB', 'System Design', 'Algorithms'],
        projects: [
          { title: 'Distributed Cache System', description: 'Built an in-memory LRU cache with Redis and Node.js' },
          { title: 'Real-time Chat App', description: 'WebSockets based scalable chat with MongoDB persistence' }
        ]
      }
    });
  } else {
    testUser.resume = {
      skills: ['JavaScript', 'React', 'Node.js', 'MongoDB', 'System Design', 'Algorithms'],
      projects: [
        { title: 'Distributed Cache System', description: 'Built an in-memory LRU cache with Redis and Node.js' }
      ]
    };
    await testUser.save();
  }
  logCheck('USER_SETUP', 'Candidate profile with resume & skills', !!testUser._id, `User: ${testUser.name} (${testUser.email})`);

  // 1. TTS with Sarvam AI
  console.log('\n--- 1. Sarvam AI Text-to-Speech (bulbul:v3, ritu) ---');
  try {
    const ttsRes = await fetch(`${API_BASE}/interviews/tts`, {
      method: 'POST',
      headers: authHeaders(),
      body: JSON.stringify({
        text: 'Welcome to your Google technical interview. We will focus on data structures, system design, and your past engineering projects.',
        speaker: 'ritu'
      })
    });
    const ttsData = await ttsRes.json();
    const isOk = ttsRes.ok && !ttsData.isFallback && !!ttsData.audioContent;
    const audioLen = ttsData.audioContent ? Buffer.from(ttsData.audioContent, 'base64').length : 0;
    logCheck('SARVAM_TTS', 'Sarvam AI TTS generation', isOk && audioLen > 20000, `Audio: ${audioLen} bytes, isFallback: ${ttsData.isFallback}`);
  } catch (e) {
    logCheck('SARVAM_TTS', 'Sarvam AI TTS generation', false, e.message);
  }

  // 2. Start Interview Session
  console.log('\n--- 2. Start Interview Session (Grounding + Profile + RAG) ---');
  let sessionId, questions;
  try {
    const startRes = await fetch(`${API_BASE}/interviews/start`, {
      method: 'POST',
      headers: authHeaders(),
      body: JSON.stringify({ company: 'Google' })
    });
    const startData = await startRes.json();
    sessionId = startData.sessionId;
    questions = startData.questions;
    const countOk = questions && questions.length === 5;
    logCheck('SESSION_START', 'Interview session creation', !!sessionId, `Session ID: ${sessionId}`);
    logCheck('QUESTION_COUNT', '5 structured questions generated', countOk, `Count: ${questions?.length}`);
    
    // Check question categories & grounding
    const hasTechnical = questions.some(q => q.category === 'technical');
    const hasBehavioral = questions.some(q => q.category === 'behavioral');
    logCheck('QUESTION_TYPES', 'Technical & Behavioral question distribution', hasTechnical && hasBehavioral, `Technical: ${questions.filter(q=>q.category==='technical').length}, Behavioral: ${questions.filter(q=>q.category==='behavioral').length}`);

    questions.forEach((q, idx) => {
      console.log(`   Q${idx+1} [${q.category.toUpperCase()} | ${q.difficulty.toUpperCase()}]: "${q.questionText}"`);
      console.log(`        Keywords: ${(q.expectedKeywords || []).join(', ')}`);
    });
  } catch (e) {
    logCheck('SESSION_START', 'Interview session creation', false, e.message);
    process.exit(1);
  }

  // 3. Socket.io Live Streaming Reaction
  console.log('\n--- 3. Socket.io Live Interviewer Streaming Reaction ---');
  let socketReaction = '';
  try {
    const sock = io(SOCKET_URL, { transports: ['websocket'], timeout: 15000 });
    await new Promise((resolve) => {
      sock.on('connect', () => {
        sock.emit('live_answer', {
          questionText: questions[0].questionText,
          answerText: 'I would design an LRU cache using a doubly linked list combined with a hash map to achieve O(1) get and put operations.',
          expectedKeywords: questions[0].expectedKeywords,
          companyName: 'Google'
        });
      });
      sock.on('ai_chunk', (chunk) => {
        socketReaction += chunk;
      });
      sock.on('ai_complete', () => {
        sock.disconnect();
        resolve();
      });
      sock.on('ai_error', (err) => {
        sock.disconnect();
        resolve();
      });
    });
    const reactionOk = socketReaction.trim().length > 10;
    logCheck('SOCKET_STREAM', 'Socket.io live_answer -> ai_chunk -> ai_complete', reactionOk, `Reaction (${socketReaction.length} chars): "${socketReaction.trim().substring(0, 100)}..."`);
  } catch (e) {
    logCheck('SOCKET_STREAM', 'Socket.io live_answer streaming', false, e.message);
  }

  await sleep(1500);

  // 4. Progressive Q&A Submission with Immediate Scoring and Proctoring Logs
  console.log('\n--- 4. Progressive Per-Question Answer Evaluation & Proctoring ---');
  
  // Submit Q1 with strong answer
  const q1Res = await fetch(`${API_BASE}/interviews/submit-answer`, {
    method: 'POST',
    headers: authHeaders(),
    body: JSON.stringify({
      sessionId,
      question: questions[0].questionText,
      answer: 'We utilize a hash map for O(1) key-to-node lookups and a doubly linked list to maintain node order for O(1) eviction of the least recently used element.',
      expectedKeywords: questions[0].expectedKeywords,
      questionIndex: 0,
      proctorLogs: [{ event: 'tab-switch', details: 'Candidate switched browser tab once' }]
    })
  });
  const q1Data = await q1Res.json();
  const q1ScoreOk = typeof q1Data.questionScore === 'number' && q1Data.questionScore >= 0 && q1Data.questionScore <= 10;
  logCheck('PROGRESSIVE_EVAL_Q1', 'Immediate score (0-10) and feedback returned', q1ScoreOk && !!q1Data.questionFeedback, `Score: ${q1Data.questionScore}/10 | Feedback: "${q1Data.questionFeedback?.substring(0, 70)}..."`);
  
  // If questions were updated by follow-up, refresh questions array
  if (q1Data.updatedQuestions) questions = q1Data.updatedQuestions;

  await sleep(1500);

  // Submit Q2 with weak answer to test adaptive follow-up triggering
  console.log('\n--- 5. Adaptive Follow-Up Question Logic (Weak Answer Trigger) ---');
  const q2Res = await fetch(`${API_BASE}/interviews/submit-answer`, {
    method: 'POST',
    headers: authHeaders(),
    body: JSON.stringify({
      sessionId,
      question: questions[1].questionText,
      answer: 'I do not know much about this, maybe just use a simple loop.',
      expectedKeywords: questions[1].expectedKeywords,
      questionIndex: 1,
      proctorLogs: []
    })
  });
  const q2Data = await q2Res.json();
  const q2ScoreOk = typeof q2Data.questionScore === 'number' && q2Data.questionScore < 6;
  logCheck('WEAK_ANSWER_EVAL', 'Low score correctly assigned to weak answer (<6)', q2ScoreOk, `Score: ${q2Data.questionScore}/10 | Feedback: "${q2Data.questionFeedback?.substring(0, 60)}..."`);
  logCheck('FOLLOW_UP_INTEGRITY', 'Follow-up evaluation processed with grounding protection', q2Data.followUpInserted !== undefined, `followUpInserted: ${q2Data.followUpInserted}`);
  
  if (q2Data.updatedQuestions) questions = q2Data.updatedQuestions;

  await sleep(1500);

  // Submit remaining intermediate questions until last
  for (let i = 2; i < questions.length - 1; i++) {
    const interRes = await fetch(`${API_BASE}/interviews/submit-answer`, {
      method: 'POST',
      headers: authHeaders(),
      body: JSON.stringify({
        sessionId,
        question: questions[i].questionText,
        answer: 'In my experience building scalable architectures, I ensure proper separation of concerns, modular interfaces, and comprehensive unit tests.',
        expectedKeywords: questions[i].expectedKeywords,
        questionIndex: i,
        proctorLogs: []
      })
    });
    const interData = await interRes.json();
    if (interData.updatedQuestions) questions = interData.updatedQuestions;
    await sleep(1000);
  }

  // 6. Submit Final Question to trigger complete Final Report
  console.log('\n--- 6. Session Finalization & Comprehensive Final Report ---');
  const lastIndex = questions.length - 1;
  const finalRes = await fetch(`${API_BASE}/interviews/submit-answer`, {
    method: 'POST',
    headers: authHeaders(),
    body: JSON.stringify({
      sessionId,
      question: questions[lastIndex].questionText,
      answer: 'When facing tight deadlines or ambiguity, I communicate transparently with stakeholders, prioritize ruthlessly using MVP principles, and maintain high standards for system reliability and team collaboration.',
      expectedKeywords: questions[lastIndex].expectedKeywords,
      questionIndex: lastIndex,
      proctorLogs: []
    })
  });
  const finalData = await finalRes.json();
  const finishedOk = finalData.finished === true;
  const report = finalData.session?.feedback;
  const reportOk = report && typeof report.score === 'number' && report.score >= 0 && report.score <= 100;
  const hasStrengths = Array.isArray(report?.strengths) && report.strengths.length > 0;
  const hasWeaknesses = Array.isArray(report?.weaknesses) && report.weaknesses.length > 0;
  const hasTips = Array.isArray(report?.improvementTips) && report.improvementTips.length > 0;
  
  logCheck('SESSION_FINISHED', 'Session marked as finished on final question', finishedOk, `finished: ${finalData.finished}`);
  logCheck('FINAL_REPORT_SCORE', 'Final report score on 0-100 scale', reportOk, `Score: ${report?.score}/100`);
  logCheck('FINAL_REPORT_STRENGTHS', 'Final report includes key strengths', hasStrengths, `Count: ${report?.strengths?.length}`);
  logCheck('FINAL_REPORT_WEAKNESSES', 'Final report includes weaknesses/gaps', hasWeaknesses, `Count: ${report?.weaknesses?.length}`);
  logCheck('FINAL_REPORT_TIPS', 'Final report includes actionable improvement tips', hasTips, `Count: ${report?.improvementTips?.length}`);

  // 7. Check MongoDB Session Document Persistence
  console.log('\n--- 7. MongoDB Persistence & Integrity Verification ---');
  const dbSession = await InterviewSession.findById(sessionId);
  logCheck('MONGO_SESSION_FOUND', 'Session document persisted in MongoDB', !!dbSession, `ID: ${dbSession?._id}`);
  logCheck('MONGO_QUESTIONS', 'Questions array persisted in session document', dbSession?.questions?.length >= 5, `Total Qs: ${dbSession?.questions?.length}`);
  logCheck('MONGO_TRANSCRIPT', 'Full transcript persisted with scores & feedback', dbSession?.transcript?.length > 0, `Entries: ${dbSession?.transcript?.length}`);
  logCheck('MONGO_GROUNDING_CONTEXT', 'Grounding context cached in document', (dbSession?.groundingContext || '').length > 100, `Length: ${dbSession?.groundingContext?.length} chars`);
  logCheck('MONGO_PROCTORING_SCORE', 'Proctoring integrity score deducted for violations (100 -> 85)', dbSession?.proctoringIntegrityScore === 85, `Score: ${dbSession?.proctoringIntegrityScore} (deducted 15 for tab-switch)`);
  logCheck('MONGO_FEEDBACK_PERSISTED', 'Final feedback persisted in document', dbSession?.feedback?.score === report?.score, `Persisted Score: ${dbSession?.feedback?.score}`);

  // 8. Genuine Activity & Streak Logging
  console.log('\n--- 8. Daily Activity & Streak Verification ---');
  const activity = await DailyActivity.findOne({ userId: testUser._id });
  logCheck('ACTIVITY_STREAK', 'Interview activity recorded in DailyActivity', activity && activity.mockInterviewsCompleted >= 1, `mockInterviewsCompleted: ${activity?.mockInterviewsCompleted}`);

  // 9. Session History API
  console.log('\n--- 9. Session History API (/api/interviews/history) ---');
  const histRes = await fetch(`${API_BASE}/interviews/history`, {
    headers: authHeaders()
  });
  const histData = await histRes.json();
  const histFound = Array.isArray(histData) && histData.some(s => s._id === sessionId);
  logCheck('SESSION_HISTORY_API', 'Completed session appears in user history', histFound, `History count: ${histData.length}`);

  // Summary
  console.log('\n================================================================');
  console.log('                      AUDIT SUMMARY RESULTS                    ');
  console.log('================================================================');
  const total = audit.length;
  const passed = audit.filter(a => a.passed).length;
  const failed = audit.filter(a => !a.passed).length;
  console.log(`Total Checks: ${total} | PASSED: ${passed} | FAILED: ${failed}`);
  
  audit.forEach(a => {
    console.log(`  ${a.passed ? '✅' : '❌'} [${a.id}] ${a.description}: ${a.details}`);
  });

  await mongoose.disconnect();
  process.exit(failed === 0 ? 0 : 1);
}

runMasterAudit().catch(err => {
  console.error('\nMaster Audit Fatal Error:', err);
  process.exit(1);
});
