import express from 'express';
import { Roadmap, User } from '../models/Schemas.js';
import { getDomainRoadmap } from '../services/aiService.js';
import { requireAuth } from './auth.js';
import { logGenuineActivity } from '../services/activityService.js';

const router = express.Router();

// Get all available roadmap domains (dynamic custom paths + default fallbacks)
router.get('/', async (req, res) => {
  try {
    const roadmaps = await Roadmap.find({}, 'domain');
    const customDomains = roadmaps.map(r => r.domain);
    const defaultDomains = ['SDE', 'Data Analyst', 'Product Manager', 'Consulting'];
    const uniqueDomains = Array.from(new Set([...defaultDomains, ...customDomains]));
    return res.json(uniqueDomains);
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
});

// Get current user's generated roadmaps
router.get('/my', requireAuth, async (req, res) => {
  try {
    const roadmaps = await Roadmap.find({ userId: req.user._id }).sort({ updatedAt: -1 });
    return res.json(roadmaps);
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
});

// Get domain-based roadmap (supporting both guest and logged-in user)
router.get('/:domain', async (req, res) => {
  const { domain } = req.params;
  try {
    let roadmap = await Roadmap.findOne({ domain: new RegExp(`^${domain}$`, 'i') });
    
    // Check if roadmap is not in DB, generate via RAG and seed it
    if (!roadmap) {
      console.log(`Roadmap for domain "${domain}" not found in database. Generating via RAG...`);
      const generated = await getDomainRoadmap(domain);
      
      // Parse weekly structure from generated text
      // We will seed a default structured roadmap, but enrich it with the AI text for the view.
      // Let's create a dynamic record.
      roadmap = await Roadmap.create({
        domain,
        weeks: [
          {
            weekNumber: 1,
            topics: [
              {
                topicId: `${domain.toLowerCase()}-w1-t1`,
                title: `${domain} Core Fundamentals`,
                description: 'Overview of core parameters, terminology, and foundational concepts.',
                whyItMatters: 'Essential first round screener topic.',
                youtubeUrl: 'https://www.youtube.com/watch?v=A7A_ePz4g3k',
                leetcodeUrl: 'https://leetcode.com/tag/array/',
                resources: [{ title: 'Introductory Material', url: 'https://takeuforward.org/' }]
              }
            ]
          }
        ]
      });
      return res.json({ roadmap, aiNotes: generated.content, citations: generated.citations });
    }

    return res.json({ roadmap, aiNotes: roadmap.aiNotes || '', citations: [{ title: `${roadmap.domain} RAG Grounded Context`, links: [] }] });
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
});

// Toggle checkbox progress tracking
router.post('/toggle-progress', requireAuth, async (req, res) => {
  const { topicId } = req.body;
  if (!topicId) {
    return res.status(400).json({ error: 'topicId is required.' });
  }

  try {
    const user = req.user;
    const index = user.completedRoadmapTopics.indexOf(topicId);
    
    if (index > -1) {
      // Uncheck
      user.completedRoadmapTopics.splice(index, 1);
      const { recalculateStreakAndScore } = await import('../services/activityService.js');
      await recalculateStreakAndScore(user._id);
    } else {
      // Check
      user.completedRoadmapTopics.push(topicId);
      await logGenuineActivity(user._id, 'roadmap');
    }

    await user.save();
    return res.json({ success: true, completedRoadmapTopics: user.completedRoadmapTopics });
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
});

export default router;
