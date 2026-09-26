import express from 'express';
import http from 'http';
import cors from 'cors';
import dotenv from 'dotenv';
import { connectDB } from './config/db.js';
import { seedDatabase } from './services/seedData.js';
import { startWeeklyEmailCron } from './services/emailCron.js';
import { initWebPush } from './services/pushService.js';
import initSocket from './socket.js';

// Import routers
import authRouter from './routes/auth.js';
import companiesRouter from './routes/companies.js';
import roadmapsRouter from './routes/roadmaps.js';
import questionsRouter from './routes/questions.js';
import interviewsRouter from './routes/interviews.js';
import profileRouter from './routes/profile.js';
import experiencesRouter from './routes/experiences.js';

import { 
  securityHeaders, 
  sanitizeInputs, 
  globalApiLimiter, 
  authLimiter, 
  aiGenerationLimiter 
} from './middleware/security.js';

// Load environment variables
dotenv.config();

// Verify search credentials at startup
if (!process.env.TAVILY_API_KEY) {
  console.error('\n==================================================');
  console.error('FATAL STARTUP ERROR: Tavily Search API key is missing in .env!');
  console.error('Required: TAVILY_API_KEY');
  console.error('==================================================\n');
  process.exit(1);
}

const app = express();
const PORT = process.env.PORT || 5500;

// Warn if NODE_ENV is not set to production (Render must set NODE_ENV=production via Dashboard env vars)
if (process.env.NODE_ENV !== 'production') {
  console.warn('[WARN] NODE_ENV is not "production". Set NODE_ENV=production in your Render environment variables.');
}

// Wrap Express in a plain HTTP server so Socket.io (used for the optional
// live-streamed interviewer reaction in the Mock Interview section) can
// attach to the exact same port — no separate server/port needed.
const httpServer = http.createServer(app);

// 1. Apply Security Headers & CORS
app.use(securityHeaders);

const ALLOWED_ORIGINS = [
  process.env.CLIENT_URL || 'https://the-placementgrid.vercel.app',
  'http://localhost:3000',
  'http://localhost:5173',
  'http://127.0.0.1:3000',
];

app.use(cors({
  origin: (origin, callback) => {
    // Allow requests with no origin (curl, Postman, server-to-server)
    if (!origin) return callback(null, true);
    if (ALLOWED_ORIGINS.includes(origin)) return callback(null, true);
    callback(new Error(`CORS: origin '${origin}' not allowed`));
  },
  credentials: true
}));

// 2. Request Body Payload Size Hardening (DoS protection)
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// 3. NoSQL Injection & Input Sanitization
app.use(sanitizeInputs);

// 4. Global API Rate Limiting (300 req / min per IP)
app.use('/api', globalApiLimiter);

// Request logger middleware
app.use((req, res, next) => {
  console.log(`[${new Date().toLocaleTimeString()}] ${req.method} ${req.url}`);
  next();
});

// Register REST endpoints with targeted rate limiting
app.use('/api/auth', authLimiter, authRouter);
app.use('/api/companies', companiesRouter);
app.use('/api/roadmaps', roadmapsRouter);
app.use('/api/questions', aiGenerationLimiter, questionsRouter);
app.use('/api/interviews', aiGenerationLimiter, interviewsRouter);
app.use('/api/profile', profileRouter);
app.use('/api/experiences', experiencesRouter);

// Base Status Route
app.get('/api/status', (req, res) => {
  res.json({
    status: 'online',
    version: '1.0.0',
    env: process.env.NODE_ENV || 'development',
    geminiKeyConfigured: !!process.env.GEMINI_API_KEY,
    groqKeyConfigured: !!process.env.GROQ_API_KEY
  });
});

// Global Error Handler
app.use((err, req, res, next) => {
  console.error('Unhandled Server Error:', err.message);
  res.status(500).json({ error: 'Internal Server Error', details: err.message });
});

// Start DB connection, run seeding, and fire up server
const startServer = async () => {
  // Connect to DB
  await connectDB();
  
  // Seed Database with initial placement questions, roadmaps and chunks
  await seedDatabase();

  // Initialize Web Push and Nodemailer email crons
  initWebPush();
  startWeeklyEmailCron();

  // Attach Socket.io for the Mock Interview section's live interviewer
  // reaction feature. Gracefully no-ops (frontend just won't show the
  // live-reaction panel) if GROQ_API_KEY isn't configured — see socket.js.
  initSocket(httpServer);

  httpServer.listen(PORT, () => {
    console.log(`==================================================`);
    console.log(`THE_PlacementGRID Backend Running on Port ${PORT}`);
    console.log(`Mode: ${process.env.NODE_ENV || 'development'}`);
    console.log(`Socket.io: live interviewer reaction enabled`);
    console.log(`==================================================`);
  });
};

startServer();
