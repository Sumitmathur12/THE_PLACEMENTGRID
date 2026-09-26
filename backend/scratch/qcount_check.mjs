import fetch from 'node-fetch';
const email = 'verify_e2e@placementgrid.com';
const token = Buffer.from(JSON.stringify({ email })).toString('base64');
const res = await fetch('http://localhost:5500/api/interviews/start', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + token },
  body: JSON.stringify({ company: 'Google' })
});
const data = await res.json();
if (!res.ok) { console.error('FAIL:', data.error); process.exit(1); }
console.log('Session ID:', data.sessionId);
console.log('Question Count:', data.questions.length, '(expected 5)');
data.questions.forEach((q, i) => console.log(`Q${i+1} [${q.category}/${q.difficulty}]: "${q.questionText.substring(0,90)}..."`));
process.exit(data.questions.length === 5 ? 0 : 1);
