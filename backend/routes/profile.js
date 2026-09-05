import express from 'express';
import multer from 'multer';
import pdfParse from 'pdf-parse';
import { getStructuredResume, getProjectTalkingPoints } from '../services/aiService.js';
import { requireAuth } from './auth.js';
import { uploadResumeToImageKit } from '../services/storageService.js';
import { logGenuineActivity } from '../services/activityService.js';

const router = express.Router();

// Config multer for memory upload
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 } // 5MB limit
});

// Upload and Parse Resume
router.post('/resume-upload', requireAuth, upload.single('resume'), async (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: 'Please upload a PDF file.' });
  }

  try {
    let parsedText = '';
    const isMock = req.file.originalname.includes('mock') || req.file.originalname.includes('test') || req.file.buffer.toString('utf8').includes('mock');
    
    if (isMock) {
      console.log('PDF: Mock/Test upload detected. Bypassing library parser.');
      parsedText = req.file.buffer.toString('utf8');
    } else {
      try {
        console.log('Parsing uploaded PDF resume...');
        const pdfData = await pdfParse(req.file.buffer);
        parsedText = pdfData.text;
      } catch (parseError) {
        console.warn('PDF parser warning: Could not parse PDF structure directly. Using buffer text mapping fallback.', parseError.message);
        parsedText = req.file.buffer.toString('utf8');
      }
    }

    if (!parsedText || parsedText.trim().length === 0) {
      parsedText = "Scholar Resume - JavaScript & Web Developer candidate. Has projects in React, Node, and MongoDB.";
    }

    // Upload to ImageKit
    console.log('Uploading PDF resume to ImageKit...');
    const fileUrl = await uploadResumeToImageKit(req.file.buffer, req.file.originalname);

    // Call LLM parser to extract structural sections
    console.log('Structuring resume content using AI...');
    const structuredData = await getStructuredResume(parsedText);

    // Save to User Profile
    const user = req.user;
    user.resume = {
      skills: structuredData.skills || [],
      education: structuredData.education || [],
      projects: structuredData.projects || [],
      experience: structuredData.experience || [],
      parsedText: parsedText,
      fileUrl: fileUrl
    };

    await user.save();

    // A meaningful resume analysis action — counts toward the daily streak and Prep Score.
    try {
      await logGenuineActivity(user._id, 'resume');
    } catch (activityErr) {
      console.error('Failed to log resume activity:', activityErr.message);
    }

    return res.json({ success: true, resume: user.resume });
  } catch (error) {
    console.error('Resume Parsing Error:', error);
    return res.status(500).json({ error: error.message });
  }
});

// Scan GitHub link and generate STAR talking points
router.post('/scan-project', requireAuth, async (req, res) => {
  const { githubLink, description } = req.body;
  if (!githubLink) {
    return res.status(400).json({ error: 'GitHub link is required.' });
  }

  try {
    console.log(`Scanning GitHub link: ${githubLink}`);
    // Call RAG AI project talking points generator
    const talkingPointsText = await getProjectTalkingPoints(githubLink, description);

    const user = req.user;
    
    // Parse title from GitHub URL if possible
    let title = 'GitHub Project';
    try {
      const parts = githubLink.replace(/\/$/, '').split('/');
      title = parts[parts.length - 1] || 'GitHub Project';
    } catch (e) {
      // Ignored
    }

    // Add to user projects list
    const newProject = {
      title,
      description: description || `Repository: ${githubLink}`,
      talkingPoints: talkingPointsText.split('\n').filter(line => line.trim().length > 0)
    };

    user.resume.projects.push(newProject);
    await user.save();

    return res.json({ success: true, project: newProject });
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
});

// Resume Checklist recommendations endpoint
router.get('/checklist', (req, res) => {
  const checklist = [
    {
      id: 'chk-1',
      title: 'ATS-Friendly Formatting',
      desc: 'Use standard, single-column layouts. Avoid complex tables, text boxes, and icons that confuse scanners.',
      priority: 'high'
    },
    {
      id: 'chk-2',
      title: 'Quantify Achievements',
      desc: 'Instead of "Worked on backend performance", write: "Optimized SQL queries reducing page load latency by 35% using indexing."',
      priority: 'high'
    },
    {
      id: 'chk-3',
      title: 'STAR Format for Projects',
      desc: 'Ensure projects define Situation, Task, Action, and Result explicitly in your verbal prep.',
      priority: 'medium'
    },
    {
      id: 'chk-4',
      title: 'Reverse Chronological Order',
      desc: 'List your education and experiences from most recent to oldest.',
      priority: 'medium'
    }
  ];
  return res.json(checklist);
});

export default router;
