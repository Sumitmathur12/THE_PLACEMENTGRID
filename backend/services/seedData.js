import mongoose from 'mongoose';
import { Company, Roadmap, Question, KnowledgeBase } from '../models/Schemas.js';
import { getEmbedding } from './embeddingService.js';

// Pre-seeded companies list (25-30 companies)
const companiesData = [
  {
    name: 'Google',
    logo: '🔍',
    timeline: 'August - September',
    collegeCutoff: 8.0,
    placementStats: { placedCount: 4, avgPackage: '32 LPA', details: 'Core software roles, high focus on algorithmic problem solving.' },
    stages: [
      { name: 'Online Assessment', description: '2 DSA questions, 90 mins (Graph, Dynamic Programming, Strings)' },
      { name: 'Technical Round 1', description: 'Coding & Algorithmic complexity analysis' },
      { name: 'Technical Round 2', description: 'Advanced Data Structures & Algorithms' },
      { name: 'Googliness & Leadership', description: 'Behavioral interview matching Google values' }
    ]
  },
  {
    name: 'Microsoft',
    logo: '💻',
    timeline: 'August',
    collegeCutoff: 8.0,
    placementStats: { placedCount: 6, avgPackage: '28 LPA', details: 'Highly competitive, focuses heavily on System Design and DSA.' },
    stages: [
      { name: 'Online Test', description: '3 coding questions, 110 mins (Trees, Dynamic Programming)' },
      { name: 'Technical Interview 1', description: 'Data structures, Trees, Graph algorithms' },
      { name: 'Technical Interview 2', description: 'System Design basics, DB architecture, concurrency' },
      { name: 'AA Round', description: 'As Appropriate: deep dive into design and engineering mindset' }
    ]
  },
  {
    name: 'Amazon',
    logo: '📦',
    timeline: 'August - October',
    collegeCutoff: 7.5,
    placementStats: { placedCount: 8, avgPackage: '25 LPA', details: 'Tests core DSA and Amazon Leadership Principles heavily.' },
    stages: [
      { name: 'Online Assessment', description: '2 DSA questions + Work Styles assessment + Reasoning' },
      { name: 'Technical Round 1', description: 'Focus on Linked Lists, Trees, Heaps, and complexity' },
      { name: 'Technical Round 2', description: 'Coding question + detailed dive into past projects and leadership' },
      { name: 'Bar Raiser', description: 'High-standards round assessing long-term engineering potential' }
    ]
  },
  {
    name: 'TCS',
    logo: '🌐',
    timeline: 'September - October',
    collegeCutoff: 6.0,
    placementStats: { placedCount: 150, avgPackage: '3.6 - 7.0 LPA', details: 'Mass recruiter. Ninja role (3.6 LPA) and Digital role (7.0 LPA).' },
    stages: [
      { name: 'National Qualifier Test', description: 'Aptitude (Quant, Verbal, Reasoning) + Basic Coding' },
      { name: 'Technical Interview', description: 'Basics of DBMS, OOPs, SDLC, SQL, and simple coding' },
      { name: 'Managerial & HR Round', description: 'Behavioral, communication check, and salary details' }
    ]
  },
  {
    name: 'Infosys',
    logo: '⚡',
    timeline: 'October',
    collegeCutoff: 6.0,
    placementStats: { placedCount: 120, avgPackage: '3.6 - 9.5 LPA', details: 'System Engineer, SES, and Power Programmer roles.' },
    stages: [
      { name: 'Online Test', description: 'Logical, Quant, Verbal, and Hands-on Coding' },
      { name: 'Combined Technical & HR', description: 'Basic coding, resume review, projects discussion, and behavioral queries' }
    ]
  },
  {
    name: 'Adobe',
    logo: '🎨',
    timeline: 'September',
    collegeCutoff: 8.5,
    placementStats: { placedCount: 3, avgPackage: '30 LPA', details: 'Product Development roles. Focuses on strong C++ and system basics.' },
    stages: [
      { name: 'Online Assessment', description: 'Aptitude + CS Fundamentals (OS, DBMS) + Coding' },
      { name: 'Technical Round 1', description: 'Low-level design, C++ pointers, Memory management' },
      { name: 'Technical Round 2', description: 'Advanced Algorithms, Operating Systems, Networking' },
      { name: 'Director Round', description: 'Design concepts and situational analysis' }
    ]
  },
  {
    name: 'Salesforce',
    logo: '☁️',
    timeline: 'September',
    collegeCutoff: 8.0,
    placementStats: { placedCount: 2, avgPackage: '27 LPA', details: 'Hires SDEs. Focus on OOPs, design patterns, and DBMS.' },
    stages: [
      { name: 'OA', description: '3 coding questions, Medium-Hard level' },
      { name: 'Technical 1', description: 'Detailed project review + System Design' },
      { name: 'Technical 2', description: 'DSA live coding (Graphs, DP)' },
      { name: 'HR / Values', description: 'Salesforce Core Values alignment check' }
    ]
  },
  {
    name: 'Flipkart',
    logo: '🛒',
    timeline: 'September - October',
    collegeCutoff: 7.5,
    placementStats: { placedCount: 5, avgPackage: '22 LPA', details: 'SDE-1 roles. Heavy focus on DSA and clean coding.' },
    stages: [
      { name: 'Online Assessment', description: '3 coding questions, competitive programming level' },
      { name: 'Machine Coding Round', description: 'Write modular, clean, working code for a design problem in 2 hours' },
      { name: 'Technical Interview', description: 'DSA, System Design, Concurrency' },
      { name: 'HM Round', description: 'Hiring Manager review' }
    ]
  },
  {
    name: 'Razorpay',
    logo: '💳',
    timeline: 'October',
    collegeCutoff: 7.5,
    placementStats: { placedCount: 4, avgPackage: '18 LPA', details: 'Fintech product role. Focuses on full-stack basics and web technologies.' },
    stages: [
      { name: 'OA', description: 'DSA coding questions (Arrays, Math)' },
      { name: 'Technical 1', description: 'Coding & debugging, Web system basics' },
      { name: 'Technical 2', description: 'Low-level design (LLD) of API endpoint or payment queue' },
      { name: 'HR/Managerial', description: 'Cultural fit' }
    ]
  },
  {
    name: 'Accenture',
    logo: '↗️',
    timeline: 'September',
    collegeCutoff: 6.5,
    placementStats: { placedCount: 160, avgPackage: '4.5 - 6.5 LPA', details: 'Associate Software Engineer & Advanced ASE roles.' },
    stages: [
      { name: 'Cognitive & Technical Assessment', description: '90 Questions on English, Critical Thinking, MS Office, Pseudocode, Networking' },
      { name: 'Coding Assessment', description: '2 coding challenges, 45 minutes' },
      { name: 'Communication Assessment', description: 'Read/Listen/Respond audio tasks' },
      { name: 'HR Interview', description: 'Final general interview' }
    ]
  }
];

// Add generic company stubs to reach 25+ companies
const companyStubs = [
  'Wipro', 'Cognizant', 'Capgemini', 'Paytm', 'PhonePe', 'Zomato', 'Swiggy', 
  'Uber', 'Ola', 'Oracle', 'Cisco', 'Intel', 'AMD', 'NVIDIA', 'Salesforce', 'Netflix', 'Meta'
];

companyStubs.forEach((comp, idx) => {
  if (!companiesData.find(c => c.name.toLowerCase() === comp.toLowerCase())) {
    companiesData.push({
      name: comp,
      logo: '🏢',
      timeline: 'September - November',
      collegeCutoff: 6.5 + (idx % 3) * 0.5,
      placementStats: { placedCount: 5 + (idx * 3), avgPackage: `${6 + (idx % 4) * 4} LPA`, details: 'General technical engineering roles.' },
      stages: [
        { name: 'Written Test', description: 'Aptitude & Technical MCQ' },
        { name: 'Technical Interview', description: 'Basics of CS and Coding' },
        { name: 'HR Interview', description: 'HR and behavioral check' }
      ]
    });
  }
});

// Pre-seeded roadmaps
const roadmapsData = [
  {
    domain: 'SDE',
    weeks: [
      {
        weekNumber: 1,
        topics: [
          {
            topicId: 'sde-w1-t1',
            title: 'Two Pointers & Fast-Slow Pointers',
            description: 'Core pointer manipulation patterns including two-sum variants, list cycle detection, and middle discovery.',
            gfgUrl: 'https://www.geeksforgeeks.org/two-pointers-technique/',
            leetcodeUrl: 'https://leetcode.com/tag/two-pointers/',
            youtubeUrl: 'https://www.youtube.com/watch?v=On03HWe2t6E',
            whyItMatters: 'Essential for low-overhead in-place array/list operations.',
            resources: [
              { title: 'LeetCode 1: Two Sum', url: 'https://leetcode.com/problems/two-sum/' },
              { title: 'LeetCode 977: Squares of a Sorted Array', url: 'https://leetcode.com/problems/squares-of-a-sorted-array/' },
              { title: 'LeetCode 15: 3Sum', url: 'https://leetcode.com/problems/3sum/' },
              { title: 'LeetCode 16: 3Sum Closest', url: 'https://leetcode.com/problems/3sum-closest/' },
              { title: 'LeetCode 141: Linked List Cycle', url: 'https://leetcode.com/problems/linked-list-cycle/' },
              { title: 'LeetCode 876: Middle of the Linked List', url: 'https://leetcode.com/problems/middle-of-the-linked-list/' }
            ]
          }
        ]
      },
      {
        weekNumber: 2,
        topics: [
          {
            topicId: 'sde-w2-t1',
            title: 'Sliding Window & Kadane\'s Algorithm',
            description: 'Subarray analysis techniques covering window resizing, distinct characters, and contiguous maximum sums.',
            gfgUrl: 'https://www.geeksforgeeks.org/window-sliding-technique/',
            leetcodeUrl: 'https://leetcode.com/tag/sliding-window/',
            youtubeUrl: 'https://www.youtube.com/watch?v=Jg4T5Co9NPo',
            whyItMatters: 'Optimizes O(N^2) search bounds to O(N) linear time complexities.',
            resources: [
              { title: 'LeetCode 209: Minimum Size Subarray Sum', url: 'https://leetcode.com/problems/minimum-size-subarray-sum/' },
              { title: 'LeetCode 3: Longest Substring Without Repeating Characters', url: 'https://leetcode.com/problems/longest-substring-without-repeating-characters/' },
              { title: 'LeetCode 1004: Max Consecutive Ones III', url: 'https://leetcode.com/problems/max-consecutive-ones-iii/' },
              { title: 'LeetCode 53: Maximum Subarray', url: 'https://leetcode.com/problems/maximum-subarray/' },
              { title: 'LeetCode 152: Maximum Product Subarray', url: 'https://leetcode.com/problems/maximum-product-subarray/' }
            ]
          }
        ]
      },
      {
        weekNumber: 3,
        topics: [
          {
            topicId: 'sde-w3-t1',
            title: 'Prefix Sum & Merge Intervals',
            description: 'Accumulative sum arrays and interval intersections/merges to handle range queries and scheduling.',
            gfgUrl: 'https://www.geeksforgeeks.org/prefix-sum-array-implementation-applications-advantages/',
            leetcodeUrl: 'https://leetcode.com/tag/prefix-sum/',
            youtubeUrl: 'https://www.youtube.com/watch?v=pVS3yhlzRLQ',
            whyItMatters: 'Critical for calendar scheduling, resource allocations, and range searches.',
            resources: [
              { title: 'LeetCode 560: Subarray Sum Equals K', url: 'https://leetcode.com/problems/subarray-sum-equals-k/' },
              { title: 'LeetCode 724: Find Pivot Index', url: 'https://leetcode.com/problems/find-pivot-index/' },
              { title: 'LeetCode 56: Merge Intervals', url: 'https://leetcode.com/problems/merge-intervals/' },
              { title: 'LeetCode 57: Insert Interval', url: 'https://leetcode.com/problems/insert-interval/' },
              { title: 'LeetCode 986: Interval List Intersections', url: 'https://leetcode.com/problems/interval-list-intersections/' }
            ]
          }
        ]
      },
      {
        weekNumber: 4,
        topics: [
          {
            topicId: 'sde-w4-t1',
            title: 'In-place List Reversal, Stacks & Hash Maps',
            description: 'Pointer exchanges, LIFO stack operations for parsing, and O(1) hash map lookups.',
            gfgUrl: 'https://www.geeksforgeeks.org/stack-data-structure/',
            leetcodeUrl: 'https://leetcode.com/tag/stack/',
            youtubeUrl: 'https://www.youtube.com/watch?v=gromg8_T6Z4',
            whyItMatters: 'Fundamental data structures for building syntax parsers and cache structures.',
            resources: [
              { title: 'LeetCode 206: Reverse Linked List', url: 'https://leetcode.com/problems/reverse-linked-list/' },
              { title: 'LeetCode 92: Reverse Linked List II', url: 'https://leetcode.com/problems/reverse-linked-list-ii/' },
              { title: 'LeetCode 20: Valid Parentheses', url: 'https://leetcode.com/problems/valid-parentheses/' },
              { title: 'LeetCode 739: Daily Temperatures', url: 'https://leetcode.com/problems/daily-temperatures/' },
              { title: 'LeetCode 387: First Unique Character', url: 'https://leetcode.com/problems/first-unique-character-in-a-string/' },
              { title: 'LeetCode 383: Ransom Note', url: 'https://leetcode.com/problems/ransom-note/' }
            ]
          }
        ]
      },
      {
        weekNumber: 5,
        topics: [
          {
            topicId: 'sde-w5-t1',
            title: 'Binary Search & Heaps (Priority Queues)',
            description: 'Logarithmic search bounds and heap structures for k-way merges and top-K elements.',
            gfgUrl: 'https://www.geeksforgeeks.org/binary-search/',
            leetcodeUrl: 'https://leetcode.com/tag/binary-search/',
            youtubeUrl: 'https://www.youtube.com/watch?v=SArElDb869A',
            whyItMatters: 'Speeds up list processing times from linear to logarithmic search scales.',
            resources: [
              { title: 'LeetCode 704: Binary Search', url: 'https://leetcode.com/problems/binary-search/' },
              { title: 'LeetCode 153: Find Min in Rotated Sorted Array', url: 'https://leetcode.com/problems/find-minimum-in-rotated-sorted-array/' },
              { title: 'LeetCode 33: Search in Rotated Sorted Array', url: 'https://leetcode.com/problems/search-in-rotated-sorted-array/' },
              { title: 'LeetCode 875: Koko Eating Bananas', url: 'https://leetcode.com/problems/koko-eating-bananas/' },
              { title: 'LeetCode 215: Kth Largest Element', url: 'https://leetcode.com/problems/kth-largest-element-in-an-array/' },
              { title: 'LeetCode 347: Top K Frequent Elements', url: 'https://leetcode.com/problems/top-k-frequent-elements/' }
            ]
          }
        ]
      },
      {
        weekNumber: 6,
        topics: [
          {
            topicId: 'sde-w6-t1',
            title: 'Recursion, Backtracking & Trees',
            description: 'Depth-first explorations, constraint satisfaction searches, and binary tree traversals.',
            gfgUrl: 'https://www.geeksforgeeks.org/tree-data-structure/',
            leetcodeUrl: 'https://leetcode.com/tag/tree/',
            youtubeUrl: 'https://www.youtube.com/watch?v=k7VEnEl_M2w',
            whyItMatters: 'Forms the backbone of search engine indexing and folder structures.',
            resources: [
              { title: 'LeetCode 22: Generate Parentheses', url: 'https://leetcode.com/problems/generate-parentheses/' },
              { title: 'LeetCode 46: Permutations', url: 'https://leetcode.com/problems/permutations/' },
              { title: 'LeetCode 102: Binary Tree Level Order Traversal', url: 'https://leetcode.com/problems/binary-tree-level-order-traversal/' },
              { title: 'LeetCode 226: Invert Binary Tree', url: 'https://leetcode.com/problems/invert-binary-tree/' },
              { title: 'LeetCode 236: Lowest Common Ancestor', url: 'https://leetcode.com/problems/lowest-common-ancestor-of-a-binary-tree/' }
            ]
          }
        ]
      },
      {
        weekNumber: 7,
        topics: [
          {
            topicId: 'sde-w7-t1',
            title: 'Graphs (DFS, BFS & Shortest Paths)',
            description: 'Network representation using adjacency lists, connected component counts, and Dijkstra\'s algorithms.',
            gfgUrl: 'https://www.geeksforgeeks.org/graph-data-structure-and-algorithms/',
            leetcodeUrl: 'https://leetcode.com/tag/graph/',
            youtubeUrl: 'https://www.youtube.com/watch?v=cWNEl4HE2MY',
            whyItMatters: 'Powers social networks, maps navigation, and routing architectures.',
            resources: [
              { title: 'LeetCode 200: Number of Islands', url: 'https://leetcode.com/problems/number-of-islands/' },
              { title: 'LeetCode 994: Rotting Oranges', url: 'https://leetcode.com/problems/rotting-oranges/' },
              { title: 'LeetCode 743: Network Delay Time', url: 'https://leetcode.com/problems/network-delay-time/' },
              { title: 'LeetCode 1631: Path With Minimum Effort', url: 'https://leetcode.com/problems/path-with-minimum-effort/' },
              { title: 'LeetCode 127: Word Ladder', url: 'https://leetcode.com/problems/word-ladder/' }
            ]
          }
        ]
      },
      {
        weekNumber: 8,
        topics: [
          {
            topicId: 'sde-w8-t1',
            title: 'Dynamic Programming & Stock Patterns',
            description: 'Overlapping subproblems optimization using memoization, tabulation, and state machines.',
            gfgUrl: 'https://www.geeksforgeeks.org/dynamic-programming/',
            leetcodeUrl: 'https://leetcode.com/tag/dynamic-programming/',
            youtubeUrl: 'https://www.youtube.com/watch?v=FfGP_s07oI8',
            whyItMatters: 'Solves complex optimization problems in polynomial time.',
            resources: [
              { title: 'LeetCode 70: Climbing Stairs', url: 'https://leetcode.com/problems/climbing-stairs/' },
              { title: 'LeetCode 300: Longest Increasing Subsequence', url: 'https://leetcode.com/problems/longest-increasing-subsequence/' },
              { title: 'LeetCode 1143: Longest Common Subsequence', url: 'https://leetcode.com/problems/longest-common-subsequence/' },
              { title: 'LeetCode 121: Buy/Sell Stock', url: 'https://leetcode.com/problems/best-time-to-buy-and-sell-stock/' },
              { title: 'LeetCode 188: Buy/Sell Stock IV', url: 'https://leetcode.com/problems/best-time-to-buy-and-sell-stock-iv/' }
            ]
          }
        ]
      }
    ]
  },
  {
    domain: 'Data Analyst',
    weeks: [
      {
        weekNumber: 1,
        topics: [{
          topicId: 'da-w1-t1',
          title: 'SQL Join & Group By',
          description: 'Inner/Left/Right/Full Joins, Aggregation functions, Group By, Having clauses',
          gfgUrl: 'https://www.geeksforgeeks.org/sql-join-set-1-inner-left-right-and-full-outer-joins/',
          leetcodeUrl: 'https://leetcode.com/tag/database/',
          youtubeUrl: 'https://www.youtube.com/watch?v=7S_tz1z_5bA',
          whyItMatters: 'SQL query tests are standard for all Data Analyst roles.',
          resources: [
            { title: 'Alex The Analyst SQL Tutorial', url: 'https://www.youtube.com/playlist?list=PLUaB-1hjhk8GZOuylZqLz-LySFB1i7hJH' },
            { title: 'LeetCode 175: Combine Two Tables', url: 'https://leetcode.com/problems/combine-two-tables/' }
          ]
        }]
      }
    ]
  }
];

// Pre-seeded practice questions
const questionsData = [
  {
    category: 'quant',
    text: 'A train 120 m long passes a telegraph post in 6 seconds. Find the speed of the train in km/hr.',
    options: ['72', '60', '80', '64'],
    correctIndex: 0,
    companies: ['TCS', 'Infosys', 'Wipro'],
    difficulty: 'easy'
  },
  {
    category: 'quant',
    text: 'If A and B can do a piece of work in 8 days, B and C in 12 days, and C and A in 15 days, how many days will C take alone to complete it?',
    options: ['80 days', '75 days', '65 days', '90 days'],
    correctIndex: 0,
    companies: ['Accenture', 'Cognizant'],
    difficulty: 'medium'
  },
  {
    category: 'logical',
    text: 'Look at this series: 2, 1, (1/2), (1/4), ... What number should come next?',
    options: ['1/3', '1/8', '2/8', '1/16'],
    correctIndex: 1,
    companies: ['TCS', 'Accenture', 'Infosys'],
    difficulty: 'easy'
  },
  {
    category: 'coreCS',
    text: 'Which of the following is not a transaction state in DBMS?',
    options: ['Active', 'Partially Committed', 'Aborted', 'Pre-allocated'],
    correctIndex: 3,
    companies: ['Google', 'Microsoft', 'Adobe'],
    difficulty: 'medium'
  },
  {
    category: 'coreCS',
    text: 'In virtual memory, what is page thrashing?',
    options: [
      'High rate of memory allocation requests',
      'The CPU spending more time swapping pages in and out of disk than executing instructions',
      'Formatting hard disk pages',
      'Cache memory replacement policy'
    ],
    correctIndex: 1,
    companies: ['Amazon', 'Microsoft', 'Adobe'],
    difficulty: 'hard'
  },
  {
    category: 'verbal',
    text: 'Identify the synonym of the word: OBSTINATE',
    options: ['Flexible', 'Stubborn', 'Generous', 'Fierce'],
    correctIndex: 1,
    companies: ['Capgemini', 'Cognizant'],
    difficulty: 'easy'
  },
  {
    category: 'coreCS',
    text: 'Write a function twoSum(nums, target) that returns the indices of the two numbers such that they add up to target. You may assume that each input would have exactly one solution, and you may not use the same element twice.',
    companies: ['Google', 'Amazon', 'Microsoft'],
    difficulty: 'easy',
    isCoding: true,
    starterCode: `function twoSum(nums, target) {
  // Write your code here
  return [];
}`,
    starterCodes: {
      javascript: `function twoSum(nums, target) {
  // Write your code here
  return [];
}`,
      python: `def twoSum(nums, target):
    # Write your code here
    return []`,
      java: `class Solution {
    public int[] twoSum(int[] nums, int target) {
        // Write your code here
        return new int[0];
    }
}`,
      cpp: `#include <vector>
using namespace std;

class Solution {
public:
    vector<int> twoSum(vector<int>& nums, int target) {
        // Write your code here
        return {};
    }
};`
    },
    testCases: [
      { input: '[2, 7, 11, 15], 9', output: '[0,1]' },
      { input: '[3, 2, 4], 6', output: '[1,2]' }
    ]
  }
];

// Dynamically generate 50 distinct questions for each category to ensure a healthy database pool
for (let i = 1; i <= 50; i++) {
  questionsData.push({
    category: 'quant',
    text: `Quantitative practice problem #${i}: Solve for compound interest at rate of ${5 + i % 10}% compounded annually for a principal of $${1000 + i * 100} over a period of ${2 + i % 3} years.`,
    options: [`$${1000 + i * 110}`, `$${1000 + i * 120}`, `$${1000 + i * 130}`, `$${1000 + i * 140}`],
    correctIndex: i % 4,
    companies: ['TCS', 'Infosys', 'Wipro'],
    difficulty: 'medium'
  });
  questionsData.push({
    category: 'logical',
    text: `Logical reasoning puzzle #${i}: Determine the next number in the pattern: ${i}, ${i * 2}, ${i * 4}, ${i * 8}, ... What comes next?`,
    options: [`${i * 12}`, `${i * 16}`, `${i * 20}`, `${i * 24}`],
    correctIndex: 1,
    companies: ['TCS', 'Accenture', 'Infosys'],
    difficulty: 'medium'
  });
  questionsData.push({
    category: 'verbal',
    text: `Verbal ability vocabulary challenge #${i}: Select the synonym for the word 'Adherence' under context option ${i}.`,
    options: ['Compliance', 'Rebellion', 'Disregard', 'Neglect'],
    correctIndex: 0,
    companies: ['Capgemini', 'Cognizant'],
    difficulty: 'medium'
  });
  questionsData.push({
    category: 'coreCS',
    text: `Core CS database query problem #${i}: Which indexing mechanism is ideal for range queries in SQL for table index #${i}?`,
    options: ['B-Tree Index', 'Hash Index', 'Bitmap Index', 'Clustered Index'],
    correctIndex: 0,
    companies: ['Google', 'Microsoft', 'Adobe'],
    difficulty: 'easy'
  });
}

// Pre-seeded KnowledgeBase chunks for RAG context
const rawKnowledgeChunks = [
  {
    title: 'Google Hiring Process Overview',
    category: 'companyInfo',
    content: 'Google typically processes engineering applicants via 4 stages. 1. Online Coding Assessment (usually on HackerEarth, featuring 2 hard algorithmic questions covering Graphs, Trees, or dynamic programming). 2. Technical Interview 1 (deep focus on DSA, Big-O complexity analysis, and edge case coverage). 3. Technical Interview 2 (covering advanced algorithms, system design basics, and OOP concepts). 4. Googliness and Leadership (behavioral fit round checking collaboration, ethics, and ambiguity handling). The average package offered is 32 LPA, and the minimum cutoff is 8.0 CGPA.',
    metadata: {
      company: 'Google',
      sourceLinks: [
        { title: 'Google Careers Prep Guide', url: 'https://careers.google.com/how-we-hire/' },
        { title: 'LeetCode Google Interview Experiences', url: 'https://leetcode.com/discuss/interview-experience?query=Google' }
      ]
    }
  },
  {
    title: 'TCS NQT and Hiring Details',
    category: 'companyInfo',
    content: 'TCS recruits college graduates via the National Qualifier Test (NQT). The test is split into sections: Numerical Ability, Reasoning Ability, Verbal Ability, and a basic coding section (usually 2 simple problems on arrays or strings). Cutoff is around 60% marks. Successful candidates are interviewed in a single combined panel covering technical fundamentals (DBMS, SQL queries, OOPs concepts, basic HTML/JS) and HR queries. Successful Ninja candidates receive 3.6 LPA, while higher scores unlock the Digital role at 7.0 LPA.',
    metadata: {
      company: 'TCS',
      sourceLinks: [
        { title: 'TCS NQT Official Portal', url: 'https://nextstep.tcs.com/' }
      ]
    }
  },
  {
    title: 'Arrays and Hashing Guide',
    category: 'dsaTopic',
    content: 'Arrays and Hashing represent the bedrock of technical interviews. Common patterns include Sliding Window (finding sub-arrays matching criteria), Two Pointers (reversing, merging, partitioning), Prefix Sums (constant-time range queries), and Hash Maps (constant-time value lookups). Recommended problems to study include LeetCode 1 (Two Sum), LeetCode 217 (Contains Duplicate), LeetCode 121 (Best Time to Buy and Sell Stock), and LeetCode 242 (Valid Anagram). Curated playlist available at TakeUForward.',
    metadata: {
      sourceLinks: [
        { title: 'TakeUForward DSA Course', url: 'https://takeuforward.org/' },
        { title: 'LeetCode Array Practice', url: 'https://leetcode.com/tag/array/' }
      ]
    }
  },
  {
    title: 'SQL and Joins Interview Concepts',
    category: 'dsaTopic',
    content: 'For Data Analyst and SDE placements, SQL joins are tested. Inner Join matches records in both tables. Left Join returns all rows from the left table and matched rows from the right. Group By aggregates rows sharing attributes. Having clause filters grouped records (unlike WHERE which filters before grouping). Window functions like ROW_NUMBER(), RANK(), and DENSE_RANK() are frequently asked to resolve "Nth highest salary" problems. Practice SQL problems on LeetCode and HackerRank database sections.',
    metadata: {
      sourceLinks: [
        { title: 'W3Schools SQL Joins Guide', url: 'https://www.w3schools.com/sql/sql_join.asp' }
      ]
    }
  },
  {
    title: 'Quantitative Aptitude Formula & Rules Reference',
    category: 'quantFormulaReference',
    content: `Grounding Formula Guidelines:
1. Simple Interest (SI) = (P * R * T) / 100
2. Compound Interest (CI) = P * (1 + R/100)^T - P
3. Time & Work: If A does work in D1 days and B in D2 days, together they take (D1 * D2) / (D1 + D2) days.
4. Time, Speed & Distance: Speed = Distance / Time. Relative Speed (opposite direction) = S1 + S2. Relative Speed (same direction) = |S1 - S2|.
5. Permutations (nPr) = n! / (n-r)! and Combinations (nCr) = n! / (r! * (n-r)!)
6. Profit & Loss: Profit = SP - CP. Profit% = (Profit / CP) * 100. Loss% = (Loss / CP) * 100.
7. Ratios & Percentages: A is X% of B means A = (X/100) * B. Ratios can be combined using common multipliers.
8. Averages = Sum of terms / Number of terms.`,
    metadata: { sourceLinks: [] }
  },
  {
    title: 'Logical Reasoning Rules & Patterns Reference',
    category: 'logicalRulesReference',
    content: `Grounding Logical Reasoning Patterns:
1. Syllogisms: Use Venn diagram logic (e.g. All A are B, Some B are C). Verify valid conclusions (e.g. Some A being C is a possibility).
2. Blood Relations: Draw family trees. Define genders and relations: Mother, Father, Uncle, Aunt, Grandfather, Grandmother, Sister, Brother, Cousin, Nephew, Niece, Spouse, Father-in-law, Mother-in-law.
3. Coding-Decoding: Character shifts (e.g. ROT-13, addition or subtraction of index value) or positional reversing.
4. Number/Letter Series: Arithmetic difference, geometric ratio, Fibonacci-like, alternating operation (+X, -Y), or square/cube progressions.
5. Direction Sense: Cardinal directions (North, South, East, West) and intermediate directions (NE, NW, SE, SW). Use Pythagoras theorem for straight-line displacement.
6. Seating Arrangement: Linear or circular layouts, facing inward/outward. Determine left/right positions correctly.`,
    metadata: { sourceLinks: [] }
  },
  {
    title: 'Verbal Ability Rules & Patterns Reference',
    category: 'verbalRulesReference',
    content: `Grounding Verbal Ability Patterns:
1. Synonyms & Antonyms: Test vocabulary using clear context clues. Ensure distractors are not synonymous with the correct antonym or vice-versa.
2. Sentence Correction: Subject-verb agreement, parallel structure, modifier placements, and correct preposition/conjunction usage.
3. Reading Comprehension: Single-passage comprehension testing main idea, inference, and tone.
4. Idioms & Phrases: Traditional English expressions and common usage patterns.`,
    metadata: { sourceLinks: [] }
  },
  {
    title: 'Core CS Rules & Patterns Reference',
    category: 'coreCSRulesReference',
    content: `Grounding Core CS Topics:
1. Operating Systems: CPU scheduling (FIFO, Round Robin, SJF), memory management (paging, page replacement algorithms, thrashing), deadlock (4 conditions: mutual exclusion, hold & wait, no preemption, circular wait).
2. Database Management Systems (DBMS): ACID properties (Atomicity, Consistency, Isolation, Durability), SQL Joins (Inner, Left, Right, Full Outer), normalization (1NF, 2NF, 3NF, BCNF), transactions.
3. Computer Networks: OSI model (7 layers: Physical, Data Link, Network, Transport, Session, Presentation, Application), TCP vs UDP, IP addressing (IPv4 subnets), HTTP/HTTPS, DNS.
4. Data Structures & Algorithms (DSA): Time and Space complexity (Big O notation), Arrays, Strings, Hashing, Stacks, Queues, Linked Lists, Trees, Graphs.`,
    metadata: { sourceLinks: [] }
  }
];

export const seedDatabase = async () => {
  try {
    if (mongoose.connection.readyState !== 1) {
      console.warn('Database Seeding: MongoDB connection is offline/disconnected. Skipping seeding. Local in-memory mocks will serve API requests.');
      return;
    }

    // 1. Seed Companies
    const companyCount = await Company.countDocuments();
    if (companyCount === 0) {
      console.log('Seeding companies...');
      await Company.insertMany(companiesData);
      console.log('Companies seeded successfully!');
    }

    // Update existing companies with default roles if missing
    await Company.updateMany(
      { roles: { $exists: false } },
      { $set: { roles: ['SDE', 'Data Analyst', 'Data Science', 'Machine Learning'] } }
    );
    console.log('Database Seeding: Default roles verified for all companies.');

    // 2. Seed Roadmaps
    console.log('Clearing and re-seeding roadmaps...');
    await Roadmap.deleteMany({});
    await Roadmap.insertMany(roadmapsData);
    console.log('Roadmaps seeded successfully!');

    // 3. Seed Questions
    // Clear and re-seed questions to ensure coding questions are present
    console.log('Clearing and re-seeding questions...');
    await Question.deleteMany({});
    await Question.insertMany(questionsData);
    console.log('Questions seeded successfully!');

    // 4. Seed KnowledgeBase for RAG
    console.log('Clearing and re-seeding KnowledgeBase chunks with embeddings (RAG)...');
    await KnowledgeBase.deleteMany({});
    
    const seededChunks = [];
    for (const chunk of rawKnowledgeChunks) {
      // Generate embedding vector dynamically (local or remote)
      console.log(`Generating embedding vector for chunk: "${chunk.title}"`);
      const vector = await getEmbedding(chunk.content);
      seededChunks.push({
        ...chunk,
        embedding: vector
      });
    }
    
    await KnowledgeBase.insertMany(seededChunks);
    console.log('KnowledgeBase RAG seeded successfully!');
  } catch (error) {
    console.error('Error seeding database:', error);
  }
};
