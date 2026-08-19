import express from 'express';
import { Company, KnowledgeBase, RoleProfile, Roadmap } from '../models/Schemas.js';
import { getCompanyProfile, getRoleCompanyProfile, getRoleCompanyRoadmap, getRoleCompanyQuestions, getRoleCompanyHRQuestions, ragRetrieve } from '../services/aiService.js';
import { getEmbedding } from '../services/embeddingService.js';
import { requireAuth } from './auth.js';
import { getUnsplashImage } from '../services/unsplashService.js';

const router = express.Router();

// Get all companies
router.get('/', async (req, res) => {
  try {
    const companies = await Company.find().sort({ name: 1 });
    return res.json(companies);
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
});

// Get company by ID
router.get('/:id', async (req, res) => {
  try {
    const company = await Company.findById(req.params.id);
    if (!company) return res.status(404).json({ error: 'Company not found.' });
    return res.json(company);
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
});

// Search and retrieve company detail (with RAG context retrieval)
router.get('/detail/:name', async (req, res) => {
  const { name } = req.params;
  try {
    let company = await Company.findOne({ name: new RegExp(`^${name}$`, 'i') });
    
    // RAG AI profiling
    const profile = await getCompanyProfile(name);
    
    // Unsplash Cover Image
    const coverImage = await getUnsplashImage(name);

    if (!company) {
      // Create a temporary unverified stub
      company = new Company({
        name,
        verified: false,
        timeline: 'N/A',
        collegeCutoff: 'Not available',
        placementStats: { placedCount: 0, avgPackage: 'N/A', details: 'AI generated profile.' }
      });
    }

    return res.json({
      company,
      profile: profile.content,
      citations: profile.citations,
      coverImage
    });
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
});

// Flag outdated info
router.post('/flag/:id', async (req, res) => {
  const { id } = req.params;
  try {
    const company = await Company.findById(id);
    if (!company) {
      return res.status(404).json({ error: 'Company not found' });
    }
    company.flagCount += 1;
    company.lastUpdated = new Date();
    await company.save();
    return res.json({ success: true, flagCount: company.flagCount });
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
});

// Upvote/verify company info
router.post('/upvote/:id', async (req, res) => {
  const { id } = req.params;
  try {
    const company = await Company.findById(id);
    if (!company) {
      return res.status(404).json({ error: 'Company not found' });
    }
    company.verified = true;
    company.flagCount = Math.max(0, company.flagCount - 1);
    company.lastUpdated = new Date();
    await company.save();
    return res.json({ success: true, verified: true, flagCount: company.flagCount });
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
});

// Add new company with dynamic RAG profile & caching
router.post('/add', requireAuth, async (req, res) => {
  const { name, timeline, collegeCutoff, placedCount, avgPackage, details } = req.body;
  if (!name) {
    return res.status(400).json({ error: 'Company name is required.' });
  }

  try {
    const trimmedName = name.trim();
    const baseName = trimmedName.split('_')[0].trim();

    // Perform a robust search covering exact match, base name match, or base name with timestamp suffix
    let company = await Company.findOne({
      $or: [
        { name: new RegExp(`^${trimmedName}$`, 'i') },
        { name: new RegExp(`^${baseName}$`, 'i') },
        { name: new RegExp(`^${baseName}_\\d+$`, 'i') }
      ]
    });

    if (company) {
      console.log(`[DEDUP] Reusing existing company "${company.name}" for request "${name}"`);
      const cachedKB = await KnowledgeBase.findOne({
        $or: [
          { 'metadata.company': new RegExp(`^${company.name}$`, 'i') },
          { 'metadata.company': new RegExp(`^${baseName}$`, 'i') }
        ]
      });
      const profileContent = cachedKB ? cachedKB.content : `### ${company.name} Prep Profile\nNo cached profile details available.`;
      return res.json({ success: true, company, reused: true, profile: profileContent });
    }

    // Check for close matches to log server-side warning
    const allCompanies = await Company.find({}, 'name');
    const reqBaseLower = baseName.toLowerCase();
    for (const existing of allCompanies) {
      const existingBase = existing.name.split('_')[0].trim().toLowerCase();
      if (
        existingBase === reqBaseLower ||
        existingBase.includes(reqBaseLower) ||
        reqBaseLower.includes(existingBase)
      ) {
        console.warn(`[DEDUP WARNING] New company request "${name}" closely matches existing company name "${existing.name}"`);
      }
    }

    // 1. Create Company record
    company = await Company.create({
      name: trimmedName,
      timeline: timeline || 'August - October',
      collegeCutoff: collegeCutoff || 'Not available',
      placementStats: {
        placedCount: placedCount || 0,
        avgPackage: avgPackage || 'N/A',
        details: details || 'Student added profile.'
      },
      verified: false
    });

    // 2. Generate RAG Context and cache it in the KnowledgeBase
    const companyPrompt = `${name} hiring process stages, interview rounds, placement cutoff and package details.`;
    const aiProfile = await getCompanyProfile(name);
    
    // Generate embedding for caching RAG
    const vector = await getEmbedding(aiProfile.content);

    await KnowledgeBase.create({
      title: `${name} Placement & Hiring Details`,
      category: 'companyInfo',
      content: aiProfile.content,
      embedding: vector,
      metadata: {
        company: name,
        sourceLinks: aiProfile.citations.flatMap(cit => cit.links || [])
      }
    });

    return res.status(201).json({ success: true, company, profile: aiProfile.content });
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
});

// Get role-specific profile for a company
router.post('/:id/role-profile', requireAuth, async (req, res) => {
  const { id } = req.params;
  const { role } = req.body;
  
  if (!role) {
    return res.status(400).json({ error: 'Role is required.' });
  }

  try {
    const company = await Company.findById(id);
    if (!company) {
      return res.status(404).json({ error: 'Company not found.' });
    }

    // Check if role-profile is cached in DB
    let roleProfile = await RoleProfile.findOne({ companyId: id, role });
    if (roleProfile) {
      console.log(`RoleProfile cache hit for: ${company.name} - ${role}`);
      return res.json({ profile: roleProfile.content, citations: roleProfile.citations });
    }

    console.log(`RoleProfile cache miss. Triggering research pipeline for: ${company.name} - ${role}`);
    const generated = await getRoleCompanyProfile(company.name, role);

    // Cache the generated profile
    roleProfile = await RoleProfile.create({
      companyId: id,
      role,
      content: generated.content,
      citations: generated.citations
    });

    return res.json({ profile: roleProfile.content, citations: roleProfile.citations });
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
});

// Generate and connect roadmap for a company-role
router.post('/:id/role-roadmap', requireAuth, async (req, res) => {
  const { id } = req.params;
  const { role } = req.body;

  if (!role) {
    return res.status(400).json({ error: 'Role is required.' });
  }

  try {
    const company = await Company.findById(id);
    if (!company) {
      return res.status(404).json({ error: 'Company not found.' });
    }

    // Get cached role profile context
    let roleProfile = await RoleProfile.findOne({ companyId: id, role });
    if (!roleProfile) {
      console.log(`Generating role profile context on the fly for roadmap: ${company.name} - ${role}`);
      const generatedProfile = await getRoleCompanyProfile(company.name, role);
      roleProfile = await RoleProfile.create({
        companyId: id,
        role,
        content: generatedProfile.content,
        citations: generatedProfile.citations
      });
    }

    // Helper to determine CS-related branch
    const isCsBranch = (branchName) => {
      if (!branchName) return true;
      const b = branchName.toLowerCase();
      return b.includes('computer') || b.includes('cs') || b.includes('information technology') || b.includes('it') || b.includes('software');
    };

    const domainName = `${company.name} - ${role}`;
    
    // Find custom User-specific roadmap in the database
    let roadmap = await Roadmap.findOne({ domain: domainName, userId: req.user._id });

    // Generate week-by-week roadmap syllabus via LLM
    console.log(`Generating study roadmap for: ${domainName}`);
    const userBranch = req.user.branch || 'General';
    const generatedRoadmap = await getRoleCompanyRoadmap(company.name, role, roleProfile.content, userBranch, isCsBranch(userBranch));

    // Parse category classification and markdown body
    const categoryMatch = generatedRoadmap.content.match(/\[CATEGORY:\s*([^\]]+)\]/i);
    let category = categoryMatch ? categoryMatch[1].trim().toLowerCase() : 'coding-heavy';
    
    // Programmatic safety checks to enforce correct categorization based on role name keywords
    const roleLower = role.toLowerCase();
    if (roleLower.includes('sde') || roleLower.includes('software') || roleLower.includes('developer') || roleLower.includes('coder') || roleLower.includes('frontend') || roleLower.includes('backend') || roleLower.includes('web') || roleLower.includes('programmer')) {
      category = 'coding-heavy';
    } else if (roleLower.includes('data') || roleLower.includes('ml') || roleLower.includes('machine learning') || roleLower.includes('nlp') || roleLower.includes('computer vision')) {
      category = 'data-ml';
    } else if (roleLower.includes('product manager') || roleLower.includes('pm') || roleLower.includes('consultant')) {
      category = 'product';
    }

    const cleanContent = generatedRoadmap.content.replace(/\[CATEGORY:\s*[^\]]+\]\n*/i, '');

    console.log(`Generating practice questions for: ${domainName}`);
    const practiceQuestions = await getRoleCompanyQuestions(company.name, role, roleProfile.content);

    console.log(`Generating behavioral questions for: ${domainName}`);
    const behavioralQuestions = await getRoleCompanyHRQuestions(company.name, role, roleProfile.content);

    // Select dynamic weeks structure template matching the classified category & student branch
    let weeksTemplate = [];
    if (category === 'data-ml') {
      weeksTemplate = [
        {
          weekNumber: 1,
          topics: [{
            topicId: `${company.name.toLowerCase()}-${role.toLowerCase().replace(/\s+/g, '-')}-w1-t1`,
            title: 'SQL, Databases & Data Prep',
            description: `Master Joins, Subqueries, Windows functions, Group By, and SQL query optimizations for ${company.name}.`,
            whyItMatters: 'Screener tests are predominantly SQL coding heavy.',
            leetcodeUrl: 'https://leetcode.com/tag/database/',
            resources: [{ title: 'SQLZoo Tutorial', url: 'https://sqlzoo.net/' }]
          }]
        },
        {
          weekNumber: 2,
          topics: [{
            topicId: `${company.name.toLowerCase()}-${role.toLowerCase().replace(/\s+/g, '-')}-w2-t1`,
            title: 'Python/R Libraries & Statistics',
            description: `Excel at Pandas, NumPy, Scikit-Learn, data distributions, hypothesis testing, and AB testing.`,
            whyItMatters: 'Fundamental for validating experimental features.',
            leetcodeUrl: 'https://leetcode.com/tag/pandas/',
            resources: [{ title: 'Kaggle Learn Pandas', url: 'https://www.kaggle.com/learn/pandas' }]
          }]
        },
        {
          weekNumber: 3,
          topics: [{
            topicId: `${company.name.toLowerCase()}-${role.toLowerCase().replace(/\s+/g, '-')}-w3-t1`,
            title: 'ML Algorithms & Model Validations',
            description: `Prepare Regression, Classification, clustering algorithms, and validation metrics (ROC-AUC, F1).`,
            whyItMatters: 'Core technical interview questions are based on ML internals.',
            leetcodeUrl: 'https://leetcode.com/tag/math/',
            resources: [{ title: 'Scikit-Learn Algorithms Guide', url: 'https://scikit-learn.org/' }]
          }]
        },
        {
          weekNumber: 4,
          topics: [{
            topicId: `${company.name.toLowerCase()}-${role.toLowerCase().replace(/\s+/g, '-')}-w4-t1`,
            title: 'NLP/CV & Kaggle Competitions',
            description: `Deep dive into Deep Learning, Neural Networks, NLP transformers, or tabular dataset projects.`,
            whyItMatters: 'Advanced project presentation round prep.',
            leetcodeUrl: 'https://leetcode.com/tag/matrix/',
            resources: [{ title: 'Kaggle Datasets & Notebooks', url: 'https://www.kaggle.com/datasets' }]
          }]
        }
      ];
    } else if (category === 'non-technical' || category === 'product') {
      weeksTemplate = [
        {
          weekNumber: 1,
          topics: [{
            topicId: `${company.name.toLowerCase()}-${role.toLowerCase().replace(/\s+/g, '-')}-w1-t1`,
            title: 'Product/Case Frameworks',
            description: `Master Guesstimate formulas, Market Entry frameworks, and Profitability case studies for ${company.name}.`,
            whyItMatters: 'Core for solving screening business case studies.',
            leetcodeUrl: '',
            resources: [{ title: 'Case Interview Prep', url: 'https://www.caseinterview.com/' }]
          }]
        },
        {
          weekNumber: 2,
          topics: [{
            topicId: `${company.name.toLowerCase()}-${role.toLowerCase().replace(/\s+/g, '-')}-w2-t1`,
            title: 'Metrics & Root Cause Analysis',
            description: `Define Acquisition, Engagement, Retention (AARRR) metrics and troubleshoot metrics drops.`,
            whyItMatters: 'Standard Product Manager / Business Analyst technical rounds.',
            leetcodeUrl: '',
            resources: [{ title: 'Stratechery Product Strategy', url: 'https://stratechery.com/' }]
          }]
        },
        {
          weekNumber: 3,
          topics: [{
            topicId: `${company.name.toLowerCase()}-${role.toLowerCase().replace(/\s+/g, '-')}-w3-t1`,
            title: 'Tech-Product & System Architecture',
            description: `Understand high-level system components, APIs, caching, databases, and microservices.`,
            whyItMatters: 'Required for technical Product Manager (TPM) rounds.',
            leetcodeUrl: '',
            resources: [{ title: 'System Design Primer', url: 'https://github.com/donnemartin/system-design-primer' }]
          }]
        },
        {
          weekNumber: 4,
          topics: [{
            topicId: `${company.name.toLowerCase()}-${role.toLowerCase().replace(/\s+/g, '-')}-w4-t1`,
            title: 'Behavioral prep & STAR framework',
            description: `Practice STAR method stories demonstrating leadership, ownership, and handling failure.`,
            whyItMatters: 'Final director/leadership fit assessments.',
            leetcodeUrl: '',
            resources: [{ title: 'Amazon Leadership Principles Guide', url: 'https://www.amazon.jobs/en/principles' }]
          }]
        }
      ];
    } else if (category === 'core-technical-non-coding') {
      const b = userBranch.toLowerCase();
      if (b.includes('civil')) {
        weeksTemplate = [
          {
            weekNumber: 1,
            topics: [{
              topicId: `${company.name.toLowerCase()}-${role.toLowerCase().replace(/\s+/g, '-')}-w1-t1`,
              title: 'Structural Analysis & Mechanics',
              description: 'Revise bending moments, shear forces, stress-strain relations, and core structural theories.',
              whyItMatters: 'Critical for structural engineering interviews.',
              leetcodeUrl: '',
              resources: [{ title: 'Civil Engineering Structural Analysis', url: 'https://nptel.ac.in/' }]
            }]
          },
          {
            weekNumber: 2,
            topics: [{
              topicId: `${company.name.toLowerCase()}-${role.toLowerCase().replace(/\s+/g, '-')}-w2-t1`,
              title: 'Fluid Mechanics & Hydrology',
              description: 'Master open channel flow, pipe networking, Bernoulli principles, and hydraulic structures.',
              whyItMatters: 'Standard questions in core civil screenings.',
              leetcodeUrl: '',
              resources: [{ title: 'NPTEL Fluid Mechanics', url: 'https://nptel.ac.in/' }]
            }]
          },
          {
            weekNumber: 3,
            topics: [{
              topicId: `${company.name.toLowerCase()}-${role.toLowerCase().replace(/\s+/g, '-')}-w3-t1`,
              title: 'Geotechnical Engineering & Concrete Tech',
              description: 'Review soil mechanics, bearing capacity, foundation designs, and concrete mix criteria.',
              whyItMatters: 'Essential for site engineering and validation panels.',
              leetcodeUrl: '',
              resources: [{ title: 'Geotechnical Guide', url: 'https://www.geotechdata.info/' }]
            }]
          },
          {
            weekNumber: 4,
            topics: [{
              topicId: `${company.name.toLowerCase()}-${role.toLowerCase().replace(/\s+/g, '-')}-w4-t1`,
              title: 'Project Review & Estimations',
              description: 'Deep-dive review of your graduation civil project and bill of quantities estimation basics.',
              whyItMatters: 'Final portfolio check by senior project panels.',
              leetcodeUrl: '',
              resources: [{ title: 'ResearchGate Civil Projects', url: 'https://www.researchgate.net/' }]
            }]
          }
        ];
      } else if (b.includes('electrical') || b.includes('electronic') || b.includes('telecommunication') || b.includes('ece')) {
        weeksTemplate = [
          {
            weekNumber: 1,
            topics: [{
              topicId: `${company.name.toLowerCase()}-${role.toLowerCase().replace(/\s+/g, '-')}-w1-t1`,
              title: 'Circuit Theory & Analog',
              description: 'Revise KVL/KCL, network theorems, semiconductor diodes, BJTs, and Op-Amp behaviors.',
              whyItMatters: 'Key for technical screen MCQ rounds.',
              leetcodeUrl: '',
              resources: [{ title: 'All About Circuits Tutorials', url: 'https://www.allaboutcircuits.com/' }]
            }]
          },
          {
            weekNumber: 2,
            topics: [{
              topicId: `${company.name.toLowerCase()}-${role.toLowerCase().replace(/\s+/g, '-')}-w2-t1`,
              title: 'Digital Electronics & Embedded Systems',
              description: 'Master logic gates, flip-flops, state machines, microcontrollers, and register configurations.',
              whyItMatters: 'Highly tested in hardware design rounds.',
              leetcodeUrl: '',
              resources: [{ title: 'Digital Logic Basics', url: 'https://www.geeksforgeeks.org/digital-electronics-logic-design-tutorials/' }]
            }]
          },
          {
            weekNumber: 3,
            topics: [{
              topicId: `${company.name.toLowerCase()}-${role.toLowerCase().replace(/\s+/g, '-')}-w3-t1`,
              title: 'Microcontrollers & Signal Processing',
              description: 'Review 8051/ARM architectures, signal transformations (Fourier/Laplace), and noise filters.',
              whyItMatters: 'Essential for telecommunications and hardware panels.',
              leetcodeUrl: '',
              resources: [{ title: 'ARM Developer Guides', url: 'https://developer.arm.com/' }]
            }]
          },
          {
            weekNumber: 4,
            topics: [{
              topicId: `${company.name.toLowerCase()}-${role.toLowerCase().replace(/\s+/g, '-')}-w4-t1`,
              title: 'ECE Project Review',
              description: 'Review final year electronic projects, circuit simulations, or PCB layouts.',
              whyItMatters: 'Final portfolio validation by technical hardware panels.',
              leetcodeUrl: '',
              resources: [{ title: 'Electronics Projects Hub', url: 'https://www.hackster.io/' }]
            }]
          }
        ];
      } else if (b.includes('mechanical') || b.includes('aerospace')) {
        weeksTemplate = [
          {
            weekNumber: 1,
            topics: [{
              topicId: `${company.name.toLowerCase()}-${role.toLowerCase().replace(/\s+/g, '-')}-w1-t1`,
              title: 'CAD & Solid Modeling',
              description: 'Revise mechanical drawings, limits/tolerances, GD&T, and finite element modeling.',
              whyItMatters: 'Required for design challenges.',
              leetcodeUrl: '',
              resources: [{ title: 'CAD Drafting Basics', url: 'https://www.autodesk.com/' }]
            }]
          },
          {
            weekNumber: 2,
            topics: [{
              topicId: `${company.name.toLowerCase()}-${role.toLowerCase().replace(/\s+/g, '-')}-w2-t1`,
              title: 'Thermodynamics & Fluid Systems',
              description: 'Master heat engines, fluid dynamics, heat transfer, and HVAC systems theory.',
              whyItMatters: 'Common core screening topics.',
              leetcodeUrl: '',
              resources: [{ title: 'Mechanical Thermodynamics NPTEL', url: 'https://nptel.ac.in/' }]
            }]
          },
          {
            weekNumber: 3,
            topics: [{
              topicId: `${company.name.toLowerCase()}-${role.toLowerCase().replace(/\s+/g, '-')}-w3-t1`,
              title: 'Manufacturing & Material Testing',
              description: 'Review casting, welding, machining operations, and tensile/hardness testing.',
              whyItMatters: 'Essential for manufacturing panels.',
              leetcodeUrl: '',
              resources: [{ title: 'Manufacturing Video Tutorials', url: 'https://www.youtube.com/' }]
            }]
          },
          {
            weekNumber: 4,
            topics: [{
              topicId: `${company.name.toLowerCase()}-${role.toLowerCase().replace(/\s+/g, '-')}-w4-t1`,
              title: 'Mechanical Project Review',
              description: 'Review CAD designs, stress analysis reports, or lab fabrications from final year projects.',
              whyItMatters: 'Final structural verification by mechanical panel.',
              leetcodeUrl: '',
              resources: [{ title: 'Mechanical Projects list', url: 'https://www.instructables.com/technology/mechanical-engineering/' }]
            }]
          }
        ];
      } else {
        weeksTemplate = [
          {
            weekNumber: 1,
            topics: [{
              topicId: `${company.name.toLowerCase()}-${role.toLowerCase().replace(/\s+/g, '-')}-w1-t1`,
              title: 'Core Engineering Fundamentals',
              description: `Revise basic engineering topics, calculations, and fundamentals appropriate to ${userBranch}.`,
              whyItMatters: 'General technical screener assessment.',
              leetcodeUrl: '',
              resources: [{ title: 'MIT OpenCourseWare Engineering', url: 'https://ocw.mit.edu/' }]
            }]
          },
          {
            weekNumber: 2,
            topics: [{
              topicId: `${company.name.toLowerCase()}-${role.toLowerCase().replace(/\s+/g, '-')}-w2-t1`,
              title: 'Process Engineering & Systems',
              description: 'Master analytical methods, safety systems, process workflow design, and operational checks.',
              whyItMatters: 'Evaluates systems engineering aptitude.',
              leetcodeUrl: '',
              resources: [{ title: 'Engineering Toolbox Reference', url: 'https://www.engineeringtoolbox.com/' }]
            }]
          },
          {
            weekNumber: 3,
            topics: [{
              topicId: `${company.name.toLowerCase()}-${role.toLowerCase().replace(/\s+/g, '-')}-w3-t1`,
              title: 'Troubleshooting & Instrumentation',
              description: 'Review test benches, measurement validation, quality criteria, and fault tree analysis.',
              whyItMatters: 'Essential for system operations roles.',
              leetcodeUrl: '',
              resources: [{ title: 'IEEE Instrumentation Standards', url: 'https://www.ieee.org/' }]
            }]
          },
          {
            weekNumber: 4,
            topics: [{
              topicId: `${company.name.toLowerCase()}-${role.toLowerCase().replace(/\s+/g, '-')}-w4-t1`,
              title: 'Specialized Seminar & Project Review',
              description: 'Detailed walkthrough of academic projects, technical presentations, and core research results.',
              whyItMatters: 'Evaluates technical depth and ownership.',
              leetcodeUrl: '',
              resources: [{ title: 'ResearchGate Search', url: 'https://www.researchgate.net/' }]
            }]
          }
        ];
      }
    } else {
      // Default to coding-heavy (SDE/SDET/Web)
      if (!isCsBranch(userBranch)) {
        weeksTemplate = [
          {
            weekNumber: 1,
            topics: [{
              topicId: `${company.name.toLowerCase()}-${role.toLowerCase().replace(/\s+/g, '-')}-w1-t1`,
              title: 'CS Core Bridging (OS, DBMS, OOPs)',
              description: 'Revise process management, SQL databases, indexing, inheritance, encapsulation, and standard interview basics.',
              whyItMatters: 'Standard technical screen hurdle for non-CS candidates.',
              leetcodeUrl: 'https://leetcode.com/tag/database/',
              resources: [{ title: 'GeeksforGeeks OS Prep', url: 'https://www.geeksforgeeks.org/operating-systems/' }]
            }]
          },
          {
            weekNumber: 2,
            topics: [{
              topicId: `${company.name.toLowerCase()}-${role.toLowerCase().replace(/\s+/g, '-')}-w2-t1`,
              title: 'Foundational DSA Patterns',
              description: 'Master Arrays, Strings, HashMaps, and Binary Search patterns.',
              whyItMatters: 'Critical for coding online assessments.',
              leetcodeUrl: 'https://leetcode.com/tag/array/',
              resources: [{ title: 'LeetCode Two Sum Problem', url: 'https://leetcode.com/problems/two-sum/' }]
            }]
          },
          {
            weekNumber: 3,
            topics: [{
              topicId: `${company.name.toLowerCase()}-${role.toLowerCase().replace(/\s+/g, '-')}-w3-t1`,
              title: 'Linear Data Structures',
              description: 'Master Linked Lists, Stacks, Queues, and Sliding Window technique problems.',
              whyItMatters: 'Commonly queried in technical interview round 1.',
              leetcodeUrl: 'https://leetcode.com/tag/sliding-window/',
              resources: [{ title: 'LeetCode Discuss Experiences', url: 'https://leetcode.com/discuss/' }]
            }]
          },
          {
            weekNumber: 4,
            topics: [{
              topicId: `${company.name.toLowerCase()}-${role.toLowerCase().replace(/\s+/g, '-')}-w4-t1`,
              title: 'Dynamic Programming & System Design',
              description: 'Master DP, Greedy patterns, and Basic System Design / OOPs concepts.',
              whyItMatters: 'Final hurdle before HR/managerial rounds.',
              leetcodeUrl: 'https://leetcode.com/tag/dynamic-programming/',
              resources: [{ title: 'System Design Primer', url: 'https://github.com/donnemartin/system-design-primer' }]
            }]
          }
        ];
      } else {
        weeksTemplate = [
          {
            weekNumber: 1,
            topics: [
              {
                topicId: `${company.name.toLowerCase()}-${role.toLowerCase().replace(/\s+/g, '-')}-w1-t1`,
                title: 'Foundational DSA Patterns',
                description: `Master Arrays, Strings, HashMaps, Two Pointers, and Binary Search patterns for ${company.name}.`,
                whyItMatters: 'Critical for initial Online Assessment coding tests.',
                leetcodeUrl: 'https://leetcode.com/tag/array/',
                resources: [{ title: 'GeeksforGeeks DSA Self-Paced', url: 'https://www.geeksforgeeks.org/' }]
              },
              {
                topicId: `${company.name.toLowerCase()}-${role.toLowerCase().replace(/\s+/g, '-')}-w1-t2`,
                title: 'Core CS: Object Oriented Programming (OOPs)',
                description: 'Revise the four pillars of OOPs (Inheritance, Polymorphism, Encapsulation, Abstraction) and common design pattern interview questions.',
                whyItMatters: 'Highly tested in technical interview panels.',
                leetcodeUrl: '',
                resources: [{ title: 'Wikipedia OOPs Concepts', url: 'https://en.wikipedia.org/wiki/Object-oriented_programming' }]
              }
            ]
          },
          {
            weekNumber: 2,
            topics: [
              {
                topicId: `${company.name.toLowerCase()}-${role.toLowerCase().replace(/\s+/g, '-')}-w2-t1`,
                title: 'Linear Data Structures',
                description: `Master Linked Lists, Stacks, Queues, and Sliding Window technique problems.`,
                whyItMatters: 'Commonly queried in technical interview round 1.',
                leetcodeUrl: 'https://leetcode.com/tag/sliding-window/',
                resources: [{ title: 'LeetCode Discuss Experiences', url: 'https://leetcode.com/discuss/' }]
              },
              {
                topicId: `${company.name.toLowerCase()}-${role.toLowerCase().replace(/\s+/g, '-')}-w2-t2`,
                title: 'Core CS: Database Management Systems (DBMS)',
                description: 'Master SQL queries, database normalization, indexing mechanisms, and transactions/ACID properties.',
                whyItMatters: 'Extremely common in technical screens and design rounds.',
                leetcodeUrl: 'https://leetcode.com/tag/database/',
                resources: [{ title: 'GeeksforGeeks DBMS Tutorials', url: 'https://www.geeksforgeeks.org/dbms/' }]
              }
            ]
          },
          {
            weekNumber: 3,
            topics: [
              {
                topicId: `${company.name.toLowerCase()}-${role.toLowerCase().replace(/\s+/g, '-')}-w3-t1`,
                title: 'Non-Linear & Advanced DSA',
                description: `Prepare Trees, BST, Heap, and Graph traversal algorithms (BFS/DFS).`,
                whyItMatters: 'Differentiates high-scoring candidates in technical interviews.',
                leetcodeUrl: 'https://leetcode.com/tag/tree/',
                resources: [{ title: 'TakeUForward DSA Sheet', url: 'https://takeuforward.org/' }]
              },
              {
                topicId: `${company.name.toLowerCase()}-${role.toLowerCase().replace(/\s+/g, '-')}-w3-t2`,
                title: 'Core CS: Operating Systems (OS)',
                description: 'Master process management, CPU scheduling, memory management (paging/virtual memory), concurrency/synchronization, and deadlocks.',
                whyItMatters: 'Crucial for system developer and backend rounds.',
                leetcodeUrl: '',
                resources: [{ title: 'GeeksforGeeks OS Prep', url: 'https://www.geeksforgeeks.org/operating-systems/' }]
              }
            ]
          },
          {
            weekNumber: 4,
            topics: [
              {
                topicId: `${company.name.toLowerCase()}-${role.toLowerCase().replace(/\s+/g, '-')}-w4-t1`,
                title: 'Dynamic Programming & System Design',
                description: `Master DP, Greedy patterns, and Basic System Design / OOPs concepts.`,
                whyItMatters: 'Final hurdle before HR/managerial rounds.',
                leetcodeUrl: 'https://leetcode.com/tag/dynamic-programming/',
                resources: [{ title: 'System Design Primer', url: 'https://github.com/donnemartin/system-design-primer' }]
              },
              {
                topicId: `${company.name.toLowerCase()}-${role.toLowerCase().replace(/\s+/g, '-')}-w4-t2`,
                title: 'Core CS: Computer Networks (CN)',
                description: 'Revise the OSI/TCP-IP model layers, TCP vs UDP, HTTP/HTTPS basics, DNS lookup flow, and common networking interview questions.',
                whyItMatters: 'Tested heavily in networking and backend engineering roles.',
                leetcodeUrl: '',
                resources: [{ title: 'GeeksforGeeks Computer Networks', url: 'https://www.geeksforgeeks.org/computer-network-tutorials/' }]
              }
            ]
          }
        ];
      }
    }

    if (!roadmap) {
      // Create custom User-specific roadmap record in database
      roadmap = await Roadmap.create({
        domain: domainName,
        userId: req.user._id,
        companyId: company._id,
        role: role,
        weeks: weeksTemplate,
        practiceQuestions,
        behavioralQuestions,
        aiNotes: cleanContent
      });
    } else {
      // If already generated, update it
      roadmap.companyId = company._id;
      roadmap.role = role;
      roadmap.weeks = weeksTemplate;
      roadmap.practiceQuestions = practiceQuestions;
      roadmap.behavioralQuestions = behavioralQuestions;
      roadmap.aiNotes = cleanContent;
      await roadmap.save();
    }

    return res.json({
      success: true,
      roadmap,
      aiNotes: cleanContent,
      citations: generatedRoadmap.citations
    });
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
});

export default router;
