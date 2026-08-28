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

export interface JournalEntry {
  id: string;
  userId: string;
  title: string;
  summary?: string;
  mode: ReflectionMode;
  messages: ChatMessage[];
  tags: string[];
  createdAt: number;
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
