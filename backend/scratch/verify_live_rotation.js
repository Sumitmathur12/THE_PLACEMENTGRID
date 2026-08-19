import fetch from 'node-fetch';
import mongoose from 'mongoose';

const signToken = (email) => {
  return Buffer.from(JSON.stringify({ email, id: 'test-user-rotation-id', exp: Date.now() + 24 * 60 * 60 * 1000 })).toString('base64');
};

const runVerification = async () => {
  const email = 'rotation_live_test@college.edu';
  
  console.log('Cleaning up user record from DB first...');
  const mongoUri = process.env.MONGODB_URI || "mongodb+srv://sm4596932_db_user:Sumit123@cluster0.dngusnv.mongodb.net/?appName=Cluster0";
  await mongoose.connect(mongoUri);
  await mongoose.connection.collection('users').deleteOne({ email });
  await mongoose.disconnect();

  const token = signToken(email);
  const headers = {
    'Authorization': `Bearer ${token}`,
    'Content-Type': 'application/json'
  };

  console.log('Live Rotation Verification: Initializing live HTTP requests to backend...');
  const baseUrl = 'http://localhost:5500/api/questions';

  // Session 1: Fetch
  console.log('\n--- FETCHING SESSION 1 ---');
  const res1 = await fetch(`${baseUrl}/practice?category=quant`, { headers });
  if (!res1.ok) {
    const text = await res1.text();
    throw new Error(`Session 1 fetch failed: ${res1.status} - ${text}`);
  }
  const data1 = await res1.json();
  const q1 = data1.questions;
  const ids1 = q1.map(q => q._id);
  console.log('Session 1 IDs:', ids1);

  // Submit Session 1
  console.log('Submitting Session 1...');
  const sub1 = await fetch(`${baseUrl}/submit`, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      category: 'quant',
      timeTaken: 120,
      answers: q1.map(q => ({ questionId: q._id, selectedIndex: q.correctIndex }))
    })
  });
  if (!sub1.ok) throw new Error('Session 1 submission failed');
  console.log('Session 1 registered.');

  // Session 2: Fetch
  console.log('\n--- FETCHING SESSION 2 ---');
  const res2 = await fetch(`${baseUrl}/practice?category=quant`, { headers });
  if (!res2.ok) throw new Error('Session 2 fetch failed');
  const data2 = await res2.json();
  const q2 = data2.questions;
  const ids2 = q2.map(q => q._id);
  console.log('Session 2 IDs:', ids2);

  // Submit Session 2
  console.log('Submitting Session 2...');
  const sub2 = await fetch(`${baseUrl}/submit`, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      category: 'quant',
      timeTaken: 130,
      answers: q2.map(q => ({ questionId: q._id, selectedIndex: q.correctIndex }))
    })
  });
  if (!sub2.ok) throw new Error('Session 2 submission failed');
  console.log('Session 2 registered.');

  // Session 3: Fetch
  console.log('\n--- FETCHING SESSION 3 ---');
  const res3 = await fetch(`${baseUrl}/practice?category=quant`, { headers });
  if (!res3.ok) throw new Error('Session 3 fetch failed');
  const data3 = await res3.json();
  const q3 = data3.questions;
  const ids3 = q3.map(q => q._id);
  console.log('Session 3 IDs:', ids3);

  // Overlap checks
  const overlap1_2 = ids1.filter(id => ids2.includes(id));
  const overlap2_3 = ids2.filter(id => ids3.includes(id));
  const overlap1_3 = ids1.filter(id => ids3.includes(id));

  console.log('\n==================================================');
  console.log('LIVE ROTATION VERIFICATION REPORT');
  console.log('==================================================');
  console.log('Session 1 IDs:', JSON.stringify(ids1, null, 2));
  console.log('Session 2 IDs:', JSON.stringify(ids2, null, 2));
  console.log('Session 3 IDs:', JSON.stringify(ids3, null, 2));
  console.log('Overlap S1 & S2:', overlap1_2);
  console.log('Overlap S2 & S3:', overlap2_3);
  console.log('Overlap S1 & S3:', overlap1_3);
  
  if (overlap1_2.length === 0 && overlap2_3.length === 0 && overlap1_3.length === 0) {
    console.log('\n[PASS] Absolutely zero question overlap across 3 consecutive practice tests! Live rotation is verified 100% active.');
  } else {
    console.log('\n[FAIL] Question repetition detected! Overlaps exist.');
  }
  console.log('==================================================\n');
};

runVerification().catch(err => {
  console.error('Error running verification:', err);
  process.exit(1);
});
