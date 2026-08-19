import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { connectDB } from './config/db.js';
import { seedDatabase } from './services/seedData.js';
import { startWeeklyEmailCron } from './services/emailCron.js';
import { initWebPush } from './services/pushService.js';

// Import routers
import authRouter from './routes/auth.js';
import companiesRouter from './routes/companies.js';
import roadmapsRouter from './routes/roadmaps.js';
import questionsRouter from './routes/questions.js';
import interviewsRouter from './routes/interviews.js';
import profileRouter from './routes/profile.js';
import experiencesRouter from './routes/experiences.js';

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

// Enable CORS and JSON parsing
app.use(cors());
app.use(express.json());

// Request logger middleware
app.use((req, res, next) => {
  console.log(`[${new Date().toLocaleTimeString()}] ${req.method} ${req.url}`);
  next();
});

// Register REST endpoints
app.use('/api/auth', authRouter);
app.use('/api/companies', companiesRouter);
app.use('/api/roadmaps', roadmapsRouter);
app.use('/api/questions', questionsRouter);
app.use('/api/interviews', interviewsRouter);
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

  app.listen(PORT, () => {
    console.log(`==================================================`);
    console.log(`THE_PlacementGRID Backend Running on Port ${PORT}`);
    console.log(`Mode: ${process.env.NODE_ENV || 'development'}`);
    console.log(`==================================================`);
  });
};

startServer();
