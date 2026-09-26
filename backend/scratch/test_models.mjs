import Groq from 'groq-sdk';
import dotenv from 'dotenv';
dotenv.config();

const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });

async function testModel(modelId) {
  console.log(`\nTesting ${modelId}...`);
  try {
    const stream = await groq.chat.completions.create({
      model: modelId,
      messages: [{ role: 'user', content: 'You are an interviewer. Give a 1 sentence acknowledgment of the candidate saying they use MongoDB indexing.' }],
      max_tokens: 200,
      stream: true
    });
    let content = '';
    for await (const chunk of stream) {
      const c = chunk.choices[0]?.delta?.content || '';
      if (c) process.stdout.write(c);
      content += c;
    }
    console.log(`\n[OK ${modelId}] Total content length: ${content.length}`);
  } catch (e) {
    console.log(`[FAIL ${modelId}]:`, e.message);
  }
}

await testModel('qwen/qwen3.8-27b');
await testModel('openai/gpt-oss-20b');
