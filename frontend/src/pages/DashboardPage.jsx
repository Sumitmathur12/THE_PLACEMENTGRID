import React, { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Target, Flame, ArrowRight, BookOpen, Clock, AlertTriangle, ShieldCheck, CheckSquare, Award, PlusCircle, Loader2, Compass } from 'lucide-react';
import ProgressRing from '../components/ProgressRing.jsx';

export default function DashboardPage({ user, token }) {
  const navigate = useNavigate();
  const [myRoadmaps, setMyRoadmaps] = useState([]);
  const [reviseCount, setReviseCount] = useState(0);
  const [recentExperiences, setRecentExperiences] = useState([]);
  const [loading, setLoading] = useState(true);
  
  // Dashboard Add Company state
  const [addName, setAddName] = useState('');
  const [addingCompany, setAddingCompany] = useState(false);

  useEffect(() => {
    if (!token) return;
    const fetchDashboardData = async () => {
      try {
        const headers = { 'Authorization': `Bearer ${token}` };
        
        // 1. Fetch SM-2 Spaced Repetition queue size
        const queueRes = await fetch('/api/questions/revise-queue', { headers });
        const queueData = await queueRes.json();
        setReviseCount(queueData.length || 0);

        // 2. Fetch recent peer experiences
        const expRes = await fetch('/api/experiences');
        const expData = await expRes.json();
        setRecentExperiences(expData.slice(0, 3));

        // 3. Fetch user's custom roadmaps
        const rmRes = await fetch('/api/roadmaps/my', { headers });
        const rmData = await rmRes.json();
        if (Array.isArray(rmData)) {
          setMyRoadmaps(rmData);
        }
      } catch (e) {
        console.error('Error loading dashboard data:', e);
      } finally {
        setLoading(false);
      }
    };

    fetchDashboardData();
  }, [token]);

  const handleQuickAddCompany = async (e) => {
    e.preventDefault();
    if (!addName.trim()) return;

    setAddingCompany(true);
    try {
      const res = await fetch('/api/companies/add', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ name: addName })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to add company');

      alert(`Company "${addName}" indexed successfully using vector RAG pipeline!`);
      setAddName('');
      // Navigate to companies page and trigger select
      navigate(`/companies?select=${encodeURIComponent(addName)}`);
    } catch (err) {
      alert(err.message);
    } finally {
      setAddingCompany(false);
    }
  };

  // Safe navigation fallback calculations
  const completedTopics = user?.completedRoadmapTopics || [];
  const totalSdeTopics = 3;
  const completionPercentage = totalSdeTopics > 0 
    ? (completedTopics.length / totalSdeTopics) * 100 
    : 0;

  return (
    <div className="fade-in max-w-7xl mx-auto px-4 py-6 flex flex-col gap-8">
      {/* Header Greeting */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-cream-300 pb-6">
        <div>
          <h1 className="text-3xl font-serif font-bold text-charcoal-900">Study Journal: {user?.name || 'Scholar'}</h1>
          <p className="text-sm text-charcoal-500 font-medium">Welcome back. Maintain consistency to secure your target role.</p>
        </div>
        
        {/* Streak & Active Info */}
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-1.5 bg-cream-200 border border-cream-300 p-3 rounded-xl shadow-paper">
            <Flame size={18} className="text-terracotta-500 fill-terracotta-500" />
            <div>
              <div className="text-[10px] text-charcoal-100 font-semibold uppercase tracking-wider">Daily Streak</div>
              <div className="text-sm font-bold text-charcoal-900">{user?.streakCount || 0} Days Active</div>
            </div>
          </div>
        </div>
      </div>

      {/* Main Grid Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        
        {/* Left/Middle Column */}
        <div className="lg:col-span-2 flex flex-col gap-8">
          
          {/* Target Company card */}
          <div className="bg-cream-200 border border-cream-300 rounded-xl p-6 shadow-paper flex flex-col sm:flex-row items-start sm:items-center justify-between gap-6">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 bg-terracotta-100 border border-terracotta-500/20 text-terracotta-600 rounded-xl flex items-center justify-center text-xl">
                🎯
              </div>
              <div>
                <h3 className="text-lg font-serif font-bold text-charcoal-900">
                  {user?.targetCompany ? `Target Company: ${user.targetCompany}` : 'Set Target Company'}
                </h3>
                <p className="text-xs text-charcoal-500 leading-relaxed max-w-sm">
                  {user?.targetCompany 
                    ? `Future mock tests, interviews, and roadmaps will focus on ${user.targetCompany}.`
                    : 'Pin your target company to customize roadmaps and practice questions.'}
                </p>
              </div>
            </div>
            
            <Link
              to="/companies"
              className="bg-terracotta-500 hover:bg-terracotta-600 text-white font-semibold text-xs px-4 py-2.5 rounded-lg transition-all shadow-paper shrink-0"
            >
              {user?.targetCompany ? 'Change Target' : 'Select Company'}
            </Link>
          </div>

          {/* Prominent Add Company Flow Widget (Dashboard Integration) */}
          <div className="bg-cream-200 border border-cream-300 rounded-xl p-6 shadow-paper flex flex-col gap-4">
            <div className="flex flex-col gap-1">
              <h3 className="text-lg font-serif font-bold text-charcoal-900 flex items-center gap-2">
                <PlusCircle size={18} className="text-sage-500" />
                Add Your College's Company
              </h3>
              <p className="text-xs text-charcoal-500">
                Is a company visiting your campus missing from our list? Input its name to trigger our vector RAG indexing pipeline instantly.
              </p>
            </div>
            
            <form onSubmit={handleQuickAddCompany} className="flex gap-2 max-w-md">
              <input
                type="text"
                required
                value={addName}
                onChange={(e) => setAddName(e.target.value)}
                placeholder="e.g. Oracle"
                disabled={addingCompany}
                className="flex-1 px-3 py-2 bg-white border border-cream-300 rounded-lg text-xs focus:outline-none focus:border-sage-500 disabled:opacity-50"
              />
              <button
                type="submit"
                disabled={addingCompany}
                className="bg-sage-500 hover:bg-sage-600 text-white font-semibold text-xs px-4 py-2 rounded-lg shadow-paper transition-all flex items-center gap-1.5 disabled:opacity-50 shrink-0"
              >
                {addingCompany ? <Loader2 size={12} className="animate-spin" /> : null}
                <span>{addingCompany ? 'Indexing...' : 'Seed & Index'}</span>
              </button>
            </form>
          </div>

          {/* SM-2 Spaced Repetition Queue */}
          <div className="bg-cream-200 border border-cream-300 rounded-xl p-6 shadow-paper flex flex-col gap-4">
            <div className="flex justify-between items-center border-b border-cream-300 pb-3">
              <div>
                <h3 className="text-lg font-serif font-bold text-charcoal-900 flex items-center gap-1.5">
                  <CheckSquare size={18} className="text-sage-500" />
                  Spaced Repetition Review
                </h3>
                <p className="text-xs text-charcoal-500">SM-2 schedules incorrect technical questions for review automatically.</p>
              </div>
              <span className={`text-xs px-2.5 py-0.5 rounded-full font-bold ${
                reviseCount > 0 ? 'bg-terracotta-100 text-terracotta-700 animate-pulse' : 'bg-sage-100 text-sage-700'
              }`}>
                {reviseCount} Items Due Today
              </span>
            </div>

            {reviseCount > 0 ? (
              <div className="flex flex-col sm:flex-row items-center justify-between bg-white border border-cream-300 p-4 rounded-lg gap-4">
                <div className="text-center sm:text-left">
                  <h4 className="text-sm font-semibold text-charcoal-900">Your "Revise Today" Queue is Ready</h4>
                  <p className="text-xs text-charcoal-500">Cover weak topics to commit formulas & DSA logic to long-term memory.</p>
                </div>
                <Link
                  to="/practice?tab=revise"
                  className="bg-sage-500 hover:bg-sage-600 text-white text-xs font-semibold px-4 py-2.5 rounded-lg shadow-paper transition-all flex items-center gap-1 shrink-0"
                >
                  <span>Revise Now</span>
                  <ArrowRight size={14} />
                </Link>
              </div>
            ) : (
              <div className="text-center py-6 text-xs text-charcoal-100 flex flex-col items-center gap-2">
                <ShieldCheck size={28} className="text-sage-500 stroke-1" />
                <span>You are fully caught up with spaced reviews! Wrong questions appear here tomorrow.</span>
              </div>
            )}
          </div>

          {/* Activities Trackers */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
            <div className="bg-cream-200 border border-cream-300 rounded-xl p-5 shadow-paper flex flex-col gap-3 justify-between">
              <h4 className="font-serif font-bold text-charcoal-900">Simulate Mock Interview</h4>
              <p className="text-xs text-charcoal-500 leading-relaxed">
                Take a timed verbal interview with proctoring flags and Indian-accent speech AI evaluation.
              </p>
              <Link
                to="/interview"
                className="text-xs font-semibold text-sage-500 hover:underline flex items-center gap-1 mt-2"
              >
                <span>Launch Mock Interview</span>
                <ArrowRight size={14} />
              </Link>
            </div>

            <div className="bg-cream-200 border border-cream-300 rounded-xl p-5 shadow-paper flex flex-col gap-3 justify-between">
              <h4 className="font-serif font-bold text-charcoal-900">Resume STAR Feedback</h4>
              <p className="text-xs text-charcoal-500 leading-relaxed">
                Upload your CV to generate ATS audit checkmarks and custom STAR project talking points.
              </p>
              <Link
                to="/resume"
                className="text-xs font-semibold text-sage-500 hover:underline flex items-center gap-1 mt-2"
              >
                <span>Analyze Resume</span>
                <ArrowRight size={14} />
              </Link>
            </div>
          </div>
        </div>

        {/* Right Column */}
        <div className="flex flex-col gap-8">
          
          {/* My Target Roadmaps List */}
          <div className="bg-cream-200 border border-cream-300 rounded-xl p-6 shadow-paper flex flex-col gap-4">
            <h3 className="font-serif font-bold text-charcoal-900 flex items-center gap-2">
              <BookOpen size={18} className="text-sage-500" />
              My Study Roadmaps
            </h3>
            <p className="text-[11px] text-charcoal-500">
              Revisit your previously generated custom company-role preparation syllabus and checklists.
            </p>
            
            {myRoadmaps.length > 0 ? (
              <div className="flex flex-col gap-2.5 max-h-60 overflow-y-auto pr-1">
                {myRoadmaps.map((rm) => (
                  <Link
                    key={rm._id}
                    to={`/companies/${rm.companyId}/roadmap/${encodeURIComponent(rm.role)}`}
                    className="flex items-center justify-between p-3 bg-white border border-cream-300 rounded-lg hover:bg-cream-300 hover:border-sage-500 transition-all shadow-paper group"
                  >
                    <div className="flex flex-col gap-0.5">
                      <span className="text-xs font-bold text-charcoal-900 group-hover:text-sage-700">{rm.domain}</span>
                      <span className="text-[9px] text-charcoal-100 uppercase font-semibold">Active Syllabus</span>
                    </div>
                    <ArrowRight size={12} className="text-charcoal-100 group-hover:text-sage-500 group-hover:translate-x-0.5 transition-all" />
                  </Link>
                ))}
              </div>
            ) : (
              <div className="text-center py-6 text-xs text-charcoal-100 flex flex-col items-center gap-2">
                <Compass size={28} className="text-sage-500 stroke-1" />
                <span>No custom roadmaps generated yet.</span>
                <Link
                  to="/companies"
                  className="mt-2 bg-sage-500 hover:bg-sage-600 text-white text-[10px] font-bold px-3 py-1.5 rounded-lg shadow-paper transition-all"
                >
                  Find Target Company
                </Link>
              </div>
            )}
          </div>

          {/* Peer Board Experience Feed */}
          <div className="bg-cream-200 border border-cream-300 rounded-xl p-6 shadow-paper flex flex-col gap-4">
            <h3 className="font-serif font-bold text-charcoal-900 flex justify-between items-center">
              <span>Peer Board</span>
              <Link to="/experiences" className="text-[10px] text-sage-500 font-semibold hover:underline">
                View All
              </Link>
            </h3>
            
            {loading ? (
              <div className="text-xs text-charcoal-100 py-4 text-center">Loading experiences...</div>
            ) : recentExperiences.length > 0 ? (
              <div className="flex flex-col gap-3">
                {recentExperiences.map((exp) => (
                  <div key={exp._id} className="bg-white p-3 rounded-lg border border-cream-300 flex flex-col gap-1.5">
                    <div className="flex justify-between items-start">
                      <span className="text-xs font-bold text-charcoal-900">{exp.company}</span>
                      <span className="text-[9px] bg-sage-100 text-sage-700 px-2 py-0.5 rounded-full capitalize">
                        {exp.difficulty}
                      </span>
                    </div>
                    <div className="text-[10px] text-charcoal-500 font-medium">
                      Role: <span className="font-bold text-charcoal-900">{exp.role}</span>
                    </div>
                    <div className="text-[10px] text-charcoal-100 line-clamp-2 italic">
                      "{exp.tips || 'Tips: Focus on DSA basics.'}"
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-xs text-charcoal-100 py-4 text-center">No experiences posted yet.</div>
            )}
          </div>

        </div>
      </div>
    </div>
  );
}
