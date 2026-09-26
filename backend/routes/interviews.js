import express from 'express';
import multer from 'multer';
import { InterviewSession, User } from '../models/Schemas.js';
import {
  getInterviewFeedback, ragRetrieve, runWebSearch,
  generateStructuredInterviewQuestions, evaluateSingleAnswer,
  generateFollowUpQuestion, validateGrounding,
  parseJobDescription, verifyCompanyContext
} from '../services/aiService.js';
import { requireAuth } from './auth.js';
import { logGenuineActivity } from '../services/activityService.js';

const router = express.Router();

// Multer: in-memory storage for session resume uploads (PDF or DOCX only)
const resumeUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB max
  fileFilter: (req, file, cb) => {
    const allowed = [
      'application/pdf',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'application/msword'
    ];
    if (allowed.includes(file.mimetype) || file.originalname.match(/\.(pdf|docx|doc)$/i)) {
      cb(null, true);
    } else {
      cb(new Error('Only PDF and DOCX files are allowed.'));
    }
  }
});


// ============================================================================
// POST /api/interviews/parse-resume
// Parse a session-specific resume (PDF or DOCX) without overwriting user profile.
// ============================================================================
router.post('/parse-resume', requireAuth, resumeUpload.single('resume'), async (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: 'No file uploaded. Please upload a PDF or DOCX file.' });
  }
  try {
    const { buffer, originalname, mimetype } = req.file;
    let rawText = '';
    const ext = (originalname || '').toLowerCase().split('.').pop();
    const isPDF = mimetype === 'application/pdf' || ext === 'pdf';
    const isDOCX = mimetype === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' || ext === 'docx' || ext === 'doc';

    if (isPDF) {
      const pdfParse = (await import('pdf-parse')).default;
      const pdfData = await pdfParse(buffer);
      rawText = pdfData.text || '';
      console.log(`[ParseResume] PDF parsed — ${rawText.length} chars from "${originalname}"`);
    } else if (isDOCX) {
      const mammoth = (await import('mammoth')).default;
      const result = await mammoth.extractRawText({ buffer });
      rawText = result.value || '';
      console.log(`[ParseResume] DOCX parsed — ${rawText.length} chars from "${originalname}"`);
    } else {
      return res.status(400).json({ error: 'Unsupported file type. Upload PDF or DOCX.' });
    }

    if (!rawText || rawText.trim().length < 30) {
      return res.status(422).json({ error: 'File parsed but extracted text is too short.' });
    }

    const knownSkills = [
      'javascript', 'typescript', 'python', 'java', 'c++', 'c#', 'golang', 'rust', 'swift', 'kotlin',
      'react', 'vue', 'angular', 'next.js', 'nuxt', 'svelte', 'tailwind', 'redux',
      'node.js', 'express', 'fastapi', 'django', 'flask', 'spring boot', 'nestjs',
      'mongodb', 'postgresql', 'mysql', 'redis', 'elasticsearch', 'dynamodb', 'firebase',
      'docker', 'kubernetes', 'aws', 'gcp', 'azure', 'terraform', 'ci/cd', 'jenkins',
      'graphql', 'rest api', 'websockets', 'kafka', 'rabbitmq', 'microservices',
      'git', 'linux', 'bash', 'machine learning', 'deep learning', 'pytorch', 'tensorflow',
      'html', 'css', 'sass', 'webpack', 'vite'
    ];
    const lowerText = rawText.toLowerCase();
    const detectedSkills = knownSkills.filter(s => lowerText.includes(s));
    const projectMatches = rawText.match(/(?:Project[s]?|Built|Developed|Created)\s*[:\-]?\s*([A-Z][a-zA-Z0-9\s\-]{3,50})/g) || [];
    const projects = projectMatches.slice(0, 5).map(m => ({ title: m.trim(), description: '' }));
    const experienceMatch = rawText.match(/(intern|engineer|developer|analyst|senior|junior|lead|manager)[^\n]{0,100}/gi) || [];
    const experience = experienceMatch.slice(0, 4).map(e => ({ role: e.trim() }));

    return res.json({
      success: true,
      resumeContext: {
        originalName: originalname,
        fileType: isPDF ? 'pdf' : 'docx',
        skills: detectedSkills,
        projects,
        experience,
        education: [],
        parsedText: rawText.substring(0, 8000)
      },
      previewText: rawText.substring(0, 300),
      detectedSkillsCount: detectedSkills.length
    });
  } catch (err) {
    console.error('[ParseResume] error:', err.message);
    return res.status(500).json({ error: `Resume parsing failed: ${err.message}` });
  }
});

// ============================================================================
// POST /api/interviews/verify-company
// ============================================================================
router.post('/verify-company', requireAuth, async (req, res) => {
  const { companyName } = req.body;
  if (!companyName) return res.status(400).json({ error: 'companyName is required.' });
  try {
    const verification = await verifyCompanyContext(companyName);
    return res.json(verification);
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

// ============================================================================
// GET /api/interviews/session/:id  — Hydrate session state after page refresh
// ============================================================================
router.get('/session/:id', requireAuth, async (req, res) => {
  try {
    const session = await InterviewSession.findById(req.params.id);
    if (!session) return res.status(404).json({ error: 'Session not found.' });
    if (session.userId.toString() !== req.user._id.toString()) return res.status(403).json({ error: 'Access denied.' });
    return res.json({
      sessionId: session._id,
      status: session.status || 'in_progress',
      currentQuestionIndex: session.currentQuestionIndex || 0,
      questions: session.questions,
      transcript: session.transcript,
      company: session.company,
      jobTitle: session.jobTitle,
      experienceLevel: session.experienceLevel,
      companyVerification: session.companyVerification || null,
      resumeContext: session.resumeContext || null,
      proctoringIntegrityScore: session.proctoringIntegrityScore,
      feedback: session.feedback || null,
      totalQuestions: session.questions.length
    });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

// ============================================================================
// POST /api/interviews/tts — ElevenLabs TTS proxy (key never leaves server)
// ============================================================================
router.post('/tts', requireAuth, async (req, res) => {
  const { text } = req.body;
  if (!text) return res.status(400).json({ error: 'Text is required.' });

  const elevenKey = process.env.ELEVENLABS_API_KEY;
  const voiceId = process.env.ELEVENLABS_VOICE_ID || 'EXAVITQu4vr4xnSDxMaL';

  if (!elevenKey) {
    return res.json({ audioContent: null, isFallback: true, reason: 'tts_key_missing' });
  }

  try {
    const cleanText = text.substring(0, 2500).replace(/[<>]/g, '');
    const response = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${voiceId}`, {
      method: 'POST',
      headers: { 'Accept': 'audio/mpeg', 'xi-api-key': elevenKey, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        text: cleanText,
        model_id: 'eleven_multilingual_v2',
        voice_settings: { stability: 0.5, similarity_boost: 0.75 }
      })
    });

    if (!response.ok) {
      const errText = await response.text();
      console.error(`[TTS] ElevenLabs ${response.status}:`, errText.substring(0, 200));
      return res.json({ audioContent: null, isFallback: true, reason: `elevenlabs_${response.status}` });
    }

    const audioBuffer = await response.arrayBuffer();
    const base64Audio = Buffer.from(audioBuffer).toString('base64');
    console.log(`[TTS] OK — ${audioBuffer.byteLength} bytes for "${cleanText.substring(0, 40)}..."`);
    return res.json({ audioContent: base64Audio, isFallback: false, mimeType: 'audio/mpeg' });
  } catch (err) {
    console.error('[TTS] proxy error:', err.message);
    return res.json({ audioContent: null, isFallback: true, reason: 'elevenlabs_error' });
  }
});

// ============================================================================
// POST /api/interviews/proctor-log — Log a real-time proctor event mid-session
// ============================================================================
router.post('/proctor-log', requireAuth, async (req, res) => {
  const { sessionId, event, details } = req.body;
  if (!sessionId || !event) return res.status(400).json({ error: 'sessionId and event required.' });
  try {
    const session = await InterviewSession.findById(sessionId);
    if (!session || session.userId.toString() !== req.user._id.toString()) {
      return res.status(404).json({ error: 'Session not found or access denied.' });
    }
    const deductMap = { 'tab-switch': 15, 'copy-paste': 25, 'no-face': 10, 'multiple-faces': 20, 'silence': 5 };
    session.proctoringLogs.push({ event, details: details || '', timestamp: new Date() });
    session.proctoringIntegrityScore = Math.max(0, session.proctoringIntegrityScore - (deductMap[event] || 0));
    await session.save();
    return res.json({ success: true, integrityScore: session.proctoringIntegrityScore });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

// ============================================================================
// POST /api/interviews/start
// ============================================================================
router.post('/start', requireAuth, async (req, res) => {
  const {
    jobTitle = 'Software Engineer',
    company = 'General Tech',
    jobDescription = '',
    experienceLevel = 'mid',
    questionTypes = ['technical', 'behavioral'],
    numberOfQuestions = 5,
    resumeText = '',
    resumeContext = null
  } = req.body;

  try {
    const user = req.user;
    if (company && company !== 'General Tech') {
      user.targetCompany = company;
      await user.save();
    }

    const cleanCompany = (company || 'Tech Industry').replace(/_\d+$/, '');
    const count = Math.min(20, Math.max(3, parseInt(numberOfQuestions) || 5));
    console.log(`MockInterview: Starting "${jobTitle}" at ${cleanCompany} (${experienceLevel}, ${count}Q)...`);

    // Steps 1–6: All independent — run in parallel to cut wait time from ~6x sequential to ~1x
    console.log(`MockInterview: Running context-gathering steps in parallel...`);
    const [
      jdResult,
      companyResult,
      ragResult,
      webResult,
      pastResult
    ] = await Promise.allSettled([
      // 1. Parse JD
      parseJobDescription(jobDescription).catch(e => { console.warn('JD parse failed:', e.message); return null; }),
      // 2. Company verification
      verifyCompanyContext(cleanCompany).catch(e => { console.warn('Company verify failed:', e.message); return { isVerified: false, summary: '', sources: [] }; }),
      // 3. RAG retrieval (local, fast)
      ragRetrieve(`${cleanCompany} ${jobTitle} technical interview questions patterns`, 3).catch(() => []),
      // 4. Web search
      runWebSearch(`${cleanCompany} ${jobTitle} interview questions`).catch(e => { console.warn('Web search skipped:', e.message); return ''; }),
      // 5. Past questions from DB
      InterviewSession.find({ userId: user._id }).sort({ date: -1 }).limit(5).select('questions')
        .then(sessions => sessions.flatMap(s => (s.questions || []).map(q => q.questionText)).filter(Boolean))
        .catch(() => [])
    ]);

    const structuredJD = jdResult.status === 'fulfilled' ? jdResult.value : null;
    if (structuredJD) console.log(`MockInterview: JD parsed — domain: ${structuredJD.domain}, concepts: ${(structuredJD.concepts || []).length}`);

    const companyVerification = (companyResult.status === 'fulfilled' && companyResult.value) ? companyResult.value : { isVerified: false, summary: '', sources: [] };
    console.log(`MockInterview: Company verified — ${companyVerification.sources.length} sources`);

    const localContext = ragResult.status === 'fulfilled' ? ragResult.value : [];
    const webContext = webResult.status === 'fulfilled' ? webResult.value : '';
    const pastQuestions = pastResult.status === 'fulfilled' ? pastResult.value : [];
    console.log(`MockInterview: Loaded ${pastQuestions.length} past questions for deduplication`);

    // 5. Build candidate profile from session resume, provided text, or stored profile
    let candidateProfile = resumeText;
    if (!candidateProfile && resumeContext && resumeContext.parsedText) {
      candidateProfile = `Skills: ${(resumeContext.skills || []).join(', ')}.\nProjects: ${(resumeContext.projects || []).map(p => `${p.title}: ${p.description || ''}`).join('; ')}`;
    }
    if (!candidateProfile && user.resume) {
      const skills = (user.resume.skills || []).join(', ');
      const projects = (user.resume.projects || []).map(p => `${p.title}: ${p.description || ''}`).join('; ');
      candidateProfile = `Skills: ${skills}. Projects: ${projects}.`;
    }

    const localContextText = JSON.stringify(localContext.map(c => c.content));

    // 7. Generate grounded, deduplicated questions with JD coverage planning
    const structuredQuestions = await generateStructuredInterviewQuestions({
      companyName: cleanCompany,
      jobTitle,
      experienceLevel,
      questionTypes,
      localContext: localContextText,
      webContext,
      candidateProfile,
      jobDescription,
      structuredJD,
      sources: companyVerification.sources,
      pastQuestions,
      count
    });

    const groundingContext = `Company: ${companyVerification.summary}\n\nLocal Context: ${localContextText}\n\nWeb Search: ${webContext}`;

    const sessionData = {
      userId: user._id,
      status: 'in_progress',
      currentQuestionIndex: 0,
      company: cleanCompany,
      jobTitle,
      jobDescription,
      experienceLevel,
      jobDetails: { title: jobTitle, company: cleanCompany, description: jobDescription, structuredJD },
      companyVerification,
      questions: structuredQuestions,
      groundingContext,
      followUpCount: 0,
      transcript: [],
      proctoringLogs: [],
      proctoringIntegrityScore: 100
    };

    if (resumeContext && resumeContext.parsedText) {
      sessionData.resumeContext = resumeContext;
    }

    const session = await InterviewSession.create(sessionData);

    return res.json({
      sessionId: session._id,
      questions: structuredQuestions,
      firstQuestion: structuredQuestions[0],
      jobTitle,
      experienceLevel,
      totalQuestions: structuredQuestions.length,
      companyVerification: {
        isVerified: companyVerification.isVerified,
        summary: companyVerification.summary,
        sourcesCount: (companyVerification.sources || []).length
      }
    });
  } catch (error) {
    console.error('MockInterview /start error:', error);
    return res.status(500).json({ error: error.message });
  }
});

// ============================================================================
// POST /api/interviews/submit-answer
// ============================================================================
router.post('/submit-answer', requireAuth, async (req, res) => {
  const {
    sessionId, question, answer,
    rawTranscript, normalizedTranscript,
    expectedKeywords, questionIndex, proctorLogs
  } = req.body;

  if (!sessionId || !question || answer === undefined || typeof questionIndex !== 'number') {
    return res.status(400).json({ error: 'sessionId, question, answer, and questionIndex are required.' });
  }

  try {
    const session = await InterviewSession.findById(sessionId);
    if (!session) return res.status(404).json({ error: 'Interview session not found.' });
    if (session.userId.toString() !== req.user._id.toString()) return res.status(403).json({ error: 'Access denied.' });

    session.currentQuestionIndex = questionIndex + 1;

    // Evaluate answer with normalized transcript + self-correction support
    let evalResult = null;
    let questionScore = null;
    let questionFeedback = null;
    try {
      evalResult = await evaluateSingleAnswer({
        questionText: question,
        answerText: answer,
        rawTranscript: rawTranscript || '',
        normalizedTranscript: normalizedTranscript || '',
        expectedKeywords: expectedKeywords || [],
        companyName: session.company
      });
      questionScore = evalResult.score;
      questionFeedback = evalResult.feedback;
    } catch (evalErr) {
      console.error('Per-answer evaluation failed, continuing:', evalErr.message);
    }

    // Append to transcript with full detail (raw + normalized)
    session.transcript.push({ speaker: 'interviewer', text: question });
    session.transcript.push({
      speaker: 'candidate',
      text: answer,
      rawTranscript: rawTranscript || answer,
      normalizedTranscript: normalizedTranscript || answer,
      score: questionScore,
      feedback: questionFeedback,
      evaluation: evalResult || null
    });

    // Process proctor logs
    if (proctorLogs && Array.isArray(proctorLogs)) {
      const deductMap = { 'tab-switch': 15, 'copy-paste': 25, 'no-face': 10, 'multiple-faces': 20, 'silence': 5 };
      proctorLogs.forEach(log => {
        session.proctoringLogs.push({ event: log.event, details: log.details, timestamp: new Date() });
        session.proctoringIntegrityScore = Math.max(0, session.proctoringIntegrityScore - (deductMap[log.event] || 0));
      });
    }

    // Fixed Question Count: Retain exact number of questions chosen by the candidate (e.g. 5 questions)
    const isLast = questionIndex >= session.questions.length - 1;

    if (isLast) {
      const perQuestionEvaluations = session.transcript
        .filter(t => t.speaker === 'candidate' && typeof t.score === 'number')
        .map(t => ({ score: t.score, feedback: t.feedback }));

      console.log(`MockInterview: Finalizing session ${sessionId} (${perQuestionEvaluations.length} answers evaluated)...`);
      const feedback = await getInterviewFeedback(session.transcript, session.company, session.proctoringLogs, perQuestionEvaluations);

      // Honest mathematical score verification
      const totalPoints = perQuestionEvaluations.reduce((sum, q) => sum + (typeof q.score === 'number' ? q.score : 0), 0);
      const maxPossible = Math.max(1, perQuestionEvaluations.length * 10);
      const mathematicalPct = Math.round((totalPoints / maxPossible) * 100);

      // Honest combined score (never arbitrary 75%)
      let finalScore = typeof feedback.score === 'number' ? feedback.score : mathematicalPct;

      // Apply proctoring integrity penalty if integrity dropped below 100
      const integrityMultiplier = Math.max(0.5, (session.proctoringIntegrityScore || 100) / 100);
      finalScore = Math.max(0, Math.min(100, Math.round(finalScore * integrityMultiplier)));

      session.status = 'completed';
      session.feedback = {
        score: finalScore,
        strengths: feedback.strengths || [],
        weaknesses: feedback.weaknesses || [],
        improvementTips: feedback.improvementTips || [],
        detailedAssessment: feedback.detailedAssessment || ''
      };

      await session.save();

      try {
        await logGenuineActivity(session.userId, 'interview');
      } catch (activityErr) {
        console.error('Failed to log interview activity:', activityErr.message);
      }

      return res.json({ finished: true, session, questionScore, questionFeedback, evaluation: evalResult });
    }

    await session.save();
    return res.json({
      finished: false,
      questionScore,
      questionFeedback,
      evaluation: evalResult,
      updatedQuestions: session.questions,
      nextIndex: questionIndex + 1,
      followUpInserted: false
    });
  } catch (error) {
    console.error('submit-answer error:', error.message);
    return res.status(500).json({ error: error.message });
  }
});

// GET /api/interviews/history
router.get('/history', requireAuth, async (req, res) => {
  try {
    const sessions = await InterviewSession.find({ userId: req.user._id }).sort({ date: -1 });
    return res.json(sessions);
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
});

export default router;

