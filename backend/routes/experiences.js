import express from 'express';
import { InterviewExperience, User } from '../models/Schemas.js';
import { requireAuth } from './auth.js';

const router = express.Router();

// Get all peer interview experiences (optional company filter)
router.get('/', async (req, res) => {
  const { company } = req.query;
  try {
    let query = {};
    if (company) {
      query.company = new RegExp(`^${company}$`, 'i');
    }
    const experiences = await InterviewExperience.find(query).sort({ date: -1 });
    return res.json(experiences);
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
});

// Post a new interview experience
router.post('/add', requireAuth, async (req, res) => {
  const { role, company, questionsAsked, difficulty, tips, anonymous } = req.body;
  
  if (!role || !company || !questionsAsked || !Array.isArray(questionsAsked)) {
    return res.status(400).json({ error: 'Missing required fields: role, company, or questionsAsked' });
  }

  try {
    const user = req.user;
    const experience = await InterviewExperience.create({
      role,
      company,
      questionsAsked,
      difficulty: difficulty || 'medium',
      tips: tips || '',
      studentName: anonymous ? 'Anonymous Senior' : user.name,
      studentEmail: anonymous ? undefined : user.email,
      date: new Date()
    });

    // Update user streak or count activity for posting
    user.streakCount = (user.streakCount || 0) + 1;
    await user.save();

    return res.status(201).json({ success: true, experience });
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
});

// Leaderboard statistics for consistent preparation
router.get('/leaderboard', async (req, res) => {
  try {
    // Find top users by streakCount or completedRoadmapTopics count
    const users = await User.find({}, 'name streakCount completedRoadmapTopics')
      .sort({ streakCount: -1 })
      .limit(10);
      
    const leaderboard = users.map(u => ({
      name: u.name,
      streak: u.streakCount || 0,
      completedCount: u.completedRoadmapTopics ? u.completedRoadmapTopics.length : 0
    }));

    return res.json(leaderboard);
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
});

export default router;
