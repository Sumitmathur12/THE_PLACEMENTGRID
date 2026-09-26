import React, { useState, useEffect, useRef } from 'react';
import {
  Briefcase, FileText, Sliders, Sparkles, Loader2, ChevronRight, ChevronLeft,
  Check, Clock, Mic, MicOff, Send, Volume2, VolumeX, MessageSquare, RotateCcw,
  CheckCircle, ThumbsUp, Target, Lightbulb, Trophy, AlertCircle,
  BookOpen, SkipForward, Shield
} from 'lucide-react';
import { io } from 'socket.io-client';
import CameraProctor from '../components/CameraProctor.jsx';

const STEPS = ['Job Details', 'Preferences', 'Resume', 'Review'];

const EXPERIENCE_LEVELS = [
  { value: 'entry',     label: 'Entry Level',  sub: '0–2 years' },
  { value: 'mid',       label: 'Mid Level',    sub: '3–5 years' },
  { value: 'senior',    label: 'Senior',       sub: '5–8 years' },
  { value: 'lead',      label: 'Lead / Staff', sub: '8+ years'  },
  { value: 'executive', label: 'Executive',    sub: 'C-Suite'   },
];

const QUESTION_TYPES = [
  { value: 'technical',   label: 'Technical' },
  { value: 'behavioral',  label: 'Behavioral' },
  { value: 'situational', label: 'Situational' },
  { value: 'hr',          label: 'HR' },
  { value: 'culture_fit', label: 'Culture Fit' },
];

export default function MockInterviewPage({ user, token }) {
  const [view, setView] = useState('wizard');
  const [wizardStep, setWizardStep] = useState(0);

  // Wizard Form State
  const [jobTitle, setJobTitle] = useState('');
  const [company, setCompany] = useState(user?.targetCompany || '');
  const [jobDescription, setJobDescription] = useState('');
  const [experienceLevel, setExperienceLevel] = useState('mid');
  const [selectedTypes, setSelectedTypes] = useState(['technical', 'behavioral']);
  const [numberOfQuestions, setNumberOfQuestions] = useState(5);
  const [useResume, setUseResume] = useState(false);

  // Session-specific resume upload (PDF/DOCX, does NOT overwrite profile)
  const [sessionResumeFile, setSessionResumeFile] = useState(null);
  const [sessionResumeContext, setSessionResumeContext] = useState(null);
  const [resumeUploading, setResumeUploading] = useState(false);
  const [resumeUploadStatus, setResumeUploadStatus] = useState(null); // 'success' | 'error' | null
  const resumeFileInputRef = useRef(null);

  // Company Verification State
  const [companyVerification, setCompanyVerification] = useState(null);
  const [verifyingCompany, setVerifyingCompany] = useState(false);

  // Loading & Error States
  const [isGenerating, setIsGenerating] = useState(false);
  const [generationStage, setGenerationStage] = useState('');
  const [errorMessage, setErrorMessage] = useState('');

  // Active Session State
  const [sessionId, setSessionId] = useState(null);
  const [questions, setQuestions] = useState([]);
  const [currentIdx, setCurrentIdx] = useState(0);
  const [answerText, setAnswerText] = useState('');
  const [rawTranscriptText, setRawTranscriptText] = useState('');
  const [savedAnswers, setSavedAnswers] = useState({});
  const [submitting, setSubmitting] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const [startTime, setStartTime] = useState(Date.now());
  const [proctorLogs, setProctorLogs] = useState([]);
  const [showProctor, setShowProctor] = useState(false);

  // Explicit Interview State Machine:
  // 'READY_TO_ANSWER' | 'QUESTION_READING' | 'RECORDING' | 'REVIEWING' | 'SUBMITTING' | 'FOLLOW_UP' | 'COMPLETED'
  const [interviewState, setInterviewState] = useState('READY_TO_ANSWER');
  const [interimTranscript, setInterimTranscript] = useState('');

  // Results State
  const [sessionResults, setSessionResults] = useState(null);
  const [expandedAnswerIdx, setExpandedAnswerIdx] = useState(null);

  // Audio State
  const [isSpeaking, setIsSpeaking] = useState(false);
  const audioRef = useRef(null);
  const synthRef = typeof window !== 'undefined' ? window.speechSynthesis : null;

  // Speech Recognition State & Refs
  const [isListening, setIsListening] = useState(false);
  const recognitionRef = useRef(null);
  const isListeningRef = useRef(false);
  const explicitStopRef = useRef(false);
  const baseAnswerRef = useRef('');

  // Socket.io Live Streaming State (REACTION only — never affects question flow)
  const [socket, setSocket] = useState(null);
  const [liveReaction, setLiveReaction] = useState('');
  const [isStreamingReaction, setIsStreamingReaction] = useState(false);

  useEffect(() => {
    // In dev: vite proxy handles /socket.io → localhost:5500 (ws:true in vite.config.js).
    // In prod: connect directly to Render backend — Vercel cannot proxy WebSocket upgrades.
    const socketUrl = import.meta.env.VITE_SOCKET_URL ||
      (window.location.hostname === 'localhost' ? '' : 'https://the-placementgrid.onrender.com');
    const s = io(socketUrl, {
      transports: ['polling', 'websocket'], // polling first → stable HTTP handshake → upgrade to WS
      withCredentials: true,
      reconnectionAttempts: 3,
      reconnectionDelay: 2000,
    });
    setSocket(s);

    s.on('ai_chunk', (payload) => {
      const content = typeof payload === 'string' ? payload : payload?.content || '';
      if (payload?.type === 'REACTION' || typeof payload === 'string') {
        setLiveReaction((prev) => prev + content);
      }
    });

    s.on('ai_complete', (payload) => {
      if (!payload || payload?.type === 'REACTION') {
        setIsStreamingReaction(false);
      }
    });

    s.on('ai_error', (err) => {
      setIsStreamingReaction(false);
      console.warn('Socket reaction error:', err);
    });

    return () => {
      s.disconnect();
    };
  }, []);

  useEffect(() => {
    const SpeechRec = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (SpeechRec) {
      const rec = new SpeechRec();
      rec.continuous = true;
      rec.interimResults = true;
      rec.onresult = (e) => {
        let interimText = '';
        let finalChunk = '';
        for (let i = e.resultIndex; i < e.results.length; i++) {
          if (e.results[i].isFinal) {
            finalChunk += e.results[i][0].transcript;
          } else {
            interimText += e.results[i][0].transcript;
          }
        }
        setInterimTranscript(interimText);
        if (finalChunk) {
          setRawTranscriptText((prev) => {
            const trimmed = prev.trimEnd();
            const updated = trimmed ? `${trimmed} ${finalChunk.trim()}` : finalChunk.trim();
            const base = (baseAnswerRef.current || '').trim();
            const normalizedChunk = normalizeTranscript(updated);
            const combined = base ? `${base} ${normalizedChunk}` : normalizedChunk;
            setAnswerText(combined);
            return updated;
          });
        }
      };
      rec.onerror = (e) => {
        if (e.error !== 'no-speech' && e.error !== 'aborted') {
          console.warn('Speech recognition error:', e.error);
        }
      };
      rec.onend = () => {
        // If recording is still active and user did not click Stop, keep listening (handles pauses)
        if (isListeningRef.current && !explicitStopRef.current) {
          try {
            rec.start();
          } catch (_) {
            setIsListening(false);
            isListeningRef.current = false;
          }
        } else {
          setIsListening(false);
          isListeningRef.current = false;
        }
      };
      recognitionRef.current = rec;
    }
  }, []);


  useEffect(() => {
    if (view !== 'session') return;
    const interval = setInterval(() => {
      setElapsed(Math.floor((Date.now() - startTime) / 1000));
    }, 1000);
    return () => clearInterval(interval);
  }, [view, startTime]);

  const formatTime = (s) => {
    const mins = Math.floor(s / 60);
    const secs = s % 60;
    return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
  };

  const toggleType = (type) => {
    setSelectedTypes((prev) =>
      prev.includes(type)
        ? prev.length > 1 ? prev.filter((t) => t !== type) : prev
        : [...prev, type]
    );
  };

  const canProceedWizard = () => {
    if (wizardStep === 0) {
      return jobTitle.trim().length > 0 && jobDescription.trim().length >= 50;
    }
    return true;
  };

  const handleStartInterview = async () => {
    setIsGenerating(true);
    setErrorMessage('');
    setGenerationStage(`Analyzing ${jobTitle || 'role'} requirements...`);

    const stageInterval = setInterval(() => {
      setGenerationStage((prev) => {
        if (prev.includes('Analyzing')) return `Grounding in ${company || 'industry'} context...`;
        if (prev.includes('Grounding')) return 'Structuring technical and behavioral questions...';
        if (prev.includes('Structuring')) return 'Finalizing rubric and scoring points...';
        return 'Finalizing your personalized interview set...';
      });
    }, 2200);

    try {
      const resumeSkills = user?.resume?.skills || [];
      const resumeProjects = (user?.resume?.projects || []).map(p => `${p.title}: ${p.description || ''}`).join('; ');
      const candidateProfile = useResume && (resumeSkills.length > 0 || resumeProjects)
        ? `Skills: ${resumeSkills.join(', ')}. Projects: ${resumeProjects}.`
        : '';

      const body = {
        jobTitle: jobTitle.trim(),
        company: company.trim() || 'General Tech',
        jobDescription: jobDescription.trim(),
        experienceLevel,
        questionTypes: selectedTypes,
        numberOfQuestions,
        resumeText: candidateProfile
      };

      // If user uploaded a session-specific resume, attach its parsed context
      if (sessionResumeContext) {
        body.resumeContext = sessionResumeContext;
      }

      const res = await fetch('/api/interviews/start', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify(body)
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to start interview');

      setSessionId(data.sessionId);
      setQuestions(data.questions || []);
      setCurrentIdx(0);
      setAnswerText('');
      setRawTranscriptText('');
      setInterimTranscript('');
      setInterviewState('READY_TO_ANSWER');
      setSavedAnswers({});
      setElapsed(0);
      setStartTime(Date.now());
      setLiveReaction('');
      setIsStreamingReaction(false);
      setShowProctor(true); // Auto-activate proctoring when interview begins
      setView('session');

      if (data.questions?.[0]?.questionText) {
        speakQuestionText(data.questions[0].questionText);
      }
    } catch (err) {
      setErrorMessage(err.message || 'Error generating interview questions.');
    } finally {
      clearInterval(stageInterval);
      setIsGenerating(false);
      setGenerationStage('');
    }
  };

  // Technical term normalization dictionary (spoken → written form)
  const TECH_NORMALIZATION = {
    'use state': 'useState', 'use effect': 'useEffect', 'use callback': 'useCallback',
    'use memo': 'useMemo', 'use ref': 'useRef', 'use context': 'useContext',
    'use reducer': 'useReducer', 'next j s': 'Next.js', 'next js': 'Next.js',
    'react j s': 'React.js', 'node j s': 'Node.js', 'type script': 'TypeScript',
    'java script': 'JavaScript', 'kubernetes': 'Kubernetes', 'docker': 'Docker',
    'mongo d b': 'MongoDB', 'mongo db': 'MongoDB', 'my s q l': 'MySQL',
    'postgre s q l': 'PostgreSQL', 'rest api': 'REST API', 'graphql': 'GraphQL',
    'g r p c': 'gRPC', 'c i c d': 'CI/CD', 'aws': 'AWS', 'gcp': 'GCP',
    'v i t e': 'Vite', 'web pack': 'Webpack', 'redis': 'Redis', 'kafka': 'Kafka',
  };

  const normalizeTranscript = (raw) => {
    if (!raw) return raw;
    let normalized = raw;
    // Handle compound self-corrections: "X... actually sorry, Y" or "X... no wait, Y" → keep Y
    normalized = normalized.replace(/[\w\s]+\.{2,3}\s*(?:(?:actually|sorry|i mean|i meant|no wait)[\s,]*)+\s*/gi, '');
    // Apply tech term normalization
    Object.entries(TECH_NORMALIZATION).forEach(([spoken, written]) => {
      const re = new RegExp(spoken, 'gi');
      normalized = normalized.replace(re, written);
    });
    return normalized.trim();
  };

  // Company verification trigger (called when company field changes and user leaves Step 0)
  const handleVerifyCompany = async (companyName) => {
    if (!companyName || !companyName.trim() || companyName.toLowerCase() === 'general tech') {
      setCompanyVerification(null);
      return;
    }
    setVerifyingCompany(true);
    try {
      const res = await fetch('/api/interviews/verify-company', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({ companyName: companyName.trim() })
      });
      const data = await res.json();
      if (res.ok) setCompanyVerification(data);
    } catch (err) {
      console.warn('Company verification failed:', err.message);
    } finally {
      setVerifyingCompany(false);
    }
  };

  // Session resume upload (PDF or DOCX) — does NOT overwrite user profile
  const handleSessionResumeUpload = async (file) => {
    if (!file) return;
    if (!token) {
      setResumeUploadStatus('error');
      return;
    }
    const ext = file.name.split('.').pop().toLowerCase();
    if (!['pdf', 'docx', 'doc'].includes(ext)) {
      setResumeUploadStatus('error');
      return;
    }
    setSessionResumeFile(file);
    setResumeUploading(true);
    setResumeUploadStatus(null);
    try {
      const formData = new FormData();
      formData.append('resume', file);
      const res = await fetch('/api/interviews/parse-resume', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` },
        body: formData
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setSessionResumeContext(data.resumeContext);
        setResumeUploadStatus('success');
      } else {
        setResumeUploadStatus('error');
        // Show error inline — no browser alert()
        console.warn('Resume parse error:', data.error || 'Resume parsing failed.');
      }
    } catch (err) {
      setResumeUploadStatus('error');
      console.error('Resume upload error:', err.message);
    } finally {
      setResumeUploading(false);
    }
  };

  const stopAllAudio = () => {
    if (audioRef.current) {
      audioRef.current.onended = null;
      audioRef.current.onerror = null;
      audioRef.current.pause();
      audioRef.current.src = '';
      audioRef.current = null;
    }
    if (synthRef) {
      synthRef.cancel();
    }
    setIsSpeaking(false);
    setInterviewState((prev) => (prev === 'QUESTION_READING' ? 'READY_TO_ANSWER' : prev));
  };

  const fallbackBrowserSpeak = (text) => {
    if (!synthRef) {
      setIsSpeaking(false);
      setInterviewState((prev) => (prev === 'QUESTION_READING' ? 'READY_TO_ANSWER' : prev));
      return;
    }
    synthRef.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.rate = 0.95;
    utterance.pitch = 1.0;
    utterance.onend = () => {
      setIsSpeaking(false);
      setInterviewState((prev) => (prev === 'QUESTION_READING' ? 'READY_TO_ANSWER' : prev));
    };
    utterance.onerror = () => {
      setIsSpeaking(false);
      setInterviewState((prev) => (prev === 'QUESTION_READING' ? 'READY_TO_ANSWER' : prev));
    };
    synthRef.speak(utterance);
  };

  const speakQuestionText = async (text) => {
    if (!text) return;
    stopAllAudio();
    setIsSpeaking(true);
    setInterviewState('QUESTION_READING');

    try {
      const res = await fetch('/api/interviews/tts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({ text })
      });

      const data = await res.json();
      if (data.audioContent && !data.isFallback) {
        const audio = new Audio(`data:audio/mpeg;base64,${data.audioContent}`);
        audioRef.current = audio;
        audio.onended = () => {
          setIsSpeaking(false);
          audioRef.current = null;
          setInterviewState((prev) => (prev === 'QUESTION_READING' ? 'READY_TO_ANSWER' : prev));
        };
        audio.onerror = () => {
          if (audioRef.current === audio) {
            fallbackBrowserSpeak(text);
          }
        };
        await audio.play();
      } else {
        fallbackBrowserSpeak(text);
      }
    } catch (err) {
      console.warn('TTS failed, using browser speech fallback:', err.message);
      fallbackBrowserSpeak(text);
    }
  };

  const toggleSpeakCurrentQuestion = () => {
    if (isSpeaking) {
      stopAllAudio();
    } else {
      const q = questions[currentIdx]?.questionText;
      if (q) speakQuestionText(q);
    }
  };

  // ==========================================================================
  // Two-stage Voice Input Pipeline (Microphone ONLY — NEVER calls TTS or auto-submits)
  // ==========================================================================
  const startVoiceAnswer = (mode = 'append') => {
    if (!recognitionRef.current) {
      setErrorMessage('Speech recognition is not supported in your browser. Please use Chrome or Edge.');
      return;
    }
    // 1. Strictly isolate: stop any playing question audio without triggering error fallback
    stopAllAudio();

    // 2. Set recording state
    explicitStopRef.current = false;
    isListeningRef.current = true;
    setIsListening(true);
    setInterviewState('RECORDING');
    setInterimTranscript('');

    if (mode === 'clear') {
      baseAnswerRef.current = '';
      setRawTranscriptText('');
      setAnswerText('');
    } else {
      // Retain existing text as the base so new speech appends seamlessly without wiping previous text!
      baseAnswerRef.current = (answerText || '').trim();
      setRawTranscriptText('');
    }

    try {
      recognitionRef.current.start();
    } catch (err) {
      console.warn('Mic start error:', err);
    }
  };

  const stopVoiceAnswer = () => {
    explicitStopRef.current = true;
    isListeningRef.current = false;
    setIsListening(false);

    if (recognitionRef.current) {
      try {
        recognitionRef.current.stop();
      } catch (_) {}
    }

    setInterviewState('REVIEWING');
    // Normalize self-corrections and technical terminology for the candidate to review
    const raw = (rawTranscriptText || interimTranscript || '').trim();
    const normalized = normalizeTranscript(raw);
    const base = (baseAnswerRef.current || '').trim();

    if (normalized) {
      const combined = base ? `${base} ${normalized}` : normalized;
      setAnswerText(combined);
    }
  };

  // Submit answer & get evaluation + live reaction + conditional follow-up
  const handleSubmitAnswer = async (skipped = false) => {
    stopAllAudio();
    if (isListening) {
      stopVoiceAnswer();
    }

    const currentQ = questions[currentIdx];
    if (!currentQ || !sessionId) return;

    const finalAnswer = skipped ? 'Skipped question' : (answerText || '').trim();
    const finalRaw = skipped ? '' : (rawTranscriptText || answerText || '').trim();
    const finalNormalized = skipped ? '' : normalizeTranscript(rawTranscriptText || answerText || '').trim();

    setSubmitting(true);
    setInterviewState('SUBMITTING');

    // Automatically trigger live Socket.io reaction for submitted real answers
    if (!skipped && socket && finalAnswer.length >= 5) {
      setLiveReaction('');
      setIsStreamingReaction(true);
      socket.emit('live_answer', {
        sessionId,
        questionId: currentQ._id || currentIdx,
        questionText: currentQ.questionText,
        answerText: finalAnswer,
        expectedKeywords: currentQ.expectedKeywords || [],
        companyName: company || 'Tech Company'
      });
    }

    try {
      const res = await fetch('/api/interviews/submit-answer', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({
          sessionId,
          question: currentQ.questionText,
          answer: finalAnswer,
          rawTranscript: finalRaw,
          normalizedTranscript: finalNormalized,
          expectedKeywords: currentQ.expectedKeywords || [],
          questionIndex: currentIdx,
          proctorLogs: proctorLogs
        })
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to submit answer');

      setSavedAnswers((prev) => ({
        ...prev,
        [currentIdx]: {
          answer: finalAnswer,
          rawTranscript: finalRaw,
          normalizedTranscript: finalNormalized,
          score: data.questionScore,
          feedback: data.questionFeedback,
          evaluation: data.evaluation
        }
      }));

      if (data.updatedQuestions) {
        setQuestions(data.updatedQuestions);
      }

      setInterimTranscript('');
      setRawTranscriptText('');
      setProctorLogs([]);

      if (data.finished) {
        setSessionResults(data.session);
        setInterviewState('COMPLETED');
        setLiveReaction('');
        setIsStreamingReaction(false);
        setView('results');
      } else if (data.followUpInserted) {
        // Adaptive follow-up question inserted
        setInterviewState('FOLLOW_UP');
        const nextIdx = currentIdx + 1;
        setCurrentIdx(nextIdx);
        setAnswerText('');
        setLiveReaction('');
        setIsStreamingReaction(false);
        setStartTime(Date.now());
        const nextQ = data.updatedQuestions?.[nextIdx]?.questionText || questions[nextIdx]?.questionText;
        if (nextQ) speakQuestionText(nextQ);
      } else {
        const nextIdx = currentIdx + 1;
        setCurrentIdx(nextIdx);
        setAnswerText(savedAnswers[nextIdx]?.answer || '');
        setLiveReaction('');
        setIsStreamingReaction(false);
        setStartTime(Date.now());
        setInterviewState('READY_TO_ANSWER');
        const nextQ = data.updatedQuestions?.[nextIdx]?.questionText || questions[nextIdx]?.questionText;
        if (nextQ) speakQuestionText(nextQ);
      }
    } catch (err) {
      setErrorMessage(err.message || 'Error submitting answer');
      setInterviewState('READY_TO_ANSWER');
    } finally {
      setSubmitting(false);
    }
  };

  const handlePrevQuestion = () => {
    if (currentIdx === 0) return;
    stopAllAudio();
    const prevIdx = currentIdx - 1;
    setCurrentIdx(prevIdx);
    setAnswerText(savedAnswers[prevIdx]?.answer || '');
    setLiveReaction('');
    setIsStreamingReaction(false);
    setInterviewState('READY_TO_ANSWER');
  };


  const handlePracticeAgain = () => {
    stopAllAudio();
    setView('wizard');
    setWizardStep(0);
    setSessionId(null);
    setQuestions([]);
    setSavedAnswers({});
    setSessionResults(null);
  };

  const currentQuestion = questions[currentIdx];
  const totalQuestions = questions.length;
  const progressPercent = totalQuestions ? Math.round(((currentIdx + 1) / totalQuestions) * 100) : 0;

  if (view === 'wizard') {
    return (
      <div className="max-w-3xl mx-auto py-8 px-4 font-sans fade-in">
        <div className="flex items-center gap-2 mb-8">
          {STEPS.map((label, idx) => {
            const isDone = idx < wizardStep;
            const isCurrent = idx === wizardStep;
            return (
              <React.Fragment key={label}>
                <div className="flex items-center gap-2">
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold transition-all ${
                    isDone
                      ? 'bg-emerald-500 text-white shadow-sm'
                      : isCurrent
                        ? 'bg-sage-600 text-white ring-4 ring-sage-100 shadow-md'
                        : 'bg-cream-300 text-charcoal-500'
                  }`}>
                    {isDone ? <Check className="w-4 h-4" /> : idx + 1}
                  </div>
                  <span className={`text-xs font-medium hidden sm:inline ${isCurrent ? 'text-charcoal-900 font-semibold' : 'text-charcoal-500'}`}>
                    {label}
                  </span>
                </div>
                {idx < STEPS.length - 1 && (
                  <div className={`flex-1 h-0.5 rounded-full ${isDone ? 'bg-emerald-500' : 'bg-cream-300'}`} />
                )}
              </React.Fragment>
            );
          })}
        </div>

        <div className="bg-white rounded-2xl border border-cream-300 shadow-paper p-6 sm:p-8">
          {errorMessage && (
            <div className="mb-6 p-4 rounded-xl bg-red-50 border border-red-200 flex items-center gap-3 text-red-700 text-sm">
              <AlertCircle className="w-5 h-5 flex-shrink-0" />
              <span>{errorMessage}</span>
            </div>
          )}

          {wizardStep === 0 && (
            <div className="space-y-6">
              <div className="flex items-center gap-3 pb-3 border-b border-cream-200">
                <div className="p-2.5 bg-sage-50 rounded-xl text-sage-600">
                  <Briefcase className="w-5 h-5" />
                </div>
                <div>
                  <h2 className="text-xl font-serif font-bold text-charcoal-900">Job Details</h2>
                  <p className="text-xs text-charcoal-500">Provide the role and requirements for AI to customize questions</p>
                </div>
              </div>

              <div>
                <label className="block text-sm font-semibold text-charcoal-900 mb-1.5">
                  Job Title <span className="text-terracotta-500">*</span>
                </label>
                <input
                  type="text"
                  placeholder="e.g. Frontend Developer Intern, Full Stack Engineer"
                  value={jobTitle}
                  onChange={(e) => setJobTitle(e.target.value)}
                  className="w-full px-4 py-3 rounded-xl border border-cream-300 focus:outline-none focus:ring-2 focus:ring-sage-500 text-charcoal-900 placeholder:text-charcoal-400 bg-cream-50"
                />
              </div>

              <div>
                <label className="block text-sm font-semibold text-charcoal-900 mb-1.5">
                  Company <span className="text-xs font-normal text-charcoal-500">(optional)</span>
                </label>
                <div className="relative">
                  <input
                    type="text"
                    placeholder="e.g. Google, Microsoft, JTG, Amazon"
                    value={company}
                    onChange={(e) => setCompany(e.target.value)}
                    onBlur={(e) => handleVerifyCompany(e.target.value)}
                    className="w-full px-4 py-3 rounded-xl border border-cream-300 focus:outline-none focus:ring-2 focus:ring-sage-500 text-charcoal-900 placeholder:text-charcoal-400 bg-cream-50"
                  />
                  {verifyingCompany && (
                    <div className="absolute right-3 top-3.5">
                      <Loader2 className="w-4 h-4 animate-spin text-sage-500" />
                    </div>
                  )}
                </div>
                {companyVerification && (
                  <div className={`mt-2 p-2.5 rounded-lg text-xs flex items-start gap-2 ${companyVerification.isVerified ? 'bg-emerald-50 border border-emerald-200 text-emerald-700' : 'bg-amber-50 border border-amber-200 text-amber-700'}`}>
                    {companyVerification.isVerified
                      ? <CheckCircle className="w-3.5 h-3.5 mt-0.5 flex-shrink-0" />
                      : <AlertCircle className="w-3.5 h-3.5 mt-0.5 flex-shrink-0" />
                    }
                    <span>
                      {companyVerification.isVerified ? '✓ Verified: ' : 'Unverified: '}
                      {companyVerification.summary?.substring(0, 120)}
                      {companyVerification.sources?.length > 0 && ` (${companyVerification.sources.length} source${companyVerification.sources.length > 1 ? 's' : ''})`}
                    </span>
                  </div>
                )}
              </div>

              <div>
                <div className="flex justify-between items-center mb-1.5">
                  <label className="text-sm font-semibold text-charcoal-900">
                    Job Description <span className="text-terracotta-500">*</span>
                  </label>
                  <span className={`text-xs ${jobDescription.length < 50 ? 'text-terracotta-500' : 'text-sage-600'}`}>
                    min. 50 chars — {jobDescription.length}/5000
                  </span>
                </div>
                <textarea
                  rows={5}
                  placeholder="Paste the job description, key responsibilities, or technologies required (JavaScript, React, Node.js, DSA, System Design...)"
                  value={jobDescription}
                  onChange={(e) => setJobDescription(e.target.value)}
                  className="w-full px-4 py-3 rounded-xl border border-cream-300 focus:outline-none focus:ring-2 focus:ring-sage-500 text-charcoal-900 placeholder:text-charcoal-400 bg-cream-50 resize-none"
                />
              </div>
            </div>
          )}

          {wizardStep === 1 && (
            <div className="space-y-6">
              <div className="flex items-center gap-3 pb-3 border-b border-cream-200">
                <div className="p-2.5 bg-sage-50 rounded-xl text-sage-600">
                  <Sliders className="w-5 h-5" />
                </div>
                <div>
                  <h2 className="text-xl font-serif font-bold text-charcoal-900">Preferences</h2>
                  <p className="text-xs text-charcoal-500">Fine-tune interview depth, questions, and format</p>
                </div>
              </div>

              <div>
                <label className="block text-sm font-semibold text-charcoal-900 mb-2">Experience Level</label>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                  {EXPERIENCE_LEVELS.map(({ value, label, sub }) => {
                    const active = experienceLevel === value;
                    return (
                      <button
                        key={value}
                        type="button"
                        onClick={() => setExperienceLevel(value)}
                        className={`p-3.5 rounded-xl border text-left transition-all ${
                          active
                            ? 'border-sage-500 bg-sage-50 ring-2 ring-sage-500/20 text-sage-900 shadow-sm'
                            : 'border-cream-300 bg-cream-50 hover:border-sage-300 text-charcoal-700'
                        }`}
                      >
                        <p className="text-sm font-bold text-charcoal-900">{label}</p>
                        <p className="text-xs text-charcoal-500 mt-0.5">{sub}</p>
                      </button>
                    );
                  })}
                </div>
              </div>

              <div>
                <label className="block text-sm font-semibold text-charcoal-900 mb-2">
                  Question Types <span className="text-xs font-normal text-charcoal-500">(select all that apply)</span>
                </label>
                <div className="flex flex-wrap gap-2">
                  {QUESTION_TYPES.map(({ value, label }) => {
                    const active = selectedTypes.includes(value);
                    return (
                      <button
                        key={value}
                        type="button"
                        onClick={() => toggleType(value)}
                        className={`px-4 py-2 rounded-full text-xs font-medium border transition-all flex items-center gap-1.5 ${
                          active
                            ? 'bg-sage-600 border-sage-600 text-white shadow-sm'
                            : 'border-cream-300 bg-cream-50 text-charcoal-700 hover:border-sage-400'
                        }`}
                      >
                        {active && <Check className="w-3.5 h-3.5" />}
                        {label}
                      </button>
                    );
                  })}
                </div>
              </div>

              <div>
                <div className="flex justify-between items-center mb-1">
                  <label className="text-sm font-semibold text-charcoal-900">
                    Number of Questions: <span className="text-sage-600 font-bold ml-1">{numberOfQuestions}</span>
                  </label>
                </div>
                <input
                  type="range"
                  min="3"
                  max="15"
                  step="1"
                  value={numberOfQuestions}
                  onChange={(e) => setNumberOfQuestions(parseInt(e.target.value))}
                  className="w-full accent-sage-600 mt-2 cursor-pointer"
                />
                <div className="flex justify-between text-xs text-charcoal-400 mt-1">
                  <span>3 questions (Quick)</span>
                  <span>10 questions (Standard)</span>
                  <span>15 questions (In-Depth)</span>
                </div>
              </div>
            </div>
          )}

          {wizardStep === 2 && (
            <div className="space-y-6">
              <div className="flex items-center gap-3 pb-3 border-b border-cream-200">
                <div className="p-2.5 bg-sage-50 rounded-xl text-sage-600">
                  <FileText className="w-5 h-5" />
                </div>
                <div>
                  <h2 className="text-xl font-serif font-bold text-charcoal-900">Resume <span className="text-xs font-normal text-charcoal-500">(session-specific)</span></h2>
                  <p className="text-xs text-charcoal-500">Upload a resume for this session — it will NOT overwrite your profile</p>
                </div>
              </div>

              <div className="space-y-3">
                {/* Option 1: Upload a resume for this session */}
                <div
                  className={`w-full p-4 rounded-xl border transition-all ${
                    sessionResumeContext
                      ? 'border-emerald-400 bg-emerald-50 ring-2 ring-emerald-400/20'
                      : 'border-cream-300 bg-cream-50 hover:border-sage-300'
                  }`}
                >
                  <div className="flex items-start justify-between mb-3">
                    <div>
                      <p className="text-sm font-bold text-charcoal-900">Upload for this session</p>
                      <p className="text-xs text-charcoal-500">PDF or DOCX — tailors questions to this specific resume</p>
                    </div>
                    {sessionResumeContext && (
                      <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded bg-emerald-200 text-emerald-800 flex items-center gap-1">
                        <CheckCircle className="w-3 h-3" /> Parsed
                      </span>
                    )}
                  </div>
                  <input
                    ref={resumeFileInputRef}
                    type="file"
                    accept=".pdf,.docx,.doc"
                    className="hidden"
                    onChange={(e) => {
                      if (e.target.files?.[0]) {
                        setUseResume(false);
                        handleSessionResumeUpload(e.target.files[0]);
                      }
                    }}
                  />
                  <button
                    type="button"
                    onClick={() => resumeFileInputRef.current?.click()}
                    disabled={resumeUploading}
                    className="px-4 py-2 rounded-lg bg-sage-600 text-white text-xs font-semibold hover:bg-sage-700 transition-colors flex items-center gap-2 disabled:opacity-60"
                  >
                    {resumeUploading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <FileText className="w-3.5 h-3.5" />}
                    {resumeUploading ? 'Parsing resume...' : sessionResumeFile ? 'Replace file' : 'Choose file (PDF/DOCX)'}
                  </button>
                  {sessionResumeContext && (
                    <div className="mt-2 text-xs text-emerald-700">
                      ✓ <strong>{sessionResumeContext.originalName}</strong> — {sessionResumeContext.skills?.length || 0} skills detected
                    </div>
                  )}
                  {resumeUploadStatus === 'error' && (
                    <div className="mt-2 text-xs text-red-600 flex items-center gap-1">
                      <AlertCircle className="w-3 h-3" /> Upload failed. Please try a valid PDF or DOCX.
                    </div>
                  )}
                </div>

                {/* Option 3: No resume */}
                <button
                  type="button"
                  onClick={() => { setUseResume(false); setSessionResumeContext(null); setSessionResumeFile(null); setResumeUploadStatus(null); }}
                  className={`w-full p-4 rounded-xl border text-left transition-all ${
                    !useResume && !sessionResumeContext
                      ? 'border-sage-500 bg-sage-50 ring-2 ring-sage-500/20'
                      : 'border-cream-300 bg-cream-50 hover:border-sage-300'
                  }`}
                >
                  <p className="text-sm font-bold text-charcoal-900">No resume — generic questions</p>
                  <p className="text-xs text-charcoal-500 mt-0.5">AI generates questions based on job description only</p>
                </button>
              </div>
            </div>
          )}

          {wizardStep === 3 && (
            <div className="space-y-6">
              <div className="flex items-center gap-3 pb-3 border-b border-cream-200">
                <div className="p-2.5 bg-terracotta-50 rounded-xl text-terracotta-600">
                  <Sparkles className="w-5 h-5" />
                </div>
                <div>
                  <h2 className="text-xl font-serif font-bold text-charcoal-900">Review & Generate</h2>
                  <p className="text-xs text-charcoal-500">Verify your setup before AI generates the interview set</p>
                </div>
              </div>

              <div className="divide-y divide-cream-200">
                <div className="py-3 flex justify-between items-center text-sm">
                  <span className="text-charcoal-500 font-medium">Job Title</span>
                  <span className="font-bold text-charcoal-900">{jobTitle}</span>
                </div>
                <div className="py-3 flex justify-between items-center text-sm">
                  <span className="text-charcoal-500 font-medium">Company</span>
                  <span className="font-bold text-charcoal-900">{company || 'Not specified (General Tech)'}</span>
                </div>
                <div className="py-3 flex justify-between items-center text-sm">
                  <span className="text-charcoal-500 font-medium">Experience Level</span>
                  <span className="font-bold text-charcoal-900 capitalize">{experienceLevel} Level</span>
                </div>
                <div className="py-3 flex justify-between items-center text-sm">
                  <span className="text-charcoal-500 font-medium">Question Types</span>
                  <span className="font-bold text-charcoal-900">{selectedTypes.join(', ')}</span>
                </div>
                <div className="py-3 flex justify-between items-center text-sm">
                  <span className="text-charcoal-500 font-medium">Number of Questions</span>
                  <span className="font-bold text-sage-600">{numberOfQuestions}</span>
                </div>
                <div className="py-3 flex justify-between items-center text-sm">
                  <span className="text-charcoal-500 font-medium">Resume</span>
                  <span className="font-bold text-charcoal-900">
                    {sessionResumeContext ? sessionResumeContext.originalName : 'None (Generic)'}
                  </span>
                </div>
              </div>

              <div className="p-4 rounded-xl bg-sage-50 border border-sage-200">
                {isGenerating ? (
                  <div className="flex items-center gap-3">
                    <Loader2 className="w-5 h-5 text-sage-600 animate-spin flex-shrink-0" />
                    <div>
                      <p className="text-xs font-bold text-sage-900">Preparing Your Interview Environment</p>
                      <p className="text-xs text-sage-700 mt-0.5 animate-pulse font-medium">{generationStage || 'Initializing AI session...'}</p>
                    </div>
                  </div>
                ) : (
                  <p className="text-xs text-sage-800 leading-relaxed">
                    AI will generate <strong>{numberOfQuestions} personalized questions</strong> grounded in {company || 'the tech industry'} and candidate requirements. This usually takes 3–8 seconds.
                  </p>
                )}
              </div>
            </div>
          )}

          <div className="flex items-center justify-between mt-8 pt-4 border-t border-cream-200">
            <button
              type="button"
              onClick={() => setWizardStep(s => s - 1)}
              disabled={wizardStep === 0 || isGenerating}
              className="px-5 py-2.5 rounded-xl text-sm font-semibold text-charcoal-700 bg-cream-200 hover:bg-cream-300 transition-colors disabled:opacity-40 flex items-center gap-1.5"
            >
              <ChevronLeft className="w-4 h-4" /> Back
            </button>

            {wizardStep < STEPS.length - 1 ? (
              <button
                type="button"
                onClick={() => setWizardStep(s => s + 1)}
                disabled={!canProceedWizard()}
                className="px-6 py-2.5 rounded-xl text-sm font-semibold text-white bg-sage-600 hover:bg-sage-700 transition-colors shadow-sm disabled:opacity-50 flex items-center gap-1.5"
              >
                Next <ChevronRight className="w-4 h-4" />
              </button>
            ) : (
              <button
                type="button"
                onClick={handleStartInterview}
                disabled={isGenerating}
                className="px-7 py-2.5 rounded-xl text-sm font-bold text-white bg-sage-600 hover:bg-sage-700 transition-all shadow-md flex items-center gap-2 disabled:opacity-50"
              >
                {isGenerating ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Generating Questions...
                  </>
                ) : (
                  <>
                    <Sparkles className="w-4 h-4" />
                    Generate & Start Interview
                  </>
                )}
              </button>
            )}
          </div>
        </div>
      </div>
    );
  }

  if (view === 'session') {
    return (
      <div className="max-w-7xl mx-auto py-6 px-4 sm:px-6 font-sans fade-in">
        {/* Top Session Bar */}
        <div className="bg-white rounded-2xl border border-cream-300 shadow-paper p-5 mb-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h2 className="text-xl font-serif font-bold text-charcoal-900">{jobTitle || 'Mock Interview Session'}</h2>
            <p className="text-xs text-charcoal-500 capitalize mt-0.5">
              {company || 'General Tech'} • {experienceLevel} level • {totalQuestions} questions
            </p>
          </div>

          <div className="flex items-center gap-3">
            <div className="flex items-center gap-1.5 text-xs bg-cream-100 px-3 py-1.5 rounded-lg border border-cream-300 font-mono text-charcoal-800">
              <Clock className="w-3.5 h-3.5 text-sage-600" />
              <span>{formatTime(elapsed)}</span>
            </div>
            <span className="text-xs font-bold text-sage-600 bg-sage-50 px-3 py-1.5 rounded-lg border border-sage-200">
              {currentIdx + 1} / {totalQuestions || 1}
            </span>
          </div>
        </div>

        {/* 2-Column Responsive Layout */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          {/* Main Interview Area (Left 8 Cols) */}
          <div className="lg:col-span-8 space-y-6">
            <div className="w-full h-2 bg-cream-200 rounded-full overflow-hidden">
              <div
                className="h-full bg-sage-600 transition-all duration-300 rounded-full"
                style={{ width: `${progressPercent}%` }}
              />
            </div>

            <div className="bg-white rounded-2xl border border-cream-300 shadow-paper p-6 sm:p-8 space-y-6">
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-xs font-bold px-2.5 py-1 rounded-md bg-sage-100 text-sage-800 border border-sage-200">
                  Q{currentIdx + 1}
                </span>
                {interviewState === 'FOLLOW_UP' ? (
                  <span className="text-xs font-bold px-2.5 py-1 rounded-md bg-indigo-100 text-indigo-800 border border-indigo-200 uppercase tracking-wider flex items-center gap-1">
                    <Sparkles className="w-3 h-3" /> Adaptive Follow-up
                  </span>
                ) : (
                  <span className={`text-xs font-bold px-2.5 py-1 rounded-md uppercase tracking-wider ${
                    currentQuestion?.difficulty === 'easy'
                      ? 'bg-emerald-100 text-emerald-800 border border-emerald-200'
                      : currentQuestion?.difficulty === 'hard'
                        ? 'bg-terracotta-100 text-terracotta-800 border border-terracotta-200'
                        : 'bg-amber-100 text-amber-800 border border-amber-200'
                  }`}>
                    {currentQuestion?.difficulty || 'medium'}
                  </span>
                )}
                <span className="text-xs font-medium px-2.5 py-1 rounded-md bg-cream-100 text-charcoal-700 border border-cream-200 capitalize">
                  {currentQuestion?.category || 'technical'}
                </span>
                {savedAnswers[currentIdx] && (
                  <span className="text-xs font-medium px-2 py-0.5 rounded-md bg-emerald-50 text-emerald-700 flex items-center gap-1">
                    <CheckCircle className="w-3.5 h-3.5" /> Answered
                  </span>
                )}
              </div>

              <div className="flex items-start justify-between gap-4">
                <p className="text-lg font-serif font-bold text-charcoal-900 leading-relaxed">
                  {currentQuestion?.questionText || 'Loading question...'}
                </p>
                <button
                  type="button"
                  onClick={toggleSpeakCurrentQuestion}
                  className={`p-2.5 rounded-full transition-all flex-shrink-0 ${
                    isSpeaking
                      ? 'bg-sage-600 text-white animate-pulse shadow-sm'
                      : 'bg-cream-100 text-charcoal-600 hover:bg-cream-200 border border-cream-300'
                  }`}
                  title={isSpeaking ? 'Stop speaking' : 'Read question aloud (ElevenLabs AI)'}
                >
                  {isSpeaking ? <VolumeX className="w-5 h-5" /> : <Volume2 className="w-5 h-5" />}
                </button>
              </div>

              <div>
                <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
                  <label className="text-sm font-semibold text-charcoal-900">
                    {interviewState === 'RECORDING' ? (
                      <span className="text-red-600 flex items-center gap-1.5 font-bold">
                        <span className="w-2 h-2 rounded-full bg-red-500 animate-ping" />
                        Recording Speech (Pauses are OK)...
                      </span>
                    ) : interviewState === 'REVIEWING' ? (
                      <span className="text-sage-700 font-bold">Your Answer (Voice Captured — Edit or Add More)</span>
                    ) : (
                      'Your Answer'
                    )}
                  </label>

                  <div className="flex items-center gap-2">
                    {interviewState === 'RECORDING' ? (
                      <button
                        type="button"
                        onClick={stopVoiceAnswer}
                        className="flex items-center gap-1.5 text-xs px-3.5 py-1.5 rounded-lg font-bold bg-red-600 text-white animate-pulse shadow-md hover:bg-red-700 transition-all"
                      >
                        <MicOff className="w-3.5 h-3.5" />
                        <span>Stop & Save Voice</span>
                      </button>
                    ) : (
                      <>
                        <button
                          type="button"
                          onClick={() => startVoiceAnswer('append')}
                          disabled={submitting}
                          className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg font-semibold bg-sage-50 text-sage-800 border border-sage-300 hover:bg-sage-100 transition-all disabled:opacity-50"
                          title="Speak to add or continue answering without losing existing text"
                        >
                          <Mic className="w-3.5 h-3.5 text-sage-600" />
                          <span>{answerText.trim() ? 'Add More (Voice)' : 'Voice Input'}</span>
                        </button>
                        {answerText.trim() && (
                          <button
                            type="button"
                            onClick={() => startVoiceAnswer('clear')}
                            disabled={submitting}
                            className="flex items-center gap-1.5 text-xs px-2.5 py-1.5 rounded-lg font-medium text-charcoal-500 hover:text-red-600 hover:bg-red-50 border border-transparent hover:border-red-200 transition-all disabled:opacity-50"
                            title="Clear answer text and start fresh recording"
                          >
                            <RotateCcw className="w-3 h-3" />
                            <span>Clear & Re-record</span>
                          </button>
                        )}
                      </>
                    )}
                  </div>
                </div>

                {/* Live Interim Speech Preview during Recording */}
                {interviewState === 'RECORDING' && (
                  <div className="mb-2.5 p-3 bg-red-50/90 border border-red-200 rounded-xl text-xs text-red-950 flex items-start gap-2.5 shadow-sm">
                    <div className="w-2.5 h-2.5 rounded-full bg-red-500 animate-ping mt-1 flex-shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="font-bold text-red-700 mb-0.5">Microphone Active</p>
                      <p className="italic text-charcoal-800 break-words">
                        {interimTranscript || rawTranscriptText || 'Start speaking your answer...'}
                      </p>
                    </div>
                  </div>
                )}

                {/* Review Banner */}
                {interviewState === 'REVIEWING' && (
                  <div className="mb-2.5 p-2.5 bg-emerald-50 border border-emerald-200 rounded-xl text-xs text-emerald-900 flex items-center gap-2">
                    <CheckCircle className="w-4 h-4 text-emerald-600 flex-shrink-0" />
                    <span>Speech captured. You can freely edit text or click "Add More (Voice)" to append additional thoughts.</span>
                  </div>
                )}

                <textarea
                  rows={6}
                  value={answerText}
                  onChange={(e) => {
                    setAnswerText(e.target.value);
                    if (interviewState === 'REVIEWING' || interviewState === 'RECORDING') {
                      setInterviewState('READY_TO_ANSWER');
                    }
                  }}
                  placeholder={
                    interviewState === 'RECORDING'
                      ? 'Listening for your speech...'
                      : "Type your answer here, or click 'Voice Input' to speak naturally. Highlight concepts, trade-offs, and technical rationale..."
                  }
                  className={`w-full p-4 rounded-xl border transition-all text-charcoal-900 placeholder:text-charcoal-400 bg-cream-50 focus:outline-none focus:ring-2 focus:ring-sage-500 text-sm resize-none ${
                    interviewState === 'RECORDING' ? 'ring-2 ring-red-400 border-red-300' : 'border-cream-300'
                  }`}
                />
                <div className="flex justify-between items-center text-xs text-charcoal-400 mt-1.5">
                  <span>{answerText.length} characters</span>
                  {savedAnswers[currentIdx]?.score !== undefined && (
                    <span className="text-sage-700 font-semibold">
                      Last Score: {savedAnswers[currentIdx].score}/10
                    </span>
                  )}
                </div>
              </div>

              {currentQuestion?.expectedKeywords?.length > 0 && (
                <div className="p-3.5 rounded-xl bg-sage-50/70 border border-sage-200">
                  <p className="text-xs text-sage-900">
                    💡 <strong>Topic hints:</strong> {currentQuestion.expectedKeywords.join(' • ')}
                  </p>
                </div>
              )}

              {/* Streamed Live Interviewer Reaction */}
              {(liveReaction || isStreamingReaction) && (
                <div className="mt-4 p-4 bg-charcoal-900 rounded-xl border border-charcoal-800 font-mono text-xs text-emerald-300 shadow-inner fade-in">
                  <div className="flex items-center gap-2 mb-2 pb-2 border-b border-charcoal-800">
                    <div className="w-2 h-2 bg-emerald-400 rounded-full animate-pulse" />
                    <span className="text-[10px] font-bold text-emerald-400 uppercase tracking-widest">
                      AI Interviewer Live Reaction
                    </span>
                  </div>
                  <p className="leading-relaxed font-sans text-xs text-emerald-200">{liveReaction}</p>
                  {isStreamingReaction && <span className="inline-block w-1.5 h-3 ml-1 bg-emerald-400 animate-pulse" />}
                </div>
              )}
            </div>

            <div className="flex items-center justify-between pt-2">
              <button
                type="button"
                onClick={handlePrevQuestion}
                disabled={currentIdx === 0 || submitting || interviewState === 'RECORDING'}
                className="px-5 py-2.5 rounded-xl text-sm font-semibold text-charcoal-700 bg-white border border-cream-300 hover:bg-cream-100 transition-colors disabled:opacity-40 flex items-center gap-1.5"
              >
                <ChevronLeft className="w-4 h-4" /> Previous
              </button>

              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={() => handleSubmitAnswer(true)}
                  disabled={submitting || interviewState === 'RECORDING'}
                  className="px-4 py-2.5 rounded-xl text-sm font-medium text-charcoal-500 hover:text-charcoal-800 transition-colors flex items-center gap-1 disabled:opacity-40"
                >
                  <SkipForward className="w-4 h-4" /> Skip
                </button>

                {currentIdx < totalQuestions - 1 ? (
                  <button
                    type="button"
                    onClick={() => handleSubmitAnswer(false)}
                    disabled={submitting || !answerText.trim() || interviewState === 'RECORDING'}
                    className="px-6 py-2.5 rounded-xl text-sm font-bold text-white bg-sage-600 hover:bg-sage-700 transition-all shadow-sm disabled:opacity-40 flex items-center gap-2"
                  >
                    {submitting ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" /> Evaluating...
                      </>
                    ) : (
                      <>
                        <Send className="w-4 h-4" /> Save & Next
                      </>
                    )}
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={() => handleSubmitAnswer(false)}
                    disabled={submitting || !answerText.trim() || interviewState === 'RECORDING'}
                    className="px-6 py-2.5 rounded-xl text-sm font-bold text-white bg-emerald-600 hover:bg-emerald-700 transition-all shadow-sm disabled:opacity-40 flex items-center gap-2"
                  >
                    {submitting ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" /> Finalizing...
                      </>
                    ) : (
                      <>
                        <CheckCircle className="w-4 h-4" /> Finish & Get Results
                      </>
                    )}
                  </button>
                )}
              </div>
            </div>
          </div>

          {/* Right Side Dock: Video Proctor & Audio Monitor (4 Cols) */}
          <div className="lg:col-span-4 space-y-4 lg:sticky lg:top-6">
            <CameraProctor
              onLogAdded={(log) => setProctorLogs((prev) => [...prev, log])}
              isListening={isListening}
              interviewState={interviewState}
            />

            <div className="bg-white p-4 rounded-xl border border-cream-300 shadow-paper space-y-2.5">
              <p className="text-xs font-bold text-charcoal-800 flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5 text-sage-600" />
                <span>AI Interview Grounding</span>
              </p>
              <div className="text-xs text-charcoal-600 space-y-1">
                <p>• <strong>Target Role:</strong> {jobTitle}</p>
                <p>• <strong>Company Context:</strong> {company || 'General Tech'}</p>
                <p>• <strong>Evaluator:</strong> RAG + Groq AI Assessment</p>
              </div>
            </div>

            <div className="bg-cream-50/80 p-3.5 rounded-xl border border-cream-200 text-xs text-charcoal-600 space-y-1">
              <p className="font-semibold text-charcoal-800">💡 Interview Tips</p>
              <p>• Speak clearly into your mic or type anytime.</p>
              <p>• Use "Add More (Voice)" to append additional points without losing previous text.</p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (view === 'results') {
    const report = sessionResults?.feedback || {};
    const score = typeof report.score === 'number' ? report.score : 0;
    const scoreColor = score >= 80 ? 'text-emerald-600 border-emerald-500' : score >= 60 ? 'text-blue-600 border-blue-500' : score >= 40 ? 'text-amber-600 border-amber-500' : score >= 20 ? 'text-orange-600 border-orange-500' : 'text-terracotta-600 border-terracotta-500';
    const scoreLabel = score >= 80 ? 'Strong Performance' : score >= 60 ? 'Decent Attempt' : score >= 40 ? 'Needs Improvement' : score >= 20 ? 'Weak — Study Required' : 'Not Ready Yet';
    const scoreSub = score >= 80 ? 'You demonstrated solid technical depth.' : score >= 60 ? 'Good foundation — sharpen the details.' : score >= 40 ? 'Core concepts need more practice.' : score >= 20 ? 'Significant gaps in technical knowledge.' : 'Focus on fundamentals before your next interview.';

    return (
      <div className="max-w-4xl mx-auto py-8 px-4 font-sans space-y-8 fade-in">
        <div className="bg-white rounded-2xl border border-cream-300 shadow-paper p-8 text-center">
          <div className={`inline-flex items-center justify-center w-28 h-28 rounded-full border-4 mb-4 bg-cream-50 ${scoreColor}`}>
            <span className="text-3xl font-serif font-bold">{score}%</span>
          </div>
          <h2 className="text-2xl font-serif font-bold text-charcoal-900 mb-1">{scoreLabel}</h2>
          <p className="text-sm text-charcoal-500 mb-1">{scoreSub}</p>
          <p className="text-xs text-charcoal-400 mb-4">
            {jobTitle || 'Mock Interview'} • {questions.length} questions completed
          </p>

          {report.detailedAssessment && (
            <p className="text-sm text-charcoal-700 bg-cream-50 border border-cream-200 rounded-xl p-5 max-w-2xl mx-auto leading-relaxed text-left">
              {report.detailedAssessment}
            </p>
          )}

          <div className="flex items-center justify-center gap-4 mt-6">
            <button
              onClick={handlePracticeAgain}
              className="px-6 py-2.5 rounded-xl text-sm font-bold text-white bg-sage-600 hover:bg-sage-700 transition-all shadow-sm flex items-center gap-2"
            >
              <RotateCcw className="w-4 h-4" /> Practice Again
            </button>
            <a
              href="/dashboard"
              className="px-5 py-2.5 rounded-xl text-sm font-semibold text-charcoal-700 bg-cream-100 hover:bg-cream-200 transition-colors border border-cream-300"
            >
              Back to Dashboard
            </a>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="bg-white rounded-2xl border border-cream-300 shadow-paper p-6">
            <h3 className="font-serif font-bold text-charcoal-900 mb-4 flex items-center gap-2 text-base">
              <ThumbsUp className="w-5 h-5 text-emerald-600" /> Strengths
            </h3>
            {report.strengths?.length ? (
              <ul className="space-y-2.5">
                {report.strengths.map((s, i) => (
                  <li key={i} className="flex items-start gap-2.5 text-xs text-charcoal-700 leading-relaxed">
                    <CheckCircle className="w-4 h-4 text-emerald-600 mt-0.5 flex-shrink-0" />
                    <span>{s}</span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-xs text-charcoal-400">Consistent attempt across technical questions.</p>
            )}
          </div>

          <div className="bg-white rounded-2xl border border-cream-300 shadow-paper p-6">
            <h3 className="font-serif font-bold text-charcoal-900 mb-4 flex items-center gap-2 text-base">
              <Target className="w-5 h-5 text-amber-600" /> Areas to Improve
            </h3>
            {report.weaknesses?.length ? (
              <ul className="space-y-2.5">
                {report.weaknesses.map((w, i) => (
                  <li key={i} className="flex items-start gap-2.5 text-xs text-charcoal-700 leading-relaxed">
                    <Lightbulb className="w-4 h-4 text-amber-600 mt-0.5 flex-shrink-0" />
                    <span>{w}</span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-xs text-charcoal-400">Keep practicing depth on algorithmic complexity.</p>
            )}
          </div>
        </div>

        {report.improvementTips?.length > 0 && (
          <div className="bg-white rounded-2xl border border-cream-300 shadow-paper p-6">
            <h3 className="font-serif font-bold text-charcoal-900 mb-4 flex items-center gap-2 text-base">
              <BookOpen className="w-5 h-5 text-sage-600" /> Actionable Next Steps
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {report.improvementTips.map((tip, i) => (
                <div key={i} className="p-3.5 rounded-xl bg-cream-50 border border-cream-200 flex items-start gap-3">
                  <span className="w-5 h-5 rounded-full bg-sage-600 text-white flex items-center justify-center text-[10px] font-bold flex-shrink-0 mt-0.5">
                    {i + 1}
                  </span>
                  <p className="text-xs text-charcoal-800 leading-relaxed">{tip}</p>
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="bg-white rounded-2xl border border-cream-300 shadow-paper p-6">
          <h3 className="font-serif font-bold text-charcoal-900 mb-5 flex items-center gap-2 text-base">
            <Trophy className="w-5 h-5 text-terracotta-600" /> Question-by-Question Review
          </h3>

          <div className="space-y-3">
            {questions.map((q, i) => {
              const ans = savedAnswers[i];
              const isExpanded = expandedAnswerIdx === i;
              const qScore = ans?.score ?? 5;
              const scoreBadgeClr = qScore >= 7 ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : qScore >= 4 ? 'bg-amber-50 text-amber-700 border-amber-200' : 'bg-red-50 text-red-700 border-red-200';

              return (
                <div key={i} className="border border-cream-300 rounded-xl overflow-hidden">
                  <button
                    type="button"
                    onClick={() => setExpandedAnswerIdx(isExpanded ? null : i)}
                    className="w-full p-4 text-left flex items-center justify-between gap-4 bg-cream-50 hover:bg-cream-100 transition-colors"
                  >
                    <div className="flex items-center gap-3">
                      <span className="text-xs font-bold text-sage-700">Q{i + 1}</span>
                      <p className="text-xs font-medium text-charcoal-900 truncate max-w-md sm:max-w-lg">
                        {q.questionText}
                      </p>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className={`text-xs font-bold px-2.5 py-1 rounded-md border ${scoreBadgeClr}`}>
                        {qScore}/10
                      </span>
                      <span className="text-xs text-charcoal-400 font-bold">{isExpanded ? '▲' : '▼'}</span>
                    </div>
                  </button>

                  {isExpanded && (
                    <div className="p-4 bg-white border-t border-cream-200 space-y-3 text-xs">
                      <div>
                        <span className="font-semibold text-charcoal-500 uppercase tracking-wider text-[10px]">Your Answer:</span>
                        <p className="mt-1 text-charcoal-800 bg-cream-50 p-3 rounded-lg border border-cream-200">
                          {ans?.answer || 'No answer recorded'}
                        </p>
                      </div>
                      {ans?.feedback && (
                        <div>
                          <span className="font-semibold text-sage-700 uppercase tracking-wider text-[10px]">AI Evaluation:</span>
                          <p className="mt-1 text-sage-900 bg-sage-50/60 p-3 rounded-lg border border-sage-200">
                            {ans.feedback}
                          </p>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </div>
    );
  }

  return null;
}
