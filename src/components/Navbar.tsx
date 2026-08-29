import React from 'react';
import { NotebookPen, Plus, LogOut, ShieldCheck, Database, BookOpen } from 'lucide-react';
import type { User } from 'firebase/auth';

interface NavbarProps {
  user: User;
  onSignOut: () => void;
  onNewEntry: () => void;
  syncStatus: 'synced' | 'saving' | 'error';
  onRetrySave?: () => void;
}

export const Navbar: React.FC<NavbarProps> = ({
  user,
  onSignOut,
  onNewEntry,
  syncStatus,
  onRetrySave,
}) => {
  return (
    <header className="sticky top-0 z-30 flex items-center justify-between border-b border-[#E4DCD3] bg-[#FFFDF9]/95 px-4 py-2.5 backdrop-blur-md">
      <div className="flex items-center gap-3">
        {/* Pen and Notebook Logo */}
        <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-[#3B2F2A] text-[#FFFDF9] shadow-xs">
          <NotebookPen className="h-5 w-5 text-[#E8D5C0]" />
        </div>
        <div>
          <div className="flex items-center gap-2">
            <span className="font-serif text-base font-semibold text-[#292321] tracking-tight">MindtrailAI</span>
            <span className="hidden sm:inline-flex items-center gap-1 rounded-full bg-[#F7F3ED] px-2 py-0.5 text-[11px] font-medium text-[#7A6255] border border-[#E4DCD3]">
              <ShieldCheck className="h-3 w-3 text-[#B9825A]" />
              Isolated Firestore
            </span>
          </div>
          <p className="text-[11px] text-[#8C817A] hidden md:block italic font-serif">
            Second Thought &mdash; A record of what you believed &mdash; and what changed
          </p>
        </div>
      </div>

      <div className="flex items-center gap-2.5">
        {/* Sync Status Badge */}
        <div className="hidden sm:flex items-center">
          {syncStatus === 'synced' && (
            <span role="status" aria-label="Cloud sync status: Synced" className="flex items-center gap-1.5 rounded-md bg-[#F7F3ED] px-2 py-1 text-xs text-[#5C4A42] border border-[#E4DCD3]">
              <Database className="h-3 w-3 text-[#B9825A]" />
              <span>Cloud Synced</span>
            </span>
          )}
          {syncStatus === 'saving' && (
            <span role="status" aria-label="Cloud sync status: Saving in progress" className="flex items-center gap-1.5 rounded-md bg-[#F7F3ED] px-2 py-1 text-xs text-[#8A5832] border border-[#E8D5C0] animate-pulse">
              <span className="h-1.5 w-1.5 rounded-full bg-[#B9825A]" />
              <span>Recording...</span>
            </span>
          )}
          {syncStatus === 'error' && (
            <button
              type="button"
              role="alert"
              aria-label="Cloud sync failed. Click to retry."
              onClick={onRetrySave}
              className="flex items-center gap-1.5 rounded-md bg-rose-50 px-2 py-1 text-xs font-medium text-rose-800 border border-rose-200 hover:bg-rose-100 transition-colors focus-visible:ring-2 focus-visible:ring-[#3B2F2A] focus:outline-hidden"
            >
              <span className="h-1.5 w-1.5 rounded-full bg-rose-600" />
              <span>Save failed &middot; Retry</span>
            </button>
          )}
        </div>

        {/* New Reflection Button */}
        <button
          type="button"
          onClick={onNewEntry}
          id="btn-new-entry-navbar"
          aria-label="Create new journal entry"
          className="flex items-center gap-1.5 rounded-lg bg-[#3B2F2A] px-3.5 py-1.5 text-xs font-medium text-[#FFFDF9] shadow-xs hover:bg-[#292321] active:scale-98 transition-all cursor-pointer focus-visible:ring-2 focus-visible:ring-[#3B2F2A] focus:outline-hidden"
        >
          <Plus className="h-3.5 w-3.5 text-[#E8D5C0]" />
          <span>New Entry</span>
        </button>

        {/* User profile & Logout */}
        <div className="flex items-center gap-2 border-l border-[#E4DCD3] pl-2.5">
          {user.photoURL ? (
            <img
              src={user.photoURL}
              alt={user.displayName || 'User profile'}
              className="h-7 w-7 rounded-full object-cover ring-1 border border-[#E4DCD3]"
              referrerPolicy="no-referrer"
            />
          ) : (
            <div className="flex h-7 w-7 items-center justify-center rounded-full bg-[#E8D5C0] text-xs font-semibold text-[#3B2F2A]">
              {(user.displayName || user.email || 'U')[0].toUpperCase()}
            </div>
          )}

          <div className="hidden lg:block text-left text-xs leading-tight">
            <p className="font-medium text-[#292321] truncate max-w-[130px]">{user.displayName || 'User'}</p>
            <p className="text-[10px] text-[#8C817A] truncate max-w-[130px]">{user.email}</p>
          </div>

          <button
            type="button"
            onClick={onSignOut}
            id="btn-sign-out"
            title="Sign Out"
            aria-label="Sign out of your account"
            className="rounded-md p-1.5 text-[#8C817A] hover:bg-[#F7F3ED] hover:text-[#292321] transition-colors cursor-pointer focus-visible:ring-2 focus-visible:ring-[#3B2F2A] focus:outline-hidden"
          >
            <LogOut className="h-4 w-4" />
          </button>
        </div>
      </div>
    </header>
  );
};
