import React, { useEffect, useState, useCallback } from 'react';
import { Users, Filter, PlusCircle, AlertCircle, Flame, Award, Trophy, Settings, Target, Globe, Calendar, TrendingUp, Lock, CheckCircle2 } from 'lucide-react';

export default function PeerExperiencesPage({ user, token }) {
  const [activeTab, setActiveTab] = useState('experiences'); // 'experiences' | 'challenge'

  return (
    <div className="fade-in max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 flex flex-col gap-8">
      {/* Page Header + Tab Switcher */}
      <div className="flex flex-col gap-4 border-b border-cream-300 pb-6">
        <div>
          <h1 className="text-3xl font-serif font-bold text-charcoal-900 flex items-center gap-2">
            <Users className="text-sage-500" />
            Peer & Community
          </h1>
          <p className="text-sm text-charcoal-500">
            Real interview experiences from seniors, and a preparation leaderboard to keep you consistent.
          </p>
        </div>

        <div className="flex gap-2">
          <button
            onClick={() => setActiveTab('experiences')}
            className={`text-xs font-semibold px-4 py-2 rounded-lg transition-all border ${
              activeTab === 'experiences'
                ? 'bg-sage-500 text-white border-sage-500 shadow-paper'
                : 'bg-white text-charcoal-500 border-cream-300 hover:bg-cream-200'
            }`}
          >
            Interview Experiences
          </button>
          <button
            onClick={() => setActiveTab('challenge')}
            className={`text-xs font-semibold px-4 py-2 rounded-lg transition-all border flex items-center gap-1.5 ${
              activeTab === 'challenge'
                ? 'bg-sage-500 text-white border-sage-500 shadow-paper'
                : 'bg-white text-charcoal-500 border-cream-300 hover:bg-cream-200'
            }`}
          >
            <Trophy size={13} />
            Peer Challenge
          </button>
        </div>
      </div>

      {activeTab === 'experiences' ? (
        <InterviewExperiencesTab user={user} token={token} />
      ) : (
        <PeerChallengeTab user={user} token={token} />
      )}
    </div>
  );
}

// ============================================================================
// TAB 1: Interview Experiences (existing feature, unchanged behavior)
// ============================================================================
function InterviewExperiencesTab({ user, token }) {
  const [experiences, setExperiences] = useState([]);
  const [companyFilter, setCompanyFilter] = useState('');
  const [loading, setLoading] = useState(false);
  const [showAddForm, setShowAddForm] = useState(false);

  const [role, setRole] = useState('');
  const [company, setCompany] = useState('');
  const [questions, setQuestions] = useState('');
  const [difficulty, setDifficulty] = useState('medium');
  const [tips, setTips] = useState('');
  const [anonymous, setAnonymous] = useState(false);

  const fetchExperiences = async () => {
    setLoading(true);
    try {
      const url = companyFilter ? `/api/experiences?company=${companyFilter}` : '/api/experiences';
      const res = await fetch(url);
      const data = await res.json();
      setExperiences(data);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchExperiences();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [companyFilter]);

  const handleAddSubmit = async (e) => {
    e.preventDefault();
    if (!role || !company || !questions) return;

    const parsedQuestions = questions
      .split('\n')
      .map(q => q.trim())
      .filter(Boolean);

    try {
      const res = await fetch('/api/experiences/add', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          role,
          company,
          questionsAsked: parsedQuestions,
          difficulty,
          tips,
          anonymous
        })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to submit experience');

      alert('Interview experience posted successfully!');
      setShowAddForm(false);
      setRole('');
      setCompany('');
      setQuestions('');
      setTips('');
      setAnonymous(false);
      fetchExperiences();
    } catch (err) {
      alert(err.message);
    }
  };

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <p className="text-xs text-charcoal-500">
          Read hyper-local, real questions asked at your college, shared by seniors.
        </p>
        {token && (
          <button
            onClick={() => setShowAddForm(!showAddForm)}
            className="bg-sage-500 hover:bg-sage-600 text-white font-medium text-xs px-4 py-2.5 rounded-lg transition-all shadow-paper flex items-center gap-1.5 shrink-0 self-start sm:self-center"
          >
            <PlusCircle size={16} />
            <span>Share Your Experience</span>
          </button>
        )}
      </div>

      {showAddForm && (
        <div className="bg-cream-200 border border-cream-300 rounded-xl p-6 shadow-paper flex flex-col gap-4">
          <h3 className="text-lg font-serif font-bold text-charcoal-900">Post Interview Log</h3>
          <form onSubmit={handleAddSubmit} className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="flex flex-col gap-1">
              <label className="text-xs font-semibold text-charcoal-900">Job Role / Designation *</label>
              <input
                type="text"
                required
                value={role}
                onChange={(e) => setRole(e.target.value)}
                placeholder="e.g. SDE Intern"
                className="px-3 py-2 bg-white border border-cream-300 rounded-lg text-xs focus:outline-none focus:border-sage-500"
              />
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-xs font-semibold text-charcoal-900">Company Name *</label>
              <input
                type="text"
                required
                value={company}
                onChange={(e) => setCompany(e.target.value)}
                placeholder="e.g. Adobe"
                className="px-3 py-2 bg-white border border-cream-300 rounded-lg text-xs focus:outline-none focus:border-sage-500"
              />
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-xs font-semibold text-charcoal-900">Perceived Difficulty</label>
              <select
                value={difficulty}
                onChange={(e) => setDifficulty(e.target.value)}
                className="px-3 py-2 bg-white border border-cream-300 rounded-lg text-xs focus:outline-none focus:border-sage-500"
              >
                <option value="easy">Easy</option>
                <option value="medium">Medium</option>
                <option value="hard">Hard</option>
              </select>
            </div>
            <div className="flex items-center gap-2 mt-4 pl-1">
              <input
                type="checkbox"
                id="anon"
                checked={anonymous}
                onChange={(e) => setAnonymous(e.target.checked)}
                className="rounded border-cream-300 text-sage-500 focus:ring-sage-500"
              />
              <label htmlFor="anon" className="text-xs font-semibold text-charcoal-900 cursor-pointer">
                Post anonymously (Hides name & email)
              </label>
            </div>

            <div className="sm:col-span-2 flex flex-col gap-1">
              <label className="text-xs font-semibold text-charcoal-900">Questions Asked (One per line) *</label>
              <textarea
                required
                value={questions}
                onChange={(e) => setQuestions(e.target.value)}
                placeholder={"How to reverse a LinkedList?\nWhat is page thrashing?\nExplain your final year project details..."}
                className="px-3 py-2 bg-white border border-cream-300 rounded-lg text-xs focus:outline-none focus:border-sage-500 h-28 resize-none"
              />
            </div>

            <div className="sm:col-span-2 flex flex-col gap-1">
              <label className="text-xs font-semibold text-charcoal-900">Preparation Tips & Advice</label>
              <textarea
                value={tips}
                onChange={(e) => setTips(e.target.value)}
                placeholder="Be strong on C++ pointers, study OS memory management chapters..."
                className="px-3 py-2 bg-white border border-cream-300 rounded-lg text-xs focus:outline-none focus:border-sage-500 h-20 resize-none"
              />
            </div>

            <div className="sm:col-span-2 flex justify-end gap-2 mt-2">
              <button
                type="button"
                onClick={() => setShowAddForm(false)}
                className="px-4 py-2 border border-cream-300 rounded-lg text-xs hover:bg-cream-300 transition-all"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="bg-sage-500 hover:bg-sage-600 text-white font-medium text-xs px-5 py-2.5 rounded-lg shadow-paper transition-all"
              >
                Post Review
              </button>
            </div>
          </form>
        </div>
      )}

      <div className="flex items-center gap-3 bg-cream-200 border border-cream-300 p-4 rounded-xl shadow-paper">
        <Filter size={16} className="text-charcoal-100" />
        <input
          type="text"
          value={companyFilter}
          onChange={(e) => setCompanyFilter(e.target.value)}
          placeholder="Filter by company name..."
          className="w-full sm:max-w-xs px-3 py-1.5 bg-white border border-cream-300 rounded-lg text-xs focus:outline-none focus:border-sage-500"
        />
      </div>

      {loading ? (
        <div className="text-center py-16 text-xs text-charcoal-100 italic">Fetching experiences...</div>
      ) : experiences.length > 0 ? (
        <div className="flex flex-col gap-4">
          {experiences.map((exp) => (
            <div key={exp._id} className="bg-cream-200 border border-cream-300 rounded-xl p-6 shadow-paper flex flex-col gap-4">
              <div className="flex justify-between items-start border-b border-cream-300 pb-3">
                <div>
                  <h3 className="text-base font-serif font-bold text-charcoal-900">{exp.company}</h3>
                  <p className="text-[10px] text-charcoal-500">
                    Role: <span className="font-semibold text-charcoal-900">{exp.role}</span> | Shared by {exp.studentName}
                  </p>
                </div>
                <span className={`text-[9px] px-2.5 py-0.5 rounded-full font-bold uppercase ${
                  exp.difficulty === 'hard' ? 'bg-red-100 text-red-700' :
                  exp.difficulty === 'medium' ? 'bg-amber-100 text-amber-700' : 'bg-sage-100 text-sage-700'
                }`}>
                  {exp.difficulty}
                </span>
              </div>

              <div className="flex flex-col gap-2 bg-white p-4 rounded-lg border border-cream-300">
                <span className="text-[9px] font-bold text-sage-500 uppercase tracking-wider">Interview Questions Asked:</span>
                <ul className="text-xs text-charcoal-500 list-disc list-inside flex flex-col gap-1.5">
                  {exp.questionsAsked.map((q, idx) => (
                    <li key={idx} className="leading-relaxed">"{q}"</li>
                  ))}
                </ul>
              </div>

              {exp.tips && (
                <div className="text-xs text-charcoal-500 bg-cream-50 border border-cream-300/40 p-3 rounded-lg leading-relaxed">
                  <strong className="text-charcoal-900">Advice:</strong> {exp.tips}
                </div>
              )}
            </div>
          ))}
        </div>
      ) : (
        <div className="bg-cream-200 border border-cream-300 rounded-xl p-16 shadow-paper text-center flex flex-col items-center justify-center gap-2">
          <AlertCircle size={32} className="text-charcoal-100 stroke-1" />
          <h3 className="font-serif font-bold text-charcoal-900">No logs found</h3>
          <p className="text-xs text-charcoal-500 max-w-xs mx-auto">
            No peer experiences posted for this company yet. Click "Share Your Experience" to be the first!
          </p>
        </div>
      )}
    </div>
  );
}

// ============================================================================
// TAB 2: Peer Challenge — competitive, privacy-respecting leaderboard
// ============================================================================
function PeerChallengeTab({ user, token }) {
  const [myStats, setMyStats] = useState(null);
  const [statsLoading, setStatsLoading] = useState(true);
  const [scope, setScope] = useState('global'); // 'global' | 'target'
  const [period, setPeriod] = useState('weekly'); // 'weekly' | 'alltime'
  const [leaderboard, setLeaderboard] = useState([]);
  const [lbLoading, setLbLoading] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [handleInput, setHandleInput] = useState('');
  const [savingSettings, setSavingSettings] = useState(false);
  const [settingsError, setSettingsError] = useState('');

  const fetchMyStats = useCallback(async () => {
    if (!token) return;
    setStatsLoading(true);
    try {
      const res = await fetch('/api/experiences/my-stats', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await res.json();
      setMyStats(data);
      setHandleInput(data.displayHandle || '');
    } catch (e) {
      console.error(e);
    } finally {
      setStatsLoading(false);
    }
  }, [token]);

  const fetchLeaderboard = useCallback(async () => {
    setLbLoading(true);
    try {
      let url = `/api/experiences/leaderboard?scope=${scope}&period=${period}`;
      if (scope === 'target' && myStats?.targetCompany) {
        url += `&company=${encodeURIComponent(myStats.targetCompany)}`;
      }
      const res = await fetch(url);
      const data = await res.json();
      setLeaderboard(data.leaderboard || []);
    } catch (e) {
      console.error(e);
    } finally {
      setLbLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scope, period, myStats]);

  useEffect(() => { fetchMyStats(); }, [fetchMyStats]);
  useEffect(() => {
    if (scope === 'target' && !myStats?.targetCompany) return;
    fetchLeaderboard();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fetchLeaderboard, scope, myStats]);

  const handleSaveSettings = async (optInValue) => {
    setSettingsError('');
    if (optInValue && handleInput.trim().length < 3) {
      setSettingsError('Please choose a display handle (at least 3 characters) first.');
      return;
    }
    setSavingSettings(true);
    try {
      const res = await fetch('/api/auth/leaderboard-settings', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ displayHandle: handleInput.trim(), leaderboardOptIn: optInValue })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to save settings');
      await fetchMyStats();
      setShowSettings(false);
      fetchLeaderboard();
    } catch (err) {
      setSettingsError(err.message);
    } finally {
      setSavingSettings(false);
    }
  };

  if (!token) {
    return (
      <div className="bg-cream-200 border border-cream-300 rounded-xl p-16 shadow-paper text-center flex flex-col items-center justify-center gap-2">
        <Lock size={32} className="text-charcoal-100 stroke-1" />
        <p className="text-xs text-charcoal-500">Log in to see your preparation stats and join the leaderboard.</p>
      </div>
    );
  }

  if (statsLoading) {
    return <div className="text-center py-16 text-xs text-charcoal-100 italic">Loading your stats...</div>;
  }

  return (
    <div className="flex flex-col gap-6">
      {/* Personal stats — always visible regardless of opt-in status */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <StatChip icon={<Flame size={14} className="text-terracotta-500 fill-terracotta-500" />} label="Current Streak" value={`${myStats?.currentStreak || 0} days`} />
        <StatChip icon={<TrendingUp size={14} className="text-sage-500" />} label="Weekly Score" value={myStats?.weeklyScore || 0} />
        <StatChip icon={<Target size={14} className="text-terracotta-500" />} label="Roadmap Progress" value={`${myStats?.roadmapCompletionPct || 0}%`} />
        <StatChip icon={<Award size={14} className="text-sage-500" />} label="Questions Practiced" value={myStats?.totalQuestionsAttempted || 0} />
      </div>

      {/* Opt-in gate OR settings/rank summary */}
      {!myStats?.leaderboardOptIn ? (
        <div className="bg-cream-200 border border-cream-300 rounded-xl p-8 shadow-paper flex flex-col items-center text-center gap-4">
          <Trophy size={28} className="text-sage-500" />
          <div>
            <h3 className="font-serif font-bold text-charcoal-900 text-lg">Join the Peer Challenge</h3>
            <p className="text-xs text-charcoal-500 max-w-md mx-auto mt-1">
              Compete with students preparing for the same target company. If you join, other students will only ever see:
              your chosen <strong>display handle</strong>, your preparation score, streak, and target company —
              never your real name, email, or college.
            </p>
          </div>
          <div className="flex flex-col sm:flex-row gap-2 w-full max-w-sm">
            <input
              type="text"
              value={handleInput}
              onChange={(e) => setHandleInput(e.target.value)}
              placeholder="Choose a display handle (e.g. QuietCoder42)"
              maxLength={24}
              className="flex-1 px-3 py-2 bg-white border border-cream-300 rounded-lg text-xs focus:outline-none focus:border-sage-500"
            />
          </div>
          {settingsError && <p className="text-[10px] text-red-600">{settingsError}</p>}
          <div className="flex gap-2">
            <button
              onClick={() => handleSaveSettings(true)}
              disabled={savingSettings}
              className="bg-sage-500 hover:bg-sage-600 text-white font-medium text-xs px-5 py-2.5 rounded-lg shadow-paper transition-all disabled:opacity-50"
            >
              {savingSettings ? 'Joining...' : 'Join Leaderboard'}
            </button>
          </div>
        </div>
      ) : (
        <div className="bg-cream-200 border border-cream-300 rounded-xl p-4 shadow-paper flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2 text-xs text-charcoal-900">
            <CheckCircle2 size={15} className="text-sage-500" />
            Playing as <strong>{myStats.displayHandle}</strong>
            {myStats.globalRank && <span className="text-charcoal-500">· Global Rank #{myStats.globalRank}</span>}
          </div>
          <button
            onClick={() => setShowSettings(!showSettings)}
            className="text-xs text-charcoal-500 hover:text-charcoal-900 flex items-center gap-1"
          >
            <Settings size={13} /> Settings
          </button>
        </div>
      )}

      {showSettings && myStats?.leaderboardOptIn && (
        <div className="bg-cream-200 border border-cream-300 rounded-xl p-6 shadow-paper flex flex-col gap-3">
          <label className="text-xs font-semibold text-charcoal-900">Display Handle</label>
          <input
            type="text"
            value={handleInput}
            onChange={(e) => setHandleInput(e.target.value)}
            maxLength={24}
            className="px-3 py-2 bg-white border border-cream-300 rounded-lg text-xs focus:outline-none focus:border-sage-500 max-w-sm"
          />
          {settingsError && <p className="text-[10px] text-red-600">{settingsError}</p>}
          <div className="flex gap-2 mt-1">
            <button
              onClick={() => handleSaveSettings(true)}
              disabled={savingSettings}
              className="bg-sage-500 hover:bg-sage-600 text-white text-xs font-medium px-4 py-2 rounded-lg transition-all disabled:opacity-50"
            >
              Save Handle
            </button>
            <button
              onClick={() => handleSaveSettings(false)}
              disabled={savingSettings}
              className="border border-red-300 text-red-600 text-xs font-medium px-4 py-2 rounded-lg hover:bg-red-50 transition-all disabled:opacity-50"
            >
              Leave Leaderboard
            </button>
          </div>
          <p className="text-[10px] text-charcoal-100">
            Leaving keeps all your personal stats tracked privately — you just won't appear on the public board.
          </p>
        </div>
      )}

      {/* Filters */}
      <div className="flex flex-wrap gap-2">
        <div className="flex bg-white border border-cream-300 rounded-lg overflow-hidden">
          <button
            onClick={() => setScope('global')}
            className={`text-[11px] font-semibold px-3 py-2 flex items-center gap-1 transition-all ${scope === 'global' ? 'bg-sage-500 text-white' : 'text-charcoal-500 hover:bg-cream-200'}`}
          >
            <Globe size={12} /> Global
          </button>
          <button
            onClick={() => setScope('target')}
            disabled={!myStats?.targetCompany}
            title={!myStats?.targetCompany ? 'Select a target company first' : ''}
            className={`text-[11px] font-semibold px-3 py-2 flex items-center gap-1 transition-all disabled:opacity-40 disabled:cursor-not-allowed ${scope === 'target' ? 'bg-sage-500 text-white' : 'text-charcoal-500 hover:bg-cream-200'}`}
          >
            <Target size={12} /> Same Target {myStats?.targetCompany ? `(${myStats.targetCompany})` : ''}
          </button>
        </div>
        <div className="flex bg-white border border-cream-300 rounded-lg overflow-hidden">
          <button
            onClick={() => setPeriod('weekly')}
            className={`text-[11px] font-semibold px-3 py-2 flex items-center gap-1 transition-all ${period === 'weekly' ? 'bg-terracotta-500 text-white' : 'text-charcoal-500 hover:bg-cream-200'}`}
          >
            <Calendar size={12} /> This Week
          </button>
          <button
            onClick={() => setPeriod('alltime')}
            className={`text-[11px] font-semibold px-3 py-2 flex items-center gap-1 transition-all ${period === 'alltime' ? 'bg-terracotta-500 text-white' : 'text-charcoal-500 hover:bg-cream-200'}`}
          >
            All-Time
          </button>
        </div>
      </div>

      {/* Leaderboard table */}
      <div className="bg-cream-200 border border-cream-300 rounded-xl shadow-paper overflow-hidden overflow-x-auto">
        {lbLoading ? (
          <div className="text-center py-12 text-xs text-charcoal-100 italic">Loading rankings...</div>
        ) : leaderboard.length === 0 ? (
          <div className="text-center py-12 text-xs text-charcoal-100 italic">
            No one's on this board yet — be the first opted-in student here!
          </div>
        ) : (
          <table className="w-full text-xs min-w-[480px]">
            <thead>
              <tr className="border-b border-cream-300 text-charcoal-500 text-left">
                <th className="px-4 py-3 font-semibold">#</th>
                <th className="px-4 py-3 font-semibold">Student</th>
                <th className="px-4 py-3 font-semibold">Target</th>
                <th className="px-4 py-3 font-semibold text-right">Streak</th>
                <th className="px-4 py-3 font-semibold text-right">Roadmap</th>
                <th className="px-4 py-3 font-semibold text-right">Score</th>
              </tr>
            </thead>
            <tbody>
              {leaderboard.map((entry) => {
                const isMe = myStats?.displayHandle && entry.displayHandle === myStats.displayHandle;
                return (
                  <tr
                    key={entry.rank}
                    className={`border-b border-cream-300/50 ${isMe ? 'bg-sage-100/60 font-semibold' : ''}`}
                  >
                    <td className="px-4 py-3 font-serif font-bold text-sage-600">#{entry.rank}</td>
                    <td className="px-4 py-3 text-charcoal-900">{entry.displayHandle}{isMe && ' (You)'}</td>
                    <td className="px-4 py-3 text-charcoal-500">{entry.targetCompany || '—'}</td>
                    <td className="px-4 py-3 text-right">
                      <span className="inline-flex items-center gap-1 text-terracotta-600">
                        <Flame size={11} className="fill-terracotta-500" />{entry.streak}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right text-charcoal-500">{entry.roadmapCompletionPct}%</td>
                    <td className="px-4 py-3 text-right font-bold text-charcoal-900">{entry.score}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}

function StatChip({ icon, label, value }) {
  return (
    <div className="bg-cream-200 border border-cream-300 rounded-xl p-3 shadow-paper flex flex-col gap-1">
      <div className="flex items-center gap-1.5">
        {icon}
        <span className="text-[9px] text-charcoal-100 font-semibold uppercase tracking-wider">{label}</span>
      </div>
      <div className="text-sm font-bold text-charcoal-900">{value}</div>
    </div>
  );
}
