import { GoogleGenAI } from '@google/genai';

let localExtractor = null;

const generateMockEmbedding = (text) => {
  const dims = 384;
  const embedding = new Array(dims).fill(0);
  
  for (let i = 0; i < text.length; i++) {
    const charCode = text.charCodeAt(i);
    const index = (i * 7) % dims;
    embedding[index] = (embedding[index] + charCode / 128 - 1) / 2;
  }
  
  const magnitude = Math.sqrt(embedding.reduce((sum, val) => sum + val * val, 0)) || 1;
  return embedding.map(val => val / magnitude);
};

export const getEmbedding = async (text) => {
  if (!text || typeof text !== 'string') {
    return new Array(384).fill(0);
  }

  // 1. Try Gemini API if configured
  if (process.env.GEMINI_API_KEY) {
    try {
      const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
      const response = await ai.models.embedContent({
        model: 'text-embedding-004',
        contents: text,
      });
      if (response && response.embedding && response.embedding.values) {
        const values = response.embedding.values;
        if (values.length === 384) return values;
        if (values.length > 384) return values.slice(0, 384);
        return [...values, ...new Array(384 - values.length).fill(0)];
      }
    } catch (err) {
      console.warn('Gemini embedding failed, falling back to local extractor:', err.message);
    }
  }

  // 2. Try Local @xenova/transformers
  try {
    const { pipeline } = await import('@xenova/transformers');
    if (!localExtractor) {
      console.log('Loading local embedding model: Xenova/all-MiniLM-L6-v2...');
      localExtractor = await pipeline('feature-extraction', 'Xenova/all-MiniLM-L6-v2');
    }
    
    const output = await localExtractor(text, { pooling: 'mean', normalize: true });
    return Array.from(output.data);
  } catch (err) {
    console.warn('Local embedding model loading failed or timed out. Using offline mock embedding generator.', err.message);
    return generateMockEmbedding(text);
  }
};
