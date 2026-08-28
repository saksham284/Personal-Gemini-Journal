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
      };
    });
  } catch (err) {
    console.warn('Error fetching all user claims:', err);
    return [];
  }
}

