import React, { useState } from 'react';
import { NotebookPen, ArrowRight, CheckCircle2, Lock } from 'lucide-react';
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
    <div className="min-h-screen bg-[#F7F3ED] text-[#292321] flex flex-col">
      {/* Top Navigation */}
      <header className="border-b border-[#E4DCD3] bg-[#FFFDF9] py-4">
        <div className="mx-auto flex max-w-[1100px] w-full items-center justify-between px-6 sm:px-8 lg:px-12">
          <div className="flex items-center gap-3">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#3B2F2A] text-[#FFFDF9] shadow-xs">
              <NotebookPen className="h-4 w-4 text-[#E8D5C0]" />
            </div>
            <div>
              <span className="font-serif text-lg font-semibold tracking-tight text-[#292321]">MindtrailAI</span>
            </div>
          </div>
          <button
            type="button"
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

      {/* Main Content Column */}
      <main className="flex-1 w-full">
        <div className="mx-auto max-w-[1100px] w-full px-6 sm:px-8 lg:px-12">
          {/* Section 1: Hero & Single Primary CTA */}
          <section className="pt-8 sm:pt-10 lg:pt-12 pb-5 lg:pb-8 border-b border-[#E4DCD3]">
            <div className="max-w-[70ch]">
              <h1 className="font-serif text-3xl sm:text-[36px] lg:text-[40px] font-medium tracking-tight text-[#292321] leading-[1.2]">
                A journal that remembers what you believed.
              </h1>

              <p className="mt-4 text-base sm:text-lg text-[#7A6255] font-serif max-w-[52ch] leading-relaxed">
                Write with Gemini. It files the positions you take &mdash; then shows you when you reverse one, and asks whether your predictions came true.
              </p>

              {/* Left-Aligned Primary CTA */}
              <div className="mt-6 flex flex-col items-start">
                {error && (
                  <div className="mb-4 max-w-md rounded-lg bg-rose-50 p-3 text-xs text-rose-800 border border-rose-200">
                    <p className="font-semibold">Sign-in Notice:</p>
                    <p className="mt-0.5">{error}</p>
                  </div>
                )}

                <button
                  type="button"
                  onClick={handleSignIn}
                  id="btn-hero-google-sign-in"
                  disabled={loading}
                  className="flex items-center justify-center gap-3 rounded-xl bg-[#3B2F2A] px-6 py-3.5 text-sm font-semibold text-[#FFFDF9] shadow-sm hover:bg-[#292321] active:scale-98 transition-all disabled:opacity-60 cursor-pointer"
                >
                  <svg className="h-4 w-4 shrink-0" viewBox="0 0 24 24">
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
                  <span>{loading ? 'Authenticating with Google...' : 'Continue with Google'}</span>
                </button>

                <p className="mt-2 text-xs text-[#7A6255] font-serif">
                  Private to your account &middot; No password stored
                </p>
              </div>
            </div>
          </section>

          {/* Section 2: How It Works (Two-Column: Copy on Left, Shift Card on Right) */}
          <section className="pt-5 lg:pt-8 pb-5 lg:pb-8 border-b border-[#E4DCD3] grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-14 items-center">
            {/* Left Column: Numbered Hierarchy */}
            <div className="lg:col-span-6 max-w-[65ch]">
              <h2 className="font-serif text-2xl font-semibold text-[#292321] tracking-tight">
                How it works
              </h2>
              <p className="mt-4 text-sm text-[#7A6255] font-serif leading-relaxed">
                MindtrailAI tracks the stances you take in your reflections and revisits them over time, so you can see how your thinking evolves.
              </p>

              <div className="mt-6 space-y-5">
                {/* Step 1 */}
                <div className="flex items-start gap-3.5">
                  <span className="text-xs font-mono font-medium text-[#8C817A] pt-0.5 select-none shrink-0">
                    01
                  </span>
                  <div>
                    <h3 className="font-serif text-sm font-semibold text-[#292321]">
                      Write and converse with Gemini
                    </h3>
                    <p className="mt-1 text-xs text-[#7A6255] font-serif leading-relaxed">
                      Reflect freely across guided modes with real-time philosophical inquiry.
                    </p>
                  </div>
                </div>

                {/* Step 2 */}
                <div className="flex items-start gap-3.5">
                  <span className="text-xs font-mono font-medium text-[#8C817A] pt-0.5 select-none shrink-0">
                    02
                  </span>
                  <div>
                    <h3 className="font-serif text-sm font-semibold text-[#292321]">
                      Seal the session
                    </h3>
                    <p className="mt-1 text-xs text-[#7A6255] font-serif leading-relaxed">
                      The analysis pass extracts key philosophical stances, conviction scores, and predictive claims.
                    </p>
                  </div>
                </div>

                {/* Step 3 */}
                <div className="flex items-start gap-3.5">
                  <span className="text-xs font-mono font-medium text-[#8C817A] pt-0.5 select-none shrink-0">
                    03
                  </span>
                  <div>
                    <h3 className="font-serif text-sm font-semibold text-[#292321]">
                      Track perspective shifts and predictions
                    </h3>
                    <p className="mt-1 text-xs text-[#7A6255] font-serif leading-relaxed">
                      Later, it shows you when a stance reverses and asks whether your life predictions came true.
                    </p>
                  </div>
                </div>
              </div>
            </div>

            {/* Right Column: Example Shift Card */}
            <div className="lg:col-span-6 flex flex-col items-start lg:items-end justify-center">
              <div className="w-full max-w-[420px]">
                {/* Muted label outside the card body */}
                <div className="text-xs font-serif italic text-[#7A6255] mb-2 px-1">
                  Example
                </div>

                <div className="rounded-2xl border border-[#E4DCD3] bg-[#FFFDF9] p-5 shadow-xs space-y-4">
                  <div className="flex items-center justify-between gap-2 flex-wrap border-b border-[#E4DCD3]/60 pb-3">
                    <div className="flex items-center gap-2">
                      <span className="inline-flex items-center gap-1.5 rounded-full border border-[#EAD8D2] bg-[#FDF2F0] px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-[#8A2E20]">
                        <span className="h-1.5 w-1.5 rounded-full bg-[#8A2E20]" />
                        Reverses Prior Stance
                      </span>
                      <span className="inline-flex items-center rounded-md bg-[#F7F3ED] border border-[#E4DCD3] px-2 py-0.5 text-[11px] font-semibold text-[#5C4A42]">
                        #management-career
                      </span>
                    </div>
                    <span className="text-[10px] font-medium text-[#7A6255] font-serif italic">
                      Extracted via Session Sealing
                    </span>
                  </div>

                  {/* Then vs Now Comparison */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                    <div className="rounded-xl bg-[#F7F3ED] p-3 border border-[#E4DCD3]">
                      <span className="text-[10px] font-semibold text-[#7A6255] uppercase tracking-wide block mb-1 font-serif">
                        Then &middot; ~6 weeks ago
                      </span>
                      <p className="text-[#5C4A42] italic font-serif leading-relaxed">
                        &ldquo;I never want to manage people &mdash; I do my best work heads-down.&rdquo;
                      </p>
                    </div>

                    <div className="rounded-xl bg-[#F7F3ED] p-3 border border-[#E4DCD3]">
                      <span className="text-[10px] font-semibold text-[#8A5832] uppercase tracking-wide block mb-1 font-serif">
                        Now &middot; Today
                      </span>
                      <p className="text-[#292321] font-medium font-serif leading-relaxed">
                        &ldquo;I&apos;m energised by 1-on-1 coaching. Management might actually be where I thrive.&rdquo;
                      </p>
                    </div>
                  </div>

                  {/* Inquiry Question */}
                  <div className="rounded-xl bg-[#F7F3ED] border border-[#E8D5C0] p-3.5">
                    <div className="flex items-start gap-2.5">
                      <div className="flex h-5 w-5 items-center justify-center rounded-full bg-[#FFFDF9] border border-[#E4DCD3] text-[#7A6255] shrink-0 mt-0.5">
                        <span className="text-[11px] font-serif font-bold">?</span>
                      </div>
                      <div className="flex-1">
                        <span className="text-[10px] font-bold text-[#7A6255] uppercase tracking-wide font-serif">
                          Reflective Inquiry Prompt
                        </span>
                        <p className="text-[#292321] text-xs font-serif italic mt-0.5 leading-relaxed font-medium">
                          &ldquo;What changed your mind about working with people?&rdquo;
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </section>

          {/* Section 3: The Reckoning (Two-Column Reversed: Example Card on Left, Copy on Right) */}
          <section className="pt-5 lg:pt-8 pb-8 lg:pb-16 grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-14 items-center">
            {/* Left Column: Example Prediction & Calibration Card */}
            <div className="lg:col-span-6 order-2 lg:order-1 flex flex-col items-start justify-center">
              <div className="w-full max-w-[420px]">
                {/* Muted label outside the card body */}
                <div className="text-xs font-serif italic text-[#7A6255] mb-2 px-1">
                  Example
                </div>

                <div className="rounded-2xl border border-[#E4DCD3] bg-[#FFFDF9] p-5 shadow-xs space-y-4">
                  {/* Card Header */}
                  <div className="flex items-center justify-between gap-2 border-b border-[#E4DCD3]/60 pb-3">
                    <span className="inline-flex items-center gap-1.5 rounded-full border border-[#E4DCD3] bg-[#F7F3ED] px-2.5 py-0.5 text-[10px] font-medium text-[#7A6255]">
                      <span className="h-1.5 w-1.5 rounded-full bg-[#B9825A]" />
                      Pending Prediction
                    </span>
                    <span className="text-[10px] text-[#8C817A] font-serif">
                      Written 12 weeks ago
                    </span>
                  </div>

                  {/* Prediction Claim & Conviction Bar */}
                  <div className="space-y-2">
                    <p className="font-serif text-sm font-medium text-[#292321] leading-snug">
                      &ldquo;I&apos;ll have left this job by June&rdquo;
                    </p>

                    <div className="space-y-1">
                      <div className="flex items-center justify-between text-[11px] text-[#7A6255] font-serif">
                        <span>Conviction</span>
                        <span className="font-mono font-medium text-[#292321]">90%</span>
                      </div>
                      <div className="h-1.5 w-full rounded-full bg-[#E8D5C0]/50 overflow-hidden">
                        <div className="h-full bg-[#3B2F2A] rounded-full" style={{ width: '90%' }} />
                      </div>
                    </div>
                  </div>

                  {/* Resolution Buttons as Static Pills */}
                  <div className="space-y-1.5 pt-1">
                    <span className="text-[10px] text-[#8C817A] font-serif block">
                      Resolution check:
                    </span>
                    <div className="flex flex-wrap gap-1.5">
                      <span className="rounded-md border border-[#E4DCD3] bg-[#F7F3ED] px-2.5 py-1 text-[11px] font-medium text-[#292321]">
                        Happened
                      </span>
                      <span className="rounded-md border border-[#E4DCD3] bg-[#F7F3ED] px-2.5 py-1 text-[11px] font-medium text-[#292321]">
                        Didn&apos;t happen
                      </span>
                      <span className="rounded-md border border-[#E4DCD3] bg-[#F7F3ED] px-2.5 py-1 text-[11px] font-medium text-[#7A6255]">
                        Still open
                      </span>
                      <span className="rounded-md border border-[#E4DCD3] bg-[#F7F3ED] px-2.5 py-1 text-[11px] font-medium text-[#7A6255]">
                        No longer relevant
                      </span>
                    </div>
                  </div>

                  {/* Divider and Calibration Summary */}
                  <div className="border-t border-[#E4DCD3]/60 pt-3 space-y-1 text-xs font-serif text-[#5C4A42]">
                    <p className="font-medium text-[#292321]">
                      Your record so far &mdash; 4 of 11 predictions came true
                    </p>
                    <p className="text-[11px] text-[#7A6255]">
                      High conviction (70&ndash;100%): 2 of 6
                    </p>
                  </div>
                </div>
              </div>
            </div>

            {/* Right Column: Explanatory Copy */}
            <div className="lg:col-span-6 order-1 lg:order-2 max-w-[65ch]">
              <h2 className="font-serif text-2xl font-semibold text-[#292321] tracking-tight">
                It comes back to ask if you were right.
              </h2>
              <p className="mt-4 text-sm text-[#7A6255] font-serif leading-relaxed">
                People make confident predictions about their own lives constantly and almost never check them, because nothing ever comes back to ask. MindtrailAI does. When you write something checkable about the future, it returns weeks later with one question &mdash; did this happen? Over time you build a record of how often your certainty matched reality.
              </p>
            </div>
          </section>
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t border-[#E4DCD3] bg-[#FFFDF9] py-4 text-xs text-[#7A6255]">
        <div className="mx-auto flex max-w-[1100px] w-full items-center justify-between px-6 sm:px-8 lg:px-12">
          <p className="font-serif">MindtrailAI &copy; {new Date().getFullYear()}</p>
          <div className="flex items-center gap-2 font-medium font-serif italic">
            <CheckCircle2 className="h-3.5 w-3.5 text-[#7A6255]" />
            <span>Secure Cloud Architecture</span>
          </div>
        </div>
      </footer>
    </div>
  );
};

