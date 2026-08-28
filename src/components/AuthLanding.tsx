import React, { useState } from 'react';
import { NotebookPen, Shield, Lock, BookOpen, Sparkles, ArrowRight, CheckCircle2, Compass, GitBranch } from 'lucide-react';
import { signInWithGoogle } from '../lib/firebase';

interface AuthLandingProps {
  onSuccess: () => void;
}

export const AuthLanding: React.FC<AuthLandingProps> = ({ onSuccess }) => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSignIn = async () => {
    try {
      setLoading(true);
      setError(null);
      await signInWithGoogle();
      onSuccess();
    } catch (err: any) {
      console.error('Sign-in error:', err);
      setError(err?.message || 'Authentication was cancelled or failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen flex-col bg-[#F7F3ED] text-[#292321]">
      {/* Top Banner */}
      <header className="border-b border-[#E4DCD3] bg-[#FFFDF9] px-6 py-4">
        <div className="mx-auto flex max-w-6xl items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#3B2F2A] text-[#FFFDF9] shadow-xs">
              <NotebookPen className="h-4 w-4 text-[#E8D5C0]" />
            </div>
            <div>
              <span className="font-serif text-lg font-semibold tracking-tight text-[#292321]">MindtrailAI</span>
              <span className="ml-2 text-xs font-serif italic text-[#7A6255] hidden sm:inline">Second Thought</span>
            </div>
          </div>
          <button
            onClick={handleSignIn}
            id="btn-nav-sign-in"
            disabled={loading}
            className="flex items-center gap-2 rounded-lg bg-[#3B2F2A] px-4 py-2 text-xs font-medium text-[#FFFDF9] shadow-xs hover:bg-[#292321] active:scale-98 transition-all disabled:opacity-50 cursor-pointer"
          >
            <span>{loading ? 'Connecting...' : 'Sign In with Google'}</span>
            <ArrowRight className="h-3.5 w-3.5 text-[#E8D5C0]" />
          </button>
        </div>
      </header>

      {/* Hero Section */}
      <main className="flex-1">
        <div className="mx-auto max-w-4xl px-6 py-16 text-center">
          <div className="inline-flex items-center gap-2 rounded-full border border-[#E4DCD3] bg-[#FFFDF9] px-3.5 py-1 text-xs text-[#7A6255] shadow-xs mb-6 font-serif italic">
            <NotebookPen className="h-3.5 w-3.5 text-[#B9825A]" />
            <span>Second Thought &middot; A record of what you believed &mdash; and what changed</span>
          </div>

          <h1 className="font-serif text-4xl font-semibold tracking-tight sm:text-5xl text-[#292321] leading-tight">
            A private space for your convictions, <br className="hidden sm:inline" />
            elevated by thoughtful reflection.
          </h1>

          <p className="mx-auto mt-4 max-w-2xl text-base text-[#7A6255] sm:text-lg font-serif">
            Capture daily thoughts, unpack difficult decisions, and track how your philosophical stances evolve over time. All journals and stance records are securely isolated to your private account.
          </p>

          {/* Primary CTA Box */}
          <div className="mx-auto mt-8 max-w-md rounded-2xl border border-[#E4DCD3] bg-[#FFFDF9] p-6 shadow-sm">
            <h2 className="font-serif text-base font-semibold text-[#292321]">Open your private journal</h2>
            <p className="mt-1 text-xs text-[#8C817A]">
              Federated Google Authentication keeps your credentials safe without storing passwords.
            </p>

            {error && (
              <div className="mt-4 rounded-lg bg-rose-50 p-3 text-xs text-rose-800 border border-rose-200 text-left">
                <p className="font-semibold">Sign-in Notice:</p>
                <p className="mt-0.5">{error}</p>
              </div>
            )}

            <button
              onClick={handleSignIn}
              id="btn-google-sign-in"
              disabled={loading}
              className="mt-5 flex w-full items-center justify-center gap-3 rounded-xl border border-[#E4DCD3] bg-[#F7F3ED] px-4 py-3 text-sm font-medium text-[#292321] shadow-xs hover:bg-[#E8D5C0]/40 hover:border-[#B9825A]/50 transition-all disabled:opacity-60 cursor-pointer"
            >
              <svg className="h-4 w-4" viewBox="0 0 24 24">
                <path
                  fill="#4285F4"
                  d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                />
                <path
                  fill="#34A853"
                  d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                />
                <path
                  fill="#FBBC05"
                  d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
                />
                <path
                  fill="#EA4335"
                  d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
                />
              </svg>
              <span>{loading ? 'Authenticating with Google...' : 'Continue with Google Account'}</span>
            </button>

            <div className="mt-4 flex items-center justify-center gap-4 text-[11px] text-[#8C817A]">
              <span className="flex items-center gap-1">
                <Lock className="h-3 w-3 text-[#B9825A]" /> End-to-End User Isolation
              </span>
              <span>&middot;</span>
              <span>No Passwords Stored</span>
            </div>
          </div>

          {/* Three Feature Highlights */}
          <div className="mx-auto mt-16 grid max-w-4xl grid-cols-1 gap-6 sm:grid-cols-3 text-left">
            <div className="rounded-xl border border-[#E4DCD3] bg-[#FFFDF9] p-5 shadow-xs">
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-[#F7F3ED] text-[#3B2F2A] border border-[#E4DCD3] mb-3">
                <BookOpen className="h-4 w-4 text-[#B9825A]" />
              </div>
              <h3 className="font-serif text-sm font-semibold text-[#292321]">Literary Reflection Modes</h3>
              <p className="mt-1.5 text-xs text-[#7A6255] leading-relaxed font-sans">
                Deep inquiry, creative brainstorming, actionable priorities, and gratitude journaling tailored to your thought process.
              </p>
            </div>

            <div className="rounded-xl border border-[#E4DCD3] bg-[#FFFDF9] p-5 shadow-xs">
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-[#F7F3ED] text-[#3B2F2A] border border-[#E4DCD3] mb-3">
                <GitBranch className="h-4 w-4 text-[#B9825A]" />
              </div>
              <h3 className="font-serif text-sm font-semibold text-[#292321]">Perspective Shift Tracking</h3>
              <p className="mt-1.5 text-xs text-[#7A6255] leading-relaxed font-sans">
                Automatically detects when a newer reflection refines, abandons, or reverses an earlier philosophical stance.
              </p>
            </div>

            <div className="rounded-xl border border-[#E4DCD3] bg-[#FFFDF9] p-5 shadow-xs">
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-[#F7F3ED] text-[#3B2F2A] border border-[#E4DCD3] mb-3">
                <Shield className="h-4 w-4 text-[#B9825A]" />
              </div>
              <h3 className="font-serif text-sm font-semibold text-[#292321]">Firestore Isolation</h3>
              <p className="mt-1.5 text-xs text-[#7A6255] leading-relaxed font-sans">
                Security rules enforce that only your authenticated Firebase UID can access or modify your personal reflections.
              </p>
            </div>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t border-[#E4DCD3] bg-[#FFFDF9] py-4 px-6 text-center text-xs text-[#8C817A]">
        <div className="mx-auto flex max-w-6xl items-center justify-between">
          <p className="font-serif">MindtrailAI &middot; Second Thought &copy; {new Date().getFullYear()}</p>
          <div className="flex items-center gap-2 text-[#7A6255] font-medium font-serif italic">
            <CheckCircle2 className="h-3.5 w-3.5 text-[#B9825A]" />
            <span>Secure Cloud Architecture</span>
          </div>
        </div>
      </footer>
    </div>
  );
};
