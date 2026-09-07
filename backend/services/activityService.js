import { User, DailyActivity, Roadmap } from '../models/Schemas.js';

// Configuration for score normalization targets
export const CONFIG = {
  weeklyQuestionTarget: 15,
  weeklyRoadmapTarget: 3,
  weeklyActiveTimeTarget: 60, // minutes
  longestStreakTarget: 100, // days
  totalQuestionsTarget: 500, // questions
  totalActiveTimeTarget: 5000, // minutes
  // Anti-gaming heartbeat controls:
  heartbeatMinIntervalSeconds: 50, // reject a heartbeat if the last one was more recent than this
  heartbeatMaxCreditMinutes: 2,    // never credit more than this per single heartbeat, even after a long gap (e.g. laptop sleep)
  dailyActiveMinutesCap: 240       // hard ceiling on genuineActiveMinutes credited per calendar day
};

// Shift UTC date to IST (UTC +5:30) timezone
export const getISTDate = (date = new Date()) => {
  const utc = date.getTime() + (date.getTimezoneOffset() * 60000);
  return new Date(utc + (3600000 * 5.5));
};

// Formatted IST Date YYYY-MM-DD
export const getISTDateString = (date = new Date()) => {
  const istDate = getISTDate(date);
  const yyyy = istDate.getFullYear();
  const mm = String(istDate.getMonth() + 1).padStart(2, '0');
  const dd = String(istDate.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
};

// Get YYYY-MM-DD date of the Monday of this week in IST
export const getISTMondayOfThisWeek = (date = new Date()) => {
  const istDate = getISTDate(date);
  const day = istDate.getDay();
  // Monday is 1. If Sunday (0), we subtract 6 days. Else subtract (day - 1) days.
  const diff = istDate.getDate() - (day === 0 ? 6 : day - 1);
  const monday = new Date(istDate.setDate(diff));
  
  const yyyy = monday.getFullYear();
  const mm = String(monday.getMonth() + 1).padStart(2, '0');
  const dd = String(monday.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
};

// Format historical relative day string in IST
export const getISTDateOffsetString = (offsetDays) => {
  const date = new Date();
  const utc = date.getTime() + (date.getTimezoneOffset() * 60000);
  const shifted = new Date(utc + (3600000 * 5.5) + (offsetDays * 24 * 60 * 60 * 1000));
  const yyyy = shifted.getFullYear();
  const mm = String(shifted.getMonth() + 1).padStart(2, '0');
  const dd = String(shifted.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
};

/**
 * Log genuine preparation activity for the user.
 * Increments appropriate activity counts for the current day in IST.
 */
export const logGenuineActivity = async (userId, actionType, count = 1, metadata = {}) => {
  const todayStr = getISTDateString();
  
  // Find or create daily activity document
  let activity = await DailyActivity.findOne({ userId, date: todayStr });
  if (!activity) {
    activity = new DailyActivity({ userId, date: todayStr });
  }

  // Increment metrics
  if (actionType === 'question') {
    activity.questionsAttempted += count;
    if (metadata.isUnique) {
      activity.uniqueQuestionsAttempted += count;
    }
    if (metadata.isCorrect) {
      activity.questionsSolved += count;
      activity.correctAnswers += count;
    } else {
      activity.incorrectAnswers += count;
    }
  } else if (actionType === 'roadmap') {
    activity.roadmapTasksCompleted += count;
  } else if (actionType === 'interview') {
    activity.mockInterviewsCompleted += count;
  } else if (actionType === 'resume') {
    activity.resumeActivities += count;
  } else if (actionType === 'heartbeat') {
    // Only processed from heartbeat handler to track active study time
    activity.genuineActiveMinutes += count;
  }

  // Always increment meaningful action count for genuine activity
  activity.meaningfulActions += 1;
  await activity.save();

  // Recalculate streak and competitive prep scores
  await recalculateStreakAndScore(userId);
  return activity;
};

/**
 * Recalculate the user's consistency streak (using IST boundaries) and 
 * compute cached weekly and lifetime competitive Prep Scores.
 */
export const recalculateStreakAndScore = async (userId) => {
  const user = await User.findById(userId);
  if (!user) return;

  // 1. Calculate Streak
  // Fetch all activities with genuine actions
  const activities = await DailyActivity.find({
    userId,
    meaningfulActions: { $gt: 0 }
  }).sort({ date: -1 });

  const activeDates = new Set(activities.map(a => a.date));
  const todayStr = getISTDateString();
  const yesterdayStr = getISTDateOffsetString(-1);

  let currentStreak = 0;
  let streakCheckingDate = null;

  if (activeDates.has(todayStr)) {
    streakCheckingDate = todayStr;
  } else if (activeDates.has(yesterdayStr)) {
    streakCheckingDate = yesterdayStr;
  }

  if (streakCheckingDate) {
    currentStreak = 1;
    let offset = streakCheckingDate === todayStr ? -1 : -2;
    while (true) {
      const checkStr = getISTDateOffsetString(offset);
      if (activeDates.has(checkStr)) {
        currentStreak++;
        offset--;
      } else {
        break;
      }
    }
  }

  user.currentStreak = currentStreak;
  user.longestStreak = Math.max(user.longestStreak || 0, currentStreak);
  user.streakCount = currentStreak; // keep synced with basic field

  // 2. Fetch User Roadmap Completion % dynamically — based on THIS user's own
  //    generated roadmap(s), never a shared/generic one. A user may have generated
  //    roadmaps for multiple company+role combos over time; we use their most
  //    recently updated one as the "active" target, since that reflects what
  //    they're currently focused on. Roadmap size varies (SDE vs PM vs core-branch),
  //    so completion is always computedTasks / thatRoadmap'sOwnTotalTasks — never
  //    a hardcoded constant.
  let roadmapCompletion = 0;
  let targetRoadmap = await Roadmap.findOne({ userId: user._id })
    .sort({ updatedAt: -1 });

  if (targetRoadmap && targetRoadmap.weeks) {
    let totalTasks = 0;
    let completedTasks = 0;
    targetRoadmap.weeks.forEach(w => {
      if (w.topics) {
        w.topics.forEach(t => {
          totalTasks++;
          if (user.completedRoadmapTopics && user.completedRoadmapTopics.includes(t.topicId)) {
            completedTasks++;
          }
        });
      }
    });
    roadmapCompletion = totalTasks > 0 ? (completedTasks / totalTasks) * 100 : 0;
  }

  // 3. Compute Weekly Score (from this Monday in IST)
  const mondayStr = getISTMondayOfThisWeek();

  // --- Rank-movement snapshot ---
  // If this is the user's first recalculation of a NEW IST week (i.e. the
  // week has rolled over since we last snapshotted), capture where they
  // stood — their score and rank — at the moment the previous week ended,
  // before we overwrite weeklyScore with this week's fresh numbers. This is
  // what powers "↑3 / ↓2 / — unchanged" on the leaderboard.
  if (user.weeklyScoreSnapshotWeek !== mondayStr) {
    if (user.weeklyScoreSnapshotWeek) {
      // Only snapshot a "previous" state if we actually had a prior week's
      // score cached (skip this for a brand-new user's very first week).
      let priorRank = null;
      if (user.leaderboardOptIn && user.displayHandle) {
        const higherCount = await User.countDocuments({
          leaderboardOptIn: true,
          displayHandle: { $ne: '' },
          weeklyScore: { $gt: user.weeklyScore || 0 }
        });
        priorRank = higherCount + 1;
      }
      user.previousWeeklyScore = user.weeklyScore || 0;
      user.previousWeeklyRank = priorRank;
    }
    user.weeklyScoreSnapshotWeek = mondayStr;
  }

  const weeklyActivities = await DailyActivity.find({
    userId,
    date: { $gte: mondayStr }
  });

  let weeklyQuestionsAttempted = 0;
  let weeklyUniqueQuestionsAttempted = 0;
  let weeklyCorrectAnswers = 0;
  let weeklyRoadmapTasksCompleted = 0;
  let weeklyActiveMinutes = 0;
  let weeklyActiveDays = 0;

  weeklyActivities.forEach(a => {
    weeklyQuestionsAttempted += a.questionsAttempted || 0;
    weeklyUniqueQuestionsAttempted += a.uniqueQuestionsAttempted || 0;
    weeklyCorrectAnswers += a.correctAnswers || 0;
    weeklyRoadmapTasksCompleted += a.roadmapTasksCompleted || 0;
    weeklyActiveMinutes += a.genuineActiveMinutes || 0;

    const isDayActive = (a.questionsAttempted > 0 || a.roadmapTasksCompleted > 0 || a.mockInterviewsCompleted > 0 || a.resumeActivities > 0 || a.genuineActiveMinutes > 0);
    if (isDayActive) {
      weeklyActiveDays++;
    }
  });

  // Calculate normalized component scores (0 - 100)
  const questionScore = Math.min(weeklyUniqueQuestionsAttempted / CONFIG.weeklyQuestionTarget, 1) * 100;
  const roadmapScore = Math.min(weeklyRoadmapTasksCompleted / CONFIG.weeklyRoadmapTarget, 1) * 100;
  const activeTimeScore = Math.min(weeklyActiveMinutes / CONFIG.weeklyActiveTimeTarget, 1) * 100;
  const consistencyScore = (weeklyActiveDays / 7) * 100;

  // Accuracy Score with Laplace smoothing and scaling for low sample size (< 5 attempts)
  let accuracyScore = 0;
  if (weeklyQuestionsAttempted > 0) {
    accuracyScore = ((weeklyCorrectAnswers + 1) / (weeklyQuestionsAttempted + 2)) * 100;
    if (weeklyQuestionsAttempted < 5) {
      accuracyScore = accuracyScore * (weeklyQuestionsAttempted / 5);
    }
  }

  user.weeklyScore = Math.round(
    (questionScore * 0.30) +
    (roadmapScore * 0.25) +
    (accuracyScore * 0.20) +
    (consistencyScore * 0.15) +
    (activeTimeScore * 0.10)
  );

  // Cache the raw weekly breakdown numbers too (not just the composite
  // score) so achievement badges — "Question Crusher", "Roadmap Finisher" —
  // can be computed cheaply from the User doc without re-aggregating
  // DailyActivity on every leaderboard request.
  user.weeklyQuestionsAttempted = weeklyUniqueQuestionsAttempted;
  user.weeklyRoadmapTasksCompleted = weeklyRoadmapTasksCompleted;

  // 4. Compute All-Time Prep Score (Lifetime metrics)
  const allTimeStreakScore = Math.min((user.longestStreak || 0) / CONFIG.longestStreakTarget, 1) * 100;
  const allTimeQuestionScore = Math.min((user.totalQuestionsAttempted || 0) / CONFIG.totalQuestionsTarget, 1) * 100;
  
  // Aggregate lifetime active minutes from DailyActivity
  const lifetimeTimeAgg = await DailyActivity.aggregate([
    { $match: { userId: user._id } },
    { $group: { _id: null, totalMinutes: { $sum: '$genuineActiveMinutes' } } }
  ]);
  const lifetimeActiveMinutes = lifetimeTimeAgg.length > 0 ? lifetimeTimeAgg[0].totalMinutes : 0;
  const allTimeActiveTimeScore = Math.min(lifetimeActiveMinutes / CONFIG.totalActiveTimeTarget, 1) * 100;

  user.allTimeScore = Math.round(
    (allTimeStreakScore * 0.25) +
    (allTimeQuestionScore * 0.30) +
    (roadmapCompletion * 0.30) +
    (allTimeActiveTimeScore * 0.15)
  );

  user.roadmapCompletionPct = Math.round(roadmapCompletion);
  user.lastActiveDate = new Date();
  await user.save();
};
