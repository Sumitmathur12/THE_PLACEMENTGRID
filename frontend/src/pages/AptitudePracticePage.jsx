import React, { useEffect, useState } from "react";
import {
  Target,
  Award,
  Calendar,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Play,
  HelpCircle,
  Loader2,
  ArrowRight,
  Code,
  Bookmark,
  Trash2,
} from "lucide-react";
import Editor from "@monaco-editor/react";

export default function AptitudePracticePage({ user, token }) {
  const [activeTab, setActiveTab] = useState("practice"); // 'practice' | 'revise' | 'history'
  const [loading, setLoading] = useState(false);
  const [questions, setQuestions] = useState([]);
  const [notification, setNotification] = useState("");
  const [sourceInfo, setSourceInfo] = useState("");

  // Test states
  const [testStarted, setTestStarted] = useState(false);
  const [currentIdx, setCurrentIdx] = useState(0);
  const [selectedAnswers, setSelectedAnswers] = useState({}); // { qId: selectedIndex }

  // Coding states
  const [codeAnswers, setCodeAnswers] = useState({}); // { qId: codeText }
  const [compiling, setCompiling] = useState(false);
  const [compileResults, setCompileResults] = useState({}); // { qId: [testCaseResults] }
  const [codingPassed, setCodingPassed] = useState({}); // { qId: boolean }
  const [codingUnverified, setCodingUnverified] = useState({}); // { qId: boolean }

  const [timer, setTimer] = useState(0);
  const [timerInterval, setTimerInterval] = useState(null);

  // Results
  const [results, setResults] = useState(null);

  // Language & confirmation states
  const [selectedLanguage, setSelectedLanguage] = useState("javascript");
  const [selectedCategory, setSelectedCategory] = useState(null);
  const [showStartModal, setShowStartModal] = useState(false);

  const languageIds = {
    javascript: 63,
    python: 71,
    java: 62,
    cpp: 54,
  };

  // Revise queue states
  const [reviseQueue, setReviseQueue] = useState([]);
  const [loadingQueue, setLoadingQueue] = useState(false);

  // History states
  const [history, setHistory] = useState([]);

  // Bookmarking states
  const [bookmarkedIds, setBookmarkedIds] = useState([]);
  const [bookmarksList, setBookmarksList] = useState([]);
  const [loadingBookmarks, setLoadingBookmarks] = useState(false);

  // Fetch SM-2 Queue
  const fetchReviseQueue = async () => {
    setLoadingQueue(true);
    try {
      const res = await fetch("/api/questions/revise-queue", {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      setReviseQueue(data);
    } catch (e) {
      console.error(e);
    } finally {
      setLoadingQueue(false);
    }
  };

  // Fetch History
  const fetchHistory = async () => {
    try {
      const res = await fetch("/api/questions/history", {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      setHistory(data);
    } catch (e) {
      console.error(e);
    }
  };

  // Fetch Bookmarked Question IDs
  const fetchBookmarkedIds = async () => {
    if (!token) return;
    try {
      const res = await fetch("/api/questions/bookmarks/ids", {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (Array.isArray(data)) {
        setBookmarkedIds(data);
      }
    } catch (e) {
      console.error("Failed to fetch bookmarked IDs:", e);
    }
  };

  // Fetch Full Bookmarks List
  const fetchBookmarksList = async () => {
    if (!token) return;
    setLoadingBookmarks(true);
    try {
      const res = await fetch("/api/questions/bookmarks", {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (Array.isArray(data)) {
        setBookmarksList(data);
      }
    } catch (e) {
      console.error("Failed to fetch bookmarks:", e);
    } finally {
      setLoadingBookmarks(false);
    }
  };

  // Toggle Bookmark
  const handleToggleBookmark = async (qId) => {
    if (!token) return;
    try {
      const res = await fetch("/api/questions/bookmarks/toggle", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ questionId: qId })
      });
      const data = await res.json();
      if (data.success) {
        if (data.bookmarked) {
          setBookmarkedIds(prev => [...prev, qId]);
        } else {
          setBookmarkedIds(prev => prev.filter(id => id !== qId));
          setBookmarksList(prev => prev.filter(b => b.questionId?._id !== qId));
        }
      }
    } catch (e) {
      console.error("Failed to toggle bookmark:", e);
    }
  };

  useEffect(() => {
    if (!token) return;
    fetchBookmarkedIds();
    if (activeTab === "revise") {
      fetchReviseQueue();
    } else if (activeTab === "history") {
      fetchHistory();
    } else if (activeTab === "bookmarked") {
      fetchBookmarksList();
    }
  }, [activeTab, token]);

  // Handle URL redirect query param
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get("tab") === "revise") {
      setActiveTab("revise");
    }
  }, []);

  const formatTime = (secs) => {
    const m = Math.floor(secs / 60)
      .toString()
      .padStart(2, "0");
    const s = (secs % 60).toString().padStart(2, "0");
    return `${m}:${s}`;
  };

  const startPracticeTest = async (categoryName) => {
    setLoading(true);
    setTestStarted(false);
    setResults(null);
    setNotification("");
    setCurrentIdx(0);
    setSelectedAnswers({});
    setCodeAnswers({});
    setCompileResults({});
    setCodingPassed({});

    try {
      const headers = token ? { Authorization: `Bearer ${token}` } : {};
      const url = categoryName
        ? `/api/questions/practice?category=${categoryName}&limit=15`
        : "/api/questions/practice?limit=15";

      const res = await fetch(url, { headers });
      const data = await res.json();

      if (data.questions && data.questions.length > 0) {
        setQuestions(data.questions);

        // Initialize starter code for coding questions across all supported languages
        const initialCodes = {};
        data.questions.forEach((q) => {
          if (q.isCoding) {
            initialCodes[q._id] = {
              javascript:
                q.starterCodes?.javascript ||
                q.starterCode ||
                "function solution() {\n  // Code here\n}",
              python:
                q.starterCodes?.python ||
                "def solution():\n    # Code here\n    pass",
              java:
                q.starterCodes?.java ||
                "class Solution {\n    public void solution() {\n        // Code here\n    }\n}",
              cpp:
                q.starterCodes?.cpp ||
                "#include <iostream>\nusing namespace std;\n\nclass Solution {\npublic:\n    void solution() {\n        // Code here\n    }\n};",
            };
          }
        });
        setCodeAnswers(initialCodes);

        if (data.notification) {
          setNotification(data.notification);
        }
        if (data.sourceInfo) {
          setSourceInfo(data.sourceInfo);
        } else {
          setSourceInfo("");
        }

        // Start timer
        setTimer(0);
        const interval = setInterval(() => {
          setTimer((prev) => prev + 1);
        }, 1000);
        setTimerInterval(interval);
        setTestStarted(true);
      } else {
        alert("No questions found in this category.");
      }
    } catch (e) {
      console.error(e);
      alert("Failed to load test questions.");
    } finally {
      setLoading(false);
    }
  };

  // Compile candidate code via Judge0 CE (or local sandbox fallback)
  const handleCompileAndRun = async (qId) => {
    setCompiling(true);
    try {
      const res = await fetch("/api/questions/compile", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          code: codeAnswers[qId]?.[selectedLanguage] || "",
          languageId: languageIds[selectedLanguage] || 63,
          questionId: qId,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Compilation request failed");

      if (data.success) {
        setCompileResults((prev) => ({ ...prev, [qId]: data.results }));
        const allPassed = data.results.every((tc) => tc.passed);
        setCodingPassed((prev) => ({ ...prev, [qId]: allPassed }));
        setCodingUnverified((prev) => ({ ...prev, [qId]: !!data.unverified }));
      } else {
        alert(`Compilation Error: ${data.error}`);
        setCompileResults((prev) => ({
          ...prev,
          [qId]: [
            {
              input: "N/A",
              expected: "N/A",
              actual: data.error,
              passed: false,
            },
          ],
        }));
        setCodingPassed((prev) => ({ ...prev, [qId]: false }));
      }
    } catch (err) {
      alert(err.message);
    } finally {
      setCompiling(false);
    }
  };

  const submitTest = async () => {
    if (timerInterval) {
      clearInterval(timerInterval);
      setTimerInterval(null);
    }

    // Build standard payload compatible with backend schemas
    const answersPayload = questions.map((q) => {
      if (q.isCoding) {
        return {
          questionId: q._id,
          passedAllCoding: codingPassed[q._id] || false,
          category: q.category,
        };
      }
      return {
        questionId: q._id,
        selectedIndex:
          selectedAnswers[q._id] !== undefined ? selectedAnswers[q._id] : -1,
        category: q.category,
      };
    });

    if (!token) {
      // Guest local evaluation
      let correct = 0;
      questions.forEach((q) => {
        if (q.isCoding) {
          if (codingPassed[q._id]) correct++;
        } else {
          if (selectedAnswers[q._id] === q.correctIndex) correct++;
        }
      });
      setResults({
        correct,
        total: questions.length,
        timeTaken: timer,
        fallback: true,
      });
      setTestStarted(false);
      return;
    }

    try {
      const res = await fetch("/api/questions/submit", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          answers: answersPayload,
          timeTaken: timer,
          category: questions[0]?.category || "Comprehensive Mock",
        }),
      });
      const data = await res.json();
      if (res.ok) {
        setResults({
          correct: data.attempt.score.correct,
          total: data.attempt.score.total,
          timeTaken: data.attempt.timeTaken,
          feedback: data.attempt.feedback,
          recommendations: data.attempt.recommendations,
        });
      } else {
        alert(data.error || "Failed to submit test.");
      }
    } catch (e) {
      console.error(e);
    } finally {
      setTestStarted(false);
    }
  };

  const handleReviseSubmit = async (srId, quality) => {
    try {
      const res = await fetch("/api/questions/revise-submit", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ srId, quality }),
      });
      if (res.ok) {
        alert(
          "Response quality submitted. Spaced repetition scheduler updated successfully.",
        );
        fetchReviseQueue();
      }
    } catch (e) {
      console.error(e);
    }
  };

  const answeredCount = questions.filter((q) =>
    q.isCoding
      ? codingPassed[q._id] !== undefined
      : selectedAnswers[q._id] !== undefined,
  ).length;
  const allAnswered = answeredCount === questions.length;
  const unansweredIdxs = questions
    .map((q, idx) => {
      const isAns = q.isCoding
        ? codingPassed[q._id] !== undefined
        : selectedAnswers[q._id] !== undefined;
      return isAns ? null : idx + 1;
    })
    .filter((val) => val !== null);

  const currentQuestion = questions[currentIdx];

  return (
    <div class="fade-in max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 flex flex-col gap-8">
      {/* Page Header */}
      <div class="border-b border-cream-300 pb-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 class="text-3xl font-serif font-bold text-charcoal-900 flex items-center gap-2">
            <Target class="text-sage-500" />
            GRID Preparation Practice Center
          </h1>
          <p class="text-sm text-charcoal-500">
            Practice rotating questions, compile coding challenges, and clear
            daily spaced-repetition revision queues.
          </p>
        </div>

        {/* Tab Switcher */}
        <div class="flex bg-cream-200 border border-cream-300 rounded-lg p-1.5 shrink-0 self-start sm:self-center">
          <button
            onClick={() => setActiveTab("practice")}
            class={`px-3 py-1.5 rounded-md text-xs font-semibold transition-all ${
              activeTab === "practice"
                ? "bg-sage-500 text-white shadow-paper"
                : "text-charcoal-900 hover:text-sage-600"
            }`}
          >
            Timed Test
          </button>
          {token && (
            <>
              <button
                onClick={() => setActiveTab("revise")}
                class={`px-3 py-1.5 rounded-md text-xs font-semibold transition-all ${
                  activeTab === "revise"
                    ? "bg-sage-500 text-white shadow-paper"
                    : "text-charcoal-900 hover:text-sage-600"
                }`}
              >
                Revise Today
              </button>
              <button
                onClick={() => setActiveTab("history")}
                class={`px-3 py-1.5 rounded-md text-xs font-semibold transition-all ${
                  activeTab === "history"
                    ? "bg-sage-500 text-white shadow-paper"
                    : "text-charcoal-900 hover:text-sage-600"
                }`}
              >
                Score History
              </button>
              <button
                onClick={() => setActiveTab("bookmarked")}
                class={`px-3 py-1.5 rounded-md text-xs font-semibold transition-all ${
                  activeTab === "bookmarked"
                    ? "bg-sage-500 text-white shadow-paper"
                    : "text-charcoal-900 hover:text-sage-600"
                }`}
              >
                Bookmarked
              </button>
            </>
          )}
        </div>
      </div>

      {/* 1. Practice Tab */}
      {activeTab === "practice" && (
        <div class="flex flex-col gap-6">
          {!testStarted && !results && !showStartModal && (
            <div class="bg-cream-200 border border-cream-300 rounded-xl p-8 shadow-paper max-w-2xl mx-auto w-full text-center flex flex-col gap-6 animate-scale-up">
              <h3 class="text-xl font-serif font-bold text-charcoal-900">
                Select Practice Subject
              </h3>
              <p class="text-xs text-charcoal-500">
                Each session pulls a non-repeating rotating set of 15 questions.
                We track your weak categories to adjust difficulty.
              </p>

              <div class="grid grid-cols-2 gap-4">
                <button
                  onClick={() => {
                    setSelectedCategory("quant");
                    setShowStartModal(true);
                  }}
                  class="bg-white border border-cream-300 hover:bg-cream-300 p-4 rounded-lg text-xs font-bold text-charcoal-900 flex flex-col gap-1.5 items-center transition-all"
                >
                  <span class="text-xl">🧮</span>
                  <span>Quantitative Aptitude</span>
                </button>
                <button
                  onClick={() => {
                    setSelectedCategory("logical");
                    setShowStartModal(true);
                  }}
                  class="bg-white border border-cream-300 hover:bg-cream-300 p-4 rounded-lg text-xs font-bold text-charcoal-900 flex flex-col gap-1.5 items-center transition-all"
                >
                  <span class="text-xl">🧩</span>
                  <span>Logical Reasoning</span>
                </button>
                <button
                  onClick={() => {
                    setSelectedCategory("verbal");
                    setShowStartModal(true);
                  }}
                  class="bg-white border border-cream-300 hover:bg-cream-300 p-4 rounded-lg text-xs font-bold text-charcoal-900 flex flex-col gap-1.5 items-center transition-all"
                >
                  <span class="text-xl font-serif">A</span>
                  <span>Verbal Ability</span>
                </button>
                <button
                  onClick={() => {
                    setSelectedCategory("coreCS");
                    setShowStartModal(true);
                  }}
                  class="bg-white border border-cream-300 hover:bg-cream-300 p-4 rounded-lg text-xs font-bold text-charcoal-900 flex flex-col gap-1.5 items-center transition-all"
                >
                  <span class="text-xl">💻</span>
                  <span>Core CS & Coding</span>
                </button>
              </div>

              <div class="relative py-2">
                <div class="absolute inset-x-0 h-[1px] bg-cream-300"></div>
              </div>

              <button
                onClick={() => {
                  setSelectedCategory("");
                  setShowStartModal(true);
                }}
                class="bg-sage-500 hover:bg-sage-600 text-white font-semibold py-3 rounded-lg shadow-paper transition-all text-xs"
              >
                Start Comprehensive Timed Mock Test
              </button>
            </div>
          )}

          {showStartModal && !testStarted && !results && (
            <div className="bg-cream-200 border border-cream-300 rounded-xl p-8 shadow-paper max-w-xl mx-auto w-full text-left flex flex-col gap-6 animate-scale-up">
              <div className="border-b border-cream-300 pb-3">
                <h3 className="text-xl font-serif font-bold text-charcoal-900 capitalize">
                  Confirm{" "}
                  {selectedCategory === "quant"
                    ? "Quantitative Aptitude"
                    : selectedCategory === "logical"
                      ? "Logical Reasoning"
                      : selectedCategory === "verbal"
                        ? "Verbal Ability"
                        : selectedCategory === "coreCS"
                          ? "Core CS & Coding"
                          : "Comprehensive Mock"}{" "}
                  Practice Session
                </h3>
              </div>
              <div className="text-xs text-charcoal-700 flex flex-col gap-3">
                <div className="grid grid-cols-2 gap-4 bg-white p-4 rounded-lg border border-cream-300">
                  <div>
                    <span className="block font-bold text-charcoal-400 uppercase tracking-wider text-[9px]">
                      Total Questions
                    </span>
                    <span className="text-sm font-bold text-charcoal-900">
                      15 Questions
                    </span>
                  </div>
                  <div>
                    <span className="block font-bold text-charcoal-400 uppercase tracking-wider text-[9px]">
                      Estimated Duration
                    </span>
                    <span className="text-sm font-bold text-charcoal-900">
                      15 - 18 minutes
                    </span>
                  </div>
                </div>

              </div>

              <div className="flex justify-end gap-3 border-t border-cream-300 pt-4">
                <button
                  onClick={() => {
                    setShowStartModal(false);
                    setSelectedCategory(null);
                  }}
                  className="px-4 py-2 border border-cream-300 hover:bg-cream-300 text-xs font-bold rounded-lg transition-all text-charcoal-700"
                >
                  Cancel
                </button>
                <button
                  onClick={() => {
                    setShowStartModal(false);
                    startPracticeTest(selectedCategory);
                  }}
                  className="bg-sage-500 hover:bg-sage-600 text-white text-xs font-bold px-5 py-2.5 rounded-lg shadow-paper transition-all"
                >
                  Start Test
                </button>
              </div>
            </div>
          )}

          {loading && (
            <div class="bg-cream-200 border border-cream-300 rounded-xl p-16 shadow-paper text-center flex flex-col items-center justify-center gap-3">
              <Loader2 size={32} class="animate-spin text-sage-500" />
              <span class="text-xs text-charcoal-500 font-serif italic">
                Loading rotating problem sets...
              </span>
            </div>
          )}

          {/* Timed Test viewport */}
          {testStarted && questions.length > 0 && currentQuestion && (
            <div class="bg-cream-200 border border-cream-300 rounded-xl p-6 shadow-paper max-w-4xl mx-auto w-full flex flex-col gap-6">
              {/* Header */}
              <div className="flex justify-between items-center border-b border-cream-300 pb-3">
                <span className="text-xs text-charcoal-500 font-semibold">
                  Question {currentIdx + 1} of {questions.length} (
                  {currentQuestion.isCoding
                    ? "Coding Challenge"
                    : "Multiple Choice"}
                  )
                </span>
                <div className="flex items-center gap-3">
                  <div className="text-xs font-bold text-terracotta-500 bg-white border border-cream-300 px-3 py-1 rounded-lg">
                    Timer: {formatTime(timer)}
                  </div>
                  <button
                    onClick={() => {
                      if (window.confirm("Are you sure? Your progress in this session will be lost.")) {
                        setTestStarted(false);
                        setQuestions([]);
                        setCurrentIdx(0);
                        setSelectedAnswers({});
                        setCodeAnswers({});
                        setCompileResults({});
                        setCodingPassed({});
                        setCodingUnverified({});
                        if (timerInterval) {
                          clearInterval(timerInterval);
                          setTimerInterval(null);
                        }
                      }
                    }}
                    className="text-[10px] font-bold uppercase px-2.5 py-1 rounded bg-terracotta-100 hover:bg-terracotta-200 text-terracotta-700 transition-all border border-terracotta-200"
                  >
                    Exit Test
                  </button>
                </div>
              </div>

              {/* Question card */}
              <div className="bg-white p-6 rounded-lg border border-cream-300 text-sm font-semibold text-charcoal-900 flex justify-between items-start gap-4">
                <span className="flex-1">{currentQuestion.text}</span>
                <button
                  onClick={() => handleToggleBookmark(currentQuestion._id)}
                  className="shrink-0 p-1 hover:bg-cream-100 rounded transition-all focus:outline-none"
                  title={bookmarkedIds.includes(currentQuestion._id) ? "Remove Bookmark" : "Bookmark Question"}
                >
                  <Bookmark
                    size={18}
                    className={
                      bookmarkedIds.includes(currentQuestion._id)
                        ? "text-terracotta-500 fill-terracotta-500"
                        : "text-charcoal-400 hover:text-charcoal-600"
                    }
                  />
                </button>
              </div>

              {/* Display code editor if it is a coding question */}
              {currentQuestion.isCoding ? (
                <div class="flex flex-col gap-4 w-full max-w-full">
                  <div className="flex flex-col border border-cream-300 rounded-lg overflow-hidden h-[280px] sm:h-[360px] min-h-[240px] bg-white shadow-paper w-full">
                    <div className="flex justify-between items-center bg-cream-200 border-b border-cream-300 px-4 py-2 text-xs font-semibold text-charcoal-700 shrink-0">
                      <span>Select Language:</span>
                      <select
                        value={selectedLanguage}
                        onChange={(e) => setSelectedLanguage(e.target.value)}
                        className="bg-white border border-cream-300 px-3 py-1 rounded shadow-sm text-xs font-bold text-charcoal-900 focus:outline-none focus:border-sage-500"
                      >
                        <option value="javascript">JavaScript (Node.js)</option>
                        <option value="python">Python 3</option>
                        <option value="java">Java (JDK 17)</option>
                        <option value="cpp">C++ (GCC 11)</option>
                      </select>
                    </div>
                    <div className="flex-1 min-h-0">
                      <Editor
                        height="100%"
                        language={
                          selectedLanguage === "cpp"
                            ? "cpp"
                            : selectedLanguage === "java"
                              ? "java"
                              : selectedLanguage === "python"
                                ? "python"
                                : "javascript"
                        }
                        theme="vs-light"
                        value={
                          codeAnswers[currentQuestion._id]?.[
                            selectedLanguage
                          ] || ""
                        }
                        onChange={(val) =>
                          setCodeAnswers((prev) => ({
                            ...prev,
                            [currentQuestion._id]: {
                              ...prev[currentQuestion._id],
                              [selectedLanguage]: val,
                            },
                          }))
                        }
                        options={{
                          fontSize: 12,
                          minimap: { enabled: false },
                          scrollBeyondLastLine: false,
                          automaticLayout: true,
                        }}
                      />
                    </div>
                  </div>

                  <div class="flex items-center justify-between gap-4">
                    <button
                      onClick={() => handleCompileAndRun(currentQuestion._id)}
                      disabled={compiling}
                      class="bg-sage-500 hover:bg-sage-600 text-white font-semibold text-xs px-4 py-2 rounded-lg shadow-paper transition-all flex items-center gap-1.5 disabled:opacity-50"
                    >
                      {compiling ? (
                        <Loader2 size={12} class="animate-spin" />
                      ) : (
                        <Code size={13} />
                      )}
                      <span>{compiling ? "Compiling..." : "Run & Test"}</span>
                    </button>

                    <span
                      className={`text-[10px] px-2.5 py-0.5 rounded-full font-bold ${
                        codingUnverified[currentQuestion._id]
                          ? "bg-amber-100 text-amber-700 border border-amber-300"
                          : codingPassed[currentQuestion._id]
                            ? "bg-sage-100 text-sage-700"
                            : "bg-terracotta-100 text-terracotta-700"
                      }`}
                    >
                      {codingUnverified[currentQuestion._id]
                        ? "⚠️ Unverified — compiler unavailable, syntax-only check"
                        : codingPassed[currentQuestion._id]
                          ? "Passed All Cases"
                          : "Cases Incomplete"}
                    </span>
                  </div>

                  {/* Render testcase comparison results */}
                  {compileResults[currentQuestion._id] && (
                    <div class="bg-white border border-cream-300 p-4 rounded-lg flex flex-col gap-2">
                      <h4 class="text-xs font-bold text-charcoal-900 border-b border-cream-300 pb-1.5">
                        Compiler Testcase Analysis
                      </h4>
                      <div class="flex flex-col gap-2 max-h-[150px] overflow-y-auto pr-1">
                        {compileResults[currentQuestion._id].map((tc, idx) => (
                          <div
                            key={idx}
                            class="text-[10px] flex items-start justify-between border-b border-dashed border-cream-300 pb-1.5 last:border-0 last:pb-0"
                          >
                            <div>
                              <div>
                                Input:{" "}
                                <code class="font-bold text-charcoal-900">
                                  {tc.input}
                                </code>
                              </div>
                              <div>
                                Expected:{" "}
                                <code class="text-sage-600 font-bold">
                                  {tc.expected}
                                </code>
                              </div>
                              <div>
                                Actual:{" "}
                                <code
                                  class={`font-bold ${tc.passed ? "text-sage-600" : "text-terracotta-600"}`}
                                >
                                  {tc.actual}
                                </code>
                              </div>
                            </div>
                            <span
                              class={`px-2 py-0.5 rounded text-[9px] font-bold ${
                                tc.passed
                                  ? "bg-sage-100 text-sage-700"
                                  : "bg-terracotta-100 text-terracotta-700"
                              }`}
                            >
                              {tc.passed ? "PASS" : "FAIL"}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                /* MCQs Options */
                <div class="flex flex-col gap-3">
                  {(currentQuestion.options || []).map((opt, oIdx) => (
                    <button
                      key={oIdx}
                      onClick={() =>
                        setSelectedAnswers((prev) => ({
                          ...prev,
                          [currentQuestion._id]: oIdx,
                        }))
                      }
                      class={`text-left px-4 py-3 rounded-lg border text-xs font-medium transition-all ${
                        selectedAnswers[currentQuestion._id] === oIdx
                          ? "bg-sage-500 text-white border-sage-500 shadow-paper"
                          : "bg-white border-cream-300 hover:bg-cream-300 text-charcoal-900"
                      }`}
                    >
                      <span class="font-serif font-bold mr-2">
                        {String.fromCharCode(65 + oIdx)}.
                      </span>
                      {opt}
                    </button>
                  ))}
                </div>
              )}

              {/* Navigation Footer */}
              <div class="flex justify-between items-center mt-4">
                <button
                  disabled={currentIdx === 0}
                  onClick={() => setCurrentIdx((prev) => prev - 1)}
                  class="px-4 py-2 border border-cream-300 hover:bg-cream-300 text-xs rounded-lg transition-all disabled:opacity-50 font-semibold"
                >
                  Previous
                </button>

                {currentIdx < questions.length - 1 ? (
                  <button
                    disabled={
                      currentQuestion.isCoding
                        ? codingPassed[currentQuestion._id] === undefined
                        : selectedAnswers[currentQuestion._id] === undefined
                    }
                    onClick={() => setCurrentIdx((prev) => prev + 1)}
                    class="bg-sage-500 hover:bg-sage-600 text-white text-xs font-semibold px-4 py-2 rounded-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    Next Question
                  </button>
                ) : (
                  <div className="flex flex-col items-end gap-1.5">
                    <span className="text-[10px] text-charcoal-500 font-bold">
                      {answeredCount} / {questions.length} answered
                    </span>
                    <button
                      onClick={() => {
                        if (!allAnswered) {
                          alert(
                            `Please answer all questions before submitting. Unanswered questions: ${unansweredIdxs.join(", ")}`,
                          );
                          return;
                        }
                        submitTest();
                      }}
                      class={`text-white text-xs font-semibold px-5 py-2.5 rounded-lg shadow-paper transition-all ${
                        allAnswered
                          ? "bg-terracotta-500 hover:bg-terracotta-600 cursor-pointer"
                          : "bg-charcoal-300 cursor-not-allowed opacity-60"
                      }`}
                    >
                      Submit Practice Test
                    </button>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Detailed Performance Feedback Report */}
          {results && (
            <div class="bg-cream-200 border border-cream-300 rounded-xl p-8 shadow-paper max-w-2xl mx-auto w-full flex flex-col gap-6 animate-scale-up text-left">
              <div className="text-center flex flex-col gap-2">
                <Award size={48} class="text-sage-500 mx-auto stroke-1" />
                <h3 class="text-2xl font-serif font-bold text-charcoal-900">
                  Practice Performance Report
                </h3>
                <p class="text-xs text-charcoal-500 font-medium">
                  Detailed breakdown of your session metrics and cognitive
                  focus.
                </p>
                {sourceInfo && (
                  <div className="inline-block bg-sage-100 border border-sage-200 text-sage-800 text-[10px] px-3 py-1 rounded-full font-bold uppercase mx-auto mt-1 tracking-wider">
                    Source: {sourceInfo}
                  </div>
                )}
              </div>

              {/* Score card grid */}
              <div class="bg-white p-6 rounded-lg border border-cream-300 grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="flex flex-col items-center justify-center border-b md:border-b-0 md:border-r border-cream-200 last:border-0 pb-4 md:pb-0">
                  <div class="text-[10px] text-charcoal-400 font-semibold uppercase tracking-wider">
                    Overall Score
                  </div>
                  <div class="text-3xl font-serif font-bold text-sage-600 mt-1">
                    {results.correct} / {results.total}
                  </div>
                  <div class="text-[10px] text-charcoal-500 font-bold mt-1">
                    ({Math.round((results.correct / results.total) * 100)}%)
                  </div>
                </div>

                <div className="flex flex-col items-center justify-center border-b md:border-b-0 md:border-r border-cream-200 last:border-0 pb-4 md:pb-0">
                  <div class="text-[10px] text-charcoal-400 font-semibold uppercase tracking-wider">
                    Time Taken
                  </div>
                  <div class="text-2xl font-serif font-bold text-sage-600 mt-1">
                    {formatTime(results.timeTaken)}
                  </div>
                  <div class="text-[9px] text-charcoal-500 font-bold mt-1 text-center">
                    Benchmark: 15-18 mins
                  </div>
                </div>

                <div className="flex flex-col items-center justify-center">
                  <div class="text-[10px] text-charcoal-400 font-semibold uppercase tracking-wider">
                    Speed Evaluation
                  </div>
                  {results.timeTaken < 90 ? (
                    <div className="flex flex-col items-center gap-1 mt-1">
                      <span class="text-[10px] bg-terracotta-100 text-terracotta-700 px-2 py-0.5 rounded-full font-bold border border-terracotta-200">
                        ⚠ SUSPICIOUSLY FAST
                      </span>
                      <span className="text-[9px] text-charcoal-500 text-center leading-snug">
                        Took under 1.5 mins. Please take time to read questions.
                      </span>
                    </div>
                  ) : (
                    <div className="flex flex-col items-center gap-1 mt-1">
                      <span class="text-[10px] bg-sage-100 text-sage-700 px-2 py-0.5 rounded-full font-bold border border-sage-200">
                        ✓ NORMAL PACE
                      </span>
                      <span className="text-[9px] text-charcoal-500">
                        Paced correctly for mock.
                      </span>
                    </div>
                  )}
                </div>
              </div>

              {/* Correct vs Incorrect breakdown by topic */}
              <div class="bg-white p-5 rounded-lg border border-cream-300 flex flex-col gap-4">
                <h4 class="text-xs font-bold text-charcoal-900 border-b border-cream-300 pb-2 uppercase tracking-wider font-serif">
                  Category & Topic Breakdown
                </h4>
                <div class="flex flex-col gap-4">
                  {Object.entries(
                    questions.reduce((acc, q) => {
                      const isCorrect = q.isCoding
                        ? codingPassed[q._id]
                        : selectedAnswers[q._id] === q.correctIndex;
                      if (!acc[q.category]) {
                        acc[q.category] = { correct: 0, total: 0 };
                      }
                      acc[q.category].total++;
                      if (isCorrect) acc[q.category].correct++;
                      return acc;
                    }, {}),
                  ).map(([catName, stats]) => {
                    const pct = Math.round((stats.correct / stats.total) * 100);
                    const isStrong = pct >= 70;
                    return (
                      <div
                        key={catName}
                        className="flex flex-col gap-1.5 text-xs"
                      >
                        <div className="flex justify-between font-semibold text-charcoal-900 capitalize">
                          <span>
                            {catName === "quant"
                              ? "Quantitative Aptitude"
                              : catName === "logical"
                                ? "Logical Reasoning"
                                : catName === "verbal"
                                  ? "Verbal Ability"
                                  : "Core CS & Coding"}
                          </span>
                          <span>
                            {stats.correct}/{stats.total} ({pct}%)
                          </span>
                        </div>
                        <div className="flex items-center gap-3">
                          <div className="flex-1 h-2 bg-cream-300 rounded-full overflow-hidden">
                            <div
                              className={`h-full rounded-full ${isStrong ? "bg-sage-500" : "bg-terracotta-500"}`}
                              style={{ width: `${pct}%` }}
                            ></div>
                          </div>
                          <span
                            className={`text-[9px] font-bold uppercase px-2 py-0.5 rounded border shrink-0 ${
                              isStrong
                                ? "bg-sage-100 text-sage-700 border-sage-200"
                                : "bg-terracotta-100 text-terracotta-700 border-terracotta-200"
                            }`}
                          >
                            {isStrong ? "Strong" : "Needs Work"}
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Actionable recommendations */}
              <div class="bg-sage-50 border border-sage-200 p-5 rounded-lg flex flex-col gap-2">
                <h4 class="text-xs font-bold text-sage-800 flex items-center gap-1.5 font-serif">
                  <CheckCircle2 size={14} />
                  Actionable Recommendations
                </h4>
                <div className="flex flex-col gap-3">
                  {results.feedback && (
                    <div className="text-xs text-sage-800 border-b border-sage-200 pb-2">
                      <span className="font-bold block mb-1">
                        AI Misconception Analysis:
                      </span>
                      <p className="italic leading-relaxed">
                        {results.feedback}
                      </p>
                    </div>
                  )}
                  <div className="text-xs text-sage-800">
                    <span className="font-bold block mb-1">
                      Tailored Actionable Steps:
                    </span>
                    {results.recommendations ? (
                      <p className="whitespace-pre-line leading-relaxed">
                        {results.recommendations}
                      </p>
                    ) : (
                      <p>
                        Focus on the weak categories identified in your
                        breakdown and complete timed sets daily.
                      </p>
                    )}
                  </div>
                </div>
              </div>

              {/* Detailed per-question review list */}
              <div className="bg-white p-5 rounded-lg border border-cream-300 flex flex-col gap-4">
                <h4 className="text-xs font-bold text-charcoal-900 border-b border-cream-300 pb-2 uppercase tracking-wider font-serif">
                  Detailed Question Review
                </h4>
                <div className="flex flex-col gap-4 divide-y divide-cream-200">
                  {questions.map((q, idx) => {
                    const isCorrect = q.isCoding
                      ? codingPassed[q._id]
                      : selectedAnswers[q._id] === q.correctIndex;
                    const selectedAnsIdx = selectedAnswers[q._id];
                    const selectedText = q.isCoding
                      ? (codingPassed[q._id] ? "Passed All Cases" : "Cases Incomplete")
                      : (selectedAnsIdx === undefined ? "Unanswered / Skipped" : q.options[selectedAnsIdx]);
                    const correctText = q.isCoding
                      ? "Passed All Cases"
                      : q.options[q.correctIndex];

                    return (
                      <div key={q._id} className="pt-4 first:pt-0 flex flex-col gap-2 text-xs">
                        <div className="flex justify-between items-start gap-3">
                          <span className="font-semibold text-charcoal-900 flex-1">
                            {idx + 1}. {q.text}
                          </span>
                          <span
                            className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase shrink-0 ${
                              isCorrect
                                ? "bg-sage-100 text-sage-700"
                                : "bg-terracotta-100 text-terracotta-700"
                            }`}
                          >
                            {isCorrect ? "✅ Correct" : "❌ Incorrect"}
                          </span>
                        </div>

                        {/* Options preview (if MCQ) */}
                        {!q.isCoding && q.options && (
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 my-1 pl-4">
                            {q.options.map((opt, oIdx) => {
                              const isSelected = selectedAnsIdx === oIdx;
                              const isCorrectOption = q.correctIndex === oIdx;
                              return (
                                <div
                                  key={oIdx}
                                  className={`p-2 rounded text-[11px] font-medium border ${
                                    isSelected
                                      ? isCorrectOption
                                        ? "bg-sage-50 border-sage-300 text-sage-900 font-bold"
                                        : "bg-terracotta-50 border-terracotta-300 text-terracotta-900"
                                      : isCorrectOption
                                        ? "bg-sage-50 border-sage-200 text-sage-800"
                                        : "bg-cream-100/30 border-cream-200 text-charcoal-700"
                                  }`}
                                >
                                  <span className="font-serif font-bold mr-1">{String.fromCharCode(65 + oIdx)}.</span>
                                  {opt}
                                </div>
                              );
                            })}
                          </div>
                        )}

                        <div className="pl-4 flex flex-col gap-1 text-[11px] text-charcoal-600 mt-1 border-l-2 border-cream-300">
                          <div>
                            <span className="font-semibold">Your Answer:</span>{" "}
                            <span className={isCorrect ? "text-sage-600 font-bold" : "text-terracotta-600 font-bold"}>
                              {selectedText}
                            </span>
                          </div>
                          {!isCorrect && (
                            <div>
                              <span className="font-semibold">Correct Answer:</span>{" "}
                              <span className="text-sage-600 font-bold">
                                {correctText}
                              </span>
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              <button
                onClick={() => setResults(null)}
                class="bg-sage-500 hover:bg-sage-600 text-white text-xs font-semibold py-3 rounded-lg shadow-paper transition-all text-center"
              >
                Back to Center Menu
              </button>
            </div>
          )}
        </div>
      )}

      {/* 2. Revise Today Tab */}
      {activeTab === "revise" && (
        <div class="flex flex-col gap-6">
          <div class="bg-cream-200 border border-cream-300 rounded-xl p-6 shadow-paper">
            <h3 class="text-lg font-serif font-bold text-charcoal-900">
              SM-2 Spaced Repetition Study Deck
            </h3>
            <p class="text-xs text-charcoal-500 mt-1 leading-relaxed">
              When you fail questions during practice, they are queued here.
              Answering correctly schedules them out based on cognitive memory
              retention, keeping study queues fresh.
            </p>
          </div>

          {loadingQueue ? (
            <div class="text-center py-12 text-xs text-charcoal-500 italic">
              Assembling your flashcards...
            </div>
          ) : reviseQueue.length > 0 ? (
            <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
              {reviseQueue.map((item) => {
                const q = item.questionId;
                if (!q) return null;
                return (
                  <div
                    key={item._id}
                    class="bg-cream-200 border border-cream-300 rounded-xl p-5 shadow-paper flex flex-col gap-4 justify-between"
                  >
                    <div class="flex flex-col gap-3">
                      <div class="flex justify-between items-center border-b border-cream-300 pb-2">
                        <span class="text-[9px] bg-sage-100 text-sage-700 px-2 py-0.5 rounded-full capitalize font-bold">
                          {q.category}
                        </span>
                        <span class="text-[9px] text-charcoal-500">
                          Ease: {item.easeFactor.toFixed(2)}
                        </span>
                      </div>
                      <p class="text-xs text-charcoal-900 font-semibold leading-relaxed">
                        {q.text}
                      </p>
                    </div>

                    <div class="flex flex-col gap-3 border-t border-cream-300 pt-3">
                      <div class="text-[9px] text-charcoal-100 font-bold uppercase tracking-wider">
                        Rate your recall memory quality:
                      </div>
                      <div class="grid grid-cols-6 gap-1">
                        {[0, 1, 2, 3, 4, 5].map((val) => (
                          <button
                            key={val}
                            onClick={() => handleReviseSubmit(item._id, val)}
                            class="bg-white border border-cream-300 hover:bg-sage-500 hover:text-white p-2 rounded text-xs font-bold text-charcoal-950 transition-all"
                            title={`Quality score: ${val}`}
                          >
                            {val}
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div class="bg-cream-200 border border-cream-300 rounded-xl p-12 text-center shadow-paper max-w-md mx-auto w-full flex flex-col items-center gap-3">
              <CheckCircle2 size={36} class="text-sage-500 stroke-1" />
              <h4 class="font-serif font-bold text-charcoal-900">
                Review Queue Cleared
              </h4>
              <p class="text-xs text-charcoal-500">
                You have reviewed all due cards. Practice more questions to
                auto-populate spaced repetition items.
              </p>
            </div>
          )}
        </div>
      )}

      {/* 3. History Tab */}
      {activeTab === "history" && (
        <div class="bg-cream-200 border border-cream-300 rounded-xl p-6 shadow-paper flex flex-col gap-6">
          <h3 class="text-lg font-serif font-bold text-charcoal-900">
            Academic Score Logs
          </h3>

          <div class="overflow-x-auto">
            <table class="w-full text-left border-collapse">
              <thead>
                <tr class="border-b border-cream-300 text-[10px] text-charcoal-100 uppercase tracking-widest font-bold">
                  <th class="pb-3">Date</th>
                  <th class="pb-3">Category</th>
                  <th class="pb-3">Result Score</th>
                  <th class="pb-3">Duration</th>
                  <th class="pb-3">Quant Average</th>
                  <th class="pb-3">CS Average</th>
                </tr>
              </thead>
              <tbody class="text-xs text-charcoal-900 divide-y divide-cream-300">
                {history.map((h) => (
                  <tr key={h._id}>
                    <td class="py-3.5 font-medium">
                      {new Date(h.date).toLocaleDateString()}
                    </td>
                    <td class="py-3.5 font-semibold capitalize">
                      {h.category}
                    </td>
                    <td class="py-3.5 font-bold text-sage-500">
                      {h.score?.correct} / {h.score?.total}
                    </td>
                    <td class="py-3.5">{formatTime(h.timeTaken)}</td>
                    <td class="py-3.5">{h.categoryBreakdown?.quant || 0}%</td>
                    <td class="py-3.5">{h.categoryBreakdown?.coreCS || 0}%</td>
                  </tr>
                ))}
                {history.length === 0 && (
                  <tr>
                    <td
                      colSpan="6"
                      class="py-8 text-center text-xs text-charcoal-100 italic"
                    >
                      No score attempts recorded yet.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* 4. Bookmarked Tab */}
      {activeTab === "bookmarked" && (
        <div className="flex flex-col gap-6">
          <div className="bg-cream-200 border border-cream-300 rounded-xl p-6 shadow-paper">
            <h3 className="text-lg font-serif font-bold text-charcoal-900">
              Your Bookmarked Study Deck
            </h3>
            <p className="text-xs text-charcoal-500 mt-1 leading-relaxed">
              Questions you bookmark during Timed Tests are stored here. Re-practice them anytime, view their correct answers, or delete them when mastered.
            </p>
          </div>

          {loadingBookmarks ? (
            <div className="text-center py-12 text-xs text-charcoal-500 italic">
              Loading your bookmarks...
            </div>
          ) : bookmarksList.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 animate-scale-up">
              {bookmarksList.map((item) => {
                const q = item.questionId;
                if (!q) return null;
                return (
                  <div
                    key={item._id}
                    className="bg-cream-200 border border-cream-300 rounded-xl p-5 shadow-paper flex flex-col gap-4 justify-between"
                  >
                    <div className="flex flex-col gap-3">
                      <div className="flex justify-between items-center border-b border-cream-300 pb-2">
                        <span className="text-[9px] bg-sage-100 text-sage-700 px-2 py-0.5 rounded-full capitalize font-bold">
                          {q.category}
                        </span>
                        <button
                          onClick={() => handleToggleBookmark(q._id)}
                          className="text-terracotta-500 hover:text-terracotta-700 transition-all focus:outline-none"
                          title="Remove Bookmark"
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                      <p className="text-xs text-charcoal-900 font-semibold leading-relaxed">
                        {q.text}
                      </p>

                      {/* Display options for practice review */}
                      {!q.isCoding && q.options && (
                        <div className="flex flex-col gap-1.5 mt-1">
                          {q.options.map((opt, oIdx) => (
                            <div key={oIdx} className="text-[11px] text-charcoal-700 bg-white/50 px-2.5 py-1.5 rounded border border-cream-300/40">
                              <span className="font-serif font-bold mr-1.5">{String.fromCharCode(65 + oIdx)}.</span>
                              {opt}
                            </div>
                          ))}
                        </div>
                      )}
                    </div>

                    <div className="border-t border-cream-300 pt-3 flex flex-col gap-2">
                      <details className="group cursor-pointer">
                        <summary className="text-[10px] font-bold text-sage-600 hover:text-sage-700 select-none list-none flex items-center gap-1">
                          <span>▶</span> Show Correct Answer
                        </summary>
                        <div className="mt-2 text-xs bg-white border border-cream-300 p-3 rounded-lg text-charcoal-900 font-medium">
                          {q.isCoding ? (
                            <span className="text-sage-600 font-bold">Coding Answer: Successful compilation with all test cases passing.</span>
                          ) : (
                            <div>
                              Correct Option: <span className="text-sage-600 font-bold">{String.fromCharCode(65 + q.correctIndex)}</span>
                              <div className="mt-1.5 font-semibold text-charcoal-600 pl-4 border-l-2 border-sage-500">
                                {q.options[q.correctIndex]}
                              </div>
                            </div>
                          )}
                        </div>
                      </details>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="bg-cream-200 border border-cream-300 rounded-xl p-12 text-center shadow-paper max-w-md mx-auto w-full flex flex-col items-center gap-3">
              <Bookmark size={36} className="text-sage-500 stroke-1" />
              <h4 className="font-serif font-bold text-charcoal-900">
                Study Deck Empty
              </h4>
              <p className="text-xs text-charcoal-500">
                You haven't bookmarked any questions yet. Bookmark questions during timed tests to save them here.
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
