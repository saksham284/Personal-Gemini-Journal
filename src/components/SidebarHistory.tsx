import React, { useState, useMemo } from 'react';
import { Search, Tag, MessageSquare, Trash2, Calendar, Sparkles, ChevronLeft, ChevronRight } from 'lucide-react';
import type { JournalEntry } from '../types';

interface SidebarHistoryProps {
  entries: JournalEntry[];
  activeEntryId: string | null;
  onSelectEntry: (entry: JournalEntry) => void;
  onDeleteRequest: (entry: JournalEntry) => void;
  isOpen: boolean;
  onToggle: () => void;
}

export const SidebarHistory: React.FC<SidebarHistoryProps> = ({
  entries,
  activeEntryId,
  onSelectEntry,
  onDeleteRequest,
  isOpen,
  onToggle,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedTag, setSelectedTag] = useState<string | null>(null);

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
          className="fixed inset-0 z-20 bg-neutral-900/30 backdrop-blur-xs md:hidden"
          onClick={onToggle}
        />
      )}

      <aside
        className={`fixed inset-y-0 left-0 z-20 flex w-80 flex-col border-r border-neutral-200 bg-white transition-transform duration-200 ease-in-out md:static md:translate-x-0 ${
          isOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'
        }`}
        style={{ height: 'calc(100vh - 53px)' }}
      >
        {/* Search & Tag Filter Bar */}
        <div className="border-b border-neutral-200 p-3 space-y-2">
          <div className="relative">
            <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-neutral-400" />
            <input
              type="text"
              id="input-search-history"
              placeholder="Search reflections & tags..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full rounded-lg border border-neutral-200 bg-neutral-50 py-1.5 pl-8 pr-3 text-xs text-neutral-900 placeholder:text-neutral-400 focus:border-neutral-900 focus:bg-white focus:outline-hidden"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute right-2.5 top-2 text-xs text-neutral-400 hover:text-neutral-700"
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
                className={`rounded-md px-2 py-0.5 text-[10px] font-medium transition-colors ${
                  selectedTag === null
                    ? 'bg-neutral-900 text-white'
                    : 'bg-neutral-100 text-neutral-600 hover:bg-neutral-200'
                }`}
              >
                All
              </button>
              {allTags.map((tag) => (
                <button
                  key={tag}
                  onClick={() => setSelectedTag(selectedTag === tag ? null : tag)}
                  className={`flex items-center gap-1 rounded-md px-2 py-0.5 text-[10px] font-medium transition-colors ${
                    selectedTag === tag
                      ? 'bg-neutral-900 text-white'
                      : 'bg-neutral-100 text-neutral-600 hover:bg-neutral-200'
                  }`}
                >
                  <Tag className="h-2.5 w-2.5" />
                  <span>#{tag}</span>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* History Entries List */}
        <div className="flex-1 overflow-y-auto p-2 space-y-4">
          {groupedEntries.length === 0 ? (
            <div className="py-12 text-center text-xs text-neutral-400 px-4">
              <Calendar className="mx-auto h-7 w-7 text-neutral-300 mb-2" />
              <p className="font-medium text-neutral-600">No reflections found</p>
              <p className="mt-1 text-[11px]">
                {entries.length === 0
                  ? 'Your saved reflections and conversations will appear here.'
                  : 'No entries match your search query.'}
              </p>
            </div>
          ) : (
            groupedEntries.map((group) => (
              <div key={group.label} className="space-y-1">
                <div className="px-2 py-1 text-[11px] font-semibold tracking-wider uppercase text-neutral-400">
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
                        className={`group relative flex cursor-pointer flex-col rounded-lg p-2.5 text-left transition-all ${
                          isActive
                            ? 'bg-neutral-900 text-white shadow-xs'
                            : 'hover:bg-neutral-100 text-neutral-800'
                        }`}
                      >
                        <div className="flex items-start justify-between gap-2">
                          <h4
                            className={`text-xs font-medium line-clamp-1 flex-1 ${
                              isActive ? 'text-white' : 'text-neutral-900'
                            }`}
                          >
                            {entry.title || 'Untitled Reflection'}
                          </h4>
                          <span
                            className={`text-[10px] shrink-0 ${
                              isActive ? 'text-neutral-300' : 'text-neutral-400'
                            }`}
                          >
                            {formatDate(entry.updatedAt || entry.createdAt)}
                          </span>
                        </div>

                        {entry.summary && (
                          <p
                            className={`mt-1 text-[11px] line-clamp-2 leading-relaxed ${
                              isActive ? 'text-neutral-300' : 'text-neutral-500'
                            }`}
                          >
                            {entry.summary}
                          </p>
                        )}

                        <div className="mt-2 flex items-center justify-between">
                          <div className="flex items-center gap-1.5">
                            <span
                              className={`flex items-center gap-0.5 text-[10px] font-medium ${
                                isActive ? 'text-neutral-300' : 'text-neutral-500'
                              }`}
                            >
                              <MessageSquare className="h-2.5 w-2.5" />
                              <span>{turnCount} {turnCount === 1 ? 'turn' : 'turns'}</span>
                            </span>

                            {entry.tags && entry.tags.length > 0 && (
                              <span
                                className={`rounded px-1 py-0.2 text-[9px] ${
                                  isActive
                                    ? 'bg-neutral-800 text-neutral-200'
                                    : 'bg-neutral-200 text-neutral-600'
                                }`}
                              >
                                #{entry.tags[0]}
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
                            title="Delete entry"
                            className={`opacity-0 group-hover:opacity-100 rounded p-1 transition-opacity ${
                              isActive
                                ? 'text-neutral-300 hover:bg-neutral-800 hover:text-rose-300'
                                : 'text-neutral-400 hover:bg-neutral-200 hover:text-rose-600'
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

        {/* Sidebar Footer Info */}
        <div className="border-t border-neutral-200 p-2.5 text-center text-[11px] text-neutral-400">
          <span>{entries.length} Total Saved Reflections</span>
        </div>
      </aside>
    </>
  );
};
