import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { UserPlus, User, Building, BookOpen, Hash, Mail, Lock, ShieldAlert, Loader2 } from 'lucide-react';
import { supabase } from '../supabaseClient.js';

export default function SignupPage({ login }) {
  const navigate = useNavigate();

  // Form fields state
  const [name, setName] = useState('');
  const [collegeName, setCollegeName] = useState('');
  const [branch, setBranch] = useState('');
  const [rollNumber, setRollNumber] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  // Inline Validation state
  const [nameError, setNameError] = useState('');
  const [collegeError, setCollegeError] = useState('');
  const [branchError, setBranchError] = useState('');
  const [rollError, setRollError] = useState('');
  const [emailError, setEmailError] = useState('');
  const [passwordError, setPasswordError] = useState('');
  const [confirmError, setConfirmError] = useState('');

  const [error, setError] = useState('');
  const [successMessage, setSuccessMessage] = useState('');
  const [loading, setLoading] = useState(false);
  const [strengthMessage, setStrengthMessage] = useState('');
  const [strengthColor, setStrengthColor] = useState('text-charcoal-400');

  // Strict email validation regex
  const validateEmail = (val) => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!val) {
      setEmailError('Email address is required.');
      return false;
    } else if (!emailRegex.test(val)) {
      setEmailError('Please enter a valid email format (e.g. candidate@college.edu).');
      return false;
    }
    setEmailError('');
    return true;
  };

  const handlePasswordStrength = (val) => {
    if (!val) {
      setStrengthMessage('');
      return;
    }
    
    if (val.length < 8) {
      setStrengthMessage('Weak: Must be at least 8 characters.');
      setStrengthColor('text-red-500');
    } else {
      // Evaluate strength based on characters diversity
      const hasUpper = /[A-Z]/.test(val);
      const hasLower = /[a-z]/.test(val);
      const hasDigit = /[0-9]/.test(val);
      const hasSpecial = /[^A-Za-z0-9]/.test(val);
      const score = [hasUpper, hasLower, hasDigit, hasSpecial].filter(Boolean).length;

      if (score >= 3) {
        setStrengthMessage('Strong password!');
        setStrengthColor('text-sage-600 font-bold');
      } else {
        setStrengthMessage('Medium: Try adding upper case, digits or symbols.');
        setStrengthColor('text-amber-600');
      }
    }
  };

  const validateForm = () => {
    let isValid = true;

    if (!name.trim()) { setNameError('Full Name is required.'); isValid = false; } else setNameError('');
    if (!collegeName.trim()) { setCollegeError('College Name is required.'); isValid = false; } else setCollegeError('');
    if (!branch.trim()) { setBranchError('Branch name is required.'); isValid = false; } else setBranchError('');
    if (!rollNumber.trim()) { setRollError('Roll Number is required.'); isValid = false; } else setRollError('');
    
    if (!validateEmail(email)) isValid = false;
    
    if (!password) {
      setPasswordError('Password is required.');
      isValid = false;
    } else if (password.length < 8) {
      setPasswordError('Password must be at least 8 characters long.');
      isValid = false;
    } else {
      setPasswordError('');
    }

    if (password !== confirmPassword) {
      setConfirmError('Passwords do not match.');
      isValid = false;
    } else {
      setConfirmError('');
    }

    return isValid;
  };

  const handleSignupSubmit = async (e) => {
    e.preventDefault();
    setError('');

    if (!validateForm()) return;

    setLoading(true);
    try {
      // 1. Sign up inside Supabase Auth
      const { data, error: authErr } = await supabase.auth.signUp({
        email: email.trim(),
        password: password
      });

      if (authErr) throw authErr;

      const session = data?.session;
      const tokenVal = session?.access_token || data?.user?.id; // token or fallback uuid for mock mode

      if (!tokenVal) {
        throw new Error('Verification required: Please check your email for a verification link to activate your account.');
      }

      // 2. Synchronize profile details to MongoDB (passes email in body to support verification fallback)
      const syncRes = await fetch('/api/auth/register-sync', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${tokenVal}`
        },
        body: JSON.stringify({
          name: name.trim(),
          email: email.trim().toLowerCase(),
          collegeName: collegeName.trim(),
          branch: branch.trim(),
          rollNumber: rollNumber.trim()
        })
      });

      if (!syncRes.ok) {
        const syncErr = await syncRes.json().catch(() => ({}));
        console.error('MongoDB register-sync verification failed:', syncErr);
        throw new Error(syncErr.error || `Failed to sync student profile context to local database (status ${syncRes.status}).`);
      }

      const syncData = await syncRes.json();

      // 3. Handle session auto-login or manual verification alert
      if (!session) {
        setSuccessMessage('Your profile has been synchronized successfully. Please check your email inbox for a verification link to activate your Supabase account before signing in.');
        return;
      }

      login(tokenVal, syncData.user);
      navigate('/dashboard');

    } catch (err) {
      console.error(err);
      setError(err.message || 'Registration failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fade-in max-w-lg mx-auto px-4 py-8">
      <div className="bg-cream-200 border border-cream-300 p-8 rounded-xl shadow-paper flex flex-col gap-6">
        <div className="text-center flex flex-col gap-2">
          <h2 className="text-2xl font-serif font-bold text-charcoal-900">Create Grid Space Account</h2>
          <p className="text-xs text-charcoal-500">Initialize your placement preparation dashboard profile</p>
        </div>

        {error && (
          <div className="bg-red-50 text-red-700 text-xs p-3 rounded-lg border border-red-200 flex items-start gap-1.5 animate-scale-up">
            <ShieldAlert size={14} className="shrink-0 mt-0.5" />
            <span>{error}</span>
          </div>
        )}

        {successMessage && (
          <div className="bg-emerald-50 text-emerald-700 text-xs p-4 rounded-lg border border-emerald-200 flex flex-col gap-2 animate-scale-up">
            <div className="flex items-start gap-1.5 font-bold">
              <span className="text-base">✉️</span>
              <span>Verification Email Sent!</span>
            </div>
            <p className="leading-relaxed">{successMessage}</p>
            <Link to="/login" className="bg-emerald-600 hover:bg-emerald-700 text-white font-medium py-2 px-4 rounded-lg text-center mt-2 w-max text-[11px] shadow-sm transition-all">
              Back to Sign In
            </Link>
          </div>
        )}

        <form onSubmit={handleSignupSubmit} className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="flex flex-col gap-1 sm:col-span-2">
            <label className="text-xs font-semibold text-charcoal-900">Full Name</label>
            <div className="relative">
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Sumit Mathur"
                className={`w-full pl-9 pr-3 py-2 bg-white border ${
                  nameError ? 'border-red-500' : 'border-cream-300'
                } rounded-lg text-xs focus:outline-none focus:border-sage-500 transition-colors`}
              />
              <User size={14} className="absolute left-3 top-3 text-charcoal-100" />
            </div>
            {nameError && <p className="text-[10px] text-red-500 font-semibold mt-0.5">{nameError}</p>}
          </div>

          <div className="flex flex-col gap-1">
            <label className="text-xs font-semibold text-charcoal-900">College Name</label>
            <div className="relative">
              <input
                type="text"
                value={collegeName}
                onChange={(e) => setCollegeName(e.target.value)}
                placeholder="Indian Institute of Technology"
                className={`w-full pl-9 pr-3 py-2 bg-white border ${
                  collegeError ? 'border-red-500' : 'border-cream-300'
                } rounded-lg text-xs focus:outline-none focus:border-sage-500 transition-colors`}
              />
              <Building size={14} className="absolute left-3 top-3 text-charcoal-100" />
            </div>
            {collegeError && <p className="text-[10px] text-red-500 font-semibold mt-0.5">{collegeError}</p>}
          </div>

          <div className="flex flex-col gap-1">
            <label className="text-xs font-semibold text-charcoal-900">Branch / Stream</label>
            <div className="relative">
              <input
                type="text"
                value={branch}
                onChange={(e) => setBranch(e.target.value)}
                placeholder="Computer Science"
                className={`w-full pl-9 pr-3 py-2 bg-white border ${
                  branchError ? 'border-red-500' : 'border-cream-300'
                } rounded-lg text-xs focus:outline-none focus:border-sage-500 transition-colors`}
              />
              <BookOpen size={14} className="absolute left-3 top-3 text-charcoal-100" />
            </div>
            {branchError && <p className="text-[10px] text-red-500 font-semibold mt-0.5">{branchError}</p>}
          </div>

          <div className="flex flex-col gap-1">
            <label className="text-xs font-semibold text-charcoal-900">Roll Number</label>
            <div className="relative">
              <input
                type="text"
                value={rollNumber}
                onChange={(e) => setRollNumber(e.target.value)}
                placeholder="2026CSE001"
                className={`w-full pl-9 pr-3 py-2 bg-white border ${
                  rollError ? 'border-red-500' : 'border-cream-300'
                } rounded-lg text-xs focus:outline-none focus:border-sage-500 transition-colors`}
              />
              <Hash size={14} className="absolute left-3 top-3 text-charcoal-100" />
            </div>
            {rollError && <p className="text-[10px] text-red-500 font-semibold mt-0.5">{rollError}</p>}
          </div>

          <div className="flex flex-col gap-1">
            <label className="text-xs font-semibold text-charcoal-900">College Email Address</label>
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
                onChange={(e) => { setPassword(e.target.value); handlePasswordStrength(e.target.value); }}
                placeholder="Min 8 characters"
                className={`w-full pl-9 pr-3 py-2 bg-white border ${
                  passwordError ? 'border-red-500' : 'border-cream-300'
                } rounded-lg text-xs focus:outline-none focus:border-sage-500 transition-colors`}
              />
              <Lock size={14} className="absolute left-3 top-3 text-charcoal-100" />
            </div>
            {strengthMessage && <p className={`text-[9px] ${strengthColor} mt-0.5`}>{strengthMessage}</p>}
            {passwordError && <p className="text-[10px] text-red-500 font-semibold mt-0.5">{passwordError}</p>}
          </div>

          <div className="flex flex-col gap-1">
            <label className="text-xs font-semibold text-charcoal-900">Confirm Password</label>
            <div className="relative">
              <input
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="Verify password match"
                className={`w-full pl-9 pr-3 py-2 bg-white border ${
                  confirmError ? 'border-red-500' : 'border-cream-300'
                } rounded-lg text-xs focus:outline-none focus:border-sage-500 transition-colors`}
              />
              <Lock size={14} className="absolute left-3 top-3 text-charcoal-100" />
            </div>
            {confirmError && <p className="text-[10px] text-red-500 font-semibold mt-0.5">{confirmError}</p>}
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-sage-500 hover:bg-sage-600 text-white font-medium py-3 rounded-lg shadow-paper transition-all flex items-center justify-center gap-2 text-sm disabled:opacity-50 sm:col-span-2 mt-4"
          >
            {loading ? <Loader2 size={16} className="animate-spin" /> : <UserPlus size={16} />}
            <span>{loading ? 'Registering student...' : 'Create Account'}</span>
          </button>
        </form>

        <div className="text-center text-xs mt-2 border-t border-cream-300 pt-4">
          <span className="text-charcoal-500">Already registered? </span>
          <Link to="/login" className="text-sage-600 font-bold hover:underline">
            Sign In Instead
          </Link>
        </div>
      </div>
    </div>
  );
}
