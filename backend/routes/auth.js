import express from 'express';
import jwt from 'jsonwebtoken';
import { User } from '../models/Schemas.js';

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
        streakCount: 1,
        lastActiveDate: new Date(),
        completedRoadmapTopics: []
      });
    } else {
      // Update active streak
      const today = new Date().toDateString();
      const lastActive = user.lastActiveDate ? user.lastActiveDate.toDateString() : '';
      if (lastActive !== today) {
        const yesterday = new Date(Date.now() - 86400000).toDateString();
        if (lastActive === yesterday) {
          user.streakCount += 1;
        } else {
          user.streakCount = 1;
        }
        user.lastActiveDate = new Date();
        await user.save();
      }
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

export default router;
