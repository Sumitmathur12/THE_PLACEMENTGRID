import Groq from 'groq-sdk';
import dotenv from 'dotenv';
dotenv.config();

const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });
const list = await groq.models.list();
console.log('Available models:');
list.data.forEach(m => console.log(' -', m.id));
