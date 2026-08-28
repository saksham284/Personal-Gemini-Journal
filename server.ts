import express, { Request, Response } from 'express';
import path from 'path';
import dotenv from 'dotenv';
import { GoogleGenAI } from '@google/genai';

dotenv.config();

const app = express();
const PORT = 3000;

// 1. Top-Level Request Deserialization (Ordering Guarantee)
app.use(express.json({ limit: '2mb' }));
app.use(express.urlencoded({ extended: true, limit: '2mb' }));

// Lazy-initialized GoogleGenAI client
let aiClient: GoogleGenAI | null = null;
function getAIClient(): GoogleGenAI {
  if (!aiClient) {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      console.warn('GEMINI_API_KEY is not set in environment variables. Set it in Settings.');
    }
    aiClient = new GoogleGenAI({ apiKey: apiKey || '' });
  }
  return aiClient;
}

// Resilient Model Fallback Ladder
const MODEL_FALLBACK_LADDER = [
  'gemini-3.6-flash',
  'gemini-3.1-flash-lite',
  'gemini-flash-latest',
  'gemini-3.7-flash',
];

interface ContentFallbackResult {
  text: string;
  modelUsed: string;
}

/**
 * Executes a Gemini content generation call across the resilient fallback ladder
 */
async function generateContentWithFallback(
  prompt: string | { contents: any[]; systemInstruction?: string }
): Promise<ContentFallbackResult> {
  const ai = getAIClient();
  let lastError: any = null;

  for (const model of MODEL_FALLBACK_LADDER) {
    try {
      let response: any;
      if (typeof prompt === 'string') {
        response = await ai.models.generateContent({
          model,
          contents: prompt,
        });
      } else {
        response = await ai.models.generateContent({
          model,
          contents: prompt.contents,
          config: prompt.systemInstruction
            ? { systemInstruction: prompt.systemInstruction }
            : undefined,
        });
      }

      if (response && response.text) {
        return {
          text: response.text,
          modelUsed: model,
        };
      }
    } catch (err: any) {
      console.warn(`[Gemini Fallback] Model ${model} encountered an error:`, err?.message || err);
      lastError = err;
      // Continue to next fallback model in ladder
    }
  }

  throw new Error(
    `All models in the fallback ladder failed. Last error: ${lastError?.message || 'Unknown Gemini API error'}`
  );
}

// API Health Check
app.get('/api/health', (req: Request, res: Response) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    aiConfigured: Boolean(process.env.GEMINI_API_KEY),
  });
});

// API: Journal Multi-Turn Reflection & Brainstorming
app.post('/api/gemini/reflect', async (req: Request, res: Response) => {
  try {
    const body = req.body && typeof req.body === 'object' ? req.body : {};
    const messages = Array.isArray(body.messages) ? body.messages : [];
    const mode = typeof body.mode === 'string' ? body.mode : 'deep_reflection';

    if (messages.length === 0) {
      return res.status(400).json({ error: 'Missing or empty messages array in request body.' });
    }

    // Build system instructions based on reflection mode
    let systemInstruction = `You are a thoughtful, empathetic, and insightful journaling and reflection companion.
Your goal is to help the user explore their thoughts, process emotions, discover constructive perspectives, and gain clarity.
- Always maintain warmth, compassion, non-judgmental curiosity, and grounded wisdom.
- Use clear, well-structured formatting (markdown headings, short paragraphs, bullet points when appropriate).
- Avoid overly clinical or generic therapist clichés.
- Prompt with gentle, open-ended follow-up questions when fitting.`;

    if (mode === 'brainstorm') {
      systemInstruction += `\nMode: Brainstorming & Ideation. Provide creative, divergent angles, unexpected connections, and constructive thought-starters.`;
    } else if (mode === 'action_steps') {
      systemInstruction += `\nMode: Action & Next Steps. Help distill the user's thoughts into clear, low-friction, realistic next actions or habits.`;
    } else if (mode === 'gratitude') {
      systemInstruction += `\nMode: Gratitude & Positive Reframing. Focus on highlighting subtle wins, gratitude anchors, and resilient mindsets.`;
    } else if (mode === 'summary') {
      systemInstruction += `\nMode: Synthesis & Insight. Provide a crisp crystallization of themes, emotional patterns, and core takeaways.`;
    }

    // Transform chat messages to Gemini contents format
    const contents = messages.map((m: any) => ({
      role: m.role === 'model' ? 'model' : 'user',
      parts: [{ text: String(m.content || '') }],
    }));

    const result = await generateContentWithFallback({
      contents,
      systemInstruction,
    });

    return res.json({
      reply: result.text,
      modelUsed: result.modelUsed,
    });
  } catch (error: any) {
    console.error('Error in /api/gemini/reflect:', error);
    return res.status(500).json({
      error: error.message || 'Failed to generate reflection response.',
    });
  }
});

// API: Journal Entry Summarization & Auto-Tagging
app.post('/api/gemini/summarize', async (req: Request, res: Response) => {
  try {
    const body = req.body && typeof req.body === 'object' ? req.body : {};
    const text = typeof body.text === 'string' ? body.text : '';

    if (!text.trim()) {
      return res.status(400).json({ error: 'Text content is required for summarization.' });
    }

    const prompt = `Analyze this personal journal or reflection conversation and produce a JSON response with:
1. "title": A succinct, poetic or crisp 3-6 word title capturing the essence.
2. "summary": A concise 1-2 sentence executive summary of the key insight or theme.
3. "tags": An array of 2-4 lowercase single-word or short tags (e.g. ["clarity", "career", "mindset"]).

Return ONLY pure valid JSON, with no markdown code fences or additional commentary.

Journal content:
"""
${text.slice(0, 10000)}
"""`;

    const result = await generateContentWithFallback(prompt);

    let parsed: any = null;
    try {
      const cleanJson = result.text.replace(/```json/g, '').replace(/```/g, '').trim();
      parsed = JSON.parse(cleanJson);
    } catch {
      parsed = {
        title: 'Personal Reflection',
        summary: result.text.slice(0, 150),
        tags: ['reflection', 'journal'],
      };
    }

    return res.json({
      title: parsed.title || 'Personal Reflection',
      summary: parsed.summary || '',
      tags: Array.isArray(parsed.tags) ? parsed.tags : ['reflection'],
      modelUsed: result.modelUsed,
    });
  } catch (error: any) {
    console.error('Error in /api/gemini/summarize:', error);
    return res.status(500).json({
      error: error.message || 'Failed to generate summary.',
    });
  }
});

// Vite Middleware for Development / Static Hosting in Production
async function startServer() {
  if (process.env.NODE_ENV !== 'production') {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req: Request, res: Response) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`ReflectAI Server running at http://0.0.0.0:${PORT}`);
  });
}

startServer();
