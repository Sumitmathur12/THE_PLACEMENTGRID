import fetch from 'node-fetch';
const email = 'user_check@placementgrid.com';
const token = Buffer.from(JSON.stringify({ email })).toString('base64');

console.log('Testing new wizard /start endpoint...');
const res = await fetch('http://localhost:5500/api/interviews/start', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': 'Bearer ' + token
  },
  body: JSON.stringify({
    jobTitle: 'Frontend Developer Intern',
    company: 'JTG',
    jobDescription: 'Looking for a frontend developer intern with skills in javascript, css, html, react, and basic web fundamentals.',
    experienceLevel: 'entry',
    questionTypes: ['technical', 'behavioral'],
    numberOfQuestions: 5
  })
});

const data = await res.json();
if (!res.ok) {
  console.error('FAIL:', data);
  process.exit(1);
}

console.log('SUCCESS! Generated', data.questions.length, 'questions for', data.jobTitle, 'at', 'JTG');
data.questions.forEach((q, i) => {
  console.log(` Q${i+1} [${q.category}/${q.difficulty}]: "${q.questionText}"`);
});
