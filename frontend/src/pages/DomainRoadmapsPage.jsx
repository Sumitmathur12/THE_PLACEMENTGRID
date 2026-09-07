import React, { useEffect, useState } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import {
  BookOpen,
  CheckSquare,
  Square,
  Play,
  HelpCircle,
  Loader2,
} from "lucide-react";
import SourceCitations from "../components/SourceCitations.jsx";
import ReactMarkdown from "react-markdown";

export default function DomainRoadmapsPage({
  user,
  token,
  updateUserCompletedTopics,
}) {
  const { companyId, role } = useParams();
  const navigate = useNavigate();

  const [companyName, setCompanyName] = useState("");
  const [selectedDomain, setSelectedDomain] = useState("");
  const [roadmap, setRoadmap] = useState(null);
  const [aiNotes, setAiNotes] = useState("");
  const [citations, setCitations] = useState([]);
  const [loading, setLoading] = useState(false);
  const [loadingCompany, setLoadingCompany] = useState(false);

  // Local state for guest checkmarks
  const [guestCompletions, setGuestCompletions] = useState([]);

  const fetchRoadmap = async (domain) => {
    setLoading(true);
    setRoadmap(null);
    setAiNotes("");
    setCitations([]);

    try {
      const res = await fetch(`/api/roadmaps/${encodeURIComponent(domain)}`);
      const data = await res.json();
      setRoadmap(data.roadmap);
      setAiNotes(data.aiNotes || "");
      setCitations(data.citations || []);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!companyId || !role) {
      navigate("/companies");
      return;
    }

    const loadCompanyAndRoadmap = async () => {
      setLoadingCompany(true);
      try {
        const compRes = await fetch(`/api/companies/${companyId}`);
        const compData = await compRes.json();
        if (compRes.ok && compData.name) {
          setCompanyName(compData.name);
          const domainName = `${compData.name} - ${role}`;
          setSelectedDomain(domainName);
          await fetchRoadmap(domainName);
        } else {
          console.error("Company details could not be resolved.");
          navigate("/companies");
        }
      } catch (err) {
        console.error(err);
        navigate("/companies");
      } finally {
        setLoadingCompany(false);
      }
    };

    loadCompanyAndRoadmap();
  }, [companyId, role]);

  const handleToggleTopic = async (topicId) => {
    if (!token) {
      // Zero-friction Guest state logic
      setGuestCompletions((prev) =>
        prev.includes(topicId)
          ? prev.filter((id) => id !== topicId)
          : [...prev, topicId],
      );
      return;
    }

    try {
      const res = await fetch("/api/roadmaps/toggle-progress", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ topicId }),
      });
      const data = await res.json();
      if (data.success) {
        updateUserCompletedTopics(data.completedRoadmapTopics);
      }
    } catch (e) {
      console.error(e);
    }
  };

  const isCompleted = (topicId) => {
    if (!token) {
      return guestCompletions.includes(topicId);
    }
    return user?.completedRoadmapTopics?.includes(topicId) || false;
  };

  return (
    <div className="fade-in max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 flex flex-col gap-6">
      {/* Page Breadcrumb and Header */}
      <div className="border-b border-cream-300 pb-4 flex flex-col gap-2">
        <Link
          to="/companies"
          className="text-xs text-sage-500 hover:underline flex items-center gap-1 font-serif"
        >
          ← Back to Companies Explorer
        </Link>
        <h1 className="text-2xl font-serif font-bold text-charcoal-900 flex items-center gap-2">
          <BookOpen className="text-sage-500" size={24} />
          {companyName
            ? `${companyName} – ${role} Prep Roadmap`
            : "Custom Prep Roadmap"}
        </h1>
        <p className="text-xs text-charcoal-500">
          Grounded week-by-week preparation syllabus generated for your target
          role. Check off topics as you finish them.
        </p>
      </div>

      {/* Main Roadmap Contents */}
      {loading ? (
        <div className="bg-cream-200 border border-cream-300 rounded-xl p-16 shadow-paper flex flex-col items-center justify-center gap-3">
          <Loader2 size={32} className="animate-spin text-sage-500 stroke-1" />
          <span className="text-xs text-charcoal-500 font-serif italic">
            Compiling week-by-week DSA & technical syllabus...
          </span>
        </div>
      ) : roadmap ? (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 items-start">
          {/* Weeks Tracker Checklist (2 columns) */}
          <div className="lg:col-span-2 flex flex-col gap-6">
            {roadmap.weeks.map((week) => (
              <div
                key={week.weekNumber}
                className="bg-cream-200 border border-cream-300 rounded-xl p-6 shadow-paper flex flex-col gap-4"
              >
                <h3 className="text-lg font-serif font-bold text-sage-700 border-b border-cream-300 pb-2">
                  Week {week.weekNumber}: Core Syllabus
                </h3>

                <div className="flex flex-col gap-5">
                  {week.topics.map((topic) => (
                    <div
                      key={topic.topicId}
                      className="flex gap-4 items-start bg-white p-4 rounded-lg border border-cream-300"
                    >
                      {/* Checkbox Trigger */}
                      <button
                        onClick={() => handleToggleTopic(topic.topicId)}
                        className="mt-0.5 hover:scale-105 transition-transform shrink-0"
                        aria-label="Toggle Topic"
                      >
                        {isCompleted(topic.topicId) ? (
                          <div className="w-5 h-5 rounded bg-sage-500 text-white flex items-center justify-center shadow-sm border border-sage-500">
                            <svg
                              xmlns="http://www.w3.org/2000/svg"
                              viewBox="0 0 24 24"
                              fill="none"
                              stroke="currentColor"
                              strokeWidth="3"
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              className="w-3.5 h-3.5"
                            >
                              <polyline points="20 6 9 17 4 12"></polyline>
                            </svg>
                          </div>
                        ) : (
                          <div className="w-5 h-5 rounded border border-cream-400 hover:border-sage-400 transition-colors bg-white flex items-center justify-center shadow-inner" />
                        )}
                      </button>

                      <div className="flex-1 flex flex-col gap-2">
                        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-1.5 sm:gap-4">
                          <h4
                            className={`text-sm font-semibold ${
                              isCompleted(topic.topicId)
                                ? "line-through text-charcoal-100"
                                : "text-charcoal-900"
                            }`}
                          >
                            {topic.title}
                          </h4>

                          {topic.whyItMatters && (
                            <span className="text-[9px] bg-terracotta-100 text-terracotta-700 px-2 py-0.5 rounded-full font-medium shrink-0">
                              Placement Metric
                            </span>
                          )}
                        </div>

                        <p className="text-xs text-charcoal-500 leading-relaxed">
                          {topic.description}
                        </p>

                        {topic.whyItMatters && (
                          <div className="text-[10px] text-charcoal-100 italic bg-cream-100 p-2.5 rounded border border-cream-200">
                            <strong>Why this matters:</strong>{" "}
                            {topic.whyItMatters}
                          </div>
                        )}

                        {/* Resource links */}
                        <div className="flex flex-wrap gap-2.5 mt-2 border-t border-cream-100 pt-2.5">
                          {topic.youtubeUrl && (
                            <a
                              href={topic.youtubeUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex items-center gap-1.5 text-[10px] text-red-600 hover:text-red-700 font-medium"
                            >
                              <Play size={10} className="fill-red-100" />
                              <span>YouTube Playlist</span>
                            </a>
                          )}
                          {topic.leetcodeUrl && (
                            <a
                              href={topic.leetcodeUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex items-center gap-1.5 text-[10px] text-amber-600 hover:text-amber-700 font-medium"
                            >
                              <span>LeetCode Tag</span>
                            </a>
                          )}
                          {topic.gfgUrl && (
                            <a
                              href={topic.gfgUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex items-center gap-1.5 text-[10px] text-green-600 hover:text-green-700 font-medium"
                            >
                              <span>GfG Prep</span>
                            </a>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}

            {/* Dedicated practice questions section */}
            {roadmap.practiceQuestions &&
              roadmap.practiceQuestions.length > 0 && (
                <div className="bg-cream-200 border border-cream-300 rounded-xl p-6 shadow-paper flex flex-col gap-4">
                  <h3 className="text-lg font-serif font-bold text-sage-700 border-b border-cream-300 pb-2 flex items-center gap-2">
                    <HelpCircle className="text-sage-500" size={20} />
                    Important Practice Questions
                  </h3>
                  <p className="text-xs text-charcoal-500 -mt-2">
                    Confirmed historical questions previously asked at this
                    company alongside key general practice recommendations
                    grouped by topic.
                  </p>

                  {/* Grouping by week / topic */}
                  {[1, 2, 3, 4].map((wkNum) => {
                    const wkQuestions = roadmap.practiceQuestions.filter(
                      (q) => q.weekNumber === wkNum,
                    );
                    if (wkQuestions.length === 0) return null;

                    return (
                      <div key={wkNum} className="flex flex-col gap-3 mt-2">
                        <h4 className="text-xs font-semibold text-charcoal-900 bg-cream-300 px-3 py-1.5 rounded uppercase tracking-wider font-serif">
                          Week {wkNum} Topics Practice
                        </h4>
                        <div className="flex flex-col gap-2">
                          {wkQuestions.map((q, idx) => (
                            <div
                              key={idx}
                              className="flex flex-wrap items-center justify-between bg-white px-4 py-3 rounded-lg border border-cream-300 hover:shadow-sm transition-all gap-3"
                            >
                              <div className="flex flex-wrap items-center gap-2 max-w-full">
                                <span className="text-[10px] text-charcoal-500 font-medium bg-cream-100 px-2 py-0.5 rounded border border-cream-200 shrink-0">
                                  {q.topicName || "General"}
                                </span>

                                <span className="text-xs font-semibold text-charcoal-900">
                                  {q.title}
                                </span>

                                {q.type === "previously-asked" ? (
                                  <span className="text-[9px] bg-terracotta-100 text-terracotta-700 px-2 py-0.5 rounded-full font-bold uppercase tracking-wide border border-terracotta-200 shrink-0">
                                    ★ Previously Asked
                                  </span>
                                ) : (
                                  <span className="text-[9px] bg-sage-100 text-sage-700 px-2 py-0.5 rounded-full font-bold uppercase tracking-wide border border-sage-200 shrink-0">
                                    Recommended
                                  </span>
                                )}
                              </div>

                              {q.url && (
                                <a
                                  href={q.url}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="text-xs text-sage-600 hover:text-sage-700 font-bold hover:underline shrink-0"
                                >
                                  Practice →
                                </a>
                              )}
                            </div>
                          ))}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}

            {/* Dedicated HR & Behavioral Round Prep section */}
            {roadmap.behavioralQuestions &&
              roadmap.behavioralQuestions.length > 0 && (
                <div className="bg-cream-200 border border-cream-300 rounded-xl p-6 shadow-paper flex flex-col gap-4">
                  <h3 className="text-lg font-serif font-bold text-sage-700 border-b border-cream-300 pb-2 flex items-center gap-2">
                    <HelpCircle className="text-sage-500" size={20} />
                    HR & Behavioral Round Prep
                  </h3>
                  <p className="text-xs text-charcoal-500 -mt-2">
                    Behavioral, situational, and culture-fit preparation
                    including general must-prepare topics and company-specific
                    values.
                  </p>
                  <div className="flex flex-col gap-3">
                    {roadmap.behavioralQuestions.map((q, idx) => (
                      <div
                        key={idx}
                        className="bg-white p-4 rounded-lg border border-cream-300 hover:shadow-sm transition-all flex flex-col gap-2"
                      >
                        <div className="flex items-start justify-between gap-4">
                          <span className="text-xs font-bold text-charcoal-900 leading-snug">
                            {q.question}
                          </span>
                          {q.type === "previously-asked" ? (
                            <span className="text-[9px] bg-terracotta-100 text-terracotta-700 px-2 py-0.5 rounded-full font-bold uppercase tracking-wide border border-terracotta-200 shrink-0">
                              ★ Previously Asked
                            </span>
                          ) : (
                            <span className="text-[9px] bg-sage-100 text-sage-700 px-2 py-0.5 rounded-full font-bold uppercase tracking-wide border border-sage-200 shrink-0">
                              General MUST-PREP
                            </span>
                          )}
                        </div>
                        {q.sampleAnswer && (
                          <p className="text-xs text-charcoal-700 bg-sage-50/50 p-2.5 rounded border border-sage-200 leading-relaxed mb-2">
                            <strong className="text-sage-800 font-semibold">
                              Sample Answer:{" "}
                            </strong>
                            {q.sampleAnswer}
                          </p>
                        )}
                        <p className="text-xs text-charcoal-600 bg-cream-100/50 p-2.5 rounded border border-cream-200 leading-relaxed">
                          <strong className="text-sage-700 font-semibold">
                            Tip:{" "}
                          </strong>
                          {q.tip}
                        </p>
                      </div>
                    ))}
                  </div>
                </div>
              )}
          </div>

          {/* Right side: RAG context highlights & citations */}
          <div className="lg:col-span-1 flex flex-col gap-6 bg-cream-200 border border-cream-300 rounded-xl p-6 shadow-paper">
            <div>
              <h3 className="font-serif font-bold text-charcoal-900 mb-1">
                Syllabus Grounding
              </h3>
              <p className="text-xs text-charcoal-500">
                These roadmaps are Useful for your preparation.
              </p>
            </div>

            {aiNotes && (
              <div className="text-xs text-charcoal-500 leading-relaxed font-sans border-t border-cream-300 pt-4">
                <h4 className="font-bold text-charcoal-900 mb-2">
                  Curriculum Notes:
                </h4>
                <div className="markdown-body text-charcoal-600 bg-cream-100/50 p-3 rounded-lg border border-cream-300">
                  <ReactMarkdown
                    components={{
                      h3: ({ node, ...props }) => (
                        <h3
                          className="text-sm font-serif font-bold text-sage-700 mt-3 mb-1"
                          {...props}
                        />
                      ),
                      h4: ({ node, ...props }) => (
                        <h4
                          className="text-xs font-semibold text-charcoal-900 mt-2 mb-1"
                          {...props}
                        />
                      ),
                      p: ({ node, ...props }) => (
                        <p
                          className="text-xs text-charcoal-600 mb-2 leading-relaxed"
                          {...props}
                        />
                      ),
                      ul: ({ node, ...props }) => (
                        <ul
                          className="list-disc pl-4 mb-2 flex flex-col gap-1"
                          {...props}
                        />
                      ),
                      li: ({ node, ...props }) => (
                        <li className="text-xs text-charcoal-600" {...props} />
                      ),
                      strong: ({ node, ...props }) => (
                        <strong
                          className="font-semibold text-charcoal-800"
                          {...props}
                        />
                      ),
                      a: ({ node, ...props }) => (
                        <a
                          className="text-sage-600 hover:underline font-medium"
                          target="_blank"
                          rel="noopener noreferrer"
                          {...props}
                        />
                      ),
                    }}
                  >
                    {aiNotes}
                  </ReactMarkdown>
                </div>
              </div>
            )}

            <SourceCitations citations={citations} />
          </div>
        </div>
      ) : (
        <div className="bg-cream-200 border border-cream-300 rounded-xl p-16 shadow-paper text-center">
          <p className="text-xs text-charcoal-500">
            Could not retrieve roadmap content.
          </p>
        </div>
      )}
    </div>
  );
}
