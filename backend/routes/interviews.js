import express from 'express';
import fetch from 'node-fetch'; // Ensure fetch works or use standard node fetch (which is global in modern node)
import { InterviewSession, User } from '../models/Schemas.js';
import { getInterviewFeedback, ragRetrieve, generateLLMResponse, runWebSearch } from '../services/aiService.js';
import { requireAuth } from './auth.js';
import { logGenuineActivity } from '../services/activityService.js';

const router = express.Router();

// Start a Mock Interview Session
router.post('/start', requireAuth, async (req, res) => {
  const { company } = req.body;
  if (!company) {
    return res.status(400).json({ error: 'Company is required.' });
  }

  try {
    // Persist as Target Company
    const user = req.user;
    user.targetCompany = company;
    await user.save();

    const cleanCompany = company.replace(/_\d+$/, '');
    console.log(`MockInterview: Starting session. Querying live web search and local RAG for ${cleanCompany} questions...`);

    // 1. Retrieve local company context
    const localContext = await ragRetrieve(`${cleanCompany} technical HR interview questions patterns`, 3);
    
    // 2. Query Google Custom Search live for real coding & interview questions asked on Glassdoor/LeetCode
    let webContext = '';
    try {
      webContext = await runWebSearch(`${cleanCompany} real interview questions asked Glassdoor LeetCode discuss`);
    } catch (searchErr) {
      console.warn('MockInterview: Live Custom Search query bypassed:', searchErr.message);
    }

    // 3. Generate a custom list of 3 questions from context
    const systemPrompt = `You are a senior technical interviewer at ${company}. Generate exactly 3 highly realistic technical, coding, or behavioral questions that have actually been asked by ${company} in real interviews (based on the provided context). 
Only use concepts or questions relevant to the company. Never write introductory text. Output each question on a new line, numbered.`;
    
    const contextPrompt = `
Local Database Context: ${JSON.stringify(localContext.map(c => c.content))}
Web Search Live Context: ${webContext}

Generate the questions.`;

    const questionsText = await generateLLMResponse(systemPrompt, contextPrompt);
    
    // Parse questions
    const questions = questionsText
      .split('\n')
      .map(q => q.replace(/^\d+\.\s*/, '').trim())
      .filter(Boolean)
      .slice(0, 3);
    
    // Default fallback questions if LLM offline
    const finalQuestions = questions.length >= 3 ? questions : [
      `Explain a challenging project you built and how you handled database queries or state management.`,
      `How do you determine the Big-O time complexity of an algorithm? Can you explain with an example?`,
      `Why do you want to join ${company}, and how do you align with our core engineering values?`
    ];

    const session = await InterviewSession.create({
      userId: user._id,
      company,
      transcript: [],
      proctoringLogs: [],
      proctoringIntegrityScore: 100
    });

    return res.json({
      sessionId: session._id,
      questions: finalQuestions,
      firstQuestion: finalQuestions[0]
    });
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
});

// Proxy route for Sarvam AI Text-to-Speech
router.post('/tts', requireAuth, async (req, res) => {
  const { text } = req.body;
  if (!text) {
    return res.status(400).json({ error: 'Text is required.' });
  }

  const sarvamKey = process.env.SARVAM_API_KEY;
  if (!sarvamKey) {
    console.warn('Sarvam API key is missing. Returning fallback state.');
    return res.json({ audioContent: null, isFallback: true });
  }

  try {
    // Note: global fetch is available in modern Node.js environments (Node 18+)
    const response = await fetch('https://api.sarvam.ai/text-to-speech', {
      method: 'POST',
      headers: {
        'api-key': sarvamKey,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        inputs: [text],
        target_language_code: 'en-IN',
        speaker: 'bulbul',
        pitch: 0,
        pace: 1.0,
        loudness: 1.5,
        speech_had_laughter: false,
        model: 'bulbul:v1'
      })
    });

    if (!response.ok) {
      const errText = await response.text();
      throw new Error(`Sarvam TTS API returned ${response.status}: ${errText}`);
    }

    const data = await response.json();
    return res.json({ 
      audioContent: data.audio_content || data.audioContent || null, 
      isFallback: false 
    });
  } catch (err) {
    console.error('Sarvam TTS proxy execution failed:', err.message);
    return res.json({ audioContent: null, error: err.message, isFallback: true });
  }
});

// Submit answer & get next or finalize
router.post('/submit-answer', requireAuth, async (req, res) => {
  const { sessionId, question, answer, proctorLogs, isLast } = req.body;
  
  if (!sessionId || !question || answer === undefined) {
    return res.status(400).json({ error: 'SessionId, question, and answer are required.' });
  }

  try {
    const session = await InterviewSession.findById(sessionId);
    if (!session) {
      return res.status(404).json({ error: 'Interview session not found.' });
    }

    // Append to transcript
    session.transcript.push({ speaker: 'interviewer', text: question });
    session.transcript.push({ speaker: 'candidate', text: answer });

    // Append any proctor logs
    if (proctorLogs && Array.isArray(proctorLogs)) {
      proctorLogs.forEach(log => {
        session.proctoringLogs.push({
          event: log.event,
          details: log.details,
          timestamp: new Date()
        });
        
        // Deduct integrity score
        let deduction = 0;
        if (log.event === 'tab-switch') deduction = 15;
        if (log.event === 'copy-paste') deduction = 25;
        if (log.event === 'no-face') deduction = 10;
        if (log.event === 'multiple-faces') deduction = 20;
        
        session.proctoringIntegrityScore = Math.max(0, session.proctoringIntegrityScore - deduction);
      });
    }

    if (isLast) {
      // Evaluate session using RAG LLM feedback
      console.log(`Evaluating interview session ${sessionId}...`);
      const feedback = await getInterviewFeedback(session.transcript, session.company, session.proctoringLogs);
      
      session.feedback = {
        score: feedback.score,
        strengths: feedback.strengths || [],
        weaknesses: feedback.weaknesses || [],
        detailedAssessment: feedback.detailedAssessment || ''
      };

      await session.save();

      // Completing a full mock interview is a genuine, meaningful preparation
      // activity — counts toward the daily streak and Prep Score.
      try {
        await logGenuineActivity(session.userId, 'interview');
      } catch (activityErr) {
        console.error('Failed to log interview activity:', activityErr.message);
      }

      return res.json({ finished: true, session });
    }

    await session.save();
    return res.json({ finished: false });
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
});

// Retrieve interview session history for a student
router.get('/history', requireAuth, async (req, res) => {
  try {
    const sessions = await InterviewSession.find({ userId: req.user._id }).sort({ date: -1 });
    return res.json(sessions);
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
});

export default router;
