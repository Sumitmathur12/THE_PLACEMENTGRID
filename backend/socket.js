import { Server } from 'socket.io';
import Groq from 'groq-sdk';

// ============================================================================
// Live Interviewer Reaction — real-time streamed acknowledgment.
//
// This is an OPTIONAL enhancement layered on top of the existing mock
// interview flow (Sarvam TTS + per-question scoring + proctoring all still
// work exactly as before, whether or not this connects). It exists purely
// to give the interview a more "alive" conversational feel: while a student
// is between questions, they can request a brief, streamed, token-by-token
// interviewer reaction to what they just said — similar to how a real
// interviewer might say "Mm, I see, and how did you handle X..." before
// moving on.
//
// If GROQ_API_KEY is missing, this degrades gracefully: the socket still
// connects, but emits a clear 'ai_error' so the frontend can hide/disable
// the live-reaction panel instead of hanging.
// ============================================================================

const initSocket = (httpServer) => {
  const groqKey = process.env.GROQ_API_KEY;
  const groq = groqKey ? new Groq({ apiKey: groqKey }) : null;

  const io = new Server(httpServer, {
    cors: {
      origin: process.env.CLIENT_URL || 'http://localhost:3000',
      methods: ['GET', 'POST'],
      credentials: true
    }
  });

  io.on('connection', (socket) => {
    console.log(`[Socket.io] Client connected: ${socket.id}`);

    socket.on('live_answer', async ({ questionText, answerText, expectedKeywords, companyName }) => {
      if (!groq) {
        socket.emit('ai_error', 'Live reaction unavailable (GROQ_API_KEY not configured).');
        return;
      }

      const cleanAnswer = (answerText || '').trim();
      if (!cleanAnswer || cleanAnswer.length < 5 || cleanAnswer.toLowerCase() === 'skipped question') {
        // Do not generate a reaction for empty or skipped answers
        socket.emit('ai_complete', { type: 'REACTION' });
        return;
      }

      try {
        const prompt = `You are a staff-level technical interviewer at ${companyName || 'a top tech company'}.
The candidate just spoke and submitted their answer to this interview question.
Provide a concise, conversational 2-3 sentence live interviewer reaction that analyzes their response:
1. WHAT: Acknowledge what they got right or missed in their answer.
2. HOW: Explain how to solve or architect it properly (name specific algorithms, data structures, or patterns).
3. WHY: Explain why that approach is chosen in real-world systems (latency, scalability, throughput, memory, or consistency trade-offs).

Speak naturally in first/second person as if chatting across a table ("You mentioned X...", "In production, you'd typically implement Y because Z...").
Do NOT output JSON, markdown headers, or bullet lists.

Question: ${questionText}
Expected Concepts: ${(expectedKeywords || []).join(', ') || 'Core technical architecture'}
Candidate Answer: ${cleanAnswer}`;

        let stream;
        try {
          stream = await groq.chat.completions.create({
            model: 'qwen/qwen3.8-27b',
            messages: [{ role: 'user', content: prompt }],
            temperature: 0.6,
            max_tokens: 220,
            stream: true
          });
        } catch (mErr) {
          console.warn('Socket: Groq stream reaction failed:', mErr.message);
        }

        for await (const chunk of stream) {
          const content = chunk.choices[0]?.delta?.content || '';
          if (content) {
            // Tag strictly as REACTION — this stream never increments questions,
            // never alters interview flow, and is purely a conversational acknowledgment.
            socket.emit('ai_chunk', { content, type: 'REACTION' });
          }
        }

        socket.emit('ai_complete', { type: 'REACTION' });
      } catch (error) {
        console.error('Socket live-reaction error:', error.message);
        socket.emit('ai_error', 'Failed to get live AI reaction.');
      }
    });


    socket.on('disconnect', () => {
      console.log(`[Socket.io] Client disconnected: ${socket.id}`);
    });
  });

  return io;
};

export default initSocket;
