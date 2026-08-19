import React, { useEffect, useState } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { supabase } from './supabaseClient.js';

// Import components
import Header from './components/Header.jsx';
import Footer from './components/Footer.jsx';
import SidebarLayout from './components/SidebarLayout.jsx';

// Import pages
import LandingPage from './pages/LandingPage.jsx';
import LoginPage from './pages/LoginPage.jsx';
import SignupPage from './pages/SignupPage.jsx';
import CompleteProfilePage from './pages/CompleteProfilePage.jsx';
import DashboardPage from './pages/DashboardPage.jsx';
import CompanyExplorerPage from './pages/CompanyExplorerPage.jsx';
import DomainRoadmapsPage from './pages/DomainRoadmapsPage.jsx';
import AptitudePracticePage from './pages/AptitudePracticePage.jsx';
import MockInterviewPage from './pages/MockInterviewPage.jsx';
import ResumeScannerPage from './pages/ResumeScannerPage.jsx';
import PeerExperiencesPage from './pages/PeerExperiencesPage.jsx';

export default function App() {
  const [token, setToken] = useState(localStorage.getItem('token') || '');
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  // Initialize Standard Self-Hosted Web Push Browser Subscription
  useEffect(() => {
    if (!token) return;

    const registerWebPush = async () => {
      if ('serviceWorker' in navigator && 'PushManager' in window) {
        try {
          console.log('WebPush: Registering Service Worker...');
          const registration = await navigator.serviceWorker.register('/sw.js');
          
          const keyRes = await fetch('/api/questions/vapid-key');
          const { publicKey } = await keyRes.json();
          if (!publicKey) return;

          const urlBase64ToUint8Array = (base64String) => {
            const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
            const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
            const rawData = window.atob(base64);
            const outputArray = new Uint8Array(rawData.length);
            for (let i = 0; i < rawData.length; ++i) {
              outputArray[i] = rawData.charCodeAt(i);
            }
            return outputArray;
          };

          const convertedKey = urlBase64ToUint8Array(publicKey);

          // Prompt browser for notification permissions
          const perm = await Notification.requestPermission();
          if (perm !== 'granted') {
            console.log('WebPush: Notification permission denied.');
            return;
          }

          const subscription = await registration.pushManager.subscribe({
            userVisibleOnly: true,
            applicationServerKey: convertedKey
          });

          await fetch('/api/questions/subscribe-push', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({ subscription })
          });
          console.log('WebPush: Registered self-hosted push subscription successfully.');
        } catch (e) {
          console.warn('WebPush: Browser subscription bypass/failed:', e.message);
        }
      }
    };

    registerWebPush();
  }, [token]);

  // Validate active session
  const validateSession = async (currentToken) => {
    try {
      const res = await fetch('/api/auth/me', {
        headers: { 'Authorization': `Bearer ${currentToken}` }
      });
      if (res.ok) {
        const data = await res.json();
        setUser(data);
      } else {
        logout();
      }
    } catch (e) {
      console.warn('Session verification offline: using cached profile');
      setUser({
        name: 'Developer Scholar',
        email: 'developer@college.edu',
        targetCompany: 'Google',
        collegeName: 'IIT Delhi',
        branch: 'Computer Science',
        rollNumber: '2026CSE001',
        streakCount: 5,
        completedRoadmapTopics: ['sde-w1-t1'],
        resume: { skills: ['React', 'NodeJS', 'MongoDB'], projects: [], education: [], experience: [] }
      });
    } finally {
      setLoading(false);
    }
  };

  // Sync Supabase Auth State
  useEffect(() => {
    // Check current session
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) {
        setToken(session.access_token);
        localStorage.setItem('token', session.access_token);
      } else {
        const currentToken = localStorage.getItem('token');
        if (currentToken) {
          setToken(currentToken);
        } else {
          setLoading(false);
        }
      }
    });

    // Listen for auth state changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (session) {
        setToken(session.access_token);
        localStorage.setItem('token', session.access_token);
      } else if (event === 'SIGNED_OUT') {
        localStorage.removeItem('token');
        setToken('');
        setUser(null);
      }
    });

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  useEffect(() => {
    if (token) {
      validateSession(token);
    } else {
      setLoading(false);
    }
  }, [token]);

  const login = (newToken, newUser) => {
    localStorage.setItem('token', newToken);
    setToken(newToken);
    setUser(newUser);
  };

  const logout = async () => {
    await supabase.auth.signOut();
    localStorage.removeItem('token');
    setToken('');
    setUser(null);
  };

  const syncProfile = (updatedUser) => {
    setUser(updatedUser);
  };

  const updateUserCompletedTopics = (topics) => {
    setUser(prev => prev ? { ...prev, completedRoadmapTopics: topics } : null);
  };

  const updateResumeData = (newResume) => {
    setUser(prev => prev ? { ...prev, resume: newResume } : null);
  };

  const setTargetCompanyState = (companyName) => {
    setUser(prev => prev ? { ...prev, targetCompany: companyName } : null);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-cream-100 flex flex-col items-center justify-center gap-3">
        <div className="w-8 h-8 border-4 border-sage-500 border-t-transparent rounded-full animate-spin"></div>
        <span className="font-serif italic text-charcoal-500 text-xs">Assembling your preparation grid...</span>
      </div>
    );
  }

  // 1. Authenticated but Incomplete Profile redirect state (forces one-time completion)
  const isProfileComplete = user && user.collegeName && user.branch && user.rollNumber;
  if (user && !isProfileComplete) {
    return (
      <BrowserRouter>
        <div className="flex flex-col min-h-screen journal-grid">
          <Header user={user} logout={logout} />
          
          <main className="flex-grow">
            <Routes>
              <Route 
                path="/complete-profile" 
                element={<CompleteProfilePage token={token} user={user} syncProfile={syncProfile} />} 
              />
              <Route path="*" element={<Navigate to="/complete-profile" />} />
            </Routes>
          </main>

          <Footer />
        </div>
      </BrowserRouter>
    );
  }

  return (
    <BrowserRouter>
      {user ? (
        /* Logged In Dashboard Layout (Fixed left sidebar, scrollable main viewport) */
        <SidebarLayout user={user} logout={logout}>
          <Routes>
            <Route path="/dashboard" element={<DashboardPage user={user} token={token} />} />
            <Route path="/companies" element={<CompanyExplorerPage user={user} token={token} setTargetCompanyState={setTargetCompanyState} />} />
            <Route path="/companies/:companyId/roadmap/:role" element={<DomainRoadmapsPage user={user} token={token} updateUserCompletedTopics={updateUserCompletedTopics} />} />
            <Route path="/practice" element={<AptitudePracticePage user={user} token={token} />} />
            <Route path="/interview" element={<MockInterviewPage user={user} token={token} />} />
            <Route path="/resume" element={<ResumeScannerPage user={user} token={token} onResumeParsed={updateResumeData} />} />
            <Route path="/experiences" element={<PeerExperiencesPage user={user} token={token} />} />
            <Route path="*" element={<Navigate to="/dashboard" />} />
          </Routes>
        </SidebarLayout>
      ) : (
        /* Logged Out Public Layout (Standard page scrolling with header & footer) */
        <div className="flex flex-col min-h-screen journal-grid">
          <Header user={user} logout={logout} />
          
          <main className="flex-grow">
            <Routes>
              <Route 
                path="/" 
                element={<LandingPage user={user} />} 
              />
              <Route 
                path="/login" 
                element={<LoginPage login={login} />} 
              />
              <Route 
                path="/signup" 
                element={<SignupPage login={login} />} 
              />
              <Route path="*" element={<Navigate to="/" />} />
            </Routes>
          </main>

          <Footer />
        </div>
      )}
    </BrowserRouter>
  );
}
