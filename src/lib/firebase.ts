import { initializeApp, getApps, getApp } from 'firebase/app';
import {
  getAuth,
  signInWithPopup,
  GoogleAuthProvider,
  signOut as firebaseSignOut,
  onAuthStateChanged,
  type User,
} from 'firebase/auth';
import {
  getFirestore,
  collection,
  doc,
  getDoc,
  getDocs,
  setDoc,
  deleteDoc,
  onSnapshot,
  query,
  orderBy,
  serverTimestamp,
  type Firestore,
} from 'firebase/firestore';
import firebaseConfigJson from '../../firebase-applet-config.json';
import type { JournalEntry, ChatMessage, ReflectionMode, ExtractedClaim, ClaimGap, UserTopicsMeta } from '../types';

const firebaseConfig = {
  apiKey: firebaseConfigJson.apiKey,
  authDomain: firebaseConfigJson.authDomain,
  projectId: firebaseConfigJson.projectId,
  storageBucket: firebaseConfigJson.storageBucket,
  messagingSenderId: firebaseConfigJson.messagingSenderId,
  appId: firebaseConfigJson.appId,
};

// Initialize Firebase App singleton
const app = !getApps().length ? initializeApp(firebaseConfig) : getApp();
export const auth = getAuth(app);

// Use custom firestoreDatabaseId if configured in firebase-applet-config.json
const databaseId = firebaseConfigJson.firestoreDatabaseId || undefined;
export const db: Firestore = databaseId ? getFirestore(app, databaseId) : getFirestore(app);

const googleProvider = new GoogleAuthProvider();
googleProvider.setCustomParameters({ prompt: 'select_account' });

/**
 * Strips undefined properties recursively from an object before saving to Firestore.
 * Prevents Firestore "Function setDoc() called with invalid data. Unsupported field value: undefined" errors.
 */
export function stripUndefined<T>(obj: T): T {
  if (obj === null || obj === undefined) {
    return obj;
  }
  if (Array.isArray(obj)) {
    return obj.map((item) => stripUndefined(item)) as unknown as T;
  }
  if (typeof obj === 'object') {
    const cleaned: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(obj)) {
      if (value !== undefined) {
        cleaned[key] = stripUndefined(value);
      }
    }
    return cleaned as T;
  }
  return obj;
}

export async function signInWithGoogle(): Promise<User> {
  const result = await signInWithPopup(auth, googleProvider);
  return result.user;
}

export async function logOut(): Promise<void> {
  await firebaseSignOut(auth);
}

export function subscribeToAuthChanges(callback: (user: User | null) => void) {
  return onAuthStateChanged(auth, callback);
}

/**
 * Real-time subscription to user's journal entries
 * Scoped strictly to /users/{userId}/interactions
 */
export function subscribeToJournalEntries(
  userId: string,
  onData: (entries: JournalEntry[]) => void,
  onError: (err: Error) => void
) {
  if (!userId) {
    onData([]);
    return () => {};
  }

  const interactionsRef = collection(db, 'users', userId, 'interactions');
  const q = query(interactionsRef, orderBy('updatedAt', 'desc'));

  return onSnapshot(
    q,
    (snapshot) => {
      const entries: JournalEntry[] = snapshot.docs.map((docSnap) => {
        const data = docSnap.data();
        return {
          id: docSnap.id,
          userId: data.userId || userId,
          title: data.title || 'Untitled Reflection',
          summary: data.summary || '',
          mode: (data.mode as ReflectionMode) || 'deep_reflection',
          messages: Array.isArray(data.messages) ? data.messages : [],
          tags: Array.isArray(data.tags) ? data.tags : [],
          isSealed: Boolean(data.isSealed),
          sealedAt: typeof data.sealedAt === 'number' ? data.sealedAt : undefined,
          claims: Array.isArray(data.claims) ? data.claims : [],
          claimGaps: Array.isArray(data.claimGaps) ? data.claimGaps : [],
          createdAt: typeof data.createdAt === 'number' ? data.createdAt : Date.now(),
          updatedAt: typeof data.updatedAt === 'number' ? data.updatedAt : Date.now(),
        };
      });
      onData(entries);
    },
    (error) => {
      console.error('Firestore subscription error:', error);
      onError(error);
    }
  );
}

/**
 * Saves or updates a journal interaction entry in Firestore
 */
export async function saveJournalEntry(entry: JournalEntry): Promise<void> {
  if (!entry.userId || !entry.id) {
    throw new Error('Missing userId or entryId for persistence.');
  }

  const entryRef = doc(db, 'users', entry.userId, 'interactions', entry.id);
  const sanitizedPayload = stripUndefined({
    ...entry,
    updatedAt: Date.now(),
    serverSyncedAt: serverTimestamp(),
  });

  await setDoc(entryRef, sanitizedPayload, { merge: true });
}

/**
 * Deletes a journal interaction entry from Firestore
 */
export async function removeJournalEntry(userId: string, entryId: string): Promise<void> {
  if (!userId || !entryId) {
    throw new Error('Missing userId or entryId for deletion.');
  }
  const entryRef = doc(db, 'users', userId, 'interactions', entryId);
  await deleteDoc(entryRef);
}

/**
 * Reads user topic slugs stored at users/{uid}/meta/topics
 */
export async function getUserTopicSlugs(userId: string): Promise<string[]> {
  if (!userId) return [];
  try {
    const topicDocRef = doc(db, 'users', userId, 'meta', 'topics');
    const snap = await getDoc(topicDocRef);
    if (snap.exists()) {
      const data = snap.data();
      if (Array.isArray(data.slugs)) {
        return data.slugs.map((s: any) => String(s).toLowerCase().trim()).filter(Boolean);
      }
    }
  } catch (err) {
    console.error('Error fetching user topic slugs:', err);
  }
  return [];
}

/**
 * Saves user topic slugs to users/{uid}/meta/topics
 */
export async function saveUserTopicSlugs(userId: string, slugs: string[]): Promise<void> {
  if (!userId) return;
  try {
    const topicDocRef = doc(db, 'users', userId, 'meta', 'topics');
    await setDoc(
      topicDocRef,
      {
        slugs,
        updatedAt: Date.now(),
        serverSyncedAt: serverTimestamp(),
      },
      { merge: true }
    );
  } catch (err) {
    console.error('Error saving user topic slugs:', err);
  }
}

/**
 * Saves extracted claims to users/{uid}/claims/{claimId}
 */
export async function saveUserClaims(userId: string, claims: ExtractedClaim[]): Promise<void> {
  if (!userId || !claims.length) return;
  try {
    for (const claim of claims) {
      if (!claim.id) continue;
      const claimRef = doc(db, 'users', userId, 'claims', claim.id);
      const payload = stripUndefined({
        ...claim,
        createdAt: claim.createdAt || Date.now(),
        serverSyncedAt: serverTimestamp(),
      });
      await setDoc(claimRef, payload, { merge: true });
    }
  } catch (err) {
    console.error('Error saving user claims:', err);
  }
}

/**
 * Fetches all past claims for a user to track evolution across sessions
 */
export async function getAllUserClaims(userId: string): Promise<ExtractedClaim[]> {
  if (!userId) return [];
  try {
    const claimsRef = collection(db, 'users', userId, 'claims');
    const q = query(claimsRef, orderBy('createdAt', 'desc'));
    const snap = await getDocs(q);
    return snap.docs.map((d) => {
      const data = d.data();
      return {
        id: d.id,
        statement: data.statement || '',
        topicSlug: data.topicSlug || '',
        conviction: typeof data.conviction === 'number' ? data.conviction : 0.5,
        sessionId: data.sessionId,
        createdAt: typeof data.createdAt === 'number' ? data.createdAt : Date.now(),
        isPredictive: Boolean(data.isPredictive),
        reviewInDays: typeof data.reviewInDays === 'number' ? data.reviewInDays : undefined,
        reviewAt: typeof data.reviewAt === 'number' ? data.reviewAt : undefined,
        outcome: data.outcome,
        resolvedAt: typeof data.resolvedAt === 'number' ? data.resolvedAt : undefined,
        lastPostponedAt: typeof data.lastPostponedAt === 'number' ? data.lastPostponedAt : undefined,
      };
    });
  } catch (err) {
    console.warn('Error fetching all user claims:', err);
    return [];
  }
}

/**
 * Fetches and partitions all user predictions and computes calibration metrics
 */
export async function getUserPredictions(userId: string): Promise<{
  dueClaims: ExtractedClaim[];
  upcomingClaims: ExtractedClaim[];
  resolvedClaims: ExtractedClaim[];
  calibration: import('../types').CalibrationRecord;
  soonestUpcomingReviewAt: number | null;
}> {
  const emptyCalibration: import('../types').CalibrationRecord = {
    totalResolved: 0,
    totalHappened: 0,
    overallRate: 0,
    highBand: { total: 0, happened: 0, rate: 0 },
    mediumBand: { total: 0, happened: 0, rate: 0 },
    lowBand: { total: 0, happened: 0, rate: 0 },
  };

  if (!userId) {
    return {
      dueClaims: [],
      upcomingClaims: [],
      resolvedClaims: [],
      calibration: emptyCalibration,
      soonestUpcomingReviewAt: null,
    };
  }

  const allClaims = await getAllUserClaims(userId);
  const predictiveClaims = allClaims.filter((c) => c.isPredictive);
  const now = Date.now();

  const dueClaims: ExtractedClaim[] = [];
  const upcomingClaims: ExtractedClaim[] = [];
  const resolvedClaims: ExtractedClaim[] = [];

  for (const claim of predictiveClaims) {
    const reviewAt = claim.reviewAt || 0;
    const outcome = claim.outcome || 'pending';

    if (outcome === 'pending') {
      if (reviewAt <= now) {
        dueClaims.push(claim);
      } else {
        upcomingClaims.push(claim);
      }
    } else {
      resolvedClaims.push(claim);
    }
  }

  // Sort queues
  dueClaims.sort((a, b) => (a.reviewAt || 0) - (b.reviewAt || 0));
  upcomingClaims.sort((a, b) => (a.reviewAt || 0) - (b.reviewAt || 0));
  resolvedClaims.sort((a, b) => (b.resolvedAt || 0) - (a.resolvedAt || 0));

  // Compute calibration stats
  const evaluatable = resolvedClaims.filter(
    (c) => c.outcome === 'happened' || c.outcome === 'did_not_happen'
  );

  const calcBand = (min: number, max: number, inclusiveMax = false) => {
    const bandClaims = evaluatable.filter((c) =>
      inclusiveMax ? c.conviction >= min && c.conviction <= max : c.conviction >= min && c.conviction < max
    );
    const happenedCount = bandClaims.filter((c) => c.outcome === 'happened').length;
    return {
      total: bandClaims.length,
      happened: happenedCount,
      rate: bandClaims.length > 0 ? Math.round((happenedCount / bandClaims.length) * 100) / 100 : 0,
    };
  };

  const highBand = calcBand(0.7, 1.0, true);
  const mediumBand = calcBand(0.4, 0.7, false);
  const lowBand = calcBand(0.0, 0.4, false);

  const totalResolved = evaluatable.length;
  const totalHappened = evaluatable.filter((c) => c.outcome === 'happened').length;
  const overallRate = totalResolved > 0 ? Math.round((totalHappened / totalResolved) * 100) / 100 : 0;

  const calibration = {
    totalResolved,
    totalHappened,
    overallRate,
    highBand,
    mediumBand,
    lowBand,
  };

  const soonestUpcomingReviewAt = upcomingClaims.length > 0 ? upcomingClaims[0].reviewAt || null : null;

  return {
    dueClaims,
    upcomingClaims,
    resolvedClaims,
    calibration,
    soonestUpcomingReviewAt,
  };
}

/**
 * Resolves a prediction with the specified outcome and updates Firestore
 */
export async function resolveUserPrediction(
  userId: string,
  claimId: string,
  outcome: import('../types').PredictionOutcome
): Promise<void> {
  if (!userId || !claimId) return;

  const claimRef = doc(db, 'users', userId, 'claims', claimId);
  const now = Date.now();
  let updatedFields: Record<string, any> = {};

  if (outcome === 'still_open') {
    const newReviewAt = now + 30 * 24 * 60 * 60 * 1000;
    updatedFields = {
      outcome: 'pending',
      reviewAt: newReviewAt,
      lastPostponedAt: now,
      updatedAt: now,
      serverSyncedAt: serverTimestamp(),
    };
  } else {
    updatedFields = {
      outcome,
      resolvedAt: now,
      updatedAt: now,
      serverSyncedAt: serverTimestamp(),
    };
  }

  await setDoc(claimRef, stripUndefined(updatedFields), { merge: true });

  // Update embedded claim if linked to a session
  try {
    const claimSnap = await getDoc(claimRef);
    if (claimSnap.exists()) {
      const claimData = claimSnap.data();
      if (claimData?.sessionId) {
        const interactionRef = doc(db, 'users', userId, 'interactions', claimData.sessionId);
        const interactionSnap = await getDoc(interactionRef);
        if (interactionSnap.exists()) {
          const interactionData = interactionSnap.data();
          if (Array.isArray(interactionData?.claims)) {
            const updatedClaims = interactionData.claims.map((c: any) => {
              if (c.id === claimId) {
                return {
                  ...c,
                  outcome: outcome === 'still_open' ? 'pending' : outcome,
                  reviewAt: updatedFields.reviewAt ?? c.reviewAt,
                  resolvedAt: updatedFields.resolvedAt ?? c.resolvedAt,
                  lastPostponedAt: updatedFields.lastPostponedAt ?? c.lastPostponedAt,
                };
              }
              return c;
            });
            await setDoc(interactionRef, { claims: updatedClaims, updatedAt: now }, { merge: true });
          }
        }
      }
    }
  } catch (err) {
    console.warn('Notice updating interaction embedded claims:', err);
  }
}


