import { evaluateSingleAnswer } from '../services/aiService.js';

async function testLatency() {
  console.log('--- Testing Evaluation Latency ---');

  // Test 1: Empty / skipped answer (fast path: should take < 1ms)
  const t0 = Date.now();
  const resEmpty = await evaluateSingleAnswer({
    questionText: 'Explain how React Fiber reconciler works.',
    answerText: 'skip',
    companyName: 'Google'
  });
  const t1 = Date.now();
  console.log(`[Fast Path] Empty/Skipped answer evaluation time: ${t1 - t0}ms | score: ${resEmpty.score}`);

  // Test 2: Normal spoken answer evaluation
  const t2 = Date.now();
  const resReal = await evaluateSingleAnswer({
    questionText: 'What is the time complexity of QuickSort in average and worst case?',
    answerText: 'Average case is O(n log n) when pivot partitions evenly, and worst case is O(n^2) when already sorted with bad pivot choice.',
    expectedKeywords: ['O(n log n)', 'O(n^2)', 'pivot partition'],
    companyName: 'Amazon'
  });
  const t3 = Date.now();
  console.log(`[LLM Evaluation] First run time: ${t3 - t2}ms | score: ${resReal.score} | feedback length: ${resReal.feedback.length}`);

  // Test 3: Cached evaluation (should take < 1ms)
  const t4 = Date.now();
  const resCached = await evaluateSingleAnswer({
    questionText: 'What is the time complexity of QuickSort in average and worst case?',
    answerText: 'Average case is O(n log n) when pivot partitions evenly, and worst case is O(n^2) when already sorted with bad pivot choice.',
    expectedKeywords: ['O(n log n)', 'O(n^2)', 'pivot partition'],
    companyName: 'Amazon'
  });
  const t5 = Date.now();
  console.log(`[LLM Cache HIT] Second run time: ${t5 - t4}ms | score: ${resCached.score}`);
}

testLatency();
