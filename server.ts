import express, { Request, Response, NextFunction } from 'express';
import path from 'path';
import fs from 'fs';
import dotenv from 'dotenv';
import { GoogleGenAI, Type } from '@google/genai';
import { initializeApp, getApps, applicationDefault } from 'firebase-admin/app';
import { getAuth, DecodedIdToken } from 'firebase-admin/auth';
import { getFirestore, FieldValue } from 'firebase-admin/firestore';

dotenv.config();

// Resolve Project ID and Database ID from environment or fallback to firebase-applet-config.json
let appletProjectId: string | undefined;
let appletFirestoreDatabaseId: string | undefined;
try {
  const configPath = path.join(process.cwd(), 'firebase-applet-config.json');
  if (fs.existsSync(configPath)) {
    const rawConfig = fs.readFileSync(configPath, 'utf8');
    const parsed = JSON.parse(rawConfig);
    appletProjectId = parsed.projectId;
    appletFirestoreDatabaseId = parsed.firestoreDatabaseId;
  }
} catch (err) {
  console.warn('[Firebase Config] Notice reading firebase-applet-config.json:', err);
}

const targetProjectId = process.env.FIREBASE_PROJECT_ID || appletProjectId;
const targetDatabaseId = process.env.FIRESTORE_DATABASE_ID || appletFirestoreDatabaseId;

if (!targetProjectId) {
  throw new Error(
    '[Firebase Admin Critical] Target Project ID could not be determined from environment or firebase-applet-config.json. Halting server startup (fail closed).'
  );
}

// 1. Initialize Firebase Admin with explicit projectId
let firebaseApp: any;
if (!getApps().length) {
  try {
    firebaseApp = initializeApp({
      credential: applicationDefault(),
      projectId: targetProjectId,
    });
  } catch (err) {
    console.warn('[Firebase Admin] Notice on applicationDefault() initialization:', err);
    firebaseApp = initializeApp({
      projectId: targetProjectId,
    });
  }
} else {
  firebaseApp = getApps()[0];
}

// Fail-closed verification on startup
const resolvedAdminProjectId = firebaseApp?.options?.projectId;
console.log(`[Firebase Admin Startup] Initialized Firebase Admin with Project ID: "${resolvedAdminProjectId}" (Target: "${targetProjectId}")`);

if (!resolvedAdminProjectId || resolvedAdminProjectId !== targetProjectId) {
  throw new Error(
    `[Firebase Admin Critical] Resolved Project ID ("${resolvedAdminProjectId}") does not match target Project ID ("${targetProjectId}"). Halting server startup (fail closed).`
  );
}

// Admin Firestore instance for internal server counters
const adminDb = targetDatabaseId && targetDatabaseId !== '(default)'
  ? getFirestore(firebaseApp, targetDatabaseId)
  : getFirestore(firebaseApp);

console.log(`[Firebase Admin Startup] Initialized Firestore Admin Database: "${targetDatabaseId || '(default)'}"`);

const app = express();
const PORT = 3000;

// Type extension for Express Request
declare global {
  namespace Express {
    interface Request {
      uid?: string;
      token?: DecodedIdToken;
    }
  }
}

// 1. Top-Level Request Deserialization (Ordering Guarantee)
app.use(express.json({ limit: '2mb' }));
app.use(express.urlencoded({ extended: true, limit: '2mb' }));

// Unauthenticated health / uptime probe endpoint (Accessible without Bearer token)
app.get('/api/health', (req: Request, res: Response) => {
  res.status(200).json({
    status: 'ok',
    timestamp: Date.now(),
    service: 'MindtrailAI-SecondThought',
    uptime: process.uptime(),
  });
});

// 2. Authentication Middleware: Revocation-checked Firebase ID Token Verification
async function requireUser(req: Request, res: Response, next: NextFunction) {
  const authHeader = req.headers.authorization;
  const correlationId = `corr_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({
      error: 'Authentication required. Missing or malformed Authorization header.',
      code: 'UNAUTHORIZED_MISSING_TOKEN',
      correlationId,
    });
  }

  const token = authHeader.slice(7).trim();
  if (!token) {
    return res.status(401).json({
      error: 'Authentication required. Token not provided.',
      code: 'UNAUTHORIZED_EMPTY_TOKEN',
      correlationId,
    });
  }

  try {
    // Cryptographically verify ID token against project ID, signature, expiration, and issuer
    const decodedToken = await getAuth().verifyIdToken(token);

    // Reject anonymous sign-in providers with 403
    const provider = decodedToken.firebase?.sign_in_provider;
    if (provider === 'anonymous' || decodedToken.provider_id === 'anonymous') {
      return res.status(403).json({
        error: 'Anonymous access is forbidden.',
        code: 'ANONYMOUS_ACCESS_FORBIDDEN',
        correlationId,
      });
    }

    req.uid = decodedToken.uid;
    req.token = decodedToken;
    return next();
  } catch (err: any) {
    console.error(`[Auth 401 Debug] verifyIdToken failed. Code: "${err?.code}", Message: "${err?.message}", Stack: ${err?.stack} [Correlation ID: ${correlationId}]`);
    return res.status(401).json({
      error: 'Invalid, expired, or revoked authentication token.',
      code: 'UNAUTHORIZED_TOKEN',
      correlationId,
    });
  }
}

// Mount requireUser on ALL /api routes before any API handler
app.use('/api', requireUser);

// 3. Per-User Cost Control & Rate Limiting Middleware for /api/gemini/*

// (a) In-memory Token Bucket: 20 requests per minute per uid
interface TokenBucket {
  tokens: number;
  lastRefill: number; // epoch ms
}
const userBuckets = new Map<string, TokenBucket>();
const BUCKET_CAPACITY = 20; // 20 requests max burst
const REFILL_RATE_PER_MS = 20 / 60000; // 20 tokens per 60,000 ms = 1 token per 3000ms

function checkTokenBucket(uid: string): boolean {
  const now = Date.now();
  let bucket = userBuckets.get(uid);

  if (!bucket) {
    bucket = { tokens: BUCKET_CAPACITY - 1, lastRefill: now };
    userBuckets.set(uid, bucket);
    return true;
  }

  // Refill tokens based on elapsed time
  const elapsed = Math.max(0, now - bucket.lastRefill);
  bucket.tokens = Math.min(BUCKET_CAPACITY, bucket.tokens + elapsed * REFILL_RATE_PER_MS);
  bucket.lastRefill = now;

  if (bucket.tokens >= 1) {
    bucket.tokens -= 1;
    return true;
  }

  return false;
}

// Periodically clean up stale token buckets to prevent memory leaks (every 10 minutes)
setInterval(() => {
  const cutoff = Date.now() - 15 * 60 * 1000;
  for (const [uid, bucket] of userBuckets.entries()) {
    if (bucket.lastRefill < cutoff) {
      userBuckets.delete(uid);
    }
  }
}, 10 * 60 * 1000);

// In-memory daily call counters per user (acting as fallback/cache if Firestore transaction experiences transient hiccups)
interface UserDailyTracker {
  date: string;
  count: number;
}
const userDailyCounters = new Map<string, UserDailyTracker>();

// (b) Daily Quota Enforcement inside Firestore Transaction (Admin SDK writable only)
async function enforceGeminiQuota(req: Request, res: Response, next: NextFunction) {
  const uid = req.uid;
  const correlationId = `corr_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;

  if (!uid) {
    return res.status(401).json({
      error: 'User ID missing from authenticated context.',
      code: 'UNAUTHORIZED_MISSING_UID',
      correlationId,
    });
  }

  // Step 1: In-memory token bucket rate limit (20 req / min)
  const hasToken = checkTokenBucket(uid);
  if (!hasToken) {
    return res.status(429).json({
      error: 'You have exceeded the rate limit (20 requests per minute). Please slow down and try again shortly.',
      code: 'RATE_LIMITED',
      correlationId,
    });
  }

  // Step 2: Daily Call Limit via Admin Firestore Transaction with in-memory fallback
  const parsedLimit = parseInt(process.env.DAILY_CALL_LIMIT || '120', 10);
  const dailyLimit = Number.isFinite(parsedLimit) && parsedLimit > 0 ? parsedLimit : 120;

  // Format today's date in YYYY-MM-DD (UTC)
  const todayDocId = new Date().toISOString().slice(0, 10);
  const quotaDocRef = adminDb.collection('users').doc(uid).collection('quota').doc(todayDocId);

  try {
    const transactionResult = await adminDb.runTransaction(async (transaction) => {
      const quotaDoc = await transaction.get(quotaDocRef);
      let currentCount = 0;

      if (quotaDoc.exists) {
        currentCount = quotaDoc.data()?.callCount || 0;
      }

      if (currentCount >= dailyLimit) {
        return { allowed: false, currentCount, dailyLimit };
      }

      const nextCount = currentCount + 1;
      transaction.set(
        quotaDocRef,
        {
          callCount: nextCount,
          dailyLimit,
          updatedAt: FieldValue.serverTimestamp(),
          date: todayDocId,
        },
        { merge: true }
      );

      return { allowed: true, currentCount: nextCount, dailyLimit };
    });

    // Update in-memory tracker
    userDailyCounters.set(uid, { date: todayDocId, count: transactionResult.currentCount });

    if (!transactionResult.allowed) {
      return res.status(429).json({
        error: `Daily Gemini AI call quota reached (${transactionResult.currentCount}/${transactionResult.dailyLimit} calls for today). Your quota will reset tomorrow.`,
        code: 'DAILY_LIMIT_REACHED',
        correlationId,
        currentCount: transactionResult.currentCount,
        dailyLimit: transactionResult.dailyLimit,
      });
    }

    return next();
  } catch (err: any) {
    console.warn(`[Quota Notice] Admin Firestore transaction encountered issue for user ${uid} [${correlationId}]:`, err?.message || err);

    // Resilient fallback: evaluate in-memory daily tracker
    let userTracker = userDailyCounters.get(uid);
    if (!userTracker || userTracker.date !== todayDocId) {
      userTracker = { date: todayDocId, count: 0 };
    }

    if (userTracker.count >= dailyLimit) {
      return res.status(429).json({
        error: `Daily Gemini AI call quota reached (${userTracker.count}/${dailyLimit} calls for today). Your quota will reset tomorrow.`,
        code: 'DAILY_LIMIT_REACHED',
        correlationId,
        currentCount: userTracker.count,
        dailyLimit,
      });
    }

    userTracker.count += 1;
    userDailyCounters.set(uid, userTracker);
    return next();
  }
}

// Mount enforceGeminiQuota on ALL /api/gemini/* routes
app.use('/api/gemini', enforceGeminiQuota);

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
  prompt: string | { contents: any; systemInstruction?: string; config?: any }
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
        const genConfig = {
          ...(prompt.config || {}),
          ...(prompt.systemInstruction ? { systemInstruction: prompt.systemInstruction } : {}),
        };
        response = await ai.models.generateContent({
          model,
          contents: prompt.contents,
          config: Object.keys(genConfig).length > 0 ? genConfig : undefined,
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

// API: Extract claims and classify evolution gaps on session seal
app.post('/api/gemini/seal-session', async (req: Request, res: Response) => {
  try {
    const uid = req.uid;
    const body = req.body && typeof req.body === 'object' ? req.body : {};
    const conversationText = typeof body.conversationText === 'string' ? body.conversationText.slice(0, 20000) : '';
    const sessionId = typeof body.sessionId === 'string' ? body.sessionId : undefined;
    const existingTopicSlugs: string[] = Array.isArray(body.existingTopicSlugs)
      ? body.existingTopicSlugs.map((s: any) => String(s).toLowerCase().trim()).filter(Boolean)
      : [];
    const previousClaims = Array.isArray(body.previousClaims) ? body.previousClaims : [];

    if (!conversationText.trim()) {
      return res.json({
        claims: [],
        claimGaps: [],
        updatedSlugs: existingTopicSlugs,
        modelUsed: 'none',
      });
    }

    const previousClaimsFormatted = previousClaims.length > 0
      ? previousClaims
          .map(
            (c: any, i: number) =>
              `${i + 1}. [Topic: ${String(c.topicSlug || 'unknown')}] (Conviction: ${c.conviction ?? 'unknown'}) "${String(c.statement || '')}"`
          )
          .join('\n')
      : 'None recorded yet.';

    const systemInstruction = `You are a precision epistemological analyst for a personal reflective journal companion.
When a user seals a reflection session, your task is to:
1. Extract first-person stances (claims) the user expressed in their reflection that they could later abandon, modify, or evolve (e.g., self-commitments, beliefs, rules, life philosophies, habits, strong attitudes, or work priorities).
2. Assign each claim a lower-kebab-case topic slug.
3. CRITICAL TOPIC SLUG REUSE: You are provided with the user's existing topic slugs: [${existingTopicSlugs.map((s) => `"${s}"`).join(', ')}]. If an extracted claim fits or relates to any of these existing topic slugs, you MUST REUSE that exact slug (e.g. reuse "career-direction" instead of inventing "career-path" or "job-transition"). If no existing slug is a good match, generate a concise new lower-kebab-case slug.
4. Assign a conviction score between 0.0 (hesitant/exploratory) and 1.0 (firm/dogmatic).
5. Evolution Gap Analysis: When a newly extracted claim shares a topic slug with any older claim provided in the Historical Claims list:
   - Compare the older stance with the new stance.
   - Classify the shift as strictly one of: "reverses", "abandons", "refines", or "reinforces".
   - Generate exactly one reflective, constructive question probing this perspective shift.`;

    const promptText = `USER SESSION TEXT:
"""
${conversationText}
"""

EXISTING TOPIC SLUGS (Reuse these whenever applicable):
${existingTopicSlugs.length > 0 ? existingTopicSlugs.join(', ') : 'None yet'}

HISTORICAL CLAIMS:
${previousClaimsFormatted}

Extract all explicit first-person stances/claims, assign topic slugs (reusing existing ones where applicable) and 0-1 conviction scores, and evaluate evolution gaps for any claims sharing a topic with historical claims.`;

    const claimsSchema = {
      type: Type.OBJECT,
      properties: {
        claims: {
          type: Type.ARRAY,
          description: 'List of first-person stances/claims extracted from the session that the user could later abandon or evolve.',
          items: {
            type: Type.OBJECT,
            properties: {
              statement: {
                type: Type.STRING,
                description: 'The first-person stance/claim stated by the user.',
              },
              topicSlug: {
                type: Type.STRING,
                description: 'Lower-kebab-case topic slug (e.g., "career-direction", "morning-routine"). Reuses existing slugs when appropriate.',
              },
              conviction: {
                type: Type.NUMBER,
                description: 'Conviction score between 0.0 and 1.0.',
              },
            },
            required: ['statement', 'topicSlug', 'conviction'],
          },
        },
        gaps: {
          type: Type.ARRAY,
          description: 'Evolution comparisons for any newly extracted claim that shares a topic with historical claims.',
          items: {
            type: Type.OBJECT,
            properties: {
              topicSlug: {
                type: Type.STRING,
                description: 'The shared lower-kebab-case topic slug.',
              },
              previousClaim: {
                type: Type.STRING,
                description: 'The older historical claim statement on this topic.',
              },
              newClaim: {
                type: Type.STRING,
                description: 'The newly extracted claim statement.',
              },
              classification: {
                type: Type.STRING,
                enum: ['reverses', 'abandons', 'refines', 'reinforces'],
                description: 'Classification of how the new stance compares to the old one.',
              },
              question: {
                type: Type.STRING,
                description: 'One probing question examining the shift.',
              },
            },
            required: ['topicSlug', 'previousClaim', 'newClaim', 'classification', 'question'],
          },
        },
      },
      required: ['claims', 'gaps'],
    };

    const result = await generateContentWithFallback({
      contents: [{ role: 'user', parts: [{ text: promptText }] }],
      systemInstruction,
      config: {
        responseMimeType: 'application/json',
        responseSchema: claimsSchema,
        temperature: 0.3,
      },
    });

    let rawParsed: any = null;
    try {
      const cleanJson = result.text.replace(/```json/g, '').replace(/```/g, '').trim();
      rawParsed = JSON.parse(cleanJson);
    } catch {
      rawParsed = { claims: [], gaps: [] };
    }

    // Defensive parsing & clamping on our side
    const rawClaims = Array.isArray(rawParsed?.claims) ? rawParsed.claims : [];
    const rawGaps = Array.isArray(rawParsed?.gaps) ? rawParsed.gaps : [];

    const parsedClaims = rawClaims
      .map((c: any) => {
        const rawSlug = String(c.topicSlug || '').toLowerCase().trim();
        const cleanSlug = rawSlug.replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '') || 'general-reflection';
        
        let conviction = 0.5;
        if (typeof c.conviction === 'number') {
          conviction = c.conviction;
        } else if (typeof c.conviction === 'string') {
          conviction = parseFloat(c.conviction) || 0.5;
        }
        // Clamp strictly to [0, 1]
        conviction = Math.max(0, Math.min(1, Math.round(conviction * 100) / 100));

        const statement = String(c.statement || '').trim();
        if (!statement) return null;

        return {
          id: `claim-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
          statement,
          topicSlug: cleanSlug,
          conviction,
          sessionId: sessionId || undefined,
          createdAt: Date.now(),
        };
      })
      .filter(Boolean);

    // "File only the first three" - reverses / abandons / refines (exclude reinforces)
    const allowedGapClassifications = new Set(['reverses', 'abandons', 'refines']);
    const filedGaps = rawGaps
      .map((g: any) => {
        const rawClass = String(g.classification || '').toLowerCase().trim();
        if (!allowedGapClassifications.has(rawClass)) {
          return null;
        }
        const rawSlug = String(g.topicSlug || '').toLowerCase().trim();
        const cleanSlug = rawSlug.replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '') || 'general-reflection';
        
        const question = String(g.question || '').trim();
        const previousClaim = String(g.previousClaim || '').trim();
        const newClaim = String(g.newClaim || '').trim();

        if (!question || !newClaim) return null;

        return {
          id: `gap-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
          topicSlug: cleanSlug,
          previousClaim: previousClaim || 'Prior stance',
          newClaim,
          classification: rawClass as 'reverses' | 'abandons' | 'refines',
          question,
        };
      })
      .filter(Boolean);

    // Build the updated list of unique slugs
    const newSlugs = parsedClaims.map((c: any) => c.topicSlug);
    const updatedSlugs = Array.from(new Set([...existingTopicSlugs, ...newSlugs]));

    // Server-side Admin SDK writes for topic-slugs and claims (write-locked from client)
    if (uid) {
      try {
        // 1. Write users/{uid}/meta/topics
        const topicDocRef = adminDb.collection('users').doc(uid).collection('meta').doc('topics');
        await topicDocRef.set(
          {
            slugs: updatedSlugs,
            updatedAt: Date.now(),
            serverSyncedAt: FieldValue.serverTimestamp(),
          },
          { merge: true }
        );

        // 2. Write users/{uid}/claims/{claimId}
        if (parsedClaims.length > 0) {
          const batch = adminDb.batch();
          for (const claim of parsedClaims) {
            const claimDocRef = adminDb.collection('users').doc(uid).collection('claims').doc(claim.id);
            batch.set(
              claimDocRef,
              {
                id: claim.id,
                statement: claim.statement,
                topicSlug: claim.topicSlug,
                conviction: claim.conviction,
                sessionId: sessionId || null,
                createdAt: claim.createdAt,
                serverSyncedAt: FieldValue.serverTimestamp(),
              },
              { merge: true }
            );
          }
          await batch.commit();
        }
      } catch (dbErr) {
        console.warn('[Admin Firestore Notice] Failed to persist claims/topics server-side:', dbErr);
      }
    }

    return res.json({
      claims: parsedClaims,
      claimGaps: filedGaps,
      updatedSlugs,
      modelUsed: result.modelUsed,
    });
  } catch (error: any) {
    console.error('Error in /api/gemini/seal-session:', error);
    return res.status(500).json({
      error: error.message || 'Failed to extract claims and analyze session evolution.',
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
    console.log(`MindtrailAI Server running at http://0.0.0.0:${PORT}`);
  });
}

startServer();
