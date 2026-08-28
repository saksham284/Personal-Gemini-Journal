import React, { useState, useEffect, useCallback, useRef } from 'react';
import type { User } from 'firebase/auth';
import {
  auth,
  subscribeToAuthChanges,
  subscribeToJournalEntries,
  saveJournalEntry,
  removeJournalEntry,
  logOut,
} from './lib/firebase';
import type { JournalEntry, ChatMessage, ReflectionMode } from './types';
import { Navbar } from './components/Navbar';
import { AuthLanding } from './components/AuthLanding';
import { SidebarHistory } from './components/SidebarHistory';
import { JournalWorkspace } from './components/JournalWorkspace';
import { DeleteModal } from './components/DeleteModal';
import { Sparkles, Menu, X } from 'lucide-react';

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

  // UI state
  const [sidebarOpen, setSidebarOpen] = useState<boolean>(false);
  const [entryToDelete, setEntryToDelete] = useState<JournalEntry | null>(null);
  const [isDeleting, setIsDeleting] = useState<boolean>(false);

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
      // 1. Call backend server endpoint
      const response = await fetch('/api/gemini/reflect', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
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

      const response = await fetch('/api/gemini/summarize', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
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
      <div className="flex min-h-screen items-center justify-center bg-neutral-50">
        <div className="flex flex-col items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-neutral-900 text-white shadow-sm animate-bounce">
            <Sparkles className="h-5 w-5 text-amber-300" />
          </div>
          <p className="text-xs font-medium text-neutral-600">Initializing ReflectAI...</p>
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
    <div className="flex min-h-screen flex-col bg-neutral-50 text-neutral-900">
      {/* Top Navigation */}
      <Navbar
        user={currentUser}
        onSignOut={logOut}
        onNewEntry={handleNewEntry}
        syncStatus={syncStatus}
        onRetrySave={handleRetrySave}
      />

      {/* Mobile Toggle Bar */}
      <div className="flex items-center justify-between border-b border-neutral-200 bg-white px-4 py-2 md:hidden">
        <button
          onClick={() => setSidebarOpen(!sidebarOpen)}
          className="flex items-center gap-2 rounded-lg border border-neutral-200 bg-neutral-50 px-2.5 py-1.5 text-xs font-medium text-neutral-700 hover:bg-neutral-100"
        >
          {sidebarOpen ? <X className="h-3.5 w-3.5" /> : <Menu className="h-3.5 w-3.5" />}
          <span>{sidebarOpen ? 'Close History' : 'Reflection History'}</span>
        </button>

        <span className="text-xs font-medium text-neutral-700 truncate max-w-[180px]">
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
            isGenerating={isGenerating}
            isSummarizing={isSummarizing}
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
    </div>
  );
}
