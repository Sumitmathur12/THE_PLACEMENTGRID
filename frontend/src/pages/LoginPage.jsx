import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { LogIn, ShieldAlert, Mail, Lock, Loader2 } from 'lucide-react';
import { supabase } from '../supabaseClient.js';

export default function LoginPage({ login }) {
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  
  // Validation and loading states
  const [error, setError] = useState('');
  const [emailError, setEmailError] = useState('');
  const [passwordError, setPasswordError] = useState('');
  const [loading, setLoading] = useState(false);

  // Email format validation (strict client-side regex check)
  const validateEmail = (val) => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!val) {
      setEmailError('Email address is required.');
      return false;
    } else if (!emailRegex.test(val)) {
      setEmailError('Please enter a valid email address (e.g. name@college.edu).');
      return false;
    }
    setEmailError('');
    return true;
  };

  const validatePassword = (val) => {
    if (!val) {
      setPasswordError('Password is required.');
      return false;
    } else if (val.length < 8) {
      setPasswordError('Password must be at least 8 characters long.');
      return false;
    }
    setPasswordError('');
    return true;
  };

  const handlePasswordLogin = async (e) => {
    e.preventDefault();
    setError('');

    const isEmailValid = validateEmail(email);
    const isPasswordValid = validatePassword(password);

    if (!isEmailValid || !isPasswordValid) return;

    setLoading(true);
    try {
      const { data, error: authErr } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password
      });

      if (authErr) throw authErr;

      const session = data?.session;
      if (session) {
        // Fetch MongoDB user record to verify profile completion
        const res = await fetch('/api/auth/me', {
          headers: { 'Authorization': `Bearer ${session.access_token}` }
        });
        
        if (!res.ok) {
          const errData = await res.json().catch(() => ({}));
          console.error('MongoDB sync verification failed:', errData);
          throw new Error(errData.error || `Profile verification failed with status ${res.status}.`);
        }
        const userData = await res.json();

        login(session.access_token, userData);

        // Check if profile details are completed
        if (!userData.collegeName || !userData.branch || !userData.rollNumber) {
          navigate('/complete-profile');
        } else {
          navigate('/dashboard');
        }
      }
    } catch (err) {
      console.error(err);
      let errMsg = err.message || 'Authentication failed. Please verify credentials.';
      if (errMsg.toLowerCase().includes('email not confirmed')) {
        errMsg = 'Your email has not been confirmed. Please click the verification link in your inbox, or disable "Confirm Email" in your Supabase Auth Providers console to bypass this check.';
      }
      setError(errMsg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fade-in max-w-md mx-auto px-4 py-16">
      <div className="bg-cream-200 border border-cream-300 p-8 rounded-xl shadow-paper flex flex-col gap-6">
        <div className="text-center flex flex-col gap-2">
          <h2 className="text-2xl font-serif font-bold text-charcoal-900">Sign In</h2>
          <p className="text-xs text-charcoal-500">Sign in to your grid space to track your placement preparation</p>
        </div>

        {error && (
          <div className="bg-red-50 text-red-700 text-xs p-3 rounded-lg border border-red-200 flex items-start gap-1.5 animate-scale-up">
            <ShieldAlert size={14} className="shrink-0 mt-0.5" />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handlePasswordLogin} className="flex flex-col gap-4">
          <div className="flex flex-col gap-1">
            <label className="text-xs font-semibold text-charcoal-900">Email Address</label>
            <div className="relative">
              <input
                type="text"
                value={email}
                onChange={(e) => { setEmail(e.target.value); validateEmail(e.target.value); }}
                placeholder="you@college.edu"
                className={`w-full pl-9 pr-3 py-2 bg-white border ${
                  emailError ? 'border-red-500' : 'border-cream-300'
                } rounded-lg text-xs focus:outline-none focus:border-sage-500 transition-colors`}
              />
              <Mail size={14} className="absolute left-3 top-3 text-charcoal-100" />
            </div>
            {emailError && <p className="text-[10px] text-red-500 font-semibold mt-0.5">{emailError}</p>}
          </div>

          <div className="flex flex-col gap-1">
            <label className="text-xs font-semibold text-charcoal-900">Password</label>
            <div className="relative">
              <input
                type="password"
                value={password}
                onChange={(e) => { setPassword(e.target.value); validatePassword(e.target.value); }}
                placeholder="Min 8 characters"
                className={`w-full pl-9 pr-3 py-2 bg-white border ${
                  passwordError ? 'border-red-500' : 'border-cream-300'
                } rounded-lg text-xs focus:outline-none focus:border-sage-500 transition-colors`}
              />
              <Lock size={14} className="absolute left-3 top-3 text-charcoal-100" />
            </div>
            {passwordError && <p className="text-[10px] text-red-500 font-semibold mt-0.5">{passwordError}</p>}
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-sage-500 hover:bg-sage-600 text-white font-medium py-3 rounded-lg shadow-paper transition-all flex items-center justify-center gap-2 text-sm disabled:opacity-50 mt-2"
          >
            {loading ? <Loader2 size={16} className="animate-spin" /> : <LogIn size={16} />}
            <span>{loading ? 'Please wait...' : 'Sign In'}</span>
          </button>
        </form>



        <div className="text-center text-xs mt-2 border-t border-cream-300 pt-4">
          <span className="text-charcoal-500">New to the grid? </span>
          <Link to="/signup" className="text-sage-600 font-bold hover:underline">
            Create an Account
          </Link>
        </div>
      </div>
    </div>
  );
}
