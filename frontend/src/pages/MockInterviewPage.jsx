import React, { useEffect, useState, useRef } from 'react';
import { ShieldAlert, Play, Square, Mic, Volume2, Award, ClipboardList, Loader2, AlertCircle } from 'lucide-react';
import CameraProctor from '../components/CameraProctor.jsx';
import AIAvatar from '../components/AIAvatar.jsx';

export default function MockInterviewPage({ user, token }) {
  const [targetCompany, setTargetCompany] = useState(user?.targetCompany || 'Google');
  const [interviewStarted, setInterviewStarted] = useState(false);
  const [loading, setLoading] = useState(false);
  const [sessionId, setSessionId] = useState(null);
  
  // Permission management
  const [permissionsGranted, setPermissionsGranted] = useState(false);
  const [permissionError, setPermissionError] = useState(null);
  const [requestingPerms, setRequestingPerms] = useState(false);

  // State Machine: 'idle' | 'ai_speaking' | 'listening' | 'processing'
  const [avatarState, setAvatarState] = useState('idle');

  // Speech & questions
  const [questions, setQuestions] = useState([]);
  const [currentQIdx, setCurrentQIdx] = useState(0);
  const [verbalTranscript, setVerbalTranscript] = useState('');
  const [isRecording, setIsRecording] = useState(false);
  const [proctorLogs, setProctorLogs] = useState([]);

  // Final review report
  const [evaluation, setEvaluation] = useState(null);

  // References for Web Speech API & Web Audio
  const recognitionRef = useRef(null);
  const synthRef = window.speechSynthesis;
  const audioRef = useRef(null);
  const audioCtxRef = useRef(null);
  const micStreamRef = useRef(null);
  const analyserRef = useRef(null);
  const animationFrameIdRef = useRef(null);

  // Initialize Speech Recognition
  const initSpeechRecognition = () => {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
      console.warn('Speech recognition not supported in this browser.');
      return;
    }
    const recognition = new SpeechRecognition();
    recognition.continuous = false;
    recognition.interimResults = false;
    recognition.lang = 'en-IN'; // Optimized for Indian-accented English

    recognition.onstart = () => {
      setIsRecording(true);
      setVerbalTranscript('Listening... Speak clearly.');
    };

    recognition.onresult = (event) => {
      const text = event.results[0][0].transcript;
      setVerbalTranscript(text);
    };

    recognition.onerror = (event) => {
      console.error('Speech recognition error:', event.error);
      setIsRecording(false);
      setVerbalTranscript('Failed to capture speech. Please type your answer below.');
      setAvatarState('listening'); // Keep state as listening so they can type
    };

    recognition.onend = () => {
      setIsRecording(false);
    };

    recognitionRef.current = recognition;
  };

  useEffect(() => {
    initSpeechRecognition();
    // Stop any speaking on page unmount
    return () => {
      if (synthRef) synthRef.cancel();
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current.src = '';
      }
      stopBargeInDetection();
    };
  }, []);

  // Request camera and microphone permissions gracefully
  const requestMediaPermissions = async () => {
    setPermissionError(null);
    setRequestingPerms(true);
    try {
      console.log('Requesting webcam and audio permissions...');
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: true });
      // Stop tracks immediately to avoid keeping hardware active
      stream.getTracks().forEach(track => track.stop());
      setPermissionsGranted(true);
      return true;
    } catch (err) {
      console.warn('Media permissions rejected:', err.name, err.message);
      let errMsg = 'Failed to access camera and microphone. Please check system settings.';
      if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError') {
        errMsg = 'Permission denied. Please click the camera icon in your URL bar and allow access to continue.';
      } else if (err.name === 'NotFoundError' || err.name === 'DevicesNotFoundError') {
        errMsg = 'No webcam or microphone device detected on this system.';
      } else if (err.name === 'NotReadableError' || err.name === 'TrackStartError') {
        errMsg = 'Webcam or microphone is currently in use by another application (e.g. Zoom, Teams, or another tab). Please close other software and try again.';
      }
      setPermissionError(errMsg);
      setPermissionsGranted(false);
      return false;
    } finally {
      setRequestingPerms(false);
    }
  };

  // Fallback native speech synthesis in case backend proxy fails or key is missing
  const fallbackSpeakQuestion = (text) => {
    if (!synthRef) {
      setAvatarState('listening');
      return;
    }
    
    synthRef.cancel();
    setAvatarState('ai_speaking');

    const utterance = new SpeechSynthesisUtterance(text);
    const voices = synthRef.getVoices();
    const indVoice = voices.find(v => v.lang.includes('en-IN') || v.lang.includes('en_IN'));
    if (indVoice) {
      utterance.voice = indVoice;
    }
    
    utterance.rate = 0.95; // Clear pace

    utterance.onend = () => {
      activateMicrophoneForAnswer();
    };

    utterance.onerror = (e) => {
      console.error('Fallback native TTS error:', e);
      activateMicrophoneForAnswer();
    };

    synthRef.speak(utterance);
  };

  // Text-To-Speech (TTS): Speaks question aloud using Sarvam AI Bulbul model
  const speakQuestion = async (text) => {
    // 1. Reset any running sound
    synthRef?.cancel();
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.src = '';
    }
    stopBargeInDetection();

    setAvatarState('ai_speaking');

    try {
      const res = await fetch('/api/interviews/tts', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ text })
      });

      if (!res.ok) throw new Error(`HTTP Error status ${res.status}`);
      const data = await res.json();

      if (data.audioContent) {
        console.log('Playing Sarvam AI Bulbul voice model TTS...');
        const audio = new Audio(`data:audio/wav;base64,${data.audioContent}`);
        audioRef.current = audio;

        audio.onended = () => {
          stopBargeInDetection();
          activateMicrophoneForAnswer();
        };

        audio.onerror = (e) => {
          console.error('HTML5 audio play failed, falling back to native TTS:', e);
          fallbackSpeakQuestion(text);
        };

        await audio.play();

        // Start monitoring mic stream for barge-in interruptions
        startBargeInDetection();
      } else {
        console.warn('Sarvam TTS key not configured or failed, falling back to native browser TTS');
        fallbackSpeakQuestion(text);
      }
    } catch (err) {
      console.warn('Sarvam API call failed, falling back to browser TTS:', err.message);
      fallbackSpeakQuestion(text);
    }
  };

  // Web Audio AnalyserNode monitoring for voice Barge-In
  const startBargeInDetection = async () => {
    stopBargeInDetection(); // ensure clean state
    
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      micStreamRef.current = stream;

      const AudioContextClass = window.AudioContext || window.webkitAudioContext;
      const audioCtx = new AudioContextClass();
      audioCtxRef.current = audioCtx;

      const source = audioCtx.createMediaStreamSource(stream);
      const analyser = audioCtx.createAnalyser();
      analyser.fftSize = 256;
      analyserRef.current = analyser;
      source.connect(analyser);

      const bufferLength = analyser.frequencyBinCount;
      const dataArray = new Uint8Array(bufferLength);

      // Sensitivity settings: Speak threshold set to 65 (of 255)
      // Laptop speakers echo protection: Counter tracks sustained voice activity
      const speakThreshold = 65; 
      let speakCounter = 0;

      const monitorMic = () => {
        if (!analyserRef.current) return;
        analyser.getByteFrequencyData(dataArray);

        // Find max peak amplitude in frequency band
        let maxVal = 0;
        for (let i = 0; i < bufferLength; i++) {
          if (dataArray[i] > maxVal) {
            maxVal = dataArray[i];
          }
        }

        if (maxVal > speakThreshold) {
          speakCounter++;
          // Trigger barge-in if voice is sustained for ~160ms (10 frames)
          if (speakCounter > 8) {
            console.log('Barge-in: Mic input voice detected! Halting AI playback.');
            handleBargeInInterruption();
            return;
          }
        } else {
          speakCounter = Math.max(0, speakCounter - 1);
        }

        animationFrameIdRef.current = requestAnimationFrame(monitorMic);
      };

      animationFrameIdRef.current = requestAnimationFrame(monitorMic);
    } catch (e) {
      console.warn('Mic barge-in monitor initialize bypassed:', e.message);
    }
  };

  const stopBargeInDetection = () => {
    if (animationFrameIdRef.current) {
      cancelAnimationFrame(animationFrameIdRef.current);
      animationFrameIdRef.current = null;
    }
    if (audioCtxRef.current) {
      if (audioCtxRef.current.state !== 'closed') {
        audioCtxRef.current.close();
      }
      audioCtxRef.current = null;
    }
    if (micStreamRef.current) {
      micStreamRef.current.getTracks().forEach(track => track.stop());
      micStreamRef.current = null;
    }
    analyserRef.current = null;
  };

  const handleBargeInInterruption = () => {
    stopBargeInDetection();

    // 1. Immediately halt audio streams
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.src = '';
    }
    synthRef?.cancel();

    // 2. Acknowledge user interruption and transition to listening immediately
    setAvatarState('listening');
    setVerbalTranscript('Listening... Speak your answer now.');

    // 3. Trigger Web Speech Recognition recording
    if (recognitionRef.current && !isRecording) {
      try {
        recognitionRef.current.start();
      } catch (e) {
        console.warn('Recognition failed to start on barge-in:', e.message);
      }
    }
  };

  const activateMicrophoneForAnswer = () => {
    setAvatarState('listening');
    if (recognitionRef.current && !isRecording) {
      try {
        recognitionRef.current.start();
      } catch (e) {
        console.warn('Recognition start failed:', e.message);
      }
    }
  };

  // Launch Session
  const handleStartInterview = async () => {
    // 1. Enforce media permission check
    if (!permissionsGranted) {
      const allowed = await requestMediaPermissions();
      if (!allowed) return;
    }

    setLoading(true);
    setEvaluation(null);
    setProctorLogs([]);
    setCurrentQIdx(0);
    setVerbalTranscript('');
    setAvatarState('processing');
    
    try {
      const res = await fetch('/api/interviews/start', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ company: targetCompany })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to start interview');

      setSessionId(data.sessionId);
      setQuestions(data.questions || []);
      setInterviewStarted(true);
      
      // Speak the first question aloud
      setTimeout(() => {
        speakQuestion(data.firstQuestion);
      }, 800);

    } catch (e) {
      alert(e.message);
      setAvatarState('idle');
    } finally {
      setLoading(false);
    }
  };

  // Record Answer manual toggle
  const toggleRecording = () => {
    if (!recognitionRef.current) {
      alert('Speech recognition is not supported in this browser. Please type your answer.');
      return;
    }

    if (isRecording) {
      recognitionRef.current.stop();
      setAvatarState('listening');
    } else {
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current.src = '';
      }
      synthRef?.cancel();
      stopBargeInDetection();
      
      setAvatarState('listening');
      try {
        recognitionRef.current.start();
      } catch (e) {
        console.warn('Manual record trigger failed:', e.message);
      }
    }
  };

  // Submit Answer flow
  const handleNextAnswerSubmit = async () => {
    if (isRecording && recognitionRef.current) {
      recognitionRef.current.stop();
    }
    stopBargeInDetection();

    setLoading(true);
    setAvatarState('processing');

    const isLast = currentQIdx === questions.length - 1;
    const currentQuestionText = questions[currentQIdx];

    try {
      const res = await fetch('/api/interviews/submit-answer', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          sessionId,
          question: currentQuestionText,
          answer: verbalTranscript || '(No answer provided)',
          proctorLogs, // sends tab-switch/no-face triggers gathered so far
          isLast
        })
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to submit response');

      if (isLast) {
        // Reset state, close camera, show feedback evaluation
        setInterviewStarted(false);
        setEvaluation(data.session?.feedback || { score: 75 });
        setAvatarState('idle');
      } else {
        // Proceed to next question
        const nextIdx = currentQIdx + 1;
        setCurrentQIdx(nextIdx);
        setVerbalTranscript('');
        
        // Speak next question
        setTimeout(() => {
          speakQuestion(questions[nextIdx]);
        }, 800);
      }

    } catch (e) {
      alert(`Error submitting answer: ${e.message}`);
      setAvatarState('listening');
    } finally {
      setLoading(false);
    }
  };

  // Real-time proctor log callback
  const handleProctorLog = (logItem) => {
    // Add real timestamp to keep log date parsing solid
    setProctorLogs(prev => [...prev, { ...logItem, timestamp: Date.now() }]);
  };

  return (
    <div className="fade-in max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 flex flex-col gap-8">
      {/* Page Header */}
      <div className="border-b border-cream-300 pb-6">
        <h1 className="text-3xl font-serif font-bold text-charcoal-900 flex items-center gap-2">
          <ShieldAlert className="text-sage-500" />
          GRID AI Mock Interview Arena
        </h1>
        <p className="text-sm text-charcoal-500">
          Conduct realistic verbal technical reviews with active eye presence indicators and focus logs.
        </p>
      </div>

      {/* Media Permission Warning Banner */}
      {!permissionsGranted && !interviewStarted && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="flex items-start gap-3">
            <AlertCircle className="text-terracotta-500 shrink-0 mt-0.5" size={18} />
            <div>
              <h4 className="text-xs font-bold text-charcoal-900">Microphone & Camera Access Required</h4>
              <p className="text-[11px] text-charcoal-500 mt-0.5 leading-relaxed">
                We need device permission to run the audio speech recognizer and verify candidate integrity.
              </p>
              {permissionError && (
                <p className="text-[10px] text-red-600 font-semibold mt-1">{permissionError}</p>
              )}
            </div>
          </div>
          <button
            onClick={requestMediaPermissions}
            disabled={requestingPerms}
            className="bg-sage-500 hover:bg-sage-600 text-white text-xs font-semibold px-4 py-2 rounded-lg shadow-paper transition-all shrink-0 disabled:opacity-50"
          >
            {requestingPerms ? 'Granting...' : 'Grant Permissions'}
          </button>
        </div>
      )}

      {/* Split Layout: Control panel & camera monitor */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 items-start">
        
        {/* Left/Middle Column (Q&A Flow) */}
        <div className="lg:col-span-2 flex flex-col gap-6">
          {!interviewStarted && !evaluation && (
            <div className="bg-cream-200 border border-cream-300 rounded-xl p-8 shadow-paper text-center flex flex-col gap-6 max-w-xl mx-auto w-full animate-scale-up">
              <h3 className="text-xl font-serif font-bold text-charcoal-900">Setup Mock Session</h3>
              <p className="text-xs text-charcoal-500 max-w-md mx-auto">
                The session will generate 3 custom technical queries. Ensure your webcam is active and window tab focus is sustained.
              </p>

              {/* Speaker Echo Headphones Recommendation Tip */}
              <div className="bg-amber-50 border border-amber-100 rounded-lg p-3 text-left max-w-xs mx-auto">
                <p className="text-[10px] text-amber-800 leading-relaxed">
                  💡 **Headphones Recommended:** Since this interview supports <strong>verbal barge-in</strong> (the AI halts speaking immediately when you speak), wearing headphones prevents speaker echo from falsely interrupting the interviewer.
                </p>
              </div>

              <div className="flex flex-col gap-2 max-w-xs mx-auto text-left w-full">
                <label className="text-[10px] font-bold text-charcoal-900 uppercase">Target Company Name</label>
                <input
                  type="text"
                  value={targetCompany}
                  onChange={(e) => setTargetCompany(e.target.value)}
                  placeholder="e.g. Google"
                  className="px-3 py-2 bg-white border border-cream-300 rounded-lg text-xs focus:outline-none focus:border-sage-500"
                />
              </div>

              <button
                onClick={handleStartInterview}
                disabled={loading}
                className="bg-sage-500 hover:bg-sage-600 text-white font-semibold py-3 rounded-lg shadow-paper transition-all text-xs max-w-xs mx-auto w-full flex items-center justify-center gap-1.5 disabled:opacity-50"
              >
                {loading ? <Loader2 size={12} className="animate-spin" /> : null}
                <span>Start Interview Session</span>
              </button>
            </div>
          )}

          {/* Active Interview Panel */}
          {interviewStarted && questions.length > 0 && (
            <div className="bg-cream-200 border border-cream-300 rounded-xl p-6 shadow-paper flex flex-col gap-6">
              
              {/* Pulse Orb AI Avatar Visualizer */}
              <div className="flex justify-center py-4 border-b border-cream-300">
                <AIAvatar state={avatarState} />
              </div>

              {/* Turn Status Indicator */}
              <div className="flex items-center gap-3 bg-white border border-cream-300 rounded-lg p-3 shadow-inner">
                <div className={`w-3 h-3 rounded-full ${
                  avatarState === 'ai_speaking' ? 'bg-sage-500 animate-pulse' :
                  avatarState === 'listening' ? 'bg-terracotta-500 animate-pulse' :
                  avatarState === 'processing' ? 'bg-amber-500 animate-ping' : 'bg-charcoal-400'
                }`} />
                <span className="text-[11px] font-bold uppercase tracking-wider text-charcoal-800">
                  {avatarState === 'ai_speaking' && "AI Interviewer (Speaking Question aloud... Please listen)"}
                  {avatarState === 'listening' && "Candidate Turn (Speak response or type below)"}
                  {avatarState === 'processing' && "Interviewer Processing (Analyzing input...)"}
                  {avatarState === 'idle' && "Session Paused"}
                </span>
              </div>

              <div className="flex justify-between items-center text-xs text-charcoal-500 font-semibold uppercase tracking-wider">
                <span>Interviewer Question {currentQIdx + 1} of {questions.length}</span>
                <span className="text-sage-500 bg-white px-2.5 py-0.5 rounded-full border border-cream-300 font-bold">
                  {targetCompany} Mock
                </span>
              </div>

              {/* TTS Prompt Box */}
              <div className="bg-white p-5 rounded-lg border border-cream-300 font-serif font-medium text-sm text-charcoal-900 leading-relaxed flex items-start gap-3">
                <span className="text-xl shrink-0">💬</span>
                <span>{questions[currentQIdx]}</span>
              </div>

              {/* Headphones active session reminder tip */}
              <div className="bg-amber-50/50 border border-amber-100/50 rounded-lg p-2.5 text-[10px] text-amber-800 flex items-start gap-1.5 leading-relaxed">
                <span>💡</span>
                <span>Wearing headphones is recommended. The interview features voice-activated barge-in, which stops the AI immediately when you start speaking.</span>
              </div>

              {/* Verbal Transcript Box */}
              <div className="flex flex-col gap-1.5">
                <label className="text-[10px] font-bold text-charcoal-700 uppercase tracking-widest flex items-center justify-between">
                  <span>Candidate Verbal Response</span>
                  {avatarState === 'listening' && (
                    <span className="text-terracotta-500 font-bold animate-pulse">● System Mic Active</span>
                  )}
                </label>
                <textarea
                  value={verbalTranscript}
                  onChange={(e) => setVerbalTranscript(e.target.value)}
                  placeholder="Your verbal answers will appear here in real-time, or you can type directly..."
                  rows={4}
                  disabled={avatarState === 'ai_speaking' || avatarState === 'processing'}
                  className="w-full p-4 bg-white border border-cream-300 rounded-lg text-xs font-semibold focus:outline-none focus:border-sage-500 disabled:opacity-50"
                />
              </div>

              {/* Controls */}
              <div className="flex justify-between items-center">
                <button
                  onClick={toggleRecording}
                  disabled={avatarState === 'ai_speaking' || avatarState === 'processing'}
                  className={`flex items-center gap-1.5 px-4 py-2.5 rounded-lg text-xs font-semibold transition-all ${
                    isRecording 
                      ? 'bg-terracotta-500 hover:bg-terracotta-600 text-white shadow-paper' 
                      : 'bg-white border border-cream-300 hover:bg-cream-300 text-charcoal-900'
                  } disabled:opacity-50`}
                >
                  <Mic size={14} />
                  <span>{isRecording ? 'Stop Recording' : 'Push to Speak'}</span>
                </button>

                <button
                  onClick={handleNextAnswerSubmit}
                  disabled={loading || avatarState === 'ai_speaking'}
                  className="bg-sage-500 hover:bg-sage-600 text-white font-semibold text-xs px-5 py-2.5 rounded-lg shadow-paper transition-all disabled:opacity-50 flex items-center gap-1.5"
                >
                  {loading ? <Loader2 size={12} className="animate-spin" /> : null}
                  <span>{currentQIdx === questions.length - 1 ? 'Finish Interview' : 'Submit & Next'}</span>
                </button>
              </div>

            </div>
          )}

          {/* Review Report Display */}
          {evaluation && (
            <div className="bg-cream-200 border border-cream-300 rounded-xl p-6 shadow-paper flex flex-col gap-6 animate-scale-up">
              
              <div className="flex items-center gap-3 border-b border-cream-300 pb-4">
                <Award size={28} className="text-sage-500" />
                <div>
                  <h3 className="text-lg font-serif font-bold text-charcoal-900">AI Evaluation Report</h3>
                  <p className="text-[10px] text-charcoal-500 uppercase tracking-wider font-semibold">
                    {targetCompany} Mock Performance
                  </p>
                </div>
              </div>

              {/* Scoring summary */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="bg-white p-4 rounded-lg border border-cream-300 text-center">
                  <div className="text-[10px] text-charcoal-700 font-bold uppercase">Overall Score</div>
                  <div className="text-2xl font-serif font-bold text-sage-500 mt-1">{evaluation.score} / 100</div>
                </div>

                <div className="bg-white p-4 rounded-lg border border-cream-300 text-center sm:col-span-2">
                  <div className="text-[10px] text-charcoal-700 font-bold uppercase text-left">Strengths</div>
                  <ul className="text-[10px] text-sage-700 font-semibold text-left list-disc list-inside mt-1.5 space-y-0.5">
                    {evaluation.strengths && evaluation.strengths.length > 0 ? (
                      evaluation.strengths.map((str, idx) => <li key={idx}>{str}</li>)
                    ) : (
                      <li>Able to answer technical fundamentals.</li>
                    )}
                  </ul>
                </div>
              </div>

              {/* Weaknesses */}
              <div className="bg-white p-4 rounded-lg border border-cream-300">
                <div className="text-[10px] text-charcoal-700 font-bold uppercase mb-1.5">Areas for Improvement</div>
                <ul className="text-[10px] text-terracotta-700 font-semibold list-disc list-inside space-y-1">
                  {evaluation.weaknesses && evaluation.weaknesses.length > 0 ? (
                    evaluation.weaknesses.map((wk, idx) => <li key={idx}>{wk}</li>)
                  ) : (
                    <li>Explain the algorithmic space complexities and trace variables clearly.</li>
                  )}
                </ul>
              </div>

              {/* Detailed assessment */}
              <div className="bg-white p-4 rounded-lg border border-cream-300">
                <div className="text-[10px] text-charcoal-700 font-bold uppercase mb-2">Detailed Conceptual Assessment</div>
                <div className="text-xs text-charcoal-900 leading-relaxed font-sans prose max-w-none">
                  {evaluation.detailedAssessment || 'Review complete. Focus on resolving dynamic programming base-cases.'}
                </div>
              </div>

              <button
                onClick={() => setEvaluation(null)}
                className="bg-sage-500 hover:bg-sage-600 text-white font-semibold text-xs py-3 rounded-lg shadow-paper transition-all"
              >
                Start New Session
              </button>

            </div>
          )}
        </div>

        {/* Right Column: Camera Proctor Monitor */}
        <div className="lg:col-span-1">
          <div className="bg-cream-200 border border-cream-300 rounded-xl p-5 shadow-paper flex flex-col gap-4">
            <h3 className="font-serif font-bold text-charcoal-900 flex items-center justify-between">
              <span>Proctoring Feed</span>
              {interviewStarted && (
                <span className="w-2.5 h-2.5 bg-red-500 rounded-full animate-ping"></span>
              )}
            </h3>
            
            {/* Camera Proctoring Component - render conditionally on interview start */}
            {interviewStarted ? (
              <CameraProctor 
                onLogAdded={handleProctorLog} 
              />
            ) : (
              <div className="aspect-video bg-charcoal-900/10 border border-dashed border-cream-300 rounded-lg flex items-center justify-center text-xs text-charcoal-500 italic">
                Camera feed offline until session starts
              </div>
            )}

            <div className="border-t border-cream-300 pt-4 flex flex-col gap-2">
              <h4 className="text-[10px] font-bold text-charcoal-900 uppercase">Integrity Log</h4>
              <div className="h-28 bg-white border border-cream-300 rounded-lg p-2.5 overflow-y-auto flex flex-col gap-1.5">
                {proctorLogs.map((log, idx) => (
                  <div key={idx} className="text-[9px] text-terracotta-500 font-semibold">
                    [{log.event}] at {new Date(log.timestamp).toLocaleTimeString()}: {log.details}
                  </div>
                ))}
                {proctorLogs.length === 0 && (
                  <div className="text-[9px] text-charcoal-400 italic text-center py-6">
                    {interviewStarted ? 'Monitoring webcam & window focus...' : 'Integrity logs will appear here during active session.'}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

      </div>
    </div>
  );
}
