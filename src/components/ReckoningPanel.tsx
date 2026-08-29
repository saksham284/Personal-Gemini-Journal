import React, { useState } from 'react';
import {
  Sparkles,
  CheckCircle2,
  XCircle,
  Clock,
  Ban,
  Calendar,
  ChevronRight,
  ChevronDown,
  Info,
  Layers,
  ArrowUpRight,
  ShieldAlert,
} from 'lucide-react';
import type { ExtractedClaim, CalibrationRecord, PredictionOutcome } from '../types';

interface ReckoningPanelProps {
  dueClaims: ExtractedClaim[];
  upcomingClaims: ExtractedClaim[];
  resolvedClaims: ExtractedClaim[];
  calibration: CalibrationRecord | null;
  soonestUpcomingReviewAt: number | null;
  onResolveClaim: (claimId: string, outcome: PredictionOutcome) => Promise<void>;
  isResolvingId: string | null;
  onClose?: () => void;
  isOpenAsModal?: boolean;
}

export const ReckoningPanel: React.FC<ReckoningPanelProps> = ({
  dueClaims,
  upcomingClaims,
  resolvedClaims,
  calibration,
  soonestUpcomingReviewAt,
  onResolveClaim,
  isResolvingId,
  onClose,
  isOpenAsModal = false,
}) => {
  const [showUpcomingList, setShowUpcomingList] = useState(false);
  const [showResolvedHistory, setShowResolvedHistory] = useState(false);
  const [earlyCheckClaimIds, setEarlyCheckClaimIds] = useState<Set<string>>(new Set());

  const formatDaysAgo = (timestamp: number) => {
    const diffMs = Date.now() - timestamp;
    const diffDays = Math.floor(diffMs / (24 * 60 * 60 * 1000));
    if (diffDays <= 0) return 'Written today';
    if (diffDays === 1) return 'Written 1 day ago';
    return `Written ${diffDays} days ago`;
  };

  const formatReviewDate = (timestamp: number) => {
    const date = new Date(timestamp);
    const diffMs = timestamp - Date.now();
    const diffDays = Math.ceil(diffMs / (24 * 60 * 60 * 1000));

    const dateStr = date.toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' });
    if (diffDays < 0) {
      return `Due (${dateStr})`;
    }
    if (diffDays === 0) return `Due today (${dateStr})`;
    if (diffDays === 1) return `Due tomorrow (${dateStr})`;
    return `Due in ${diffDays} days (${dateStr})`;
  };

  const toggleEarlyCheck = (claimId: string) => {
    setEarlyCheckClaimIds((prev) => {
      const next = new Set(prev);
      if (next.has(claimId)) {
        next.delete(claimId);
      } else {
        next.add(claimId);
      }
      return next;
    });
  };

  const totalPredictive = dueClaims.length + upcomingClaims.length + resolvedClaims.length;

  return (
    <div
      className={`flex flex-col bg-[#FFFDF9] text-[#292321] ${
        isOpenAsModal ? 'max-h-[85vh] w-full max-w-2xl rounded-2xl border border-[#E4DCD3] shadow-2xl p-6 overflow-y-auto' : 'p-4 space-y-4'
      }`}
    >
      {/* Header */}
      <div className="flex items-center justify-between border-b border-[#E4DCD3] pb-3">
        <div className="flex items-center gap-2.5">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#3B2F2A] text-[#FFFDF9]">
            <Sparkles className="h-4 w-4 text-[#E8D5C0]" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="font-serif text-base font-bold text-[#292321]">The Reckoning</h3>
              {dueClaims.length > 0 && (
                <span className="inline-flex items-center rounded-full bg-[#8A2E20] px-2 py-0.5 text-[10px] font-bold text-[#FFFDF9]">
                  {dueClaims.length} due
                </span>
              )}
            </div>
            <p className="text-[11px] text-[#7A6255] font-serif">
              Testable predictions &amp; empirical calibration record
            </p>
          </div>
        </div>

        {isOpenAsModal && onClose && (
          <button
            type="button"
            onClick={onClose}
            aria-label="Close Reckoning panel"
            className="rounded-lg p-1.5 text-[#8C817A] hover:bg-[#F7F3ED] hover:text-[#292321] cursor-pointer focus-visible:ring-2 focus-visible:ring-[#3B2F2A] focus:outline-hidden text-sm"
          >
            &times;
          </button>
        )}
      </div>

      {/* 1. Calibration Record (Always Visible Summary) */}
      <section className="rounded-xl border border-[#E4DCD3] bg-[#F7F3ED] p-3.5 space-y-2.5">
        <div className="flex items-center justify-between">
          <span className="text-xs font-bold font-serif text-[#3B2F2A] uppercase tracking-wider">
            Calibration Record
          </span>
          <span className="text-[10px] text-[#7A6255] font-serif">
            {calibration?.totalResolved || 0} resolved predictions
          </span>
        </div>

        {calibration && calibration.totalResolved >= 3 ? (
          <div className="space-y-3">
            <div className="flex items-center justify-between text-xs border-b border-[#E4DCD3]/60 pb-2">
              <span className="font-medium text-[#292321]">Overall Accuracy:</span>
              <span className="font-serif font-bold text-[#3B2F2A]">
                {calibration.totalHappened} / {calibration.totalResolved} happened ({Math.round(calibration.overallRate * 100)}%)
              </span>
            </div>

            {/* Bands Breakdown */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-xs">
              {/* High Band */}
              <div className="rounded-lg bg-[#FFFDF9] border border-[#E4DCD3] p-2.5 flex flex-col justify-between">
                <div>
                  <div className="flex items-center justify-between text-[10px] text-[#5C4A42] font-semibold">
                    <span>High (0.7–1.0)</span>
                    <span className="font-mono">{calibration.highBand.total} claims</span>
                  </div>
                  <div className="mt-1.5 font-serif font-bold text-sm text-[#292321]">
                    {calibration.highBand.total > 0
                      ? `${Math.round(calibration.highBand.rate * 100)}%`
                      : '—'}
                  </div>
                </div>
                <div className="mt-1 text-[10px] text-[#8C817A]">
                  {calibration.highBand.happened} / {calibration.highBand.total} happened
                </div>
              </div>

              {/* Medium Band */}
              <div className="rounded-lg bg-[#FFFDF9] border border-[#E4DCD3] p-2.5 flex flex-col justify-between">
                <div>
                  <div className="flex items-center justify-between text-[10px] text-[#5C4A42] font-semibold">
                    <span>Medium (0.4–0.7)</span>
                    <span className="font-mono">{calibration.mediumBand.total} claims</span>
                  </div>
                  <div className="mt-1.5 font-serif font-bold text-sm text-[#292321]">
                    {calibration.mediumBand.total > 0
                      ? `${Math.round(calibration.mediumBand.rate * 100)}%`
                      : '—'}
                  </div>
                </div>
                <div className="mt-1 text-[10px] text-[#8C817A]">
                  {calibration.mediumBand.happened} / {calibration.mediumBand.total} happened
                </div>
              </div>

              {/* Low Band */}
              <div className="rounded-lg bg-[#FFFDF9] border border-[#E4DCD3] p-2.5 flex flex-col justify-between">
                <div>
                  <div className="flex items-center justify-between text-[10px] text-[#5C4A42] font-semibold">
                    <span>Low (0.0–0.4)</span>
                    <span className="font-mono">{calibration.lowBand.total} claims</span>
                  </div>
                  <div className="mt-1.5 font-serif font-bold text-sm text-[#292321]">
                    {calibration.lowBand.total > 0
                      ? `${Math.round(calibration.lowBand.rate * 100)}%`
                      : '—'}
                  </div>
                </div>
                <div className="mt-1 text-[10px] text-[#8C817A]">
                  {calibration.lowBand.happened} / {calibration.lowBand.total} happened
                </div>
              </div>
            </div>
          </div>
        ) : (
          <div className="text-xs text-[#7A6255] font-serif leading-relaxed py-1">
            <p>
              {3 - (calibration?.totalResolved || 0)} more resolved prediction
              {3 - (calibration?.totalResolved || 0) === 1 ? '' : 's'} needed to calculate conviction calibration breakdown.
            </p>
          </div>
        )}
      </section>

      {/* 2. Due Review Queue */}
      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <h4 className="text-xs font-bold font-serif text-[#292321] uppercase tracking-wider flex items-center gap-1.5">
            <span>Due for Review</span>
            <span className="rounded-md bg-[#3B2F2A] px-1.5 py-0.2 text-[10px] text-[#FFFDF9] font-mono">
              {dueClaims.length}
            </span>
          </h4>
        </div>

        {dueClaims.length === 0 ? (
          <div className="rounded-xl border border-dashed border-[#E4DCD3] bg-[#FFFDF9] p-4 text-center text-xs text-[#7A6255] font-serif space-y-1">
            {totalPredictive === 0 ? (
              <>
                <p className="font-semibold text-[#292321]">No predictive stances extracted yet</p>
                <p className="text-[11px] leading-relaxed max-w-sm mx-auto">
                  When you write something checkable about the future (e.g. &ldquo;I&rsquo;ll leave by March&rdquo; or &ldquo;this project launch will slip&rdquo;) and seal the session, MindtrailAI will queue it here to review whether it happened.
                </p>
              </>
            ) : soonestUpcomingReviewAt ? (
              <>
                <p className="font-semibold text-[#292321]">No predictions currently due</p>
                <p className="text-[11px] leading-relaxed">
                  Next review due on{' '}
                  <span className="font-semibold text-[#3B2F2A]">
                    {new Date(soonestUpcomingReviewAt).toLocaleDateString([], {
                      month: 'short',
                      day: 'numeric',
                      year: 'numeric',
                    })}
                  </span>
                  .
                </p>
              </>
            ) : (
              <p className="text-[11px]">All recorded predictions have been reviewed.</p>
            )}
          </div>
        ) : (
          <div className="space-y-3">
            {dueClaims.map((claim) => {
              const convictionPct = Math.round(claim.conviction * 100);
              const isResolving = isResolvingId === claim.id;

              return (
                <div
                  key={claim.id}
                  className="rounded-xl border border-[#E8D5C0] bg-[#FFFDF9] p-4 shadow-xs space-y-3"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span className="rounded-md bg-[#F7F3ED] border border-[#E4DCD3] px-2 py-0.5 text-[10px] font-semibold text-[#5C4A42]">
                        #{claim.topicSlug}
                      </span>
                      <span className="text-[10px] text-[#8C817A] font-serif">
                        {formatDaysAgo(claim.createdAt)}
                      </span>
                    </div>

                    <span className="text-[10px] font-bold text-[#8A5832]">
                      {convictionPct}% Conviction
                    </span>
                  </div>

                  <p className="font-serif text-xs font-semibold text-[#292321] leading-relaxed">
                    &ldquo;{claim.statement}&rdquo;
                  </p>

                  {/* Conviction Bar */}
                  <div className="h-1.5 w-full overflow-hidden rounded-full bg-[#E4DCD3]">
                    <div
                      className="h-full rounded-full bg-[#8A5832] transition-all"
                      style={{ width: `${Math.max(8, convictionPct)}%` }}
                    />
                  </div>

                  {/* 4 One-Tap Outcome Buttons */}
                  <div className="pt-1">
                    <div className="text-[10px] font-semibold text-[#7A6255] uppercase tracking-wide font-serif mb-1.5">
                      Resolve Prediction Outcome:
                    </div>
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5">
                      {/* 1. Happened */}
                      <button
                        type="button"
                        disabled={isResolving}
                        onClick={() => onResolveClaim(claim.id, 'happened')}
                        className="flex items-center justify-center gap-1 rounded-lg border border-emerald-300 bg-emerald-50 px-2 py-1.5 text-[11px] font-semibold text-emerald-800 hover:bg-emerald-100 disabled:opacity-50 transition-colors cursor-pointer focus-visible:ring-2 focus-visible:ring-[#3B2F2A] focus:outline-hidden"
                      >
                        <CheckCircle2 className="h-3 w-3 text-emerald-600 shrink-0" />
                        <span>Happened</span>
                      </button>

                      {/* 2. Did Not Happen */}
                      <button
                        type="button"
                        disabled={isResolving}
                        onClick={() => onResolveClaim(claim.id, 'did_not_happen')}
                        className="flex items-center justify-center gap-1 rounded-lg border border-rose-300 bg-rose-50 px-2 py-1.5 text-[11px] font-semibold text-rose-800 hover:bg-rose-100 disabled:opacity-50 transition-colors cursor-pointer focus-visible:ring-2 focus-visible:ring-[#3B2F2A] focus:outline-hidden"
                      >
                        <XCircle className="h-3 w-3 text-rose-600 shrink-0" />
                        <span>Did not happen</span>
                      </button>

                      {/* 3. Still Open */}
                      <button
                        type="button"
                        disabled={isResolving}
                        onClick={() => onResolveClaim(claim.id, 'still_open')}
                        title="Postpone check by 30 days"
                        className="flex items-center justify-center gap-1 rounded-lg border border-amber-300 bg-amber-50 px-2 py-1.5 text-[11px] font-semibold text-amber-800 hover:bg-amber-100 disabled:opacity-50 transition-colors cursor-pointer focus-visible:ring-2 focus-visible:ring-[#3B2F2A] focus:outline-hidden"
                      >
                        <Clock className="h-3 w-3 text-amber-600 shrink-0" />
                        <span>Still open (+30d)</span>
                      </button>

                      {/* 4. No Longer Relevant */}
                      <button
                        type="button"
                        disabled={isResolving}
                        onClick={() => onResolveClaim(claim.id, 'no_longer_relevant')}
                        className="flex items-center justify-center gap-1 rounded-lg border border-[#E4DCD3] bg-[#F7F3ED] px-2 py-1.5 text-[11px] font-semibold text-[#7A6255] hover:bg-[#E8D5C0]/40 disabled:opacity-50 transition-colors cursor-pointer focus-visible:ring-2 focus-visible:ring-[#3B2F2A] focus:outline-hidden"
                      >
                        <Ban className="h-3 w-3 text-[#8C817A] shrink-0" />
                        <span>Not relevant</span>
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>

      {/* 3. Upcoming Predictions & "Check Now" Early Review Control */}
      {upcomingClaims.length > 0 && (
        <section className="border-t border-[#E4DCD3] pt-3 space-y-2.5">
          <button
            type="button"
            onClick={() => setShowUpcomingList(!showUpcomingList)}
            className="flex w-full items-center justify-between text-left text-xs font-semibold text-[#5C4A42] hover:text-[#292321] transition-colors cursor-pointer font-serif"
          >
            <div className="flex items-center gap-1.5">
              <Calendar className="h-3.5 w-3.5 text-[#B9825A]" />
              <span>Upcoming Predictions ({upcomingClaims.length})</span>
            </div>
            {showUpcomingList ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
          </button>

          {showUpcomingList && (
            <div className="space-y-2.5 pt-1">
              <p className="text-[11px] text-[#7A6255] font-serif leading-relaxed">
                Review any prediction ahead of its scheduled date with the <strong className="text-[#292321]">Check now</strong> control:
              </p>

              {upcomingClaims.map((claim) => {
                const convictionPct = Math.round(claim.conviction * 100);
                const isEarlyChecking = earlyCheckClaimIds.has(claim.id);
                const isResolving = isResolvingId === claim.id;

                return (
                  <div
                    key={claim.id}
                    className="rounded-xl border border-[#E4DCD3] bg-[#F7F3ED]/60 p-3 text-xs space-y-2 transition-all hover:bg-[#F7F3ED]"
                  >
                    <div className="flex items-center justify-between gap-2 flex-wrap">
                      <div className="flex items-center gap-1.5">
                        <span className="rounded-md bg-[#FFFDF9] border border-[#E4DCD3] px-1.5 py-0.5 text-[9px] font-semibold text-[#5C4A42]">
                          #{claim.topicSlug}
                        </span>
                        <span className="text-[10px] text-[#8C817A] font-serif">
                          {claim.reviewAt ? formatReviewDate(claim.reviewAt) : 'Pending'}
                        </span>
                      </div>

                      <div className="flex items-center gap-2">
                        <span className="text-[10px] font-semibold text-[#5C4A42]">
                          {convictionPct}% Conviction
                        </span>
                        <button
                          type="button"
                          onClick={() => toggleEarlyCheck(claim.id)}
                          className={`rounded-md px-2 py-0.5 text-[10px] font-semibold transition-colors cursor-pointer focus-visible:ring-2 focus-visible:ring-[#3B2F2A] focus:outline-hidden ${
                            isEarlyChecking
                              ? 'bg-[#3B2F2A] text-[#FFFDF9]'
                              : 'bg-[#FFFDF9] text-[#8A5832] border border-[#E8D5C0] hover:bg-[#E8D5C0]/40'
                          }`}
                        >
                          {isEarlyChecking ? 'Hide actions' : 'Check now'}
                        </button>
                      </div>
                    </div>

                    <p className="font-serif text-xs text-[#292321] leading-relaxed">
                      &ldquo;{claim.statement}&rdquo;
                    </p>

                    {/* Early Resolution Buttons */}
                    {isEarlyChecking && (
                      <div className="rounded-lg bg-[#FFFDF9] p-2.5 border border-[#E8D5C0] mt-2 space-y-1.5">
                        <span className="text-[10px] font-semibold text-[#7A6255] uppercase tracking-wide font-serif block">
                          Check Prediction Outcome Now:
                        </span>
                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5">
                          <button
                            type="button"
                            disabled={isResolving}
                            onClick={() => onResolveClaim(claim.id, 'happened')}
                            className="flex items-center justify-center gap-1 rounded-md border border-emerald-300 bg-emerald-50 px-2 py-1 text-[10px] font-semibold text-emerald-800 hover:bg-emerald-100 disabled:opacity-50 cursor-pointer"
                          >
                            <CheckCircle2 className="h-2.5 w-2.5 text-emerald-600" />
                            <span>Happened</span>
                          </button>

                          <button
                            type="button"
                            disabled={isResolving}
                            onClick={() => onResolveClaim(claim.id, 'did_not_happen')}
                            className="flex items-center justify-center gap-1 rounded-md border border-rose-300 bg-rose-50 px-2 py-1 text-[10px] font-semibold text-rose-800 hover:bg-rose-100 disabled:opacity-50 cursor-pointer"
                          >
                            <XCircle className="h-2.5 w-2.5 text-rose-600" />
                            <span>Did not happen</span>
                          </button>

                          <button
                            type="button"
                            disabled={isResolving}
                            onClick={() => onResolveClaim(claim.id, 'still_open')}
                            className="flex items-center justify-center gap-1 rounded-md border border-amber-300 bg-amber-50 px-2 py-1 text-[10px] font-semibold text-amber-800 hover:bg-amber-100 disabled:opacity-50 cursor-pointer"
                          >
                            <Clock className="h-2.5 w-2.5 text-amber-600" />
                            <span>Still open (+30d)</span>
                          </button>

                          <button
                            type="button"
                            disabled={isResolving}
                            onClick={() => onResolveClaim(claim.id, 'no_longer_relevant')}
                            className="flex items-center justify-center gap-1 rounded-md border border-[#E4DCD3] bg-[#F7F3ED] px-2 py-1 text-[10px] font-semibold text-[#7A6255] hover:bg-[#E8D5C0]/40 disabled:opacity-50 cursor-pointer"
                          >
                            <Ban className="h-2.5 w-2.5 text-[#8C817A]" />
                            <span>Not relevant</span>
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </section>
      )}

      {/* 4. Resolved History Section */}
      {resolvedClaims.length > 0 && (
        <section className="border-t border-[#E4DCD3] pt-3 space-y-2">
          <button
            type="button"
            onClick={() => setShowResolvedHistory(!showResolvedHistory)}
            className="flex w-full items-center justify-between text-left text-xs font-semibold text-[#8C817A] hover:text-[#292321] transition-colors cursor-pointer font-serif"
          >
            <div className="flex items-center gap-1.5">
              <Layers className="h-3.5 w-3.5 text-[#8C817A]" />
              <span>Resolved Archive ({resolvedClaims.length})</span>
            </div>
            {showResolvedHistory ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
          </button>

          {showResolvedHistory && (
            <div className="space-y-2 pt-1 max-h-56 overflow-y-auto pr-1">
              {resolvedClaims.map((claim) => {
                let badgeStyle = 'bg-gray-100 text-gray-700 border-gray-200';
                let label: string = claim.outcome || 'resolved';
                if (claim.outcome === 'happened') {
                  badgeStyle = 'bg-emerald-50 text-emerald-800 border-emerald-200';
                  label = 'Happened';
                } else if (claim.outcome === 'did_not_happen') {
                  badgeStyle = 'bg-rose-50 text-rose-800 border-rose-200';
                  label = 'Did not happen';
                } else if (claim.outcome === 'no_longer_relevant') {
                  badgeStyle = 'bg-gray-50 text-gray-600 border-gray-200';
                  label = 'No longer relevant';
                }

                return (
                  <div
                    key={claim.id}
                    className="rounded-lg border border-[#E4DCD3] bg-[#FFFDF9] p-2.5 text-xs flex items-start justify-between gap-3"
                  >
                    <div className="flex-1 space-y-1">
                      <p className="font-serif text-[11px] text-[#292321] leading-relaxed">
                        &ldquo;{claim.statement}&rdquo;
                      </p>
                      <div className="flex items-center gap-2 text-[10px] text-[#8C817A] font-serif">
                        <span>#{claim.topicSlug}</span>
                        <span>&middot;</span>
                        <span>{Math.round(claim.conviction * 100)}% conviction</span>
                      </div>
                    </div>

                    <span className={`inline-flex items-center rounded-md border px-2 py-0.5 text-[10px] font-semibold shrink-0 ${badgeStyle}`}>
                      {label}
                    </span>
                  </div>
                );
              })}
            </div>
          )}
        </section>
      )}
    </div>
  );
};
