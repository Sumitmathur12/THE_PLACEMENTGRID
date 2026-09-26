import Groq from 'groq-sdk';
import dotenv from 'dotenv';
dotenv.config();

const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });
console.log('Testing groq streaming with openai/gpt-oss-20b...');
try {
  const stream = await groq.chat.completions.create({
    model: 'openai/gpt-oss-20b',
    messages: [{ role: 'user', content: 'Say hello in one sentence.' }],
    temperature: 0.5,
    max_tokens: 120,
    stream: true
  });

  let full = '';
  for await (const chunk of stream) {
    console.log('Chunk raw:', JSON.stringify(chunk));
    const content = chunk.choices[0]?.delta?.content || '';
    full += content;
  }
  console.log('Full content:', full);
} catch (e) {
  console.error('Error:', e);
}
