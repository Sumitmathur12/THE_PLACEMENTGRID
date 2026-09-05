import express from 'express';
import { InterviewExperience, User } from '../models/Schemas.js';
import { requireAuth } from './auth.js';
import { logGenuineActivity } from '../services/activityService.js';

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

    // Sharing a real interview experience is a genuine community
    // contribution — route it through the same day-aware activity pipeline
    // as every other meaningful action, instead of a raw counter bump.
    try {
      await logGenuineActivity(user._id, 'experience');
    } catch (activityErr) {
      console.error('Failed to log experience-post activity:', activityErr.message);
    }

    return res.status(201).json({ success: true, experience });
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
});

// ==========================================================================
// Peer Challenge Leaderboard — privacy-safe, scoped, paginated.
//
// Query params:
//   scope   = 'global' | 'target'   (default 'global')
//             'target' filters to users sharing the requester's own
//             targetCompany, so competition feels relevant rather than
//             against unrelated students.
//   period  = 'weekly' | 'alltime'  (default 'weekly')
//   page    = 1-based page number (default 1)
//   limit   = page size (default 20, capped at 50)
//
// Privacy guarantee: only opted-in users (leaderboardOptIn: true) ever
// appear here, and only their displayHandle, streak, score, and target
// company are returned — never name, email, or any other private field.
// ==========================================================================
router.get('/leaderboard', async (req, res) => {
  try {
    const scope = req.query.scope === 'target' ? 'target' : 'global';
    const period = req.query.period === 'alltime' ? 'alltime' : 'weekly';
    const page = Math.max(1, parseInt(req.query.page) || 1);
    const limit = Math.min(50, Math.max(1, parseInt(req.query.limit) || 20));
    const skip = (page - 1) * limit;

    const query = { leaderboardOptIn: true, displayHandle: { $ne: '' } };

    if (scope === 'target') {
      // This route is intentionally unauthenticated/public (so a leaderboard
      // can be shared/viewed without forcing a login), so for 'target' scope
      // the caller must explicitly pass which company to filter by — the
      // frontend passes the logged-in user's own targetCompany here.
      const targetCompanyName = req.query.company || '';
      if (!targetCompanyName) {
        return res.status(400).json({ error: 'scope=target requires a ?company= parameter.' });
      }
      query.targetCompany = new RegExp(`^${targetCompanyName}$`, 'i');

      // Optional further narrowing to Same Company + Same Role, when the
      // caller knows their specific target role too (e.g. "Google SDE" vs
      // just "Google" — someone prepping for a Product Manager role at the
      // same company shouldn't be lumped into a pure-coding comparison).
      const targetRoleName = req.query.role || '';
      if (targetRoleName) {
        query.targetRole = new RegExp(`^${targetRoleName}$`, 'i');
      }
    }

    const sortField = period === 'weekly' ? 'weeklyScore' : 'allTimeScore';

    const [totalCount, users] = await Promise.all([
      User.countDocuments(query),
      User.find(
        query,
        'displayHandle currentStreak longestStreak weeklyScore allTimeScore targetCompany targetRole roadmapCompletionPct totalQuestionsAttempted weeklyQuestionsAttempted previousWeeklyRank'
      )
        .sort({ [sortField]: -1 })
        .skip(skip)
        .limit(limit)
    ]);

    const leaderboard = users.map((u, idx) => {
      const rank = skip + idx + 1;
      let rankChange = null; // positive = moved up, negative = moved down, null = no prior data
      if (period === 'weekly' && u.previousWeeklyRank != null) {
        rankChange = u.previousWeeklyRank - rank;
      }
      return {
        rank,
        displayHandle: u.displayHandle,
        streak: u.currentStreak || 0,
        longestStreak: u.longestStreak || 0,
        score: period === 'weekly' ? (u.weeklyScore || 0) : (u.allTimeScore || 0),
        targetCompany: u.targetCompany || '',
        targetRole: u.targetRole || '',
        roadmapCompletionPct: u.roadmapCompletionPct || 0,
        totalQuestionsAttempted: u.totalQuestionsAttempted || 0,
        weeklyQuestionsAttempted: u.weeklyQuestionsAttempted || 0,
        rankChange
      };
    });

    // ------------------------------------------------------------------
    // Achievement badges — computed from the returned page only (not a
    // separate expensive global query), and only meant as a lightweight,
    // motivating signal, not a scored competitive mechanic in themselves.
    // We deliberately avoid volume-only "most time spent" style badges —
    // every badge here rewards genuine preparation signals.
    // ------------------------------------------------------------------
    const badges = {};
    if (leaderboard.length > 0) {
      if (page === 1) {
        badges.weeklyChampion = period === 'weekly' ? leaderboard[0].displayHandle : null;
        badges.allTimeChampion = period === 'alltime' ? leaderboard[0].displayHandle : null;
      }
      const mostConsistent = [...leaderboard].sort((a, b) => b.streak - a.streak)[0];
      if (mostConsistent && mostConsistent.streak > 0) badges.mostConsistent = mostConsistent.displayHandle;

      const questionCrusher = [...leaderboard].sort((a, b) => b.weeklyQuestionsAttempted - a.weeklyQuestionsAttempted)[0];
      if (questionCrusher && questionCrusher.weeklyQuestionsAttempted > 0) badges.questionCrusher = questionCrusher.displayHandle;

      const roadmapFinishers = leaderboard.filter(e => e.roadmapCompletionPct >= 100).map(e => e.displayHandle);
      if (roadmapFinishers.length > 0) badges.roadmapFinishers = roadmapFinishers;

      const improved = leaderboard.filter(e => e.rankChange != null && e.rankChange > 0).sort((a, b) => b.rankChange - a.rankChange)[0];
      if (improved) badges.mostImproved = improved.displayHandle;
    }

    return res.json({
      scope,
      period,
      page,
      limit,
      totalCount,
      totalPages: Math.max(1, Math.ceil(totalCount / limit)),
      leaderboard,
      badges
    });
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
});

// Personal preparation stats — always available for the logged-in user,
// regardless of whether they've opted into the public leaderboard. This is
// what powers the "My Stats" panel on the Dashboard.
router.get('/my-stats', requireAuth, async (req, res) => {
  try {
    const u = req.user;

    // Compute this user's own rank within their opted-in scope, if opted in.
    let globalRank = null;
    let targetRank = null;
    let rankChange = null;

    if (u.leaderboardOptIn && u.displayHandle) {
      const higherGlobal = await User.countDocuments({
        leaderboardOptIn: true,
        displayHandle: { $ne: '' },
        weeklyScore: { $gt: u.weeklyScore || 0 }
      });
      globalRank = higherGlobal + 1;
      if (u.previousWeeklyRank != null) {
        rankChange = u.previousWeeklyRank - globalRank;
      }

      if (u.targetCompany) {
        const higherTarget = await User.countDocuments({
          leaderboardOptIn: true,
          displayHandle: { $ne: '' },
          targetCompany: new RegExp(`^${u.targetCompany}$`, 'i'),
          weeklyScore: { $gt: u.weeklyScore || 0 }
        });
        targetRank = higherTarget + 1;
      }
    }

    return res.json({
      currentStreak: u.currentStreak || 0,
      longestStreak: u.longestStreak || 0,
      weeklyScore: u.weeklyScore || 0,
      allTimeScore: u.allTimeScore || 0,
      roadmapCompletionPct: u.roadmapCompletionPct || 0,
      totalQuestionsAttempted: u.totalQuestionsAttempted || 0,
      weeklyQuestionsAttempted: u.weeklyQuestionsAttempted || 0,
      targetCompany: u.targetCompany || '',
      targetRole: u.targetRole || '',
      displayHandle: u.displayHandle || '',
      leaderboardOptIn: u.leaderboardOptIn || false,
      globalRank,
      targetRank,
      rankChange
    });
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
});

export default router;
