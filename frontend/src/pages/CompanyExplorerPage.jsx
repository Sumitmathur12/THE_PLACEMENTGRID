import React, { useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { Compass, Search, Flag, ThumbsUp, PlusCircle, AlertCircle, Calendar, Users, ExternalLink, HelpCircle, Loader2 } from 'lucide-react';
import SourceCitations from '../components/SourceCitations.jsx';

const renderParagraphWithLinks = (text) => {
  if (typeof text !== 'string') return text;
  
  // Match markdown links: [Label](URL)
  const linkRegex = /\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/g;
  const elements = [];
  let lastIndex = 0;
  let match;
  
  while ((match = linkRegex.exec(text)) !== null) {
    const label = match[1];
    const url = match[2];
    
    // Add text before the link
    if (match.index > lastIndex) {
      elements.push(text.substring(lastIndex, match.index));
    }
    
    // Add clickable link element
    elements.push(
      <a 
        key={match.index} 
        href={url} 
        target="_blank" 
        rel="noopener noreferrer" 
        className="text-sage-600 font-bold hover:underline inline-flex items-center gap-0.5"
      >
        {label}
        <ExternalLink size={10} className="inline mt-0.5" />
      </a>
    );
    
    lastIndex = linkRegex.lastIndex;
  }
  
  if (lastIndex < text.length) {
    elements.push(text.substring(lastIndex));
  }
  
  return elements.length > 0 ? elements : text;
};

export default function CompanyExplorerPage({ user, token, setTargetCompanyState }) {
  const location = useLocation();
  const navigate = useNavigate();
  const [companies, setCompanies] = useState([]);
  const [search, setSearch] = useState('');
  const [selectedCompany, setSelectedCompany] = useState(null);
  const [profileText, setProfileText] = useState('');
  const [selectedRole, setSelectedRole] = useState('');
  const [customRole, setCustomRole] = useState('');
  const [hasResearched, setHasResearched] = useState(false);
  const [roleProfileText, setRoleProfileText] = useState('');
  const [loadingRoleDetail, setLoadingRoleDetail] = useState(false);
  const [generatingRoadmap, setGeneratingRoadmap] = useState(false);
  const [citations, setCitations] = useState([]);
  const [coverImage, setCoverImage] = useState('');
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [showAddForm, setShowAddForm] = useState(false);
  const [loadingAdd, setLoadingAdd] = useState(false);

  // New Company form fields (now just Name, generating everything else via custom search + vector search RAG)
  const [newName, setNewName] = useState('');

  const fetchCompanies = async () => {
    try {
      const res = await fetch('/api/companies');
      const data = await res.json();
      setCompanies(data);
      return data;
    } catch (e) {
      console.error('Error fetching companies:', e);
      return [];
    }
  };

  useEffect(() => {
    fetchCompanies().then((data) => {
      // Parse ?select=Company query param from Dashboard quick-add trigger
      const params = new URLSearchParams(location.search);
      const selName = params.get('select');
      if (selName) {
        handleSelectCompany(selName);
      }
    });
  }, [location]);

  const fetchRoleProfile = async (companyId, role) => {
    setLoadingRoleDetail(true);
    setRoleProfileText('');
    try {
      const res = await fetch(`/api/companies/${companyId}/role-profile`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ role })
      });
      const data = await res.json();
      if (res.ok) {
        setRoleProfileText(data.profile || '');
        setCitations(data.citations || []);
      } else {
        console.error(data.error);
      }
    } catch (err) {
      console.error('Error fetching role profile:', err);
    } finally {
      setLoadingRoleDetail(false);
    }
  };

  const handleSelectCompany = async (companyName) => {
    setLoadingDetail(true);
    setSelectedCompany(null);
    setProfileText('');
    setRoleProfileText('');
    setSelectedRole('');
    setCustomRole('');
    setHasResearched(false);
    setCitations([]);
    setCoverImage('');
    
    try {
      const res = await fetch(`/api/companies/detail/${encodeURIComponent(companyName)}`);
      const data = await res.json();
      setSelectedCompany(data.company);
      setProfileText(data.profile);
      setCoverImage(data.coverImage || '');
    } catch (e) {
      console.error('Error fetching details:', e);
    } finally {
      setLoadingDetail(false);
    }
  };

  const handleTriggerResearch = async () => {
    const finalRole = selectedRole === 'Other' ? customRole.trim() : selectedRole;
    if (!selectedCompany) return;
    if (!finalRole) {
      alert('Please select a role or input a custom role name.');
      return;
    }
    
    setHasResearched(false);
    await fetchRoleProfile(selectedCompany._id, finalRole);
    setHasResearched(true);
  };

  const handleGenerateRoadmap = async () => {
    const finalRole = selectedRole === 'Other' ? customRole.trim() : selectedRole;
    if (!selectedCompany || !finalRole) return;
    setGeneratingRoadmap(true);
    try {
      const res = await fetch(`/api/companies/${selectedCompany._id}/role-roadmap`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ role: finalRole })
      });
      const data = await res.json();
      if (res.ok && data.success) {
        navigate(`/companies/${selectedCompany._id}/roadmap/${encodeURIComponent(finalRole)}`);
      } else {
        alert(data.error || 'Failed to generate custom roadmap.');
      }
    } catch (err) {
      console.error('Error generating custom roadmap:', err);
      alert('Network error while generating roadmap.');
    } finally {
      setGeneratingRoadmap(false);
    }
  };

  const handleUpvote = async (id) => {
    if (!token) return alert('Please login to upvote.');
    try {
      const res = await fetch(`/api/companies/upvote/${id}`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await res.json();
      if (data.success) {
        setCompanies(prev => prev.map(c => c._id === id ? { ...c, verified: true, flagCount: data.flagCount } : c));
        if (selectedCompany && selectedCompany._id === id) {
          setSelectedCompany(prev => ({ ...prev, verified: true, flagCount: data.flagCount }));
        }
      }
    } catch (e) {
      console.error(e);
    }
  };

  const handleFlag = async (id) => {
    if (!token) return alert('Please login to flag outdated information.');
    try {
      const res = await fetch(`/api/companies/flag/${id}`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await res.json();
      if (data.success) {
        setCompanies(prev => prev.map(c => c._id === id ? { ...c, flagCount: data.flagCount, lastUpdated: new Date() } : c));
        if (selectedCompany && selectedCompany._id === id) {
          setSelectedCompany(prev => ({ ...prev, flagCount: data.flagCount, lastUpdated: new Date() }));
        }
      }
    } catch (e) {
      console.error(e);
    }
  };

  const handlePinAsTarget = async (companyName) => {
    if (!token) return alert('Please login to set your target company.');
    try {
      const res = await fetch('/api/auth/target-company', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ companyName })
      });
      const data = await res.json();
      if (data.success) {
        setTargetCompanyState(companyName);
        alert(`Successfully pinned ${companyName} as your target company!`);
      }
    } catch (e) {
      console.error(e);
    }
  };

  const handleAddCompanySubmit = async (e) => {
    e.preventDefault();
    if (!newName.trim()) return;
    setLoadingAdd(true);
    try {
      const res = await fetch('/api/companies/add', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          name: newName
        })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to add company');

      alert(`Company "${newName}" generated successfully from RAG context!`);
      setShowAddForm(false);
      setNewName('');
      await fetchCompanies();
      handleSelectCompany(newName);
    } catch (err) {
      alert(err.message);
    } finally {
      setLoadingAdd(false);
    }
  };

  const filteredCompanies = companies.filter(c => 
    c.name.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="fade-in max-w-7xl mx-auto px-4 py-6 flex flex-col gap-8">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-cream-300 pb-6">
        <div>
          <h1 className="text-3xl font-serif font-bold text-charcoal-900 flex items-center gap-2">
            <Compass className="text-sage-500" />
            Company Catalog
          </h1>
          <p className="text-sm text-charcoal-500">
            See historical recruitment timelines, cutoffs, package values, and upvote/flag freshness status.
          </p>
        </div>
        
        {token && (
          <button
            onClick={() => setShowAddForm(!showAddForm)}
            className="bg-sage-500 hover:bg-sage-600 text-white font-semibold text-xs px-4 py-2.5 rounded-lg transition-all shadow-paper flex items-center gap-1.5 shrink-0 self-start sm:self-center"
          >
            <PlusCircle size={16} />
            <span>Add Your College's Company</span>
          </button>
        )}
      </div>

      {/* RAG Add Company Modal Form */}
      {showAddForm && (
        <div className="bg-cream-200 border border-cream-300 rounded-xl p-6 shadow-paper flex flex-col gap-4 max-w-md">
          <h3 className="text-lg font-serif font-bold text-charcoal-900">Index New Company via RAG</h3>
          <p className="text-xs text-charcoal-500 leading-relaxed">
            Type the company name. The portal will perform a dynamic Google Custom Search + MongoDB Vector RAG query, structure the profile automatically, and cache it.
          </p>
          <form onSubmit={handleAddCompanySubmit} className="flex flex-col gap-3">
            <div className="flex flex-col gap-1">
              <label className="text-[10px] font-bold text-charcoal-900 uppercase">Company Name</label>
              <input
                type="text"
                required
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                placeholder="e.g. Netflix"
                className="px-3 py-2 bg-white border border-cream-300 rounded-lg text-xs focus:outline-none focus:border-sage-500"
              />
            </div>
            
            <div className="flex justify-end gap-2 mt-2">
              <button
                type="button"
                onClick={() => setShowAddForm(false)}
                className="px-4 py-2 border border-cream-300 rounded-lg text-xs hover:bg-cream-300 transition-all font-semibold"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={loadingAdd}
                className="bg-sage-500 hover:bg-sage-600 text-white font-semibold text-xs px-4 py-2 rounded-lg flex items-center gap-1.5 transition-all disabled:opacity-50"
              >
                {loadingAdd ? <Loader2 size={12} className="animate-spin" /> : null}
                <span>{loadingAdd ? 'Generating Context...' : 'Generate Profile'}</span>
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Main Catalog View Split */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 items-start">
        
        {/* Left Side: Directory List */}
        <div className="lg:col-span-1 flex flex-col gap-4">
          <div className="relative">
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search companies..."
              className="w-full pl-9 pr-3 py-2.5 bg-cream-200 border border-cream-300 rounded-lg text-xs focus:outline-none focus:border-sage-500 transition-colors"
            />
            <Search size={14} className="absolute left-3 top-3.5 text-charcoal-100" />
          </div>

          {/* Directory Cards */}
          <div className="max-h-[500px] overflow-y-auto flex flex-col gap-3 pr-2">
            {filteredCompanies.map((c) => (
              <button
                key={c._id}
                onClick={() => handleSelectCompany(c.name)}
                className={`text-left p-4 rounded-xl border transition-all flex justify-between items-center ${
                  selectedCompany && selectedCompany.name === c.name
                    ? 'bg-sage-500 text-white border-sage-500 shadow-paper'
                    : 'bg-cream-200 border-cream-300 hover:bg-cream-300 text-charcoal-900'
                }`}
              >
                <div className="flex items-center gap-3">
                  <span className="text-xl">{c.logo || '🏢'}</span>
                  <div>
                    <div className="font-serif font-bold text-sm">{c.name}</div>
                    <div className={`text-[10px] ${
                      selectedCompany && selectedCompany.name === c.name ? 'text-white/80' : 'text-charcoal-500'
                    }`}>
                      Cutoff: {c.collegeCutoff} CGPA
                    </div>
                  </div>
                </div>

                {!c.verified && (
                  <span className={`text-[9px] px-1.5 py-0.5 rounded border ${
                    selectedCompany && selectedCompany.name === c.name
                      ? 'border-white/30 text-white/90 bg-white/10'
                      : 'border-terracotta-500/20 text-terracotta-700 bg-terracotta-100'
                  }`}>
                    AI-Gen
                  </span>
                )}
              </button>
            ))}
            
            {filteredCompanies.length === 0 && (
              <div className="text-center text-xs text-charcoal-100 py-8 italic">No matching companies found.</div>
            )}
          </div>
        </div>

        {/* Right Side: RAG Details Panel */}
        <div className="lg:col-span-2">
          {loadingDetail ? (
            <div className="bg-cream-200 border border-cream-300 rounded-xl p-16 shadow-paper flex flex-col items-center justify-center gap-3">
              <Loader2 size={32} className="animate-spin text-sage-500 stroke-1" />
              <span className="text-xs text-charcoal-500 font-serif italic">Retrieving and assembling grounded RAG context...</span>
            </div>
          ) : selectedCompany ? (
            <div className="bg-cream-200 border border-cream-300 rounded-xl overflow-hidden shadow-paper flex flex-col gap-6">
              
              {/* Unsplash Cover Banner Image */}
              {coverImage && (
                <div className="h-40 w-full overflow-hidden relative border-b border-cream-300">
                  <img src={coverImage} alt={selectedCompany.name} className="w-full h-full object-cover filter brightness-90" />
                  <div className="absolute inset-0 bg-gradient-to-t from-charcoal-900/60 to-transparent"></div>
                  <div className="absolute bottom-4 left-6 text-white flex items-center gap-3">
                    <span className="text-4xl bg-white/10 backdrop-blur-md p-2 rounded-xl border border-white/20">
                      {selectedCompany.logo || '🏢'}
                    </span>
                    <div>
                      <h2 className="text-2xl font-serif font-bold text-white flex items-center gap-2">
                        {selectedCompany.name}
                      </h2>
                      <p className="text-[10px] text-white/80 font-medium">
                        Last Updated: {new Date(selectedCompany.lastUpdated).toLocaleDateString()}
                      </p>
                    </div>
                  </div>
                </div>
              )}

              <div className="px-6 pb-6 flex flex-col gap-6">
                
                {/* Fallback header details if coverImage is not present */}
                {!coverImage && (
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-cream-300 pb-4">
                    <div className="flex items-center gap-4">
                      <span className="text-4xl">{selectedCompany.logo || '🏢'}</span>
                      <div>
                        <h2 className="text-2xl font-serif font-bold text-charcoal-900 flex items-center gap-2">
                          {selectedCompany.name}
                          {!selectedCompany.verified && (
                            <span className="text-[9px] bg-terracotta-100 text-terracotta-700 border border-terracotta-500/20 px-2 py-0.5 rounded-full uppercase font-sans">
                              Verify Content Accuracy
                            </span>
                          )}
                        </h2>
                        <p className="text-xs text-charcoal-500">
                          Last Updated: {new Date(selectedCompany.lastUpdated).toLocaleDateString()}
                        </p>
                      </div>
                    </div>
                  </div>
                )}

                {/* Operations bar */}
                <div className="flex items-center justify-between gap-4 -mt-2">
                  <div className="flex items-center gap-2">
                    {/* Pin as target */}
                    {token && (
                      <button
                        onClick={() => handlePinAsTarget(selectedCompany.name)}
                        className="bg-sage-500 hover:bg-sage-600 text-white font-semibold text-xs px-3.5 py-2 rounded-lg shadow-paper transition-all"
                      >
                        Target This Company
                      </button>
                    )}
                    {/* Upvote and Flag */}
                    <button
                      onClick={() => handleUpvote(selectedCompany._id)}
                      className="bg-white border border-cream-300 hover:bg-cream-300 text-charcoal-900 p-2 rounded-lg transition-all"
                      title="Upvote/Verify content"
                    >
                      <ThumbsUp size={14} className="text-sage-500" />
                    </button>
                    <button
                      onClick={() => handleFlag(selectedCompany._id)}
                      className="bg-white border border-cream-300 hover:bg-cream-300 text-charcoal-900 p-2 rounded-lg transition-all"
                      title="Flag outdated/inaccurate information"
                    >
                      <Flag size={14} className="text-terracotta-500" />
                    </button>
                  </div>
                </div>

                {/* Campus stats strip */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 bg-white p-4 rounded-lg border border-cream-300">
                  <div className="text-center border-b sm:border-b-0 sm:border-r border-cream-200 sm:border-cream-300 pb-3 sm:pb-0">
                    <div className="text-[10px] text-charcoal-100 font-semibold uppercase">Timeline</div>
                    <div className="text-sm font-bold text-sage-500 mt-0.5">{selectedCompany.timeline}</div>
                  </div>
                  <div className="text-center border-b sm:border-b-0 sm:border-r border-cream-200 sm:border-cream-300 pb-3 sm:pb-0">
                    <div className="text-[10px] text-charcoal-100 font-semibold uppercase">Cutoff Score</div>
                    <div className="text-sm font-bold text-sage-500 mt-0.5">
                      {selectedCompany.collegeCutoff === 'Not available' ? 'Not available' : `${selectedCompany.collegeCutoff} CGPA`}
                    </div>
                  </div>
                  <div className="text-center">
                    <div className="text-[10px] text-charcoal-100 font-semibold uppercase">Average Package</div>
                    <div className="text-sm font-bold text-sage-500 mt-0.5">{selectedCompany.placementStats.avgPackage}</div>
                  </div>
                </div>

                {/* Mandatory Role Gating / Selector */}
                {!hasResearched ? (
                  <div className="bg-white p-5 rounded-xl border border-cream-300 shadow-paper flex flex-col gap-4 mt-2">
                    <div className="flex flex-col gap-1">
                      <h4 className="text-sm font-serif font-bold text-charcoal-900">Select Target Role</h4>
                      <p className="text-[11px] text-charcoal-500 leading-relaxed font-sans">
                        No company profile generation happens until a role is explicitly selected. Choose your prep path below.
                      </p>
                    </div>

                    <div className="flex flex-wrap gap-2">
                      {['SDE', 'Data Analyst', 'Data Scientist', 'Machine Learning Engineer', 'Product Manager', 'Core/Non-CS', 'Other'].map((role) => (
                        <button
                          key={role}
                          type="button"
                          onClick={() => {
                            setSelectedRole(role);
                            if (role !== 'Other') setCustomRole('');
                          }}
                          className={`px-3 py-1.5 rounded-lg text-xs font-semibold font-serif border transition-all ${
                            selectedRole === role
                              ? 'bg-sage-500 text-white border-sage-500 shadow-paper'
                              : 'bg-cream-100 border-cream-300 hover:bg-cream-300 text-charcoal-900'
                          }`}
                        >
                          {role}
                        </button>
                      ))}
                    </div>

                    {selectedRole === 'Other' && (
                      <div className="flex flex-col gap-1">
                        <label className="text-[10px] text-charcoal-100 font-semibold uppercase">Specify Custom Role</label>
                        <input
                          type="text"
                          required
                          value={customRole}
                          onChange={(e) => setCustomRole(e.target.value)}
                          placeholder="e.g. Frontend Engineer, Cloud Architect"
                          className="w-full px-3 py-2 bg-white border border-cream-300 rounded-lg text-xs focus:outline-none focus:border-sage-500"
                        />
                      </div>
                    )}

                    <button
                      type="button"
                      onClick={handleTriggerResearch}
                      disabled={loadingRoleDetail}
                      className="w-full bg-sage-500 hover:bg-sage-600 disabled:opacity-50 text-white font-bold text-xs py-2.5 rounded-lg shadow-paper transition-all flex items-center justify-center gap-1.5"
                    >
                      {loadingRoleDetail ? <Loader2 size={12} className="animate-spin" /> : null}
                      <span>{loadingRoleDetail ? 'Researching Pipeline...' : 'Research Role Prep'}</span>
                    </button>
                  </div>
                ) : (
                  <div className="flex flex-col gap-4 mt-2">
                    <div className="flex items-center justify-between border-b border-cream-300 pb-2">
                      <div className="text-xs font-bold text-charcoal-900">
                        Target Role: <span className="text-sage-500 font-serif font-bold">{selectedRole === 'Other' ? customRole : selectedRole}</span>
                      </div>
                      <button
                        onClick={() => {
                          setHasResearched(false);
                          setRoleProfileText('');
                          setCitations([]);
                        }}
                        className="text-xs text-terracotta-500 hover:underline font-serif"
                      >
                        Change Role
                      </button>
                    </div>

                    {loadingRoleDetail ? (
                      <div className="py-12 flex flex-col items-center justify-center gap-2 bg-white/50 rounded-lg border border-cream-300">
                        <Loader2 className="animate-spin text-sage-500" />
                        <span className="text-xs text-charcoal-500 font-serif italic">Fetching grounded details...</span>
                      </div>
                    ) : (
                      <>
                        {/* RAG Role Profile content */}
                        <div className="text-sm text-charcoal-900 leading-relaxed font-sans prose max-w-none prose-sage">
                          {roleProfileText ? (
                            roleProfileText.split('\n').map((para, i) => {
                              const trimmed = para.trim();
                              if (trimmed.startsWith('###')) {
                                return <h3 key={i} className="text-lg font-serif font-bold text-sage-700 mt-4 mb-2">{renderParagraphWithLinks(trimmed.replace('###', '').trim())}</h3>;
                              }
                              if (trimmed.startsWith('**') && trimmed.endsWith('**')) {
                                return <h4 key={i} className="font-bold text-charcoal-900 mt-3 mb-1">{renderParagraphWithLinks(trimmed.replace(/\*\*/g, '').trim())}</h4>;
                              }
                              return trimmed.length > 0 ? <p key={i} className="mb-3">{renderParagraphWithLinks(trimmed)}</p> : null;
                            })
                          ) : (
                            <p className="text-xs text-charcoal-500 italic font-sans">No details available. Please change role and try again.</p>
                          )}
                        </div>

                        {/* Citation block */}
                        {citations.length > 0 && (
                          <SourceCitations citations={citations} />
                        )}

                        {/* Connect to Roadmap CTA block */}
                        {roleProfileText && token && (
                          <div className="mt-4 pt-4 border-t border-cream-300 flex justify-end">
                            <button
                              onClick={handleGenerateRoadmap}
                              disabled={generatingRoadmap}
                              className="w-full sm:w-auto bg-sage-500 hover:bg-sage-600 disabled:bg-sage-300 text-white font-bold text-xs px-5 py-2.5 rounded-lg shadow-paper transition-all flex items-center justify-center gap-2"
                            >
                              {generatingRoadmap ? (
                                <>
                                  <Loader2 size={12} className="animate-spin" />
                                  <span>Generating adaptive roadmap...</span>
                                </>
                              ) : (
                                <span>Generate My Roadmap for {selectedCompany.name} – {selectedRole === 'Other' ? customRole : selectedRole}</span>
                              )}
                            </button>
                          </div>
                        )}
                      </>
                    )}
                  </div>
                )}

                {/* Flags indicator */}
                {selectedCompany.flagCount > 0 && (
                  <div className="bg-red-50 text-red-700 text-xs p-3 rounded-lg border border-red-200 flex items-center gap-2">
                    <AlertCircle size={16} />
                    <span>
                      This profile has been flagged {selectedCompany.flagCount} times as potentially outdated. Exercise caution.
                    </span>
                  </div>
                )}
              </div>
            </div>
          ) : (
            <div className="bg-cream-200 border border-cream-300 rounded-xl p-16 shadow-paper text-center flex flex-col items-center justify-center gap-3">
              <Compass size={40} className="text-charcoal-100 stroke-1" />
              <h3 className="font-serif font-bold text-charcoal-900">Select a Company</h3>
              <p className="text-xs text-charcoal-500 max-w-sm">
                Select a company from the catalog directory to check its pre-seeded details and run the vector RAG generator.
              </p>
            </div>
          )}
        </div>

      </div>
    </div>
  );
}
