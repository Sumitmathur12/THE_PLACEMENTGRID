import React, { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { Compass, BookOpen, Target, Shield, ChevronRight, CheckCircle2, Award, Zap, RefreshCw, BarChart2 } from 'lucide-react';

const companiesList = [
  { name: 'Google', logo: '🔍' },
  { name: 'Microsoft', logo: '💻' },
  { name: 'Amazon', logo: '📦' },
  { name: 'TCS', logo: '🌐' },
  { name: 'Infosys', logo: '⚡' },
  { name: 'Adobe', logo: '🎨' },
  { name: 'Salesforce', logo: '☁️' },
  { name: 'Flipkart', logo: '🛒' },
  { name: 'Razorpay', logo: '💳' },
  { name: 'Accenture', logo: '↗️' },
  { name: 'Wipro', logo: '🏢' },
  { name: 'Cognizant', logo: '🏢' },
  { name: 'Capgemini', logo: '🏢' },
  { name: 'Paytm', logo: '🏢' },
  { name: 'PhonePe', logo: '🏢' },
  { name: 'Zomato', logo: '🏢' },
  { name: 'Swiggy', logo: '🏢' },
  { name: 'Uber', logo: '🏢' },
  { name: 'Ola', logo: '🏢' },
  { name: 'Oracle', logo: '🏢' },
  { name: 'Cisco', logo: '🏢' },
  { name: 'Intel', logo: '🏢' },
  { name: 'AMD', logo: '🏢' },
  { name: 'NVIDIA', logo: '🏢' },
  { name: 'Netflix', logo: '🏢' },
  { name: 'Meta', logo: '🏢' }
];

// Helper to stagger and observe features
function ScrollFeatureCard({ title, icon: Icon, tag, description, children, delay }) {
  const cardRef = useRef(null);
  const [isIntersecting, setIsIntersecting] = useState(false);

  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setIsIntersecting(true);
          // Keep observing to allow scroll-in / scroll-out or lock active state
        }
      },
      { threshold: 0.15, rootMargin: '0px 0px -40px 0px' }
    );
    
    if (cardRef.current) {
      observer.observe(cardRef.current);
    }
    
    return () => observer.disconnect();
  }, []);

  return (
    <div
      ref={cardRef}
      style={{
        transition: `opacity 750ms cubic-bezier(0.16, 1, 0.3, 1) ${delay}ms, transform 750ms cubic-bezier(0.16, 1, 0.3, 1) ${delay}ms`,
        willChange: 'transform, opacity',
        transformPerspective: '1000px',
      }}
      className={`flex flex-col md:flex-row items-center gap-8 p-8 bg-white border border-cream-300 rounded-2xl shadow-paper group hover:shadow-lg transition-shadow duration-300 ${
        isIntersecting
          ? 'opacity-100 translate-y-0 rotate-x-0'
          : 'opacity-0 translate-y-12 rotate-x-12'
      }`}
    >
      {/* Text Context */}
      <div className="flex-grow flex flex-col gap-3 max-w-xl">
        <span className="text-[10px] text-terracotta-500 font-bold uppercase tracking-widest">{tag}</span>
        <div className="flex items-center gap-2">
          <Icon className="text-sage-500 shrink-0" size={22} />
          <h3 className="text-lg sm:text-xl font-serif font-bold text-charcoal-900">{title}</h3>
        </div>
        <p className="text-xs sm:text-sm text-charcoal-500 leading-relaxed">{description}</p>
      </div>

      {/* Visual Widget Preview (staggered parallax tilt cue) */}
      <div 
        className="w-full md:w-56 h-36 bg-cream-50 border border-cream-200 rounded-xl flex items-center justify-center overflow-hidden shrink-0 relative transition-transform duration-500 group-hover:scale-102"
        style={{ transformStyle: 'preserve-3d' }}
      >
        <div 
          className="transition-transform duration-500 group-hover:translate-z-6"
          style={{ transform: 'translate3d(0,0,0)' }}
        >
          {children}
        </div>
      </div>
    </div>
  );
}

export default function LandingPage({ user }) {
  // Split companies into two rows
  const midIndex = Math.ceil(companiesList.length / 2);
  const row1 = [...companiesList.slice(0, midIndex), ...companiesList.slice(0, midIndex)];
  const row2 = [...companiesList.slice(midIndex), ...companiesList.slice(midIndex)];

  return (
    <div className="fade-in max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-12 flex flex-col gap-20 overflow-hidden">
      
      {/* Inline styles for high performance animations */}
      <style>{`
        @keyframes marquee-left {
          0% { transform: translate3d(0, 0, 0); }
          100% { transform: translate3d(-50%, 0, 0); }
        }
        @keyframes marquee-right {
          0% { transform: translate3d(-50%, 0, 0); }
          100% { transform: translate3d(0, 0, 0); }
        }
        .animate-marquee-left {
          display: flex;
          width: max-content;
          animation: marquee-left 45s linear infinite;
        }
        .animate-marquee-right {
          display: flex;
          width: max-content;
          animation: marquee-right 45s linear infinite;
        }
        .marquee-container:hover .animate-marquee-left,
        .marquee-container:hover .animate-marquee-right {
          animation-play-state: paused;
        }
        .pulse-wave {
          animation: waves 2s cubic-bezier(0.16, 1, 0.3, 1) infinite;
        }
        @keyframes waves {
          0% { transform: scale3d(0.9, 0.9, 1); opacity: 0.8; }
          100% { transform: scale3d(1.4, 1.4, 1); opacity: 0; }
        }
      `}</style>

      {/* Hero Section */}
      <div className="text-center max-w-3xl mx-auto flex flex-col gap-6">
        <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold tracking-tight font-serif text-sage-700">
          THE_<span className="text-terracotta-500">PlacementGRID</span>
        </h1>
        <p className="text-lg text-charcoal-500 leading-relaxed font-sans max-w-2xl mx-auto">
          Prepare for your target company with AI-grounded roadmaps, mock interviews, and adaptive practice. Built as a calm, structured student placement preparation portal.
        </p>
        
        {/* Action Buttons */}
        <div className="flex flex-col sm:flex-row gap-4 justify-center mt-4 items-center">
          {user ? (
            <Link
              to="/dashboard"
              className="bg-sage-500 hover:bg-sage-600 text-white font-medium px-8 py-3.5 rounded-lg shadow-paper transition-all flex items-center justify-center gap-1.5 w-full sm:w-auto"
            >
              <span>Go to your Dashboard</span>
              <ChevronRight size={18} />
            </Link>
          ) : (
            <Link
              to="/signup"
              className="bg-sage-500 hover:bg-sage-600 text-white font-medium px-8 py-3.5 rounded-lg shadow-paper transition-all flex items-center justify-center gap-1.5 w-full sm:w-auto text-base"
            >
              <span>Get Started</span>
              <ChevronRight size={18} />
            </Link>
          )}
        </div>
      </div>

      {/* 1. USP/MVP Highlights Section */}
      <div className="flex flex-col gap-8">
        <div className="text-center">
          <h2 className="text-2xl sm:text-3xl font-serif font-bold text-sage-700">Our Core Pillars</h2>
          <p className="text-xs text-charcoal-400 mt-1 uppercase tracking-wider font-semibold">Strict integrity, no hallucinations</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          <div className="bg-white p-6 rounded-xl border border-cream-300 shadow-paper flex flex-col gap-3">
            <div className="w-10 h-10 bg-sage-500/10 text-sage-500 rounded-lg flex items-center justify-center">
              <CheckCircle2 size={20} />
            </div>
            <h3 className="text-sm font-serif font-bold text-charcoal-900 leading-snug">
              <strong>Grounded, not hallucinated</strong>
            </h3>
            <p className="text-xs text-charcoal-500 leading-relaxed">
              Every roadmap topic and practice question is strictly backed by real retrieved sources via RAG.
            </p>
          </div>

          <div className="bg-white p-6 rounded-xl border border-cream-300 shadow-paper flex flex-col gap-3">
            <div className="w-10 h-10 bg-sage-500/10 text-sage-500 rounded-lg flex items-center justify-center">
              <Target size={20} />
            </div>
            <h3 className="text-sm font-serif font-bold text-charcoal-900 leading-snug">
              <strong>Sandboxed Local VM Execution</strong>
            </h3>
            <p className="text-xs text-charcoal-500 leading-relaxed">
              Compile and run algorithms securely on the server side inside isolated Node.js VM context frames.
            </p>
          </div>

          <div className="bg-white p-6 rounded-xl border border-cream-300 shadow-paper flex flex-col gap-3">
            <div className="w-10 h-10 bg-sage-500/10 text-sage-500 rounded-lg flex items-center justify-center">
              <Shield size={20} />
            </div>
            <h3 className="text-sm font-serif font-bold text-charcoal-900 leading-snug">
              <strong>Real-Time Proctoring Feed</strong>
            </h3>
            <p className="text-xs text-charcoal-500 leading-relaxed">
              Maintain preparation integrity with active tab-switching hooks and camera presence logging.
            </p>
          </div>

          <div className="bg-white p-6 rounded-xl border border-cream-300 shadow-paper flex flex-col gap-3">
            <div className="w-10 h-10 bg-sage-500/10 text-sage-500 rounded-lg flex items-center justify-center">
              <RefreshCw size={20} />
            </div>
            <h3 className="text-sm font-serif font-bold text-charcoal-900 leading-snug">
              <strong>Interactive Voice Mocks</strong>
            </h3>
            <p className="text-xs text-charcoal-500 leading-relaxed">
              Take verbal interview sessions powered by Sarvam AI TTS that support instant audio barge-in.
            </p>
          </div>
        </div>
      </div>

      {/* 2. "How It Works" Visual Flow Section */}
      <div className="flex flex-col gap-10 bg-cream-200 border border-cream-300 rounded-2xl p-8 sm:p-12">
        <div className="text-center">
          <h2 className="text-2xl sm:text-3xl font-serif font-bold text-sage-700">How It Works</h2>
          <p className="text-xs text-charcoal-400 mt-1 uppercase tracking-wider font-semibold">Your path to placement readiness</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-5 gap-6 relative">
          <div className="flex flex-col items-center text-center gap-3">
            <div className="w-12 h-12 bg-sage-500 text-white rounded-full flex items-center justify-center font-bold text-sm shadow-paper border-2 border-white">
              1
            </div>
            <h4 className="text-xs font-bold text-charcoal-900">Sign Up</h4>
            <p className="text-[11px] text-charcoal-500 leading-relaxed">Create your real authenticated profile with college credentials.</p>
          </div>

          <div className="flex flex-col items-center text-center gap-3">
            <div className="w-12 h-12 bg-sage-500 text-white rounded-full flex items-center justify-center font-bold text-sm shadow-paper border-2 border-white">
              2
            </div>
            <h4 className="text-xs font-bold text-charcoal-900">Configure Target</h4>
            <p className="text-[11px] text-charcoal-500 leading-relaxed">Select your target company and domain focus area.</p>
          </div>

          <div className="flex flex-col items-center text-center gap-3">
            <div className="w-12 h-12 bg-sage-500 text-white rounded-full flex items-center justify-center font-bold text-sm shadow-paper border-2 border-white">
              3
            </div>
            <h4 className="text-xs font-bold text-charcoal-900">Grounded Roadmaps</h4>
            <p className="text-[11px] text-charcoal-500 leading-relaxed">Get syllabus topics backed by real LeetCode and YouTube materials.</p>
          </div>

          <div className="flex flex-col items-center text-center gap-3">
            <div className="w-12 h-12 bg-sage-500 text-white rounded-full flex items-center justify-center font-bold text-sm shadow-paper border-2 border-white">
              4
            </div>
            <h4 className="text-xs font-bold text-charcoal-900">Practice Mocks</h4>
            <p className="text-[11px] text-charcoal-500 leading-relaxed">Run compiler testcases and take interactive verbal mocks.</p>
          </div>

          <div className="flex flex-col items-center text-center gap-3">
            <div className="w-12 h-12 bg-sage-500 text-white rounded-full flex items-center justify-center font-bold text-sm shadow-paper border-2 border-white">
              5
            </div>
            <h4 className="text-xs font-bold text-charcoal-900">Master Retention</h4>
            <p className="text-[11px] text-charcoal-500 leading-relaxed">Track progress with spaced repetition queues and active notifications.</p>
          </div>
        </div>
      </div>

      {/* 3. Replacement Section 1: Auto-Scrolling Company Logos Strip */}
      <div className="flex flex-col gap-6">
        <div className="text-center">
          <h2 className="text-xl sm:text-2xl font-serif font-bold text-sage-700">Prepare for these companies</h2>
          <p className="text-[10px] text-charcoal-400 mt-1 uppercase tracking-wider font-semibold">Structured study targets pre-configured inside our database</p>
        </div>

        <div className="marquee-container overflow-hidden w-full relative flex flex-col gap-4 py-4">
          {/* Fade Out Overlays for a premium look */}
          <div className="absolute inset-y-0 left-0 w-20 bg-gradient-to-r from-cream-100 to-transparent z-10 pointer-events-none"></div>
          <div className="absolute inset-y-0 right-0 w-20 bg-gradient-to-l from-cream-100 to-transparent z-10 pointer-events-none"></div>

          {/* Row 1 (Left to Right Scrolling) */}
          <div className="flex overflow-hidden">
            <div className="animate-marquee-left flex gap-6 pr-6">
              {row1.map((comp, idx) => (
                <div key={idx} className="flex items-center gap-2 px-4 py-2 bg-white border border-cream-300 rounded-xl shadow-paper text-xs font-semibold text-charcoal-700 grayscale opacity-65 hover:grayscale-0 hover:opacity-100 hover:scale-105 hover:translate-y-[-2px] transition-all duration-300 cursor-pointer select-none">
                  <span className="text-sm shrink-0">{comp.logo}</span>
                  <span className="font-serif tracking-tight">{comp.name}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Row 2 (Right to Left Scrolling) */}
          <div className="flex overflow-hidden">
            <div className="animate-marquee-right flex gap-6 pr-6">
              {row2.map((comp, idx) => (
                <div key={idx} className="flex items-center gap-2 px-4 py-2 bg-white border border-cream-300 rounded-xl shadow-paper text-xs font-semibold text-charcoal-700 grayscale opacity-65 hover:grayscale-0 hover:opacity-100 hover:scale-105 hover:translate-y-[-2px] transition-all duration-300 cursor-pointer select-none">
                  <span className="text-sm shrink-0">{comp.logo}</span>
                  <span className="font-serif tracking-tight">{comp.name}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* 4. Replacement Section 2: Animated 3D-Style Feature Showcase */}
      <div className="flex flex-col gap-10">
        <div className="text-center">
          <h2 className="text-2xl sm:text-3xl font-serif font-bold text-sage-700">Capabilities Showcase</h2>
          <p className="text-xs text-charcoal-400 mt-1 uppercase tracking-wider font-semibold">Features that make a difference in your preparation</p>
        </div>

        <div className="flex flex-col gap-8">
          
          {/* Card 1: Grounded RAG Roadmaps */}
          <ScrollFeatureCard 
            title="Grounded RAG Roadmaps" 
            tag="Retrieval-Augmented"
            icon={BookOpen}
            description="Acquire week-by-week preparation roadmaps grounded strictly in verified online curricula and official sources. Eliminate algorithmic hallucinations."
            delay={0}
          >
            <div className="flex flex-col gap-1.5 p-3 w-44">
              <span className="text-[10px] font-bold text-sage-700 font-serif border-b border-cream-300 pb-1">Syllabus Overview</span>
              <div className="flex items-center gap-2 text-[9px] text-charcoal-700">
                <CheckCircle2 size={12} className="text-sage-500 animate-pulse" />
                <span>Arrays & Hashmaps</span>
              </div>
              <div className="flex items-center gap-2 text-[9px] text-charcoal-700">
                <CheckCircle2 size={12} className="text-sage-500" />
                <span>Sliding Window</span>
              </div>
              <div className="flex items-center gap-2 text-[9px] text-charcoal-300">
                <div className="w-2.5 h-2.5 border border-cream-300 rounded-full"></div>
                <span>Linked List Reversal</span>
              </div>
            </div>
          </ScrollFeatureCard>

          {/* Card 2: Adaptive Aptitude Practice */}
          <ScrollFeatureCard 
            title="Adaptive Aptitude Practice" 
            tag="Performance Driven"
            icon={Target}
            description="Excludes already attempted questions dynamically. Features local sandboxed VM algorithm compilation, testing code against hidden inputs instantly."
            delay={100}
          >
            <div className="p-3 w-44 flex flex-col gap-1 justify-center items-center">
              <span className="text-[9px] font-bold text-charcoal-400 uppercase tracking-widest">Score Trend</span>
              <svg className="w-32 h-14" viewBox="0 0 100 40">
                <path d="M 0 35 Q 25 32, 50 20 T 100 5" fill="none" stroke="#7c9288" strokeWidth="2.5" />
                <circle cx="100" cy="5" r="3.5" fill="#df7a5e" className="animate-ping" />
                <circle cx="100" cy="5" r="2.5" fill="#df7a5e" />
              </svg>
              <span className="text-[10px] text-sage-700 font-bold">Accuracy: 92%</span>
            </div>
          </ScrollFeatureCard>

          {/* Card 3: Proctored AI Mock Interview */}
          <ScrollFeatureCard 
            title="Proctored AI Mock Interview" 
            tag="Integrity Focused"
            icon={Shield}
            description="Mock interview simulation with integrated tab-switch proctoring metrics and camera presence validation. Supports audio stream vocal barge-in."
            delay={200}
          >
            <div className="w-44 h-24 flex flex-col justify-center items-center gap-2 relative">
              {/* Pulsing avatar glow rings */}
              <div className="absolute w-12 h-12 rounded-full border-2 border-sage-500/20 pulse-wave"></div>
              <div className="absolute w-12 h-12 rounded-full border-2 border-sage-500/30 pulse-wave" style={{ animationDelay: '0.6s' }}></div>
              
              <div className="w-12 h-12 rounded-full bg-sage-500 text-white flex items-center justify-center shadow-paper z-10">
                <Compass size={20} className="animate-spin-slow" />
              </div>
              <div className="flex gap-0.5 items-center justify-center mt-1">
                <div className="w-1 h-3 bg-sage-500 rounded-full animate-pulse"></div>
                <div className="w-1 h-5 bg-sage-500 rounded-full animate-pulse" style={{ animationDelay: '0.15s' }}></div>
                <div className="w-1 h-2 bg-sage-500 rounded-full animate-pulse" style={{ animationDelay: '0.3s' }}></div>
                <div className="w-1 h-4 bg-sage-500 rounded-full animate-pulse" style={{ animationDelay: '0.45s' }}></div>
              </div>
            </div>
          </ScrollFeatureCard>

          {/* Card 4: Spaced Repetition Notification */}
          <ScrollFeatureCard 
            title="Spaced Repetition Mastery" 
            tag="Memory Retention"
            icon={RefreshCw}
            description="Applies SM-2 algorithm queues to target core concepts. Triggers weekly progress digests, active prompt reminders, and self-hosted push notifications."
            delay={150}
          >
            <div className="w-44 h-24 flex items-center justify-center gap-2 relative">
              {/* Stacked cards visualization */}
              <div className="absolute w-28 h-16 bg-white border border-cream-300 rounded-lg shadow-sm transform translate-y-2 scale-90 opacity-60"></div>
              <div className="absolute w-28 h-16 bg-white border border-cream-300 rounded-lg shadow-sm transform translate-y-1 scale-95 opacity-80"></div>
              <div className="absolute w-28 h-16 bg-white border border-cream-300 rounded-lg shadow-md transform flex items-center justify-center p-2 z-10 border-cream-300">
                <div className="bg-terracotta-100 text-terracotta-700 font-bold text-[9px] px-2 py-1 rounded-full border border-terracotta-500/20 animate-pulse">
                  5 Due Today
                </div>
              </div>
            </div>
          </ScrollFeatureCard>

          {/* Card 5: Resume Score Analyzer */}
          <ScrollFeatureCard 
            title="Resume Analyzer" 
            tag="Profile Assessment"
            icon={Award}
            description="Automatically parse PDFs and retrieve instant rating scores, citation verification ratios, and formatted bullet improvements for SDE placement roles."
            delay={250}
          >
            <div className="w-44 h-24 flex items-center justify-center gap-3">
              <svg className="w-16 h-16 transform -rotate-90">
                <circle cx="32" cy="32" r="24" stroke="#f7f2ea" strokeWidth="6" fill="transparent" />
                <circle 
                  cx="32" cy="32" r="24" stroke="#df7a5e" strokeWidth="6" fill="transparent" 
                  strokeDasharray={2 * Math.PI * 24}
                  strokeDashoffset={2 * Math.PI * 24 * (1 - 0.88)}
                  strokeLinecap="round"
                  className="animate-pulse"
                />
                <text x="32" y="-28" transform="rotate(90)" fill="#df7a5e" fontWeight="bold" fontSize="11" textAnchor="middle" dominantBaseline="middle">
                  88%
                </text>
              </svg>
              <div className="flex flex-col gap-1">
                <span className="text-[8px] bg-sage-100 text-sage-700 font-bold px-1.5 py-0.5 rounded border border-sage-500/10">STAR: Good</span>
                <span className="text-[8px] bg-cream-300 text-charcoal-700 font-bold px-1.5 py-0.5 rounded">Citations: 8</span>
              </div>
            </div>
          </ScrollFeatureCard>

        </div>
      </div>

      {/* 5. Feature Count Strip Section */}
      <div className="border-t border-b border-cream-300 py-8 bg-cream-50">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 text-center max-w-4xl mx-auto">
          <div className="flex flex-col gap-1">
            <span className="text-3xl font-serif font-bold text-sage-600">6 Core</span>
            <span className="text-xs text-charcoal-400 font-semibold uppercase tracking-wider">Functional Modules</span>
          </div>

          <div className="flex flex-col gap-1">
            <span className="text-3xl font-serif font-bold text-terracotta-500">3 AI-Grounded</span>
            <span className="text-xs text-charcoal-400 font-semibold uppercase tracking-wider">Retrieved Pipelines</span>
          </div>

          <div className="flex flex-col gap-1">
            <span className="text-3xl font-serif font-bold text-sage-600">100% Free</span>
            <span className="text-xs text-charcoal-400 font-semibold uppercase tracking-wider">Tier Service Deployable</span>
          </div>
        </div>
      </div>
    </div>
  );
}
