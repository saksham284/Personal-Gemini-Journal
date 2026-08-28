import React, { useState, useEffect, useCallback, useRef } from 'react';
import type { User } from 'firebase/auth';
import {
  auth,
  signInWithGoogle,
  subscribeToAuthChanges,
  subscribeToJournalEntries,
  saveJournalEntry,
  removeJournalEntry,
  getUserTopicSlugs,
  getAllUserClaims,
  logOut,
} from './lib/firebase';
import type { JournalEntry, ChatMessage, ReflectionMode } from './types';
import { Navbar } from './components/Navbar';
import { AuthLanding } from './components/AuthLanding';
import { SidebarHistory } from './components/SidebarHistory';
import { JournalWorkspace } from './components/JournalWorkspace';
import { DeleteModal } from './components/DeleteModal';
import { NotebookPen, Menu, X, LogIn, Lock, RefreshCw } from 'lucide-react';

function createNewBlankEntry(userId: string): JournalEntry {
  return {
    id: `entry_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
    userId,
    title: 'New Reflection',
    summary: '',
    mode: 'deep_reflection',
    messages: [],
    tags: ['reflection'],
    createdAt: Date.now(),
    updatedAt: Date.now(),
  };
}

export default function App() {
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [authLoading, setAuthLoading] = useState<boolean>(true);

  // Journal entries state
  const [entries, setEntries] = useState<JournalEntry[]>([]);
  const [activeEntry, setActiveEntry] = useState<JournalEntry | null>(null);
  const [syncStatus, setSyncStatus] = useState<'synced' | 'saving' | 'error'>('synced');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // AI loading states
  const [isGenerating, setIsGenerating] = useState<boolean>(false);
  const [isSummarizing, setIsSummarizing] = useState<boolean>(false);
  const [isSealing, setIsSealing] = useState<boolean>(false);

  // UI state
  const [sidebarOpen, setSidebarOpen] = useState<boolean>(false);
  const [entryToDelete, setEntryToDelete] = useState<JournalEntry | null>(null);
  const [isDeleting, setIsDeleting] = useState<boolean>(false);

  // 401 Re-authentication state
  const [isReauthModalOpen, setIsReauthModalOpen] = useState<boolean>(false);
  const [isReauthenticating, setIsReauthenticating] = useState<boolean>(false);

  // Fallback cache for retry
  const pendingSaveRef = useRef<JournalEntry | null>(null);

  // 1. Subscribe to Firebase Auth
  useEffect(() => {
    const unsubscribe = subscribeToAuthChanges((user) => {
      setCurrentUser(user);
      setAuthLoading(false);
      if (!user) {
        setEntries([]);
        setActiveEntry(null);
      } else {
        setIsReauthModalOpen(false);
      }
    });

    return () => unsubscribe();
  }, []);

  // 2. Subscribe to Firestore entries when user is authenticated
  useEffect(() => {
    if (!currentUser) return;

    const unsubscribe = subscribeToJournalEntries(
      currentUser.uid,
      (fetchedEntries) => {
        setEntries(fetchedEntries);
        // If no active entry selected, select the first one or create a new blank draft
        setActiveEntry((prev) => {
          if (prev) {
            const updated = fetchedEntries.find((e) => e.id === prev.id);
            return updated || prev;
          }
          return fetchedEntries[0] || createNewBlankEntry(currentUser.uid);
        });
      },
      (err) => {
        console.error('Failed to subscribe to entries:', err);
        setErrorMessage('Could not connect to Firestore database. Please verify security rules or network.');
      }
    );

    return () => unsubscribe();
  }, [currentUser]);

  // Helper for Authenticated API requests with Bearer token & 401 interceptor
  const authFetch = useCallback(
    async (url: string, options: RequestInit = {}): Promise<Response> => {
      if (!currentUser) {
        setIsReauthModalOpen(true);
        throw new Error('Authentication required. Please sign in.');
      }

      let idToken: string;
      try {
        idToken = await currentUser.getIdToken();
      } catch (tokenErr) {
        console.error('Failed to acquire Firebase ID token:', tokenErr);
        setIsReauthModalOpen(true);
        throw new Error('Session expired. Please sign in again.');
      }

      const headers = new Headers(options.headers || {});
      headers.set('Authorization', `Bearer ${idToken}`);
      if (!headers.has('Content-Type') && options.body) {
        headers.set('Content-Type', 'application/json');
      }

      const response = await fetch(url, {
        ...options,
        headers,
      });

      if (response.status === 401) {
        console.warn(`[Client] Received 401 from ${url}. Triggering re-authentication modal.`);
        setIsReauthModalOpen(true);
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || 'Your authentication session has expired. Please sign in again to continue.');
      }

      if (response.status === 429) {
        const errorData = await response.json().catch(() => ({}));
        const code = errorData.code || 'RATE_LIMITED';
        console.warn(`[Client] Received 429 (${code}) from ${url}. Preserving draft and surfacing notice.`);
        throw new Error(errorData.error || 'Rate limit or daily AI call limit reached. Please wait before retrying.');
      }

      return response;
    },
    [currentUser]
  );

  // Re-authentication action
  const handleReauthenticate = async () => {
    setIsReauthenticating(true);
    try {
      await signInWithGoogle();
      setIsReauthModalOpen(false);
      setErrorMessage(null);
    } catch (err: any) {
      console.error('Re-authentication failed:', err);
      setErrorMessage('Re-authentication failed. Please try again.');
    } finally {
      setIsReauthenticating(false);
    }
  };

  // Handle New Entry creation
  const handleNewEntry = useCallback(() => {
    if (!currentUser) return;
    const fresh = createNewBlankEntry(currentUser.uid);
    setActiveEntry(fresh);
    setSidebarOpen(false);
  }, [currentUser]);

  // Handle selecting an existing entry
  const handleSelectEntry = useCallback((entry: JournalEntry) => {
    setActiveEntry(entry);
    setSidebarOpen(false);
  }, []);

  // Update entry and persist to Firestore
  const handleUpdateEntry = async (updated: JournalEntry) => {
    setActiveEntry(updated);
    if (!currentUser) return;

    try {
      setSyncStatus('saving');
      pendingSaveRef.current = updated;
      await saveJournalEntry(updated);
      setSyncStatus('synced');
      setErrorMessage(null);
    } catch (err: any) {
      console.error('Error saving entry to Firestore:', err);
      setSyncStatus('error');
      setErrorMessage('Failed to save to Firestore. Click retry in the top bar.');
    }
  };

  // Retry pending save if previous write failed
  const handleRetrySave = async () => {
    if (!pendingSaveRef.current || !currentUser) return;
    try {
      setSyncStatus('saving');
      await saveJournalEntry(pendingSaveRef.current);
      setSyncStatus('synced');
      setErrorMessage(null);
    } catch (err: any) {
      console.error('Retry save failed:', err);
      setSyncStatus('error');
    }
  };

  // Handle multi-turn message send to Gemini
  const handleSendMessage = async (userText: string, mode: ReflectionMode) => {
    if (!currentUser || !activeEntry) return;

    const userMessage: ChatMessage = {
      id: `msg_${Date.now()}_u`,
      role: 'user',
      content: userText,
      timestamp: Date.now(),
    };

    // Calculate preliminary new title if first message
    let newTitle = activeEntry.title;
    if (activeEntry.messages.length === 0 && activeEntry.title === 'New Reflection') {
      newTitle = userText.slice(0, 38).trim() + (userText.length > 38 ? '...' : '');
    }

    const updatedMessages = [...activeEntry.messages, userMessage];
    const workingEntry: JournalEntry = {
      ...activeEntry,
      title: newTitle,
      mode,
      messages: updatedMessages,
      updatedAt: Date.now(),
    };

    setActiveEntry(workingEntry);
    setIsGenerating(true);
    setErrorMessage(null);

    try {
      // 1. Call backend server endpoint with verified Bearer token
      const response = await authFetch('/api/gemini/reflect', {
        method: 'POST',
        body: JSON.stringify({
          messages: workingEntry.messages.map((m) => ({
            role: m.role,
            content: m.content,
          })),
          mode,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || `Server returned error status ${response.status}`);
      }

      const data = await response.json();
      const modelMessage: ChatMessage = {
        id: `msg_${Date.now()}_m`,
        role: 'model',
        content: data.reply || 'Reflected on your thought.',
        timestamp: Date.now(),
      };

      const finalEntry: JournalEntry = {
        ...workingEntry,
        messages: [...workingEntry.messages, modelMessage],
        updatedAt: Date.now(),
      };

      // 2. Persist complete interaction to Firestore
      await handleUpdateEntry(finalEntry);
    } catch (err: any) {
      console.error('Gemini Reflection error:', err);
      setErrorMessage(err.message || 'Failed to generate reflection with Gemini. Please try again.');
    } finally {
      setIsGenerating(false);
    }
  };

  // Handle AI Summarize & Tag trigger
  const handleSummarizeEntry = async (entry: JournalEntry) => {
    if (entry.messages.length === 0) return;

    setIsSummarizing(true);
    setErrorMessage(null);

    try {
      const fullConversation = entry.messages
        .map((m) => `${m.role === 'user' ? 'User' : 'Gemini'}: ${m.content}`)
        .join('\n\n');

      const response = await authFetch('/api/gemini/summarize', {
        method: 'POST',
        body: JSON.stringify({ text: fullConversation }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || 'Failed to synthesize summary');
      }

      const data = await response.json();
      const synthesizedEntry: JournalEntry = {
        ...entry,
        title: data.title || entry.title,
        summary: data.summary || entry.summary,
        tags: Array.isArray(data.tags) && data.tags.length > 0 ? data.tags : entry.tags,
        updatedAt: Date.now(),
      };

      await handleUpdateEntry(synthesizedEntry);
    } catch (err: any) {
      console.error('Summarize error:', err);
      setErrorMessage(err.message || 'Failed to summarize entry.');
    } finally {
      setIsSummarizing(false);
    }
  };

  // Handle Sealing a Session and Extracting Claims & Evolution Gaps
  const handleSealSession = async (entry: JournalEntry) => {
    if (entry.messages.length === 0 || !currentUser) return;

    setIsSealing(true);
    setErrorMessage(null);

    try {
      const fullConversation = entry.messages
        .map((m) => `${m.role === 'user' ? 'User' : 'Gemini'}: ${m.content}`)
        .join('\n\n');

      // 1. Fetch user's existing topic slugs from users/{uid}/meta/topics
      const existingSlugs = await getUserTopicSlugs(currentUser.uid);

      // 2. Fetch past claims to compare evolution
      const allPastClaims = await getAllUserClaims(currentUser.uid);
      const historicalClaims = allPastClaims
        .filter((c) => c.sessionId !== entry.id)
        .map((c) => ({
          statement: c.statement,
          topicSlug: c.topicSlug,
          conviction: c.conviction,
          createdAt: c.createdAt,
        }));

      // 3. Call backend seal-session endpoint with verified Bearer token
      const response = await authFetch('/api/gemini/seal-session', {
        method: 'POST',
        body: JSON.stringify({
          conversationText: fullConversation,
          sessionId: entry.id,
          existingTopicSlugs: existingSlugs,
          previousClaims: historicalClaims,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || 'Failed to extract claims and seal session');
      }

      const data = await response.json();

      // 4. Update journal entry in Firestore with the server-extracted stances & evolution gaps
      const returnedClaims = Array.isArray(data.claims) ? data.claims : [];
      const sealedEntry: JournalEntry = {
        ...entry,
        isSealed: true,
        sealedAt: Date.now(),
        claims: returnedClaims,
        claimGaps: Array.isArray(data.claimGaps) ? data.claimGaps : [],
        updatedAt: Date.now(),
      };

      await handleUpdateEntry(sealedEntry);
    } catch (err: any) {
      console.error('Seal session error:', err);
      setErrorMessage(err.message || 'Failed to extract stances and seal session.');
    } finally {
      setIsSealing(false);
    }
  };

  // Handle Delete Confirmation
  const handleConfirmDelete = async () => {
    if (!entryToDelete || !currentUser) return;
    setIsDeleting(true);
    try {
      await removeJournalEntry(currentUser.uid, entryToDelete.id);
      if (activeEntry?.id === entryToDelete.id) {
        const remaining = entries.filter((e) => e.id !== entryToDelete.id);
        setActiveEntry(remaining[0] || createNewBlankEntry(currentUser.uid));
      }
      setEntryToDelete(null);
    } catch (err: any) {
      console.error('Delete entry error:', err);
      setErrorMessage('Failed to delete entry from Firestore.');
    } finally {
      setIsDeleting(false);
    }
  };

  // Auth Loading Screen
  if (authLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#F7F3ED]">
        <div className="flex flex-col items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#3B2F2A] text-[#FFFDF9] shadow-sm animate-bounce">
            <NotebookPen className="h-5 w-5 text-[#E8D5C0]" />
          </div>
          <p className="text-xs font-serif italic text-[#7A6255]">Initializing MindtrailAI &middot; Second Thought...</p>
        </div>
      </div>
    );
  }

  // Not Authenticated: Landing View
  if (!currentUser) {
    return <AuthLanding onSuccess={() => {}} />;
  }

  // Authenticated: Main Workspace
  return (
    <div className="flex min-h-screen flex-col bg-[#F7F3ED] text-[#292321]">
      {/* Top Navigation */}
      <Navbar
        user={currentUser}
        onSignOut={logOut}
        onNewEntry={handleNewEntry}
        syncStatus={syncStatus}
        onRetrySave={handleRetrySave}
      />

      {/* Mobile Toggle Bar */}
      <div className="flex items-center justify-between border-b border-[#E4DCD3] bg-[#FFFDF9] px-4 py-2 md:hidden">
        <button
          onClick={() => setSidebarOpen(!sidebarOpen)}
          className="flex items-center gap-2 rounded-lg border border-[#E4DCD3] bg-[#F7F3ED] px-2.5 py-1.5 text-xs font-medium text-[#7A6255] hover:bg-[#E8D5C0]/40"
        >
          {sidebarOpen ? <X className="h-3.5 w-3.5" /> : <Menu className="h-3.5 w-3.5" />}
          <span>{sidebarOpen ? 'Close History' : 'Reflection History'}</span>
        </button>

        <span className="font-serif text-xs font-medium text-[#292321] truncate max-w-[180px]">
          {activeEntry?.title || 'Reflection'}
        </span>
      </div>

      {/* Main Workspace with History Sidebar */}
      <div className="flex flex-1 overflow-hidden">
        <SidebarHistory
          entries={entries}
          activeEntryId={activeEntry?.id || null}
          onSelectEntry={handleSelectEntry}
          onDeleteRequest={(entry) => setEntryToDelete(entry)}
          isOpen={sidebarOpen}
          onToggle={() => setSidebarOpen(!sidebarOpen)}
        />

        {activeEntry && (
          <JournalWorkspace
            entry={activeEntry}
            onUpdateEntry={handleUpdateEntry}
            onSummarizeEntry={handleSummarizeEntry}
            onSealSession={handleSealSession}
            isGenerating={isGenerating}
            isSummarizing={isSummarizing}
            isSealing={isSealing}
            onSendMessage={handleSendMessage}
            errorMessage={errorMessage}
            onClearError={() => setErrorMessage(null)}
          />
        )}
      </div>

      {/* Delete Confirmation Modal */}
      <DeleteModal
        entry={entryToDelete}
        onConfirm={handleConfirmDelete}
        onCancel={() => setEntryToDelete(null)}
        isDeleting={isDeleting}
      />

      {/* 401 Re-authentication Modal */}
      {isReauthModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#3B2F2A]/50 p-4 backdrop-blur-xs">
          <div className="w-full max-w-md rounded-2xl border border-[#E4DCD3] bg-[#FFFDF9] p-6 shadow-2xl space-y-4">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#F7F3ED] text-[#B9825A] border border-[#E4DCD3]">
                <Lock className="h-5 w-5" />
              </div>
              <div>
                <h3 className="font-serif text-base font-bold text-[#292321]">Session Verification Required</h3>
                <p className="text-xs font-serif text-[#7A6255]">Your session token has expired or is invalid.</p>
              </div>
            </div>

            <p className="font-serif text-xs text-[#7A6255] leading-relaxed">
              To protect your private journal entries and securely communicate with Gemini, please re-authenticate.
              <span className="font-semibold text-[#292321]"> Your draft text and current reflections are safely preserved.</span>
            </p>

            <div className="flex items-center justify-end gap-2.5 pt-2">
              <button
                type="button"
                onClick={() => setIsReauthModalOpen(false)}
                className="rounded-lg border border-[#E4DCD3] bg-[#F7F3ED] px-3.5 py-2 text-xs font-medium text-[#7A6255] hover:bg-[#E8D5C0]/40 cursor-pointer"
              >
                Dismiss
              </button>
              <button
                type="button"
                onClick={handleReauthenticate}
                disabled={isReauthenticating}
                id="btn-reauthenticate"
                className="flex items-center gap-2 rounded-lg bg-[#3B2F2A] px-4 py-2 text-xs font-semibold text-[#FFFDF9] shadow-xs hover:bg-[#292321] disabled:opacity-50 cursor-pointer"
              >
                {isReauthenticating ? (
                  <RefreshCw className="h-3.5 w-3.5 animate-spin text-[#E8D5C0]" />
                ) : (
                  <LogIn className="h-3.5 w-3.5 text-[#E8D5C0]" />
                )}
                <span>{isReauthenticating ? 'Signing In...' : 'Sign In with Google'}</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
