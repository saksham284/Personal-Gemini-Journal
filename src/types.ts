export type ReflectionMode =
  | 'deep_reflection'
  | 'brainstorm'
  | 'summary'
  | 'action_steps'
  | 'gratitude';

export interface ChatMessage {
  id: string;
  role: 'user' | 'model';
  content: string;
  timestamp: number;
}

export type GapClassification = 'reverses' | 'abandons' | 'refines' | 'reinforces';

export type PredictionOutcome =
  | 'pending'
  | 'happened'
  | 'did_not_happen'
  | 'still_open'
  | 'no_longer_relevant';

export interface ExtractedClaim {
  id: string;
  statement: string;
  topicSlug: string;
  conviction: number; // 0 to 1
  sessionId?: string;
  createdAt: number;
  isPredictive?: boolean;
  reviewInDays?: number;
  reviewAt?: number;
  outcome?: PredictionOutcome;
  resolvedAt?: number;
  lastPostponedAt?: number;
}

export interface CalibrationBandStats {
  total: number;
  happened: number;
  rate: number; // 0 to 1
}

export interface CalibrationRecord {
  totalResolved: number;
  totalHappened: number;
  overallRate: number;
  highBand: CalibrationBandStats; // 0.7 - 1.0
  mediumBand: CalibrationBandStats; // 0.4 - 0.7
  lowBand: CalibrationBandStats; // 0.0 - 0.4
}

export interface ClaimGap {
  id: string;
  topicSlug: string;
  previousClaim: string;
  newClaim: string;
  classification: 'reverses' | 'abandons' | 'refines'; // Filed only for the first three
  question: string;
}

export interface JournalEntry {
  id: string;
  userId: string;
  title: string;
  summary?: string;
  mode: ReflectionMode;
  messages: ChatMessage[];
  tags: string[];
  isSealed?: boolean;
  sealedAt?: number;
  claims?: ExtractedClaim[];
  claimGaps?: ClaimGap[];
  createdAt: number;
  updatedAt: number;
}

export interface UserTopicsMeta {
  slugs: string[];
  updatedAt: number;
}

export interface UserProfile {
  uid: string;
  email: string | null;
  displayName: string | null;
  photoURL: string | null;
  createdAt: number;
}

export interface ReflectionRequestPayload {
  messages: Array<{ role: 'user' | 'model'; content: string }>;
  mode?: ReflectionMode;
  userContext?: string;
}

export interface ReflectionResponsePayload {
  reply: string;
  modelUsed: string;
  suggestions?: string[];
}

export interface SummarizeResponsePayload {
  title: string;
  summary: string;
  tags: string[];
  modelUsed: string;
}

export interface SealSessionRequestPayload {
  conversationText: string;
  existingTopicSlugs?: string[];
  previousClaims?: Array<{
    statement: string;
    topicSlug: string;
    conviction: number;
    createdAt?: number;
  }>;
}

export interface SealSessionResponsePayload {
  claims: ExtractedClaim[];
  claimGaps: ClaimGap[];
  updatedSlugs: string[];
  modelUsed: string;
}

