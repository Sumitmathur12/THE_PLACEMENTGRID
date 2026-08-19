import React, { useEffect, useRef } from 'react';

export default function AIAvatar({ state, audioContext, audioStream }) {
  const canvasRef = useRef(null);
  const animationRef = useRef(null);
  const analyserRef = useRef(null);

  useEffect(() => {
    if (!audioContext || !audioStream) {
      return;
    }

    try {
      const analyser = audioContext.createAnalyser();
      analyser.fftSize = 64;
      const source = audioContext.createMediaStreamSource(audioStream);
      source.connect(analyser);
      analyserRef.current = analyser;
    } catch (e) {
      console.warn('AudioContext Analyser binding failed:', e.message);
    }

    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
    };
  }, [audioContext, audioStream]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    let width = canvas.width = 160;
    let height = canvas.height = 160;

    const render = () => {
      ctx.clearRect(0, 0, width, height);
      
      // Calculate frequency data if speaking
      let average = 0;
      if (state === 'ai_speaking' && analyserRef.current) {
        const bufferLength = analyserRef.current.frequencyBinCount;
        const dataArray = new Uint8Array(bufferLength);
        analyserRef.current.getByteFrequencyData(dataArray);
        
        let sum = 0;
        for (let i = 0; i < bufferLength; i++) {
          sum += dataArray[i];
        }
        average = sum / bufferLength;
      }

      const centerX = width / 2;
      const centerY = height / 2;
      
      // Determine orb properties based on state
      let baseRadius = 45;
      let scale = 1 + (average / 150); // scales up with volume
      let colorGlow = 'rgba(58, 96, 83, 0.2)'; // Sage glow
      let colorCore = '#3a6053'; // Sage core

      if (state === 'listening') {
        // Pulse gently when listening
        const pulse = Math.sin(Date.now() / 150) * 4;
        scale = 1 + (pulse / 80);
        colorGlow = 'rgba(194, 109, 75, 0.25)'; // Terracotta glow
        colorCore = '#c26d4b'; // Terracotta core
      } else if (state === 'processing') {
        // Fast dynamic rotating ripple when processing
        const pulse = Math.sin(Date.now() / 80) * 3;
        scale = 1 + (pulse / 60);
        colorGlow = 'rgba(80, 110, 150, 0.25)'; // Cool indigo glow
        colorCore = '#4b75a4'; // Cool indigo core
      } else if (state === 'ai_speaking') {
        // If not connected to real audio stream, do simulated wave pulse
        if (average === 0) {
          const simVolume = 0.5 + Math.sin(Date.now() / 50) * 0.4;
          scale = 1 + (simVolume * 0.25);
        }
      } else {
        // Idle
        colorGlow = 'rgba(142, 142, 142, 0.15)';
        colorCore = '#8e8e8e';
      }

      const r = baseRadius * scale;

      // Draw multi-layered glow rings
      const glowCount = 3;
      for (let i = glowCount; i > 0; i--) {
        ctx.beginPath();
        ctx.arc(centerX, centerY, r + (i * 12), 0, 2 * Math.PI);
        ctx.fillStyle = colorGlow;
        ctx.fill();
      }

      // Draw solid core
      ctx.beginPath();
      ctx.arc(centerX, centerY, r, 0, 2 * Math.PI);
      
      // Gradient core fill
      const grad = ctx.createRadialGradient(centerX - 10, centerY - 10, r * 0.1, centerX, centerY, r);
      grad.addColorStop(0, '#ffffff');
      grad.addColorStop(0.3, colorCore);
      grad.addColorStop(1, colorCore);
      
      ctx.fillStyle = grad;
      ctx.fill();

      // Core border outline
      ctx.strokeStyle = 'rgba(255,255,255,0.4)';
      ctx.lineWidth = 1.5;
      ctx.stroke();

      animationRef.current = requestAnimationFrame(render);
    };

    render();

    return () => {
      cancelAnimationFrame(animationRef.current);
    };
  }, [state]);

  return (
    <div class="flex flex-col items-center gap-3">
      <div class="relative w-40 h-40 flex items-center justify-center bg-white rounded-full shadow-paper border border-cream-300">
        <canvas ref={canvasRef} width="160" height="160" class="block" />
        
        {/* State Label HUD Overlay */}
        <div class="absolute bottom-2.5 bg-charcoal-900 text-white text-[8px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full">
          {state.replace('_', ' ')}
        </div>
      </div>
    </div>
  );
}
