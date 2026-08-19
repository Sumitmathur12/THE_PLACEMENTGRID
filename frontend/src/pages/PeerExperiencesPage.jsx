import React, { useEffect, useState } from 'react';
import { Users, Filter, PlusCircle, AlertCircle, ArrowUpRight, Flame, Award } from 'lucide-react';

export default function PeerExperiencesPage({ user, token }) {
  const [experiences, setExperiences] = useState([]);
  const [leaderboard, setLeaderboard] = useState([]);
  const [companyFilter, setCompanyFilter] = useState('');
  const [loading, setLoading] = useState(false);
  const [showAddForm, setShowAddForm] = useState(false);

  // Form states
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

  const fetchLeaderboard = async () => {
    try {
      const res = await fetch('/api/experiences/leaderboard');
      const data = await res.json();
      setLeaderboard(data);
    } catch (e) {
      console.error(e);
    }
  };

  useEffect(() => {
    fetchExperiences();
  }, [companyFilter]);

  useEffect(() => {
    fetchLeaderboard();
  }, []);

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

      alert('Interview experience posted successfully! Your daily streak has been incremented.');
      setShowAddForm(false);
      setRole('');
      setCompany('');
      setQuestions('');
      setTips('');
      setAnonymous(false);
      fetchExperiences();
      fetchLeaderboard();
    } catch (err) {
      alert(err.message);
    }
  };

  return (
    <div class="fade-in max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 flex flex-col gap-8">
      {/* Page Header */}
      <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-cream-300 pb-6">
        <div>
          <h1 class="text-3xl font-serif font-bold text-charcoal-900 flex items-center gap-2">
            <Users class="text-sage-500" />
            Senior Interview Experience Board
          </h1>
          <p class="text-sm text-charcoal-500">
            Read hyper-local, real questions asked at your college, shared by seniors.
          </p>
        </div>

        {token && (
          <button
            onClick={() => setShowAddForm(!showAddForm)}
            class="bg-sage-500 hover:bg-sage-600 text-white font-medium text-xs px-4 py-2.5 rounded-lg transition-all shadow-paper flex items-center gap-1.5 shrink-0 self-start sm:self-center"
          >
            <PlusCircle size={16} />
            <span>Share Your Experience</span>
          </button>
        )}
      </div>

      {/* Share Experience modal form */}
      {showAddForm && (
        <div class="bg-cream-200 border border-cream-300 rounded-xl p-6 shadow-paper flex flex-col gap-4">
          <h3 class="text-lg font-serif font-bold text-charcoal-900">Post Interview Log</h3>
          <form onSubmit={handleAddSubmit} class="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div class="flex flex-col gap-1">
              <label class="text-xs font-semibold text-charcoal-900">Job Role / Designation *</label>
              <input
                type="text"
                required
                value={role}
                onChange={(e) => setRole(e.target.value)}
                placeholder="e.g. SDE Intern"
                class="px-3 py-2 bg-white border border-cream-300 rounded-lg text-xs focus:outline-none focus:border-sage-500"
              />
            </div>
            <div class="flex flex-col gap-1">
              <label class="text-xs font-semibold text-charcoal-900">Company Name *</label>
              <input
                type="text"
                required
                value={company}
                onChange={(e) => setCompany(e.target.value)}
                placeholder="e.g. Adobe"
                class="px-3 py-2 bg-white border border-cream-300 rounded-lg text-xs focus:outline-none focus:border-sage-500"
              />
            </div>
            <div class="flex flex-col gap-1">
              <label class="text-xs font-semibold text-charcoal-900">Perceived Difficulty</label>
              <select
                value={difficulty}
                onChange={(e) => setDifficulty(e.target.value)}
                class="px-3 py-2 bg-white border border-cream-300 rounded-lg text-xs focus:outline-none focus:border-sage-500"
              >
                <option value="easy">Easy</option>
                <option value="medium">Medium</option>
                <option value="hard">Hard</option>
              </select>
            </div>
            <div class="flex items-center gap-2 mt-4 pl-1">
              <input
                type="checkbox"
                id="anon"
                checked={anonymous}
                onChange={(e) => setAnonymous(e.target.checked)}
                class="rounded border-cream-300 text-sage-500 focus:ring-sage-500"
              />
              <label htmlFor="anon" class="text-xs font-semibold text-charcoal-900 cursor-pointer">
                Post anonymously (Hides name & email)
              </label>
            </div>
            
            <div class="sm:col-span-2 flex flex-col gap-1">
              <label class="text-xs font-semibold text-charcoal-900">Questions Asked (One per line) *</label>
              <textarea
                required
                value={questions}
                onChange={(e) => setQuestions(e.target.value)}
                placeholder="How to reverse a LinkedList?&#10;What is page thrashing?&#10;Explain your final year project details..."
                class="px-3 py-2 bg-white border border-cream-300 rounded-lg text-xs focus:outline-none focus:border-sage-500 h-28 resize-none"
              />
            </div>

            <div class="sm:col-span-2 flex flex-col gap-1">
              <label class="text-xs font-semibold text-charcoal-900">Preparation Tips & Advice</label>
              <textarea
                value={tips}
                onChange={(e) => setTips(e.target.value)}
                placeholder="Be strong on C++ pointers, study OS memory management chapters..."
                class="px-3 py-2 bg-white border border-cream-300 rounded-lg text-xs focus:outline-none focus:border-sage-500 h-20 resize-none"
              />
            </div>

            <div class="sm:col-span-2 flex justify-end gap-2 mt-2">
              <button
                type="button"
                onClick={() => setShowAddForm(false)}
                class="px-4 py-2 border border-cream-300 rounded-lg text-xs hover:bg-cream-300 transition-all"
              >
                Cancel
              </button>
              <button
                type="submit"
                class="bg-sage-500 hover:bg-sage-600 text-white font-medium text-xs px-5 py-2.5 rounded-lg shadow-paper transition-all"
              >
                Post Review
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Main split */}
      <div class="grid grid-cols-1 lg:grid-cols-3 gap-6 lg:gap-8 items-start">
        
        {/* Left/Middle: Experience feeds */}
        <div class="lg:col-span-2 flex flex-col gap-6">
          {/* Filters strip */}
          <div class="flex items-center gap-3 bg-cream-200 border border-cream-300 p-4 rounded-xl shadow-paper">
            <Filter size={16} class="text-charcoal-100" />
            <input
              type="text"
              value={companyFilter}
              onChange={(e) => setCompanyFilter(e.target.value)}
              placeholder="Filter by company name..."
              class="w-full sm:max-w-xs px-3 py-1.5 bg-white border border-cream-300 rounded-lg text-xs focus:outline-none focus:border-sage-500"
            />
          </div>

          {/* Cards feed */}
          {loading ? (
            <div class="text-center py-16 text-xs text-charcoal-100 italic">Fetching experiences...</div>
          ) : experiences.length > 0 ? (
            <div class="flex flex-col gap-4">
              {experiences.map((exp) => (
                <div key={exp._id} class="bg-cream-200 border border-cream-300 rounded-xl p-6 shadow-paper flex flex-col gap-4">
                  {/* Card Header details */}
                  <div class="flex justify-between items-start border-b border-cream-300 pb-3">
                    <div>
                      <h3 class="text-base font-serif font-bold text-charcoal-900">{exp.company}</h3>
                      <p class="text-[10px] text-charcoal-500">
                        Role: <span class="font-semibold text-charcoal-900">{exp.role}</span> | Shared by {exp.studentName}
                      </p>
                    </div>
                    
                    <span class={`text-[9px] px-2.5 py-0.5 rounded-full font-bold uppercase ${
                      exp.difficulty === 'hard' ? 'bg-red-100 text-red-700' :
                      exp.difficulty === 'medium' ? 'bg-amber-100 text-amber-700' : 'bg-sage-100 text-sage-700'
                    }`}>
                      {exp.difficulty}
                    </span>
                  </div>

                  {/* Questions asked list */}
                  <div class="flex flex-col gap-2 bg-white p-4 rounded-lg border border-cream-300">
                    <span class="text-[9px] font-bold text-sage-500 uppercase tracking-wider">Interview Questions Asked:</span>
                    <ul class="text-xs text-charcoal-500 list-disc list-inside flex flex-col gap-1.5">
                      {exp.questionsAsked.map((q, idx) => (
                        <li key={idx} class="leading-relaxed">"{q}"</li>
                      ))}
                    </ul>
                  </div>

                  {/* Preparation advice */}
                  {exp.tips && (
                    <div class="text-xs text-charcoal-500 bg-cream-50 border border-cream-300/40 p-3 rounded-lg leading-relaxed">
                      <strong class="text-charcoal-900">Advice:</strong> {exp.tips}
                    </div>
                  )}
                </div>
              ))}
            </div>
          ) : (
            <div class="bg-cream-200 border border-cream-300 rounded-xl p-16 shadow-paper text-center flex flex-col items-center justify-center gap-2">
              <AlertCircle size={32} class="text-charcoal-100 stroke-1" />
              <h3 class="font-serif font-bold text-charcoal-900">No logs found</h3>
              <p class="text-xs text-charcoal-500 max-w-xs mx-auto">
                No peer experiences posted for this company yet. Click "Share Your Experience" to be the first!
              </p>
            </div>
          )}
        </div>

        {/* Right side: Consistency leaderboard sidebar */}
        <div class="lg:col-span-1 bg-cream-200 border border-cream-300 rounded-xl p-6 shadow-paper flex flex-col gap-4">
          <h3 class="font-serif font-bold text-charcoal-900 border-b border-cream-300 pb-2 flex items-center gap-1.5 text-sm">
            <Award size={16} class="text-sage-500" />
            Consistency Leaderboard
          </h3>
          <p class="text-[10px] text-charcoal-500">
            Ranked by daily streak activity and completed roadmap checkpoints. Consistency drives placement success.
          </p>

          <div class="flex flex-col gap-3">
            {leaderboard.map((item, index) => (
              <div 
                key={index}
                class="bg-white p-3 rounded-lg border border-cream-300 flex justify-between items-center gap-2"
              >
                <div class="flex items-center gap-2.5">
                  <span class="text-xs font-bold font-serif text-sage-600">#{index + 1}</span>
                  <div>
                    <div class="text-xs font-bold text-charcoal-900">{item.name}</div>
                    <div class="text-[9px] text-charcoal-500">{item.completedCount} Topics Covered</div>
                  </div>
                </div>

                <div class="flex items-center gap-1 bg-sage-100 text-sage-700 text-[10px] px-2 py-0.5 rounded-full border border-sage-500/10 font-bold shrink-0">
                  <Flame size={10} class="text-terracotta-500 fill-terracotta-500" />
                  <span>{item.streak}</span>
                </div>
              </div>
            ))}
            
            {leaderboard.length === 0 && (
              <div class="text-center text-xs text-charcoal-100 py-4 italic">No rankings logged yet.</div>
            )}
          </div>
        </div>

      </div>
    </div>
  );
}
