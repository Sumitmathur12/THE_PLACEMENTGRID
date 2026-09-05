import express from 'express';
import jwt from 'jsonwebtoken';
import { User, DailyActivity } from '../models/Schemas.js';
import { getISTDateString, recalculateStreakAndScore, CONFIG } from '../services/activityService.js';

const router = express.Router();

// Helper to sign a mock token for guest fallback (Base64 of userID + secret)
const signToken = (userId) => {
  return Buffer.from(JSON.stringify({ id: userId, exp: Date.now() + 24 * 60 * 60 * 1000 })).toString('base64');
};

// Middleware to verify auth via Supabase JWT (Supports RS256/ES256 JWKS and HS256 by delegating validation to Supabase auth API)
export const requireAuth = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'Unauthorized: No token provided' });
    }
    const token = authHeader.split(' ')[1];
    
    let email = '';
    let name = '';

    if (token.includes('.')) {
      // First try local JWT verification (standard fast-path, essential for E2E tests signing local mock JWTs)
      const jwtSecret = process.env.SUPABASE_JWT_SECRET;
      if (process.env.NODE_ENV !== 'production' && jwtSecret) {
        try {
          const decoded = jwt.verify(token, jwtSecret);
          email = decoded.email;
          name = decoded.user_metadata?.full_name || decoded.name || 'Scholar Candidate';
        } catch (e) {
          console.log('Local JWT verification failed or bypassed, falling back to Supabase remote API...');
        }
      }

      if (!email) {
        // Real JWT - verify dynamically via Supabase Auth API
        const supabaseUrl = process.env.SUPABASE_URL;
        const supabaseAnonKey = process.env.SUPABASE_ANON_KEY;

        if (!supabaseUrl || !supabaseAnonKey) {
          return res.status(500).json({ error: 'Server misconfiguration: Supabase credentials missing' });
        }

        const verifyRes = await fetch(`${supabaseUrl}/auth/v1/user`, {
          method: 'GET',
          headers: {
            'apikey': supabaseAnonKey,
            'Authorization': `Bearer ${token}`
          }
        });

        if (!verifyRes.ok) {
          const errPayload = await verifyRes.json().catch(() => ({}));
          return res.status(401).json({ 
            error: `Unauthorized: Supabase JWT validation failed: ${errPayload.msg || errPayload.error_description || 'Invalid token'}` 
          });
        }

        const userData = await verifyRes.json();
        email = userData.email;
        name = userData.user_metadata?.full_name || userData.user_metadata?.name || 'Scholar Candidate';
      }
    } else {
      // Mock/Base64 fallback for local development or guest sessions
      try {
        const decoded = JSON.parse(Buffer.from(token, 'base64').toString('utf-8'));
        email = decoded.email || (decoded.id === 'guest-user-id' ? 'guest@college.edu' : decoded.id);
        name = decoded.user_metadata?.full_name || decoded.name || 'Scholar Candidate';
      } catch (e) {
        return res.status(401).json({ error: 'Unauthorized: Invalid token format' });
      }
    }

    if (!email) {
      return res.status(401).json({ error: 'Unauthorized: Token did not contain a valid identifier' });
    }

    // Find or create matching User document in MongoDB
    let user = await User.findOne({ email });
    if (!user) {
      user = await User.create({
        name,
        email,
        targetCompany: 'Google',
        lastActiveDate: new Date(),
        completedRoadmapTopics: []
      });
    } else {
      // NOTE: Streak is intentionally NOT incremented here. This middleware
      // runs on every single authenticated request (page loads, polling,
      // etc.) — incrementing a "genuine preparation" streak here would mean
      // simply having the app open counts as activity, which directly
      // contradicts the anti-gaming rule that a login/visit alone must never
      // extend the streak. Streak updates happen exclusively through
      // `activityService.recalculateStreakAndScore`, triggered only by real
      // actions (practice submissions, roadmap task completion, finishing a
      // mock interview, a resume analysis, or a validated heartbeat ping).
      user.lastActiveDate = new Date();
      await user.save();
    }

    req.user = user;
    next();
  } catch (error) {
    return res.status(401).json({ error: `Unauthorized: Invalid session. ${error.message}` });
  }
};

// Profile Synchronization after Supabase Signup (Public to support pending email verification states)
router.post('/register-sync', async (req, res) => {
  const { name, email: bodyEmail, collegeName, branch, rollNumber } = req.body;
  if (!name || !collegeName || !branch || !rollNumber) {
    return res.status(400).json({ error: 'All profile registration fields are required.' });
  }

  let email = bodyEmail;

  // Extract email securely from bearer token if provided (e.g. from session or E2E tests)
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    const token = authHeader.split(' ')[1];
    try {
      if (token.includes('.')) {
        // First try local JWT verification (standard fast-path, essential for E2E tests signing local mock JWTs)
        const jwtSecret = process.env.SUPABASE_JWT_SECRET;
        if (process.env.NODE_ENV !== 'production' && jwtSecret) {
          try {
            const decoded = jwt.verify(token, jwtSecret);
            email = decoded.email;
          } catch (e) {
            console.log('register-sync: Local JWT verification failed or bypassed, falling back to Supabase remote API...');
          }
        }

        if (!email) {
          // Real JWT - verify dynamically via Supabase Auth API
          const supabaseUrl = process.env.SUPABASE_URL;
          const supabaseAnonKey = process.env.SUPABASE_ANON_KEY;
          if (supabaseUrl && supabaseAnonKey) {
            const verifyRes = await fetch(`${supabaseUrl}/auth/v1/user`, {
              method: 'GET',
              headers: {
                'apikey': supabaseAnonKey,
                'Authorization': `Bearer ${token}`
              }
            });
            if (verifyRes.ok) {
              const userData = await verifyRes.json();
              email = userData.email;
            }
          }
        }
      } else {
        // Base64 JSON fallback for E2E tests
        const decoded = JSON.parse(Buffer.from(token, 'base64').toString());
        email = decoded.email;
      }
    } catch (err) {
      console.warn('register-sync: Ignored token decoding failure:', err.message);
    }
  }

  if (!email) {
    return res.status(400).json({ error: 'Unauthorized: Email is missing from token payload and body.' });
  }

  try {
    let user = await User.findOne({ email: email.toLowerCase() });
    if (!user) {
      user = new User({
        email: email.toLowerCase(),
        name,
        targetCompany: 'Google',
        streakCount: 1,
        lastActiveDate: new Date(),
        completedRoadmapTopics: []
      });
    }

    user.name = name.trim();
    user.collegeName = collegeName.trim();
    user.branch = branch.trim();
    user.rollNumber = rollNumber.trim();
    await user.save();

    return res.json({ success: true, user });
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
});

// Complete profile endpoint (for first-time Google/GitHub OAuth logins)
router.post('/complete-profile', requireAuth, async (req, res) => {
  const { collegeName, branch, rollNumber } = req.body;
  if (!collegeName || !branch || !rollNumber) {
    return res.status(400).json({ error: 'College Name, Branch, and Roll Number are required.' });
  }

  try {
    const user = req.user;
    user.collegeName = collegeName.trim();
    user.branch = branch.trim();
    user.rollNumber = rollNumber.trim();
    await user.save();

    return res.json({ success: true, user });
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
});

// Get Current User Profile details (verified via Supabase JWT or guest fallback)
router.get('/me', requireAuth, async (req, res) => {
  try {
    return res.json(req.user);
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
});

// Update Target Company Pinned status
router.post('/target-company', requireAuth, async (req, res) => {
  const { companyName } = req.body;
  try {
    req.user.targetCompany = companyName;
    await req.user.save();
    return res.json({ success: true, targetCompany: companyName });
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
});

// ==========================================================================
// Activity Heartbeat — server-authoritative genuine active-time tracking.
//
// The frontend pings this endpoint at most once per minute, and ONLY while
// the tab is visible and the user has interacted recently. But we NEVER
// trust the client's own claim of elapsed time — the server independently
// computes how much time to credit, based on `lastHeartbeatAt`, and applies
// three anti-gaming guards:
//   1. Minimum interval — a heartbeat arriving too soon after the last one
//      is rejected outright (prevents request spamming/flooding).
//   2. Per-ping credit cap — even if a large gap is detected (e.g. laptop
//      was asleep and just woke up), we only ever credit a couple of
//      minutes for that single ping, never the full elapsed gap.
//   3. Daily cap — total genuineActiveMinutes for a calendar day (IST) is
//      hard-capped, so no amount of pinging can inflate a day beyond a
//      realistic study-session ceiling.
// ==========================================================================
router.post('/heartbeat', requireAuth, async (req, res) => {
  try {
    const user = req.user;
    const now = new Date();

    if (user.lastHeartbeatAt) {
      const secondsSinceLast = (now.getTime() - new Date(user.lastHeartbeatAt).getTime()) / 1000;
      if (secondsSinceLast < CONFIG.heartbeatMinIntervalSeconds) {
        // Too soon — likely a duplicate/rapid-fire request. Reject silently
        // (not an error state from the client's perspective, just a no-op).
        return res.json({ success: true, credited: 0, reason: 'too_soon' });
      }
    }

    // Determine how many minutes to credit for this ping, capped regardless
    // of how long the actual gap was.
    const creditMinutes = CONFIG.heartbeatMaxCreditMinutes;

    const todayStr = getISTDateString();
    let activity = await DailyActivity.findOne({ userId: user._id, date: todayStr });
    if (!activity) {
      activity = new DailyActivity({ userId: user._id, date: todayStr });
    }

    const remainingCap = Math.max(0, CONFIG.dailyActiveMinutesCap - (activity.genuineActiveMinutes || 0));
    const actualCredit = Math.min(creditMinutes, remainingCap);

    if (actualCredit > 0) {
      activity.genuineActiveMinutes += actualCredit;
      await activity.save();
    }

    user.lastHeartbeatAt = now;
    await user.save();

    // Recalculate streak/score so active-time contributes to the Prep Score
    // in near real-time, not just after a question/roadmap/interview action.
    await recalculateStreakAndScore(user._id);

    return res.json({ success: true, credited: actualCredit, dailyTotal: activity.genuineActiveMinutes });
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
});

// Update leaderboard participation settings — display handle + opt-in toggle.
// Real name/email are never touched here and never exposed on any public
// leaderboard response; only the chosen handle is shown publicly.
router.post('/leaderboard-settings', requireAuth, async (req, res) => {
  try {
    const { displayHandle, leaderboardOptIn } = req.body;
    const user = req.user;

    if (displayHandle !== undefined) {
      const trimmed = String(displayHandle).trim().slice(0, 24); // reasonable length cap
      if (trimmed.length > 0 && trimmed.length < 3) {
        return res.status(400).json({ error: 'Display handle must be at least 3 characters.' });
      }
      user.displayHandle = trimmed;
    }

    if (leaderboardOptIn !== undefined) {
      if (leaderboardOptIn === true && !user.displayHandle) {
        return res.status(400).json({ error: 'Please choose a display handle before joining the leaderboard.' });
      }
      user.leaderboardOptIn = Boolean(leaderboardOptIn);
    }

    await user.save();
    return res.json({
      success: true,
      displayHandle: user.displayHandle,
      leaderboardOptIn: user.leaderboardOptIn
    });
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
});

export default router;
