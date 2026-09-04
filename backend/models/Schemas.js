import mongoose from "mongoose";

// User Schema
const UserSchema = new mongoose.Schema(
  {
    name: { type: String, required: true },
    email: { type: String, required: true, unique: true },
    googleId: { type: String },
    targetCompany: { type: String, default: "" },
    collegeName: { type: String, default: "" },
    branch: { type: String, default: "" },
    rollNumber: { type: String, default: "" },
    completedRoadmapTopics: [{ type: String }], // Unique IDs representing completed roadmap topics
    attemptedQuestionIds: [
      { type: mongoose.Schema.Types.ObjectId, ref: "Question" },
    ], // Track attempted questions for rotation
    streakCount: { type: Number, default: 0 },
    currentStreak: { type: Number, default: 0 },
    longestStreak: { type: Number, default: 0 },
    totalQuestionsAttempted: { type: Number, default: 0 },
    weeklyScore: { type: Number, default: 0 },
    allTimeScore: { type: Number, default: 0 },
    roadmapCompletionPct: { type: Number, default: 0 },
    targetRole: { type: String, default: "" },
    // Weekly breakdown numbers (cached alongside weeklyScore) — used to power
    // achievement badges without re-aggregating DailyActivity on every request.
    weeklyQuestionsAttempted: { type: Number, default: 0 },
    weeklyRoadmapTasksCompleted: { type: Number, default: 0 },
    // Rank-movement tracking: snapshotted once per IST week (on the user's
    // first genuine activity of a new week), so the leaderboard can show
    // "you moved up 3 spots since last week" instead of just a static rank.
    weeklyScoreSnapshotWeek: { type: String, default: "" }, // the Monday (YYYY-MM-DD) this snapshot belongs to
    previousWeeklyScore: { type: Number, default: 0 },
    previousWeeklyRank: { type: Number, default: null },
    displayHandle: { type: String, default: "" },
    leaderboardOptIn: { type: Boolean, default: false },
    lastHeartbeatAt: { type: Date },
    lastActiveDate: { type: Date },
    bookmarkedResources: [
      {
        title: String,
        url: String,
        category: String,
      },
    ],
    resume: {
      skills: [String],
      education: [
        {
          institution: String,
          degree: String,
          year: String,
          gpa: String,
        },
      ],
      projects: [
        {
          title: String,
          description: String,
          talkingPoints: [String], // STAR format AI generated answers
        },
      ],
      experience: [
        {
          company: String,
          role: String,
          duration: String,
          description: String,
        },
      ],
      parsedText: { type: String, default: "" },
      fileUrl: { type: String, default: "" },
    },
    pushSubscriptions: [mongoose.Schema.Types.Mixed],
  },
  { timestamps: true },
);

// Company Schema
const CompanySchema = new mongoose.Schema(
  {
    name: { type: String, required: true, unique: true },
    logo: { type: String, default: "" },
    lastUpdated: { type: Date, default: Date.now },
    stages: [
      {
        name: String,
        description: String,
      },
    ],
    timeline: { type: String, default: "August - October" },
    collegeCutoff: {
      type: mongoose.Schema.Types.Mixed,
      default: "Not available",
    }, // CGPA or score cutoff
    placementStats: {
      placedCount: { type: Number, default: 0 },
      avgPackage: { type: String, default: "N/A" }, // e.g. "12 LPA"
      details: { type: String, default: "" },
    },
    roles: {
      type: [String],
      default: ["SDE", "Data Analyst", "Data Science", "Machine Learning"],
    },
    flagCount: { type: Number, default: 0 },
    verified: { type: Boolean, default: false },
  },
  { timestamps: true },
);

// Roadmap Schema
const RoadmapSchema = new mongoose.Schema(
  {
    domain: { type: String, required: true }, // e.g. 'SDE', 'Data Analyst', 'Product'
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },
    companyId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Company",
      default: null,
    },
    role: { type: String, default: "" },
    weeks: [
      {
        weekNumber: Number,
        topics: [
          {
            topicId: String, // e.g. 'sde-w1-t1'
            title: String,
            description: String,
            gfgUrl: String,
            leetcodeUrl: String,
            youtubeUrl: String,
            whyItMatters: String,
            resources: [
              {
                title: String,
                url: String,
              },
            ],
          },
        ],
      },
    ],
    practiceQuestions: [
      {
        weekNumber: Number,
        title: String,
        url: String,
        type: {
          type: String,
          enum: ["previously-asked", "recommended"],
          default: "recommended",
        },
        topicName: String,
      },
    ],
    behavioralQuestions: [
      {
        question: String,
        tip: String,
        sampleAnswer: String,
        type: {
          type: String,
          enum: ["previously-asked", "general"],
          default: "general",
        },
      },
    ],
    aiNotes: { type: String, default: "" },
  },
  { timestamps: true },
);

// Question Schema
const QuestionSchema = new mongoose.Schema(
  {
    category: { type: String, required: true }, // 'quant', 'logical', 'verbal', 'coreCS', 'coding'
    text: { type: String, required: true },
    options: [{ type: String }],
    correctIndex: { type: Number },
    companies: [{ type: String }], // companies where this pattern has appeared
    difficulty: {
      type: String,
      enum: ["easy", "medium", "hard"],
      default: "medium",
    },
    isCoding: { type: Boolean, default: false },
    testCases: [
      {
        input: String,
        output: String,
      },
    ],
    starterCode: { type: String, default: "" },
    starterCodes: { type: Map, of: String, default: {} },
    subTopic: { type: String, default: "" },
    origin: {
      type: String,
      enum: ["curated", "AI-generated"],
      default: "curated",
    },
  },
  { timestamps: true },
);

// Attempt Schema (Time-Series history)
const AttemptSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    category: { type: String }, // e.g. 'quant', or 'company-mock:TCS'
    score: {
      correct: Number,
      total: Number,
    },
    timeTaken: { type: Number }, // in seconds
    categoryBreakdown: { type: Map, of: Number }, // e.g., { quant: 80, verbal: 50 }
    feedback: { type: String, default: "" },
    recommendations: { type: String, default: "" },
    date: { type: Date, default: Date.now },
  },
  { timestamps: true },
);

// SpacedRepetition Schema (SM-2)
const SpacedRepetitionSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    questionId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Question",
      required: true,
    },
    interval: { type: Number, default: 1 }, // in days
    easeFactor: { type: Number, default: 2.5 },
    repetitions: { type: Number, default: 0 },
    nextReviewDate: { type: Date, default: Date.now },
  },
  { timestamps: true },
);

// InterviewSession Schema
const InterviewSessionSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    company: { type: String, required: true },
    transcript: [
      {
        speaker: { type: String, enum: ["interviewer", "candidate"] },
        text: String,
      },
    ],
    proctoringIntegrityScore: { type: Number, default: 100 },
    proctoringLogs: [
      {
        event: String, // 'tab-switch', 'no-face', 'multiple-faces', 'copy-paste', 'silence'
        timestamp: { type: Date, default: Date.now },
        details: String,
      },
    ],
    feedback: {
      strengths: [String],
      weaknesses: [String],
      detailedAssessment: String,
      score: Number, // 1-100 scale
    },
    date: { type: Date, default: Date.now },
  },
  { timestamps: true },
);

// InterviewExperience Schema (Peer layer)
const InterviewExperienceSchema = new mongoose.Schema(
  {
    role: { type: String, required: true }, // e.g. 'SDE Intern', 'System Engineer'
    company: { type: String, required: true },
    questionsAsked: [{ type: String }],
    difficulty: {
      type: String,
      enum: ["easy", "medium", "hard"],
      default: "medium",
    },
    tips: { type: String, default: "" },
    studentName: { type: String, default: "Anonymous Senior" },
    studentEmail: { type: String },
    date: { type: Date, default: Date.now },
  },
  { timestamps: true },
);

// KnowledgeBase Schema (RAG Content Chunks with Embeddings)
const KnowledgeBaseSchema = new mongoose.Schema(
  {
    title: { type: String, required: true },
    category: { type: String, required: true }, // 'companyInfo', 'dsaTopic', 'interviewExperience', 'roadmap'
    content: { type: String, required: true },
    embedding: { type: [Number], required: true }, // Array of 384 numbers for MiniLM
    metadata: {
      company: String,
      sourceLinks: [
        {
          title: String,
          url: String,
        },
      ],
    },
  },
  { timestamps: true },
);

// Create indexes for Vector Search or Text Search
KnowledgeBaseSchema.index({ content: "text", title: "text" });

export const User = mongoose.model("User", UserSchema);
export const Company = mongoose.model("Company", CompanySchema);
export const Roadmap = mongoose.model("Roadmap", RoadmapSchema);
export const Question = mongoose.model("Question", QuestionSchema);
export const Attempt = mongoose.model("Attempt", AttemptSchema);
export const SpacedRepetition = mongoose.model(
  "SpacedRepetition",
  SpacedRepetitionSchema,
);
export const InterviewSession = mongoose.model(
  "InterviewSession",
  InterviewSessionSchema,
);
export const InterviewExperience = mongoose.model(
  "InterviewExperience",
  InterviewExperienceSchema,
);
export const KnowledgeBase = mongoose.model(
  "KnowledgeBase",
  KnowledgeBaseSchema,
);

// RoleProfile Schema (cached role-specific company guides)
const RoleProfileSchema = new mongoose.Schema(
  {
    companyId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Company",
      required: true,
    },
    role: { type: String, required: true },
    content: { type: String, required: true },
    citations: [
      {
        title: String,
        links: [
          {
            title: String,
            url: String,
          },
        ],
      },
    ],
    lastUpdated: { type: Date, default: Date.now },
  },
  { timestamps: true },
);
RoleProfileSchema.index({ companyId: 1, role: 1 }, { unique: true });

export const RoleProfile = mongoose.model("RoleProfile", RoleProfileSchema);

// BookmarkedQuestion Schema
const BookmarkedQuestionSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    questionId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Question",
      required: true,
    },
    category: { type: String, required: true },
    bookmarkedAt: { type: Date, default: Date.now },
  },
  { timestamps: true },
);
BookmarkedQuestionSchema.index({ userId: 1, questionId: 1 }, { unique: true });

export const BookmarkedQuestion = mongoose.model(
  "BookmarkedQuestion",
  BookmarkedQuestionSchema,
);

// DailyActivity Schema
const DailyActivitySchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    date: { type: String, required: true }, // YYYY-MM-DD in IST
    questionsAttempted: { type: Number, default: 0 },
    uniqueQuestionsAttempted: { type: Number, default: 0 },
    questionsSolved: { type: Number, default: 0 },
    correctAnswers: { type: Number, default: 0 },
    incorrectAnswers: { type: Number, default: 0 },
    roadmapTasksCompleted: { type: Number, default: 0 },
    mockInterviewsCompleted: { type: Number, default: 0 },
    resumeActivities: { type: Number, default: 0 },
    genuineActiveMinutes: { type: Number, default: 0 },
    meaningfulActions: { type: Number, default: 0 },
  },
  { timestamps: true },
);
DailyActivitySchema.index({ userId: 1, date: 1 }, { unique: true });

// WeeklyLeaderboard Schema
const WeeklyLeaderboardSchema = new mongoose.Schema(
  {
    weekStartDate: { type: String, required: true }, // YYYY-MM-DD (Monday)
    rankings: [
      {
        userId: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
        displayHandle: String,
        prepScore: Number,
        streakCount: Number,
        targetCompany: String,
        targetRole: String,
      },
    ],
  },
  { timestamps: true },
);
WeeklyLeaderboardSchema.index({ weekStartDate: 1 });

export const DailyActivity = mongoose.model(
  "DailyActivity",
  DailyActivitySchema,
);
export const WeeklyLeaderboard = mongoose.model(
  "WeeklyLeaderboard",
  WeeklyLeaderboardSchema,
);
