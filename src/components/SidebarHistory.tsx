import React, { useState, useMemo } from 'react';
import {
  Search,
  Tag,
  MessageSquare,
  Trash2,
  ShieldCheck,
  NotebookPen,
  Plus,
  Sparkles,
  ChevronDown,
  ChevronRight,
  Calendar,
  CheckCircle2,
  XCircle,
  Clock,
  Ban,
} from 'lucide-react';
import type { JournalEntry, ExtractedClaim, CalibrationRecord, PredictionOutcome } from '../types';

interface SidebarHistoryProps {
  entries: JournalEntry[];
  activeEntryId: string | null;
  onSelectEntry: (entry: JournalEntry) => void;
  onDeleteRequest: (entry: JournalEntry) => void;
  onNewEntry?: () => void;
  isOpen: boolean;
  onToggle: () => void;
  dueClaims?: ExtractedClaim[];
  upcomingClaims?: ExtractedClaim[];
  resolvedClaims?: ExtractedClaim[];
  calibration?: CalibrationRecord | null;
  soonestUpcomingReviewAt?: number | null;
  onResolveClaim?: (claimId: string, outcome: PredictionOutcome) => Promise<void>;
  isResolvingId?: string | null;
  onOpenReckoning?: () => void;
}

export const SidebarHistory: React.FC<SidebarHistoryProps> = ({
  entries,
  activeEntryId,
  onSelectEntry,
  onDeleteRequest,
  onNewEntry,
  isOpen,
  onToggle,
  dueClaims = [],
  upcomingClaims = [],
  resolvedClaims = [],
  calibration = null,
  soonestUpcomingReviewAt = null,
  onResolveClaim,
  isResolvingId = null,
  onOpenReckoning,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedTag, setSelectedTag] = useState<string | null>(null);
  const [isReckoningExpanded, setIsReckoningExpanded] = useState<boolean>(true);

  const formatDaysAgo = (timestamp: number) => {
    const diffMs = Date.now() - timestamp;
    const diffDays = Math.floor(diffMs / (24 * 60 * 60 * 1000));
    if (diffDays <= 0) return 'Today';
    if (diffDays === 1) return '1d ago';
    return `${diffDays}d ago`;
  };

  // Extract all unique tags
  const allTags = useMemo(() => {
    const set = new Set<string>();
    entries.forEach((e) => {
      e.tags?.forEach((t) => set.add(t.toLowerCase()));
    });
    return Array.from(set);
  }, [entries]);

  // Filter entries
  const filteredEntries = useMemo(() => {
    return entries.filter((entry) => {
      const matchSearch =
        searchQuery.trim() === '' ||
        entry.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (entry.summary && entry.summary.toLowerCase().includes(searchQuery.toLowerCase())) ||
        entry.messages.some((m) => m.content.toLowerCase().includes(searchQuery.toLowerCase()));

      const matchTag =
        !selectedTag || (entry.tags && entry.tags.map((t) => t.toLowerCase()).includes(selectedTag));

      return matchSearch && matchTag;
    });
  }, [entries, searchQuery, selectedTag]);

  // Group entries by date
  const groupedEntries = useMemo(() => {
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
    const yesterday = today - 86400000;
    const pastWeek = today - 7 * 86400000;

    const groups: { label: string; items: JournalEntry[] }[] = [
      { label: 'Today', items: [] },
      { label: 'Yesterday', items: [] },
      { label: 'Previous 7 Days', items: [] },
      { label: 'Earlier', items: [] },
    ];

    filteredEntries.forEach((entry) => {
      const t = entry.updatedAt || entry.createdAt;
      if (t >= today) {
        groups[0].items.push(entry);
      } else if (t >= yesterday) {
        groups[1].items.push(entry);
      } else if (t >= pastWeek) {
        groups[2].items.push(entry);
      } else {
        groups[3].items.push(entry);
      }
    });

    return groups.filter((g) => g.items.length > 0);
  }, [filteredEntries]);

  const formatDate = (timestamp: number) => {
    const d = new Date(timestamp);
    return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  return (
    <>
      {/* Mobile Backdrop */}
      {isOpen && (
        <div
          className="fixed inset-0 z-20 bg-[#3B2F2A]/30 backdrop-blur-xs md:hidden"
          onClick={onToggle}
          aria-hidden="true"
        />
      )}

      <aside
        aria-label="Reflection History Sidebar"
        className={`fixed inset-y-0 left-0 z-20 flex w-80 flex-col border-r border-[#E4DCD3] bg-[#FFFDF9] transition-transform duration-200 ease-in-out md:static md:translate-x-0 ${
          isOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'
        }`}
        style={{ height: 'calc(100vh - 53px)' }}
      >
        {/* Search & Tag Filter Bar */}
        <div className="border-b border-[#E4DCD3] p-3 space-y-2 bg-[#FFFDF9]">
          <div className="relative">
            <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-[#8C817A]" />
            <input
              type="text"
              id="input-search-history"
              aria-label="Search reflections and tags"
              placeholder="Search reflections & tags..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full rounded-lg border border-[#E4DCD3] bg-[#F7F3ED] py-1.5 pl-8 pr-7 text-xs text-[#292321] placeholder:text-[#8C817A] focus:border-[#3B2F2A] focus:bg-[#FFFDF9] focus-visible:ring-2 focus-visible:ring-[#3B2F2A] focus:outline-hidden"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                aria-label="Clear search input"
                className="absolute right-2.5 top-2 text-xs text-[#8C817A] hover:text-[#292321] focus-visible:ring-2 focus-visible:ring-[#3B2F2A] rounded p-0.5"
              >
                &times;
              </button>
            )}
          </div>

          {/* Tag Filter Pills */}
          {allTags.length > 0 && (
            <div className="flex flex-wrap gap-1 pt-1 max-h-16 overflow-y-auto">
              <button
                onClick={() => setSelectedTag(null)}
                className={`rounded-md px-2 py-0.5 text-[10px] font-medium transition-colors focus-visible:ring-2 focus-visible:ring-[#3B2F2A] focus:outline-hidden cursor-pointer ${
                  selectedTag === null
                    ? 'bg-[#3B2F2A] text-[#FFFDF9]'
                    : 'bg-[#F7F3ED] text-[#5C4A42] border border-[#E4DCD3] hover:bg-[#E8D5C0]/40'
                }`}
              >
                All
              </button>
              {allTags.map((tag) => (
                <button
                  key={tag}
                  onClick={() => setSelectedTag(selectedTag === tag ? null : tag)}
                  className={`flex items-center gap-1 rounded-md px-2 py-0.5 text-[10px] font-medium transition-colors focus-visible:ring-2 focus-visible:ring-[#3B2F2A] focus:outline-hidden cursor-pointer ${
                    selectedTag === tag
                      ? 'bg-[#3B2F2A] text-[#FFFDF9]'
                      : 'bg-[#F7F3ED] text-[#5C4A42] border border-[#E4DCD3] hover:bg-[#E8D5C0]/40'
                  }`}
                >
                  <Tag className="h-2.5 w-2.5 text-[#B9825A]" />
                  <span>#{tag}</span>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Reckoning Due Queue Section (Appears in Sidebar when due items exist) */}
        {dueClaims.length > 0 && (
          <div className="border-b border-[#DFC8B2] bg-[#F4EFEA] p-3 space-y-2.5">
            <div className="flex items-center justify-between">
              <button
                type="button"
                onClick={() => setIsReckoningExpanded(!isReckoningExpanded)}
                className="flex items-center gap-1.5 text-left font-serif text-xs font-bold text-[#8A2E20] hover:text-[#5C1F15] transition-colors cursor-pointer focus-visible:ring-2 focus-visible:ring-[#3B2F2A] focus:outline-hidden"
              >
                <Sparkles className="h-3.5 w-3.5 text-[#8A2E20]" />
                <span>The Reckoning</span>
                <span className="inline-flex items-center rounded-full bg-[#8A2E20] px-1.5 py-0.2 text-[9px] font-bold text-[#FFFDF9]">
                  {dueClaims.length} due
                </span>
              </button>

              {onOpenReckoning && (
                <button
                  type="button"
                  onClick={onOpenReckoning}
                  title="Open full Reckoning & Calibration record"
                  className="text-[10px] font-medium text-[#7A6255] hover:text-[#292321] hover:underline cursor-pointer"
                >
                  View all
                </button>
              )}
            </div>

            {isReckoningExpanded && (
              <div className="space-y-2.5 max-h-72 overflow-y-auto pr-0.5">
                {dueClaims.map((claim) => {
                  const convictionPct = Math.round(claim.conviction * 100);
                  const isResolving = isResolvingId === claim.id;

                  return (
                    <div
                      key={claim.id}
                      className="rounded-xl border border-[#D5C8BD] bg-[#FFFDF9] p-3 shadow-2xs space-y-2"
                    >
                      <div className="flex items-center justify-between gap-1.5 text-[10px]">
                        <span className="font-semibold text-[#5C4A42]">#{claim.topicSlug}</span>
                        <span className="text-[#8C817A]">{formatDaysAgo(claim.createdAt)}</span>
                      </div>

                      <p className="font-serif text-xs font-medium text-[#292321] leading-relaxed">
                        &ldquo;{claim.statement}&rdquo;
                      </p>

                      {/* Conviction Bar */}
                      <div className="space-y-1">
                        <div className="flex justify-between text-[9px] text-[#7A6255]">
                          <span>Conviction</span>
                          <span className="font-bold">{convictionPct}%</span>
                        </div>
                        <div className="h-1 w-full overflow-hidden rounded-full bg-[#E4DCD3]">
                          <div
                            className="h-full rounded-full bg-[#8A5832]"
                            style={{ width: `${Math.max(8, convictionPct)}%` }}
                          />
                        </div>
                      </div>

                      {/* 4 Outcome Resolution Buttons */}
                      <div className="pt-1 grid grid-cols-2 gap-1 text-[10px]">
                        <button
                          type="button"
                          disabled={isResolving}
                          onClick={() => onResolveClaim && onResolveClaim(claim.id, 'happened')}
                          className="flex items-center justify-center gap-1 rounded-md border border-emerald-300 bg-emerald-50 px-1.5 py-1 font-semibold text-emerald-800 hover:bg-emerald-100 disabled:opacity-50 transition-colors cursor-pointer"
                        >
                          <CheckCircle2 className="h-2.5 w-2.5 text-emerald-600" />
                          <span>Happened</span>
                        </button>

                        <button
                          type="button"
                          disabled={isResolving}
                          onClick={() => onResolveClaim && onResolveClaim(claim.id, 'did_not_happen')}
                          className="flex items-center justify-center gap-1 rounded-md border border-rose-300 bg-rose-50 px-1.5 py-1 font-semibold text-rose-800 hover:bg-rose-100 disabled:opacity-50 transition-colors cursor-pointer"
                        >
                          <XCircle className="h-2.5 w-2.5 text-rose-600" />
                          <span>Did not</span>
                        </button>

                        <button
                          type="button"
                          disabled={isResolving}
                          onClick={() => onResolveClaim && onResolveClaim(claim.id, 'still_open')}
                          title="Postpone check by 30 days"
                          className="flex items-center justify-center gap-1 rounded-md border border-amber-300 bg-amber-50 px-1.5 py-1 font-semibold text-amber-800 hover:bg-amber-100 disabled:opacity-50 transition-colors cursor-pointer"
                        >
                          <Clock className="h-2.5 w-2.5 text-amber-600" />
                          <span>Still open (+30d)</span>
                        </button>

                        <button
                          type="button"
                          disabled={isResolving}
                          onClick={() => onResolveClaim && onResolveClaim(claim.id, 'no_longer_relevant')}
                          className="flex items-center justify-center gap-1 rounded-md border border-[#E4DCD3] bg-[#F7F3ED] px-1.5 py-1 font-semibold text-[#7A6255] hover:bg-[#E8D5C0]/40 disabled:opacity-50 transition-colors cursor-pointer"
                        >
                          <Ban className="h-2.5 w-2.5 text-[#8C817A]" />
                          <span>Not relevant</span>
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* History Entries List */}
        <div className="flex-1 overflow-y-auto p-2 space-y-4">
          {entries.length === 0 ? (
            /* Empty state teaching next action */
            <div className="py-10 text-center text-xs text-[#8C817A] px-4 font-serif">
              <div className="mx-auto flex h-11 w-11 items-center justify-center rounded-xl bg-[#F7F3ED] border border-[#E4DCD3] text-[#B9825A] mb-3">
                <NotebookPen className="h-5 w-5" />
              </div>
              <h3 className="font-semibold text-sm text-[#292321]">Start your first reflection</h3>
              <p className="mt-1 text-[11px] text-[#7A6255] leading-relaxed">
                Capture a raw thought, question, or dilemma. As you reflect and seal entries, your epistemological stance records will appear here.
              </p>
              {onNewEntry && (
                <button
                  onClick={onNewEntry}
                  id="btn-sidebar-first-reflection"
                  className="mt-4 inline-flex items-center gap-1.5 rounded-lg bg-[#3B2F2A] px-3.5 py-2 text-xs font-semibold text-[#FFFDF9] shadow-xs hover:bg-[#292321] focus-visible:ring-2 focus-visible:ring-[#3B2F2A] focus:outline-hidden cursor-pointer"
                >
                  <Plus className="h-3.5 w-3.5 text-[#E8D5C0]" />
                  <span>Start First Reflection</span>
                </button>
              )}
            </div>
          ) : groupedEntries.length === 0 ? (
            /* Search filter with zero results */
            <div className="py-10 text-center text-xs text-[#8C817A] px-4 font-serif">
              <p className="font-semibold text-[#292321]">No matching reflections</p>
              <p className="mt-1 text-[11px] text-[#7A6255]">
                No entries match your search query &ldquo;{searchQuery}&rdquo;.
              </p>
              <button
                onClick={() => {
                  setSearchQuery('');
                  setSelectedTag(null);
                }}
                className="mt-3 text-xs font-medium text-[#B9825A] hover:underline"
              >
                Clear search filters
              </button>
            </div>
          ) : (
            groupedEntries.map((group) => (
              <div key={group.label} className="space-y-1">
                <div className="px-2 py-1 text-[10px] font-semibold tracking-wider uppercase text-[#8C817A] font-serif">
                  {group.label}
                </div>
                <div className="space-y-1">
                  {group.items.map((entry) => {
                    const isActive = entry.id === activeEntryId;
                    const turnCount = entry.messages.filter((m) => m.role === 'user').length;

                    return (
                      <div
                        key={entry.id}
                        onClick={() => onSelectEntry(entry)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' || e.key === ' ') {
                            e.preventDefault();
                            onSelectEntry(entry);
                          }
                        }}
                        tabIndex={0}
                        role="button"
                        aria-pressed={isActive}
                        aria-label={`Reflection: ${entry.title || 'Untitled'}, ${turnCount} thoughts`}
                        className={`group relative flex cursor-pointer flex-col rounded-xl p-2.5 text-left transition-all focus-visible:ring-2 focus-visible:ring-[#3B2F2A] focus:outline-hidden ${
                          isActive
                            ? 'bg-[#3B2F2A] text-[#FFFDF9] shadow-xs'
                            : 'hover:bg-[#F7F3ED] text-[#292321]'
                        }`}
                      >
                        <div className="flex items-start justify-between gap-2">
                          <h4
                            className={`text-xs font-serif font-medium line-clamp-1 flex-1 ${
                              isActive ? 'text-[#FFFDF9]' : 'text-[#292321]'
                            }`}
                          >
                            {entry.title || 'Untitled Reflection'}
                          </h4>
                          <span
                            className={`text-[10px] shrink-0 font-sans ${
                              isActive ? 'text-[#E8D5C0]' : 'text-[#8C817A]'
                            }`}
                          >
                            {formatDate(entry.updatedAt || entry.createdAt)}
                          </span>
                        </div>

                        {entry.summary && (
                          <p
                            className={`mt-1 text-[11px] line-clamp-2 leading-relaxed font-serif ${
                              isActive ? 'text-[#E8D5C0]' : 'text-[#7A6255]'
                            }`}
                          >
                            {entry.summary}
                          </p>
                        )}

                        <div className="mt-2 flex items-center justify-between">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <span
                              className={`flex items-center gap-0.5 text-[10px] font-medium ${
                                isActive ? 'text-[#E8D5C0]' : 'text-[#7A6255]'
                              }`}
                            >
                              <MessageSquare className="h-2.5 w-2.5" />
                              <span>{turnCount} {turnCount === 1 ? 'thought' : 'thoughts'}</span>
                            </span>

                            {entry.tags && entry.tags.length > 0 && (
                              <span
                                className={`rounded px-1.5 py-0.2 text-[9px] ${
                                  isActive
                                    ? 'bg-[#292321] text-[#E8D5C0]'
                                    : 'bg-[#E8D5C0]/60 text-[#3B2F2A]'
                                }`}
                              >
                                #{entry.tags[0]}
                              </span>
                            )}

                            {entry.isSealed && (
                              <span
                                title="Sealed session with extracted stances"
                                className={`inline-flex items-center gap-0.5 rounded px-1.5 py-0.2 text-[9px] font-medium ${
                                  isActive
                                    ? 'bg-[#B9825A]/30 text-[#E8D5C0] border border-[#B9825A]/40'
                                    : 'bg-[#F7F3ED] text-[#8A5832] border border-[#E4DCD3]'
                                }`}
                              >
                                <ShieldCheck className="h-2.5 w-2.5 text-[#B9825A]" />
                                <span>Sealed</span>
                              </span>
                            )}
                          </div>

                          {/* Delete Entry Button */}
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              onDeleteRequest(entry);
                            }}
                            aria-label={`Delete reflection: ${entry.title || 'Untitled'}`}
                            title="Delete entry"
                            className={`opacity-0 group-hover:opacity-100 group-focus-within:opacity-100 rounded p-1 transition-opacity cursor-pointer focus-visible:ring-2 focus-visible:ring-rose-600 focus:outline-hidden ${
                              isActive
                                ? 'text-[#E8D5C0] hover:bg-[#292321] hover:text-rose-300'
                                : 'text-[#8C817A] hover:bg-[#E8D5C0]/40 hover:text-rose-600'
                            }`}
                          >
                            <Trash2 className="h-3 w-3" />
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            ))
          )}
        </div>

        {/* Sidebar Footer Info & Calibration Record Button */}
        <div className="border-t border-[#E4DCD3] p-2.5 bg-[#FFFDF9] space-y-2">
          {onOpenReckoning && (
            <button
              type="button"
              onClick={onOpenReckoning}
              className="flex w-full items-center justify-between rounded-lg border border-[#E4DCD3] bg-[#F7F3ED] px-3 py-2 text-left text-xs font-serif text-[#292321] hover:border-[#B9825A] hover:bg-[#E8D5C0]/40 transition-all cursor-pointer focus-visible:ring-2 focus-visible:ring-[#3B2F2A] focus:outline-hidden"
            >
              <div className="flex items-center gap-2">
                <Sparkles className="h-3.5 w-3.5 text-[#B9825A]" />
                <span className="font-semibold">The Reckoning</span>
              </div>

              {dueClaims.length > 0 ? (
                <span className="rounded-full bg-[#8A2E20] px-2 py-0.5 text-[10px] font-bold text-[#FFFDF9]">
                  {dueClaims.length} due
                </span>
              ) : calibration && calibration.totalResolved >= 3 ? (
                <span className="text-[10px] font-semibold text-[#5C4A42]">
                  {Math.round(calibration.overallRate * 100)}% accuracy ({calibration.totalHappened}/{calibration.totalResolved})
                </span>
              ) : (
                <span className="text-[10px] text-[#8C817A]">
                  Calibration ({calibration?.totalResolved || 0}/3)
                </span>
              )}
            </button>
          )}

          <div className="text-center text-[10px] text-[#8C817A] font-serif">
            <span>{entries.length} Total Recorded Reflections</span>
          </div>
        </div>
      </aside>
    </>
  );
};

