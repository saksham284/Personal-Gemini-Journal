import React from 'react';
import { Sparkles, Plus, LogOut, ShieldCheck, Database } from 'lucide-react';
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
    <header className="sticky top-0 z-30 flex items-center justify-between border-b border-neutral-200 bg-white/90 px-4 py-2.5 backdrop-blur-md">
      <div className="flex items-center gap-3">
        <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-neutral-900 text-white shadow-sm">
          <Sparkles className="h-5 w-5 text-amber-300" />
        </div>
        <div>
          <div className="flex items-center gap-2">
            <span className="font-semibold text-neutral-900 tracking-tight">ReflectAI</span>
            <span className="hidden sm:inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-xs font-medium text-emerald-700 border border-emerald-200">
              <ShieldCheck className="h-3 w-3" />
              Isolated Firestore
            </span>
          </div>
          <p className="text-xs text-neutral-500 hidden md:block">Personal Journal & Gemini Companion</p>
        </div>
      </div>

      <div className="flex items-center gap-2.5">
        {/* Sync Status Badge */}
        <div className="hidden sm:flex items-center">
          {syncStatus === 'synced' && (
            <span className="flex items-center gap-1.5 rounded-md bg-neutral-100 px-2 py-1 text-xs text-neutral-600">
              <Database className="h-3 w-3 text-emerald-600" />
              <span>Synced to Cloud</span>
            </span>
          )}
          {syncStatus === 'saving' && (
            <span className="flex items-center gap-1.5 rounded-md bg-amber-50 px-2 py-1 text-xs text-amber-700 animate-pulse">
              <span className="h-1.5 w-1.5 rounded-full bg-amber-500" />
              <span>Saving...</span>
            </span>
          )}
          {syncStatus === 'error' && (
            <button
              onClick={onRetrySave}
              className="flex items-center gap-1.5 rounded-md bg-rose-50 px-2 py-1 text-xs font-medium text-rose-700 hover:bg-rose-100 transition-colors"
            >
              <span className="h-1.5 w-1.5 rounded-full bg-rose-500" />
              <span>Save failed &middot; Retry</span>
            </button>
          )}
        </div>

        {/* New Reflection Button */}
        <button
          onClick={onNewEntry}
          id="btn-new-entry-navbar"
          className="flex items-center gap-1.5 rounded-lg bg-neutral-900 px-3 py-1.5 text-xs font-medium text-white shadow-sm hover:bg-neutral-800 transition-colors"
        >
          <Plus className="h-4 w-4" />
          <span>New Entry</span>
        </button>

        {/* User profile & Logout */}
        <div className="flex items-center gap-2 border-l border-neutral-200 pl-2.5">
          {user.photoURL ? (
            <img
              src={user.photoURL}
              alt={user.displayName || 'User'}
              className="h-7 w-7 rounded-full object-cover ring-1 ring-neutral-300"
              referrerPolicy="no-referrer"
            />
          ) : (
            <div className="flex h-7 w-7 items-center justify-center rounded-full bg-neutral-200 text-xs font-semibold text-neutral-700">
              {(user.displayName || user.email || 'U')[0].toUpperCase()}
            </div>
          )}

          <div className="hidden lg:block text-left text-xs leading-tight">
            <p className="font-medium text-neutral-900 truncate max-w-[130px]">{user.displayName || 'User'}</p>
            <p className="text-[10px] text-neutral-400 truncate max-w-[130px]">{user.email}</p>
          </div>

          <button
            onClick={onSignOut}
            id="btn-sign-out"
            title="Sign Out"
            className="rounded-md p-1.5 text-neutral-500 hover:bg-neutral-100 hover:text-neutral-900 transition-colors"
          >
            <LogOut className="h-4 w-4" />
          </button>
        </div>
      </div>
    </header>
  );
};
