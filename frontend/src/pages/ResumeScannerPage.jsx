import React, { useEffect, useState } from 'react';
import { FileText, Github, Upload, CheckCircle2, AlertCircle, Loader2 } from 'lucide-react';

export default function ResumeScannerPage({ user, token, onResumeParsed }) {
  const [file, setFile] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [checklist, setChecklist] = useState([]);
  const [scanningProject, setScanningProject] = useState(false);

  // GitHub scanner inputs
  const [githubLink, setGithubLink] = useState('');
  const [projectDesc, setProjectDesc] = useState('');

  const fetchChecklist = async () => {
    try {
      const res = await fetch('/api/profile/checklist');
      const data = await res.json();
      setChecklist(data);
    } catch (e) {
      console.error(e);
    }
  };

  useEffect(() => {
    fetchChecklist();
  }, []);

  const handleFileChange = (e) => {
    setFile(e.target.files[0]);
  };

  const handleUploadSubmit = async (e) => {
    e.preventDefault();
    if (!file) return;
    setUploading(true);

    const formData = new FormData();
    formData.append('resume', file);

    try {
      const res = await fetch('/api/profile/resume-upload', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` },
        body: formData
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to parse resume');

      onResumeParsed(data.resume);
      alert('Resume parsed and saved to profile successfully!');
    } catch (err) {
      alert(err.message);
    } finally {
      setUploading(false);
    }
  };

  const handleProjectScanSubmit = async (e) => {
    e.preventDefault();
    if (!githubLink) return;
    setScanningProject(true);

    try {
      const res = await fetch('/api/profile/scan-project', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ githubLink, description: projectDesc })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to scan project');

      // Append project locally in user state
      const updatedUser = { ...user };
      updatedUser.resume.projects.push(data.project);
      onResumeParsed(updatedUser.resume); // update global user state

      alert('GitHub project scanned and talking points saved!');
      setGithubLink('');
      setProjectDesc('');
    } catch (err) {
      alert(err.message);
    } finally {
      setScanningProject(false);
    }
  };

  return (
    <div class="fade-in max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 flex flex-col gap-8">
      {/* Page Header */}
      <div class="border-b border-cream-300 pb-6">
        <h1 class="text-3xl font-serif font-bold text-charcoal-900 flex items-center gap-2">
          <FileText class="text-sage-500" />
          Resume & Project Analyzer
        </h1>
        <p class="text-sm text-charcoal-500">
          Upload your CV to parse structural fields, and scan your GitHub link to generate STAR interview answers.
        </p>
      </div>

      {/* Main Grid */}
      <div class="grid grid-cols-1 lg:grid-cols-3 gap-6 lg:gap-8 items-start">
        
        {/* Left Side: Upload & Scan Controls */}
        <div class="lg:col-span-1 flex flex-col gap-6">
          
          {/* CV Upload Card */}
          <div class="bg-cream-200 border border-cream-300 rounded-xl p-6 shadow-paper flex flex-col gap-4">
            <h3 class="font-serif font-bold text-charcoal-900 flex items-center gap-1.5 text-sm">
              <Upload size={16} class="text-sage-500" />
              Upload Resume (PDF)
            </h3>
            
            <form onSubmit={handleUploadSubmit} class="flex flex-col gap-4">
              <div class="border-2 border-dashed border-cream-300 bg-white hover:bg-cream-100 p-6 rounded-lg text-center cursor-pointer transition-all relative">
                <input
                  type="file"
                  accept=".pdf"
                  onChange={handleFileChange}
                  class="absolute inset-0 opacity-0 cursor-pointer w-full h-full"
                />
                <span class="text-xs text-charcoal-500">
                  {file ? `Selected: ${file.name}` : 'Drop PDF here or click to browse'}
                </span>
              </div>
              
              <button
                type="submit"
                disabled={!file || uploading}
                class="bg-sage-500 hover:bg-sage-600 text-white text-xs font-semibold py-2.5 rounded-lg shadow-paper transition-all flex items-center justify-center gap-1.5 disabled:opacity-50"
              >
                {uploading ? <Loader2 size={12} class="animate-spin" /> : null}
                <span>{uploading ? 'Parsing PDF text...' : 'Parse and Structure Resume'}</span>
              </button>
            </form>
          </div>

          {/* GitHub Repository scanner */}
          <div class="bg-cream-200 border border-cream-300 rounded-xl p-6 shadow-paper flex flex-col gap-4">
            <h3 class="font-serif font-bold text-charcoal-900 flex items-center gap-1.5 text-sm">
              <Github size={16} class="text-sage-500" />
              Scan GitHub Project
            </h3>
            
            <form onSubmit={handleProjectScanSubmit} class="flex flex-col gap-4">
              <div class="flex flex-col gap-1">
                <label class="text-[10px] font-semibold text-charcoal-900">GitHub Repository Link</label>
                <input
                  type="url"
                  required
                  value={githubLink}
                  onChange={(e) => setGithubLink(e.target.value)}
                  placeholder="https://github.com/user/project"
                  class="px-3 py-2 bg-white border border-cream-300 rounded-lg text-xs focus:outline-none focus:border-sage-500"
                />
              </div>

              <div class="flex flex-col gap-1">
                <label class="text-[10px] font-semibold text-charcoal-900">Project Role/Tech Highlights</label>
                <textarea
                  value={projectDesc}
                  onChange={(e) => setProjectDesc(e.target.value)}
                  placeholder="e.g. Built backend using Node/MongoDB and deployed to AWS..."
                  class="px-3 py-2 bg-white border border-cream-300 rounded-lg text-xs focus:outline-none focus:border-sage-500 h-16 resize-none"
                />
              </div>

              <button
                type="submit"
                disabled={!githubLink || scanningProject}
                class="bg-sage-500 hover:bg-sage-600 text-white text-xs font-semibold py-2.5 rounded-lg shadow-paper transition-all flex items-center justify-center gap-1.5 disabled:opacity-50"
              >
                {scanningProject ? <Loader2 size={12} class="animate-spin" /> : null}
                <span>{scanningProject ? 'Analyzing code...' : 'Generate STAR Answers'}</span>
              </button>
            </form>
          </div>

        </div>

        {/* Right Side: Parsed Profile details & advice list */}
        <div class="lg:col-span-2 flex flex-col gap-6">
          {/* Parsed Structure display */}
          <div class="bg-cream-200 border border-cream-300 rounded-xl p-6 shadow-paper flex flex-col gap-6">
            <h3 class="font-serif font-bold text-charcoal-900 border-b border-cream-300 pb-2">
              Your Structured Profile Details
            </h3>

            {user?.resume?.skills?.length > 0 || user?.resume?.projects?.length > 0 ? (
              <div class="flex flex-col gap-6">
                
                {/* Skills */}
                {user.resume.skills && user.resume.skills.length > 0 && (
                  <div class="flex flex-col gap-2">
                    <span class="text-xs font-bold text-sage-500 uppercase">Parsed Skills Catalog</span>
                    <div class="flex flex-wrap gap-1.5">
                      {user.resume.skills.map((skill, sIdx) => (
                        <span 
                          key={sIdx} 
                          class="bg-white border border-cream-300 text-charcoal-900 text-[10px] px-2.5 py-1 rounded-full font-medium"
                        >
                          {skill}
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                {/* Projects with STAR points */}
                {user.resume.projects && user.resume.projects.length > 0 && (
                  <div class="flex flex-col gap-3">
                    <span class="text-xs font-bold text-sage-500 uppercase">Projects & Interview Talking Points</span>
                    <div class="flex flex-col gap-4">
                      {user.resume.projects.map((proj, pIdx) => (
                        <div key={pIdx} class="bg-white p-4 rounded-lg border border-cream-300 flex flex-col gap-2">
                          <h4 class="text-sm font-bold text-charcoal-900 font-serif">{proj.title}</h4>
                          <p class="text-xs text-charcoal-500 italic">{proj.description}</p>
                          
                          {proj.talkingPoints && proj.talkingPoints.length > 0 && (
                            <div class="mt-2 border-t border-cream-100 pt-2 flex flex-col gap-1.5">
                              <span class="text-[9px] font-bold text-terracotta-500 uppercase">STAR Interview Guide</span>
                              <div class="flex flex-col gap-1 pl-1">
                                {proj.talkingPoints.map((tp, tIdx) => (
                                  <p key={tIdx} class="text-[10px] text-charcoal-500 leading-relaxed">
                                    {tp}
                                  </p>
                                ))}
                              </div>
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
                
              </div>
            ) : (
              <div class="text-center py-12 text-xs text-charcoal-100 italic">
                No resume uploaded. Parse a PDF to populate skills and experience.
              </div>
            )}
          </div>

          {/* ATS Checklist Advice strip */}
          <div class="bg-cream-200 border border-cream-300 rounded-xl p-6 shadow-paper flex flex-col gap-4">
            <h3 class="font-serif font-bold text-charcoal-900">ATS Optimization Guide</h3>
            <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {checklist.map((item) => (
                <div key={item.id} class="bg-white p-4 rounded-lg border border-cream-300 flex gap-3">
                  {item.priority === 'high' ? (
                    <AlertCircle size={20} class="text-terracotta-500 shrink-0 mt-0.5" />
                  ) : (
                    <CheckCircle2 size={20} class="text-sage-500 shrink-0 mt-0.5" />
                  )}
                  <div class="flex flex-col gap-0.5">
                    <span class="text-xs font-semibold text-charcoal-900">{item.title}</span>
                    <span class="text-[10px] text-charcoal-500 leading-relaxed">{item.desc}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

      </div>
    </div>
  );
}
