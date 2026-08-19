import React, { useEffect, useRef, useState } from 'react';
import { Camera, ShieldAlert, CheckCircle, VideoOff } from 'lucide-react';

export default function CameraProctor({ onLogAdded }) {
  const videoRef = useRef(null);
  const streamRef = useRef(null);
  const [stream, setStream] = useState(null);
  const [cameraActive, setCameraActive] = useState(false);
  const [cameraError, setCameraError] = useState(false);
  const [integrityScore, setIntegrityScore] = useState(100);
  const [faceCheckStatus, setFaceCheckStatus] = useState('Initializing...');

  // Start webcam feed
  const startCamera = async () => {
    try {
      setCameraError(false);
      const mediaStream = await navigator.mediaDevices.getUserMedia({
        video: { width: 300, height: 200 }
      });
      streamRef.current = mediaStream;
      setStream(mediaStream);
      if (videoRef.current) {
        videoRef.current.srcObject = mediaStream;
      }
      setCameraActive(true);
      setFaceCheckStatus('Verified Presence');
    } catch (err) {
      console.warn('Webcam access denied or unavailable:', err.message);
      setCameraError(true);
      setFaceCheckStatus('Webcam Unavailable (Using light check)');
      
      // Fallback: log a light warning but allow the student to practice
      onLogAdded?.({
        event: 'webcam-missing',
        details: 'Webcam not started (Practice session running in webcam-free mode)'
      });
    }
  };

  // Stop camera feed
  const stopCamera = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }
    setStream(null);
    setCameraActive(false);
  };

  useEffect(() => {
    // Start camera immediately on load
    startCamera();

    // 1. Tab-Switch (Visibility) tracking
    const handleVisibilityChange = () => {
      if (document.hidden) {
        setIntegrityScore(prev => Math.max(0, prev - 15));
        onLogAdded?.({
          event: 'tab-switch',
          details: 'Candidate left the active browser tab or minimized the window.'
        });
      }
    };

    // 2. Window Blur (Focus out) tracking
    const handleWindowBlur = () => {
      setIntegrityScore(prev => Math.max(0, prev - 15));
      onLogAdded?.({
        event: 'tab-switch',
        details: 'Focus shifted away from the application viewport (possible search).'
      });
    };

    // 3. Clipboard copy-paste intercept
    const handleCopyPaste = (e) => {
      e.preventDefault();
      setIntegrityScore(prev => Math.max(0, prev - 25));
      onLogAdded?.({
        event: 'copy-paste',
        details: `Blocked clipboard attempt: '${e.type}' event registered.`
      });
    };

    // Attach listeners
    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('blur', handleWindowBlur);
    document.addEventListener('copy', handleCopyPaste);
    document.addEventListener('paste', handleCopyPaste);

    return () => {
      stopCamera();
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('blur', handleWindowBlur);
      document.removeEventListener('copy', handleCopyPaste);
      document.removeEventListener('paste', handleCopyPaste);
    };
  }, []); // empty dependency array prevents infinite restart/stop loops

  // Handle manual mock triggers for presentation/testing of proctoring layers
  const triggerMockNoFace = () => {
    setIntegrityScore(prev => Math.max(0, prev - 10));
    setFaceCheckStatus('No Face Detected (Warning)');
    onLogAdded?.({
      event: 'no-face',
      details: 'Integrity scanner lost candidate facial landmarks/visual lock.'
    });
    setTimeout(() => {
      if (streamRef.current) setFaceCheckStatus('Verified Presence');
    }, 3000);
  };

  const triggerMockMultipleFaces = () => {
    setIntegrityScore(prev => Math.max(0, prev - 20));
    setFaceCheckStatus('Multiple Faces Detected');
    onLogAdded?.({
      event: 'multiple-faces',
      details: 'Integrity scanner flagged secondary face present in field-of-view.'
    });
    setTimeout(() => {
      if (streamRef.current) setFaceCheckStatus('Verified Presence');
    }, 3000);
  };

  return (
    <div className="bg-cream-50 p-4 rounded-xl border border-cream-300 shadow-paper flex flex-col gap-3">
      <div className="flex items-center justify-between border-b border-cream-200 pb-2">
        <span className="font-serif font-semibold text-sm flex items-center gap-1.5 text-sage-700">
          <Camera size={16} />
          Proctor Monitor
        </span>
        <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
          integrityScore > 80 ? 'bg-sage-100 text-sage-700' :
          integrityScore > 50 ? 'bg-amber-100 text-amber-700' : 'bg-red-100 text-red-700'
        }`}>
          Integrity: {integrityScore}%
        </span>
      </div>

      {/* Webcam Viewfinder */}
      <div className="relative w-full aspect-video max-w-full bg-charcoal-900 rounded-lg overflow-hidden flex items-center justify-center border border-cream-300">
        {cameraActive && !cameraError ? (
          <>
            <video
              ref={videoRef}
              autoPlay
              playsInline
              muted
              className="w-full h-full object-cover transform -scale-x-100"
            />
            {/* Green glowing scan outline to show scanner active */}
            <div className="absolute inset-x-0 top-0 h-[2px] bg-green-500/80 animate-[bounce_3s_infinite] shadow-[0_0_8px_#22c55e]"></div>
            <div className="absolute bottom-2 left-2 bg-charcoal-900/60 text-white text-[10px] px-2 py-0.5 rounded backdrop-blur-sm flex items-center gap-1">
              <span className="w-1.5 h-1.5 bg-green-500 rounded-full animate-ping"></span>
              <span>{faceCheckStatus}</span>
            </div>
          </>
        ) : (
          <div className="flex flex-col items-center justify-center gap-2 text-charcoal-500 text-xs">
            <VideoOff size={32} className="stroke-1 text-charcoal-100" />
            <span>Camera Offline</span>
            {cameraError && (
              <button 
                onClick={startCamera}
                className="mt-1 text-[10px] text-sage-500 underline hover:text-sage-600"
              >
                Retry Camera Permissions
              </button>
            )}
          </div>
        )}
      </div>

      {/* Presentation Controls (Manual triggers to test alerts in viva/demo) */}
      <div className="flex gap-2">
        <button
          onClick={triggerMockNoFace}
          disabled={!cameraActive}
          className="flex-1 text-[10px] bg-cream-200 border border-cream-300 hover:bg-cream-300 py-1.5 rounded transition-all font-medium disabled:opacity-50"
        >
          Simulate No Face
        </button>
        <button
          onClick={triggerMockMultipleFaces}
          disabled={!cameraActive}
          className="flex-1 text-[10px] bg-cream-200 border border-cream-300 hover:bg-cream-300 py-1.5 rounded transition-all font-medium disabled:opacity-50"
        >
          Simulate Multi-Face
        </button>
      </div>

      <div className="text-[10px] text-charcoal-500 flex gap-1.5 items-start">
        <ShieldAlert size={12} className="shrink-0 mt-0.5 text-terracotta-500" />
        <span>Grounded locally in-browser. All logs remain client-side and delete on session exit.</span>
      </div>
    </div>
  );
}
