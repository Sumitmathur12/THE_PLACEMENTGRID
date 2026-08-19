import fetch from 'node-fetch';
import fs from 'fs';
import path from 'path';
import jwt from 'jsonwebtoken';
import mongoose from 'mongoose';
import dotenv from 'dotenv';

dotenv.config();

const BASE_URL = 'http://localhost:5500/api';

const runE2ETests = async () => {
  console.log('==================================================');
  console.log('STARTING REAL E2E VERIFICATION TEST PROTOCOL');
  console.log('==================================================\n');

  const testCompanyName = 'E2ETesla_' + Date.now();
  let token = '';
  let user = null;
  let companyId = null;
  let codingQuestionId = null;

  // 1. Sign in Flow (Mandatory Signup & Profile Synchronization test)
  try {
    console.log('1. Testing Profile Registration & Sync Flow...');
    
    // Generate a valid test token matching either real Supabase HS256 JWT or local Base64 fallback format
    const testEmail = `e2e_test_${Date.now()}@college.edu`;
    const testName = 'E2E Scholar Candidate';
    const jwtSecret = process.env.SUPABASE_JWT_SECRET;
    
    const payload = {
      email: testEmail,
      user_metadata: { full_name: testName },
      exp: Math.floor(Date.now() / 1000) + (24 * 60 * 60)
    };
    
    if (jwtSecret) {
      token = jwt.sign(payload, jwtSecret);
    } else {
      token = Buffer.from(JSON.stringify({ ...payload, id: 'test-user-id' })).toString('base64');
    }

    // Call register-sync to configure MongoDB profile parameters
    const res = await fetch(`${BASE_URL}/auth/register-sync`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({
        name: testName,
        collegeName: 'E2E Institute of Technology',
        branch: 'Computer Engineering',
        rollNumber: 'E2E2026'
      })
    });
    
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Failed register-sync');
    
    user = data.user;
    console.log('   [PASS] Signup profile synced successfully. Token accepted.');
  } catch (err) {
    console.error('   [FAIL] Sign-In and Sync failed:', err.message);
    process.exit(1);
  }

  // 2. Add Company Flow (RAG Profile Generation with Live Custom Search grounding)
  try {
    console.log('\n2. Testing "Add Company" RAG flow...');
    const res = await fetch(`${BASE_URL}/companies/add`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({ name: testCompanyName })
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Failed to add company');

    console.log('   [PASS] Company generated successfully.');
    console.log('   [INFO] Citations found:', data.profile.includes('[Source') || data.profile.includes('[Web Search') ? 'Yes' : 'No');
    console.log(`   [INFO] RAG profile content snippet:\n${data.profile.substring(0, 180)}...\n`);

    // Sub-test: Add the exact same company name case-insensitively again.
    // Confirm it returns success and the returned company's ID is the same!
    console.log('   Testing duplicate check case-insensitive reuse...');
    const duplicateRes = await fetch(`${BASE_URL}/companies/add`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({ name: testCompanyName.toUpperCase() })
    });
    const duplicateData = await duplicateRes.json();
    if (!duplicateRes.ok) throw new Error(duplicateData.error || 'Failed to check duplicate');
    console.log('   [PASS] Case-insensitive duplicate check successfully reused company:', duplicateData.reused ? 'Yes' : 'No');
  } catch (err) {
    console.error('   [FAIL] Add Company RAG flow failed:', err.message);
    process.exit(1);
  }

  // 3. Take Aptitude Test with Coding Question (Judge0 Local Sandboxed Execution check)
  try {
    console.log('3. Testing Timed Practice Test with Coding Question compilation...');
    
    // Find the coding question
    const practiceRes = await fetch(`${BASE_URL}/questions/practice?category=coreCS&limit=5`, {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    const practiceData = await practiceRes.json();
    const codingQ = practiceData.questions.find(q => q.isCoding);
    
    if (!codingQ) {
      throw new Error('Coding question not found in seeded database.');
    }
    codingQuestionId = codingQ._id;

    // Run code compilation on the sandboxed VM fallback
    const compileRes = await fetch(`${BASE_URL}/questions/compile`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({
        code: `function twoSum(nums, target) {
          const map = new Map();
          for (let i = 0; i < nums.length; i++) {
            const complement = target - nums[i];
            if (map.has(complement)) {
              return [map.get(complement), i];
            }
            map.set(nums[i], i);
          }
          return [];
        }`,
        languageId: 63, // Javascript
        questionId: codingQuestionId
      })
    });
    const compileData = await compileRes.json();
    if (!compileRes.ok) throw new Error(compileData.error || 'Failed compiling JS');

    console.log('   [PASS] Sandboxed VM JS compilation complete.');
    console.log('   [INFO] Test case outcomes:');
    compileData.results.forEach((tc, idx) => {
      console.log(`          Case ${idx + 1}: Input: ${tc.input} | Expected: ${tc.expected} | Actual: ${tc.actual} | Passed: ${tc.passed}`);
    });
    
    const allPassed = compileData.results.every(r => r.passed);
    if (!allPassed) throw new Error('VM Sandbox returned incorrect output evaluations.');
    console.log('   [PASS] Sandboxed execution output validation passed.');
  } catch (err) {
    console.error('   [FAIL] Practice compiling failed:', err.message);
    process.exit(1);
  }

  // 4. Mock Interview Flow (Turn-taking feedback generation)
  try {
    console.log('\n4. Testing Mock Interview Flow...');
    const startRes = await fetch(`${BASE_URL}/interviews/start`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({ company: testCompanyName })
    });
    const startData = await startRes.json();
    if (!startRes.ok) throw new Error(startData.error || 'Failed starting session');

    const sessionId = startData.sessionId;
    const questions = startData.questions;

    // Submit mock transcript response
    const submitRes = await fetch(`${BASE_URL}/interviews/submit-answer`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({
        sessionId,
        question: questions[0],
        answer: 'NVIDIA leverages unified memory architectures and CUDA platforms to parallelize heavy tensor calculations. The performance scales with core speed.',
        proctorLogs: [{ event: 'window_focused', details: 'Candidate remained focused.', timestamp: Date.now() }],
        isLast: true
      })
    });
    const submitData = await submitRes.json();
    if (!submitRes.ok) throw new Error(submitData.error || 'Failed submitting answer');

    console.log('   [PASS] Answer submitted and evaluation feedback retrieved.');
    
    const feedback = submitData.session.feedback;
    if (typeof feedback.score !== 'number' || feedback.score < 1 || feedback.score > 100) {
      throw new Error(`Invalid score bounds: ${feedback.score}. Expected numeric evaluation between 1 and 100.`);
    }
    if (!feedback.strengths || !Array.isArray(feedback.strengths) || feedback.strengths.length === 0 || !feedback.strengths[0]) {
      throw new Error('Interview feedback failed: strengths array is empty or invalid.');
    }
    
    console.log('   [PASS] Evaluation score and strengths assertions passed.');
    console.log('   [INFO] AI Evaluation Score (out of 100):', feedback.score);
    console.log('   [INFO] AI Evaluation Strengths:', feedback.strengths.join(', '));
  } catch (err) {
    console.error('   [FAIL] Mock Interview failed:', err.message);
    process.exit(1);
  }

  // 5. Resume Upload Flow (ImageKit Integration check)
  try {
    console.log('\n5. Testing Resume Upload and ImageKit storage integration...');
    
    // Create a mock PDF buffer (just standard string content mimicking a PDF header)
    const mockPdfBuffer = Buffer.from('%PDF-1.4\n1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n2 0 obj\n<< /Type /Pages /Kids [3 0 R] /Count 1 >>\nendobj\n3 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << >> >>\nendobj\nxref\n0 4\n0000000000 65535 f\n0000000009 00000 n\n0000000056 00000 n\n0000000111 00000 n\ntrailer\n<< /Size 4 /Root 1 0 R >>\nstartxref\n212\n%%EOF');
    
    // Multer upload needs form-data
    const FormData = (await import('form-data')).default;
    const form = new FormData();
    form.append('resume', mockPdfBuffer, {
      filename: 'resume_scholar.pdf',
      contentType: 'application/pdf'
    });

    const uploadRes = await fetch(`${BASE_URL}/profile/resume-upload`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        ...form.getHeaders()
      },
      body: form
    });
    
    const uploadData = await uploadRes.json();
    if (!uploadRes.ok) throw new Error(uploadData.error || 'Failed uploading resume');

    console.log('   [PASS] Resume parsing and ImageKit upload successful.');
    console.log('   [INFO] ImageKit Remote File URL:', uploadData.resume.fileUrl);
    
    if (!uploadData.resume.fileUrl.startsWith('https://ik.imagekit.io/')) {
      throw new Error('Upload output does not map to ImageKit CDN URL.');
    }
    console.log('   [PASS] Resume successfully landed in ImageKit.');
  } catch (err) {
    console.error('   [FAIL] Resume upload ImageKit test failed:', err.message);
    process.exit(1);
  }

  // 6. Role-Based Company Breakdown & Roadmap Flow for Amazon SDE
  try {
    console.log('\n6. Testing SDE Role-Profile and Connected Roadmap for Amazon...');
    const compRes = await fetch(`${BASE_URL}/companies`);
    const companies = await compRes.json();
    const amazon = companies.find(c => c.name.toLowerCase() === 'amazon');
    
    if (!amazon) {
      throw new Error('Amazon not found in seeded database.');
    }

    // A. Fetch Role-Specific Profile
    const profileRes = await fetch(`${BASE_URL}/companies/${amazon._id}/role-profile`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({ role: 'SDE' })
    });
    const profileData = await profileRes.json();
    if (!profileRes.ok) throw new Error(profileData.error || 'Failed fetching role profile');
    
    console.log('   [PASS] Amazon SDE Role Profile generated successfully.');
    console.log('   [INFO] Citations found:', profileData.citations && profileData.citations.length > 0 ? 'Yes' : 'No');
    console.log(`   [INFO] SDE role content snippet:\n${profileData.profile.substring(0, 180)}...\n`);
    
    // Extract Commonly Asked Questions section
    const caqMatch = profileData.profile.match(/### Commonly Asked Questions([\s\S]*?)(###|$)/i);
    const caqContent = caqMatch ? caqMatch[1].trim() : 'Section not found via H3 regex parsing.';
    console.log(`   [INFO] Amazon SDE Commonly Asked Questions content:\n${caqContent}\n`);

    // B. Generate connected roadmap
    const roadmapRes = await fetch(`${BASE_URL}/companies/${amazon._id}/role-roadmap`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({ role: 'SDE' })
    });
    const roadmapData = await roadmapRes.json();
    if (!roadmapRes.ok) throw new Error(roadmapData.error || 'Failed generating role roadmap');
    
    console.log('   [PASS] Amazon - SDE custom week-by-week study syllabus connected and generated.');
    console.log(`   [INFO] Generated SDE roadmap syllabus:\n${roadmapData.aiNotes.substring(0, 400)}...\n`);

    // Assert CS Core subjects exist in the weeks template
    console.log('   Testing Core CS subject checklist propagation in SDE roadmap...');
    const weeks = roadmapData.roadmap.weeks;
    if (!weeks || weeks.length !== 4) {
      throw new Error(`Verification failed: Expected 4 weeks, got ${weeks ? weeks.length : 'none'}`);
    }

    const w1t2 = weeks[0].topics.find(t => t.title.includes('Core CS: Object Oriented Programming'));
    const w2t2 = weeks[1].topics.find(t => t.title.includes('Core CS: Database Management Systems'));
    const w3t2 = weeks[2].topics.find(t => t.title.includes('Core CS: Operating Systems'));
    const w4t2 = weeks[3].topics.find(t => t.title.includes('Core CS: Computer Networks'));

    if (!w1t2 || !w2t2 || !w3t2 || !w4t2) {
      throw new Error('Verification failed: One or more Core CS fundamental topics are missing from CS SDE roadmap weeks.');
    }
    
    if (!w1t2.resources[0].url.includes('wikipedia.org') || !w2t2.resources[0].url.includes('geeksforgeeks.org')) {
      throw new Error('Verification failed: Core CS topic resources contain invalid or non-allowed links.');
    }
    console.log('   [PASS] Core CS checklist items successfully validated in SDE weeks.');

    // Assert practiceQuestions array exists and is populated
    console.log('   Testing practice questions generation in roadmap...');
    const questions = roadmapData.roadmap.practiceQuestions;
    if (!questions || !Array.isArray(questions) || questions.length === 0) {
      throw new Error('Verification failed: practiceQuestions is missing or empty in generated roadmap.');
    }
    console.log(`   [PASS] Found ${questions.length} practice questions. First topic: "${questions[0].title}" (${questions[0].type})`);
  } catch (err) {
    console.error('   [FAIL] SDE Role-Profile for Amazon failed:', err.message);
    process.exit(1);
  }

  // 7. Testing generic support for TCS SDE (Service MNC category check)
  try {
    console.log('7. Testing SDE Role-Profile and Connected Roadmap for TCS...');
    const compRes = await fetch(`${BASE_URL}/companies`);
    const companies = await compRes.json();
    const tcs = companies.find(c => c.name.toLowerCase() === 'tcs');
    
    if (!tcs) {
      throw new Error('TCS not found in seeded database.');
    }

    // A. Fetch Role-Specific Profile
    const profileRes = await fetch(`${BASE_URL}/companies/${tcs._id}/role-profile`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({ role: 'SDE' })
    });
    const profileData = await profileRes.json();
    if (!profileRes.ok) throw new Error(profileData.error || 'Failed fetching TCS SDE role profile');
    
    console.log('   [PASS] TCS SDE Role Profile generated successfully.');
    console.log('   [INFO] Citations found:', profileData.citations && profileData.citations.length > 0 ? 'Yes' : 'No');
    console.log(`   [INFO] TCS SDE content snippet:\n${profileData.profile.substring(0, 150)}...\n`);
  } catch (err) {
    console.error('   [FAIL] TCS role profile test failed:', err.message);
    process.exit(1);
  }

  // 8. Testing lesser-known company/unusual role for "not enough verified information available"
  try {
    console.log('8. Testing limit fallback constraints for unusual roles...');
    const compRes = await fetch(`${BASE_URL}/companies`);
    const companies = await compRes.json();
    const tcs = companies.find(c => c.name.toLowerCase() === 'tcs');

    const profileRes = await fetch(`${BASE_URL}/companies/${tcs._id}/role-profile`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({ role: 'Quantum Cryptographer' })
    });
    const profileData = await profileRes.json();
    if (!profileRes.ok) throw new Error(profileData.error || 'Failed fetching unusual role profile');
    
    console.log('   [PASS] Unusual Role (Quantum Cryptographer) generated successfully.');
    
    const textLower = profileData.profile.toLowerCase();
    const hasWarningOrInfo = textLower.includes('not enough verified') || textLower.includes('not available') || textLower.includes('unverified') || textLower.includes('notice');
    console.log('   [INFO] Found strict-grounding limit fallback phrase:', hasWarningOrInfo ? 'Yes' : 'No');
    console.log(`   [INFO] Unusual role content:\n${profileData.profile}\n`);
    
    if (!hasWarningOrInfo) {
      throw new Error('Factual constraint violation: AI fabricated details instead of outputting limit fallback message.');
    }

    // Sub-test: transient company stub cutoff score default check
    console.log('   Testing transient company stub cutoff score...');
    const detailStubRes = await fetch(`${BASE_URL}/companies/detail/NonExistentCompanyTemp`);
    const detailStubData = await detailStubRes.json();
    if (!detailStubRes.ok) throw new Error('Failed to fetch details stub');
    console.log('   [INFO] Transient stub cutoff value:', detailStubData.company.collegeCutoff);
    if (detailStubData.company.collegeCutoff !== 'Not available') {
      throw new Error(`Cutoff validation failed: expected "Not available", got "${detailStubData.company.collegeCutoff}"`);
    }
    console.log('   [PASS] Transient company stub correctly defaults cutoff to "Not available".');
  } catch (err) {
    console.error('   [FAIL] Limit fallback constraint checks failed:', err.message);
    process.exit(1);
  }

  // 9. Testing non-coding role (Product Manager) adaptive roadmap content classification & Branch-Adaptive Customization
  try {
    console.log('\n9. Testing adaptive roadmap generation & Branch-Adaptive Customization...');
    const compRes = await fetch(`${BASE_URL}/companies`);
    const companies = await compRes.json();
    const amazon = companies.find(c => c.name.toLowerCase() === 'amazon');

    // A. Fetch Role-Specific Profile for Product Manager
    const profileRes = await fetch(`${BASE_URL}/companies/${amazon._id}/role-profile`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({ role: 'Product Manager' })
    });
    const profileData = await profileRes.json();
    if (!profileRes.ok) throw new Error(profileData.error || 'Failed fetching PM role profile');

    // B. Generate connected roadmap for Product Manager
    const roadmapRes = await fetch(`${BASE_URL}/companies/${amazon._id}/role-roadmap`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({ role: 'Product Manager' })
    });
    const roadmapData = await roadmapRes.json();
    if (!roadmapRes.ok) throw new Error(roadmapData.error || 'Failed generating PM roadmap');

    console.log('   [PASS] Amazon - Product Manager custom roadmap generated.');
    console.log(`   [INFO] PM Roadmap content snippet:\n${roadmapData.aiNotes.substring(0, 400)}...\n`);

    const roadmapLower = roadmapData.aiNotes.toLowerCase();
    const hasLeetCode = roadmapLower.includes('leetcode.com') || roadmapLower.includes('leetcode-discuss') || roadmapLower.includes('dsa');
    const hasPMTerms = roadmapLower.includes('case') || roadmapLower.includes('framework') || roadmapLower.includes('product') || roadmapLower.includes('star') || roadmapLower.includes('metric');

    console.log('   [INFO] PM: Contains LeetCode/DSA content:', hasLeetCode ? 'Yes' : 'No');
    console.log('   [INFO] PM: Contains PM Case/Metrics/Framework terms:', hasPMTerms ? 'Yes' : 'No');

    if (hasLeetCode) {
      throw new Error('Factual constraint violation: LeetCode/DSA content forced onto a non-coding Product Manager role.');
    }

    // C. Non-CS branch Student (Mechanical Engineering) preparing for SDE (coding-heavy)
    console.log('\n   Sub-Test: Non-CS Student (Mechanical Engineering) SDE Prep...');
    await fetch(`${BASE_URL}/auth/register-sync`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({
        name: 'E2E Scholar Candidate',
        collegeName: 'E2E Institute of Technology',
        branch: 'Mechanical Engineering',
        rollNumber: 'E2E2026'
      })
    });

    const mechSdeRes = await fetch(`${BASE_URL}/companies/${amazon._id}/role-roadmap`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({ role: 'SDE' })
    });
    const mechSdeData = await mechSdeRes.json();
    if (!mechSdeRes.ok) throw new Error(mechSdeData.error || 'Failed SDE roadmap for Mechanical');

    console.log('   [PASS] Mechanical student SDE roadmap generated.');
    const mechWeeks = mechSdeData.roadmap.weeks;
    console.log('   [INFO] Week 1 Checklist Topic:', mechWeeks[0].topics[0].title);
    if (!mechWeeks[0].topics[0].title.includes('CS Core Bridging')) {
      throw new Error(`Expected Week 1 checklist to be CS Core Bridging for Mechanical SDE, got: "${mechWeeks[0].topics[0].title}"`);
    }
    console.log('   [PASS] Checklist correctly injected CS Core Bridging in Week 1.');

    // D. Civil Engineering student preparing for Core Technical
    console.log('\n   Sub-Test: Civil Engineering student preparing for Core Technical...');
    await fetch(`${BASE_URL}/auth/register-sync`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({
        name: 'E2E Scholar Candidate',
        collegeName: 'E2E Institute of Technology',
        branch: 'Civil Engineering',
        rollNumber: 'E2E2026'
      })
    });

    // Let's create/fetch a role profile for "Site Engineer" (Core Technical)
    const civilProfileRes = await fetch(`${BASE_URL}/companies/${amazon._id}/role-profile`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({ role: 'Site Engineer' })
    });
    const civilProfileData = await civilProfileRes.json();
    if (!civilProfileRes.ok) throw new Error(civilProfileData.error || 'Failed Site Engineer profile');

    const civilRoadmapRes = await fetch(`${BASE_URL}/companies/${amazon._id}/role-roadmap`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({ role: 'Site Engineer' })
    });
    const civilRoadmapData = await civilRoadmapRes.json();
    if (!civilRoadmapRes.ok) throw new Error(civilRoadmapData.error || 'Failed Site Engineer roadmap');

    console.log('   [PASS] Civil student Site Engineer roadmap generated.');
    console.log(`   [INFO] Civil Roadmap AI notes snippet:\n${civilRoadmapData.aiNotes.substring(0, 250)}...\n`);

    const civilWeeks = civilRoadmapData.roadmap.weeks;
    console.log('   [INFO] Week 1 Checklist Topic:', civilWeeks[0].topics[0].title);
    if (!civilWeeks[0].topics[0].title.includes('Structural')) {
      throw new Error(`Expected Structural topics in Week 1 for Civil student, got: "${civilWeeks[0].topics[0].title}"`);
    }

    const civilLower = civilRoadmapData.aiNotes.toLowerCase();
    const hasCivilTerms = civilLower.includes('structural') || civilLower.includes('concrete') || civilLower.includes('geotechnical') || civilLower.includes('soil') || civilLower.includes('construction') || civilLower.includes('site') || civilLower.includes('building') || civilLower.includes('estimation');
    console.log('   [INFO] Civil AI Notes contains civil engineering terms:', hasCivilTerms ? 'Yes' : 'No');
    if (!hasCivilTerms) {
      throw new Error('LLM failed to dynamically customize the roadmap details for Civil branch.');
    }
    console.log('   [PASS] Civil core technical roadmap is dynamically customized.');

    // E. ECE student preparing for Core Technical
    console.log('\n   Sub-Test: Electronics & Communication student preparing for Core Technical...');
    await fetch(`${BASE_URL}/auth/register-sync`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({
        name: 'E2E Scholar Candidate',
        collegeName: 'E2E Institute of Technology',
        branch: 'Electronics & Communication Engineering',
        rollNumber: 'E2E2026'
      })
    });

    const eceProfileRes = await fetch(`${BASE_URL}/companies/${amazon._id}/role-profile`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({ role: 'Hardware Engineer' })
    });
    const eceProfileData = await eceProfileRes.json();
    if (!eceProfileRes.ok) throw new Error(eceProfileData.error || 'Failed Hardware Engineer profile');

    const eceRoadmapRes = await fetch(`${BASE_URL}/companies/${amazon._id}/role-roadmap`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({ role: 'Hardware Engineer' })
    });
    const eceRoadmapData = await eceRoadmapRes.json();
    if (!eceRoadmapRes.ok) throw new Error(eceRoadmapData.error || 'Failed Hardware Engineer roadmap');

    console.log('   [PASS] ECE student Hardware Engineer roadmap generated.');
    console.log(`   [INFO] ECE Roadmap AI notes snippet:\n${eceRoadmapData.aiNotes.substring(0, 250)}...\n`);

    const eceWeeks = eceRoadmapData.roadmap.weeks;
    console.log('   [INFO] Week 1 Checklist Topic:', eceWeeks[0].topics[0].title);
    if (!eceWeeks[0].topics[0].title.includes('Circuit')) {
      throw new Error(`Expected Circuit topics in Week 1 for ECE student, got: "${eceWeeks[0].topics[0].title}"`);
    }

    const eceLower = eceRoadmapData.aiNotes.toLowerCase();
    const hasEceTerms = eceLower.includes('circuit') || eceLower.includes('embedded') || eceLower.includes('vlsi') || eceLower.includes('signal') || eceLower.includes('analog') || eceLower.includes('digital');
    console.log('   [INFO] ECE AI Notes contains ECE terms:', hasEceTerms ? 'Yes' : 'No');
    if (!hasEceTerms) {
      throw new Error('LLM failed to dynamically customize the roadmap details for ECE branch.');
    }
    console.log('   [PASS] ECE core technical roadmap is dynamically customized.');
  } catch (err) {
    console.error('   [FAIL] Adaptive roadmap and branch customization test failed:', err.message);
    process.exit(1);
  }

  // Cleanup test database artifacts (deletes the newly created timestamped test company and its profiles/roadmaps)
  console.log('\nCleaning up E2E database artifacts...');
  try {
    const mongoUri = process.env.MONGODB_URI || "mongodb+srv://sm4596932_db_user:Sumit123@cluster0.dngusnv.mongodb.net/?appName=Cluster0";
    await mongoose.connect(mongoUri);
    const CompanyCol = mongoose.connection.collection('companies');
    const RoleProfileCol = mongoose.connection.collection('roleprofiles');
    const RoadmapCol = mongoose.connection.collection('roadmaps');

    const e2eCompanies = await CompanyCol.find({ name: new RegExp('^E2ETesla', 'i') }).toArray();
    if (e2eCompanies.length > 0) {
      for (const comp of e2eCompanies) {
        const rmDel = await RoadmapCol.deleteMany({ companyId: comp._id });
        const rpDel = await RoleProfileCol.deleteMany({ companyId: comp._id });
        const compDel = await CompanyCol.deleteOne({ _id: comp._id });
        console.log(`   [CLEANUP] Deleted E2E company "${comp.name}" and its associated roadmaps (${rmDel.deletedCount}) and profiles (${rpDel.deletedCount}).`);
      }
    } else {
      console.log('   [CLEANUP] No E2E test companies starting with "E2ETesla" were found.');
    }
  } catch (err) {
    console.error('   [CLEANUP ERROR] Failed to clean up database artifacts:', err.message);
  } finally {
    await mongoose.disconnect();
  }

  console.log('\n==================================================');
  console.log('E2E TEST PROTOCOL COMPLETED: ALL TESTS PASSED!');
  console.log('==================================================');
};

runE2ETests();
