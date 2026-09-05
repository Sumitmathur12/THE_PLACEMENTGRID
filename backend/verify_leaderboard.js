import fetch from "node-fetch";
import jwt from "jsonwebtoken";
import mongoose from "mongoose";
import dotenv from "dotenv";

dotenv.config();

const BASE_URL = "http://localhost:5500/api";

// Small helper — creates a fresh signed-up test user and returns { token, name }
const makeTestUser = async (label) => {
  const testEmail = `verifylb_${label}_${Date.now()}@college.edu`;
  const testName = `VerifyLB ${label}`;
  const jwtSecret = process.env.SUPABASE_JWT_SECRET;
  const payload = {
    email: testEmail,
    user_metadata: { full_name: testName },
    exp: Math.floor(Date.now() / 1000) + 24 * 60 * 60,
  };
  const token = jwtSecret
    ? jwt.sign(payload, jwtSecret)
    : Buffer.from(JSON.stringify({ ...payload, id: `test-${label}` })).toString(
        "base64",
      );

  const res = await fetch(`${BASE_URL}/auth/register-sync`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({
      name: testName,
      collegeName: "VerifyLB Institute",
      branch: "Computer Engineering",
      rollNumber: `VLB-${label}-${Date.now()}`,
    }),
  });
  if (!res.ok) {
    const data = await res.json();
    throw new Error(`Failed to create test user ${label}: ${data.error}`);
  }
  return { token, email: testEmail, name: testName };
};

const authedGet = (url, token) =>
  fetch(url, { headers: { Authorization: `Bearer ${token}` } }).then((r) =>
    r.json(),
  );

const authedPost = (url, token, body) =>
  fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(body),
  }).then(async (r) => ({ ok: r.ok, data: await r.json() }));

let passed = 0;
let failed = 0;
const check = (label, condition) => {
  if (condition) {
    console.log(`  [PASS] ${label}`);
    passed++;
  } else {
    console.log(`  [FAIL] ${label}`);
    failed++;
  }
};

const run = async () => {
  console.log("==================================================");
  console.log("PEER CHALLENGE LEADERBOARD — VERIFICATION SUITE");
  console.log("==================================================\n");

  // ------------------------------------------------------------------
  // Test 1: New user has zero activity
  // ------------------------------------------------------------------
  console.log("1. New user has zero activity...");
  const userA = await makeTestUser("A");
  const statsA0 = await authedGet(
    `${BASE_URL}/experiences/my-stats`,
    userA.token,
  );
  check("currentStreak is 0 for a brand-new user", statsA0.currentStreak === 0);
  check("weeklyScore is 0 for a brand-new user", statsA0.weeklyScore === 0);
  check(
    "leaderboardOptIn defaults to false",
    statsA0.leaderboardOptIn === false,
  );

  // ------------------------------------------------------------------
  // Test 2: Login alone does not increase streak
  // (register-sync above already simulates a "login" — confirm streak still 0)
  // ------------------------------------------------------------------
  console.log("\n2. Login/signup alone does not count as activity...");
  check(
    "Streak remains 0 after signup with no other action",
    statsA0.currentStreak === 0,
  );

  // ------------------------------------------------------------------
  // Test 3: Cannot opt into leaderboard without a display handle
  // ------------------------------------------------------------------
  console.log("\n3. Opt-in requires a display handle first...");
  const badOptIn = await authedPost(
    `${BASE_URL}/auth/leaderboard-settings`,
    userA.token,
    {
      leaderboardOptIn: true,
    },
  );
  check("Rejects opt-in with no handle set", badOptIn.ok === false);

  // ------------------------------------------------------------------
  // Test 4: Setting a handle + opting in succeeds
  // ------------------------------------------------------------------
  console.log("\n4. Setting a handle and opting in...");
  const handleA = `TestHandleA${Date.now()}`.slice(0, 24);
  const optInRes = await authedPost(
    `${BASE_URL}/auth/leaderboard-settings`,
    userA.token,
    {
      displayHandle: handleA,
      leaderboardOptIn: true,
    },
  );
  check("Opt-in succeeds once a handle is provided", optInRes.ok === true);
  check(
    "Returned displayHandle matches what was set",
    optInRes.data.displayHandle === handleA,
  );

  // ------------------------------------------------------------------
  // Test 5: Real name/email never appear in the public leaderboard response
  // ------------------------------------------------------------------
  console.log("\n5. Privacy — no real name/email in leaderboard response...");
  const lbRaw = await fetch(
    `${BASE_URL}/experiences/leaderboard?scope=global&period=weekly&limit=50`,
  ).then((r) => r.text());
  check(
    "Response does not contain the test user's real name",
    !lbRaw.includes(userA.name),
  );
  check(
    "Response does not contain the test user's email",
    !lbRaw.includes(userA.email),
  );

  // ------------------------------------------------------------------
  // Test 6: Opted-out users do not appear on the public leaderboard
  // ------------------------------------------------------------------
  console.log(
    "\n6. Opted-out users are excluded from the public leaderboard...",
  );
  const userB = await makeTestUser("B");
  const handleB = `TestHandleB${Date.now()}`.slice(0, 24);
  // Set a handle but deliberately do NOT opt in
  await authedPost(`${BASE_URL}/auth/leaderboard-settings`, userB.token, {
    displayHandle: handleB,
  });
  const lbAfterB = await fetch(
    `${BASE_URL}/experiences/leaderboard?scope=global&period=weekly&limit=50`,
  ).then((r) => r.json());
  const foundB = lbAfterB.leaderboard.find((e) => e.displayHandle === handleB);
  check("Non-opted-in user does not appear in leaderboard results", !foundB);

  // ------------------------------------------------------------------
  // Test 7: Heartbeat anti-spam — a second rapid call credits 0 minutes
  // ------------------------------------------------------------------
  console.log("\n7. Heartbeat rate-limiting (anti-gaming)...");
  const hb1 = await authedPost(`${BASE_URL}/auth/heartbeat`, userA.token, {});
  const hb2 = await authedPost(`${BASE_URL}/auth/heartbeat`, userA.token, {}); // fired immediately after
  check("First heartbeat call succeeds", hb1.ok === true);
  check(
    "Immediate second heartbeat call is credited 0 (rate-limited)",
    hb2.data.credited === 0,
  );

  // ------------------------------------------------------------------
  // Test 8: My-stats works and reflects opted-in state
  // ------------------------------------------------------------------
  console.log("\n8. My-stats reflects current opt-in/handle state...");
  const statsA1 = await authedGet(
    `${BASE_URL}/experiences/my-stats`,
    userA.token,
  );
  check(
    "my-stats shows leaderboardOptIn true after opting in",
    statsA1.leaderboardOptIn === true,
  );
  check(
    "my-stats shows the chosen displayHandle",
    statsA1.displayHandle === handleA,
  );

  // ------------------------------------------------------------------
  // Test 9: Leave leaderboard removes user from public results but keeps stats
  // ------------------------------------------------------------------
  console.log(
    "\n9. Leaving the leaderboard removes public visibility, keeps private stats...",
  );
  await authedPost(`${BASE_URL}/auth/leaderboard-settings`, userA.token, {
    leaderboardOptIn: false,
  });
  const lbAfterLeave = await fetch(
    `${BASE_URL}/experiences/leaderboard?scope=global&period=weekly&limit=50`,
  ).then((r) => r.json());
  const stillFoundA = lbAfterLeave.leaderboard.find(
    (e) => e.displayHandle === handleA,
  );
  check(
    "User no longer appears in public leaderboard after opting out",
    !stillFoundA,
  );
  const statsA2 = await authedGet(
    `${BASE_URL}/experiences/my-stats`,
    userA.token,
  );
  check(
    "Private stats (streak/score) are still tracked after opting out",
    typeof statsA2.currentStreak === "number",
  );

  // ------------------------------------------------------------------
  // Test 10: scope=target requires a company param
  // ------------------------------------------------------------------
  console.log("\n10. scope=target requires an explicit company filter...");
  const targetNoCompany = await fetch(
    `${BASE_URL}/experiences/leaderboard?scope=target`,
  );
  check(
    "Rejects scope=target without a company param",
    targetNoCompany.status === 400,
  );

  // ------------------------------------------------------------------
  // Test 11: Pagination works
  // ------------------------------------------------------------------
  console.log("\n11. Pagination returns consistent metadata...");
  const page1 = await fetch(
    `${BASE_URL}/experiences/leaderboard?scope=global&period=weekly&page=1&limit=1`,
  ).then((r) => r.json());
  check("limit=1 returns at most 1 entry", page1.leaderboard.length <= 1);
  check(
    "totalPages is present and numeric",
    typeof page1.totalPages === "number",
  );

  // ------------------------------------------------------------------
  console.log("\n==================================================");
  console.log(`RESULTS: ${passed} passed, ${failed} failed`);
  console.log("==================================================");

  // Cleanup: remove test users from MongoDB so this script can be re-run
  // safely without polluting the database.
  try {
    const mongoUri = process.env.MONGODB_URI;
    if (mongoUri) {
      await mongoose.connect(mongoUri);
      const User = mongoose.connection.collection("users");
      const delResult = await User.deleteMany({
        email: { $regex: "^verifylb_" },
      });
      console.log(`[CLEANUP] Removed ${delResult.deletedCount} test user(s).`);
      await mongoose.disconnect();
    }
  } catch (cleanupErr) {
    console.warn("Cleanup skipped:", cleanupErr.message);
  }

  process.exit(failed > 0 ? 1 : 0);
};

run().catch((err) => {
  console.error("Test suite crashed:", err);
  process.exit(1);
});
