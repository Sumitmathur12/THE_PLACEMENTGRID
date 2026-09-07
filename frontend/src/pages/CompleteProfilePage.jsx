import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Building, BookOpen, Hash, ShieldAlert, Loader2, Award } from 'lucide-react';

export default function CompleteProfilePage({ token, user, syncProfile }) {
  const navigate = useNavigate();

  const [collegeName, setCollegeName] = useState('');
  const [branch, setBranch] = useState('');
  const [rollNumber, setRollNumber] = useState('');

  const [collegeError, setCollegeError] = useState('');
  const [branchError, setBranchError] = useState('');
  const [rollError, setRollError] = useState('');

  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const validateForm = () => {
    let isValid = true;
    if (!collegeName.trim()) {
      setCollegeError('College name is required.');
      isValid = false;
    } else {
      setCollegeError('');
    }

    if (!branch.trim()) {
      setBranchError('Branch stream is required.');
      isValid = false;
    } else {
      setBranchError('');
    }

    if (!rollNumber.trim()) {
      setRollError('Roll number is required.');
      isValid = false;
    } else {
      setRollError('');
    }

    return isValid;
  };

  const handleSubmitProfile = async (e) => {
    e.preventDefault();
    setError('');

    if (!validateForm()) return;

    setLoading(true);
    try {
      const res = await fetch('/api/auth/complete-profile', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          collegeName: collegeName.trim(),
          branch: branch.trim(),
          rollNumber: rollNumber.trim()
        })
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to complete profile synchronization.');

      // Update the user session state
      syncProfile(data.user);
      navigate('/dashboard');

    } catch (err) {
      console.error(err);
      setError(err.message || 'Error saving details. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fade-in max-w-md mx-auto px-4 py-16">
      <div className="bg-cream-200 border border-cream-300 p-8 rounded-xl shadow-paper flex flex-col gap-6 animate-scale-up">
        
        <div className="text-center flex flex-col items-center gap-3 border-b border-cream-300 pb-4">
          <Award size={36} className="text-sage-500 animate-bounce" />
          <div>
            <h2 className="text-xl font-serif font-bold text-charcoal-900">Complete Your Student Profile</h2>
            <p className="text-[10px] text-charcoal-500 uppercase tracking-wider font-semibold mt-1">
              One-time synchronization for OAuth log in
            </p>
          </div>
        </div>

        <p className="text-xs text-charcoal-600 leading-relaxed text-center">
          Hello <strong>{user?.name || 'Scholar'}</strong>! Since you signed in via a third-party social provider, we need to collect your academic identifiers before you can access the preparation dashboard.
        </p>

        {error && (
          <div className="bg-red-50 text-red-700 text-xs p-3 rounded-lg border border-red-200 flex items-start gap-1.5 animate-scale-up">
            <ShieldAlert size={14} className="shrink-0 mt-0.5" />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmitProfile} className="flex flex-col gap-4">
          <div className="flex flex-col gap-1">
            <label className="text-xs font-semibold text-charcoal-900">College / Institution Name</label>
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
            <label className="text-xs font-semibold text-charcoal-900">Branch / Specialization</label>
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
            <label className="text-xs font-semibold text-charcoal-900">Roll Number / Enrollment ID</label>
            <div className="relative">
              <input
                type="text"
                value={rollNumber}
                onChange={(e) => setRollNumber(e.target.value)}
                placeholder="e.g. 2026CSE100"
                className={`w-full pl-9 pr-3 py-2 bg-white border ${
                  rollError ? 'border-red-500' : 'border-cream-300'
                } rounded-lg text-xs focus:outline-none focus:border-sage-500 transition-colors`}
              />
              <Hash size={14} className="absolute left-3 top-3 text-charcoal-100" />
            </div>
            {rollError && <p className="text-[10px] text-red-500 font-semibold mt-0.5">{rollError}</p>}
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-sage-500 hover:bg-sage-600 text-white font-medium py-3 rounded-lg shadow-paper transition-all flex items-center justify-center gap-2 text-sm disabled:opacity-50 mt-2"
          >
            {loading ? <Loader2 size={16} className="animate-spin" /> : null}
            <span>{loading ? 'Completing registration...' : 'Complete Profile & Dashboard Access'}</span>
          </button>
        </form>
      </div>
    </div>
  );
}
