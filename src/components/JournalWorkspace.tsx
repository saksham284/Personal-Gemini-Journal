import React, { useState, useRef, useEffect } from 'react';
import Markdown from 'react-markdown';
import {
  Send,
  Sparkles,
  Bot,
  User,
  Copy,
  Check,
  RefreshCw,
  Lightbulb,
  Compass,
  ListTodo,
  Heart,
  Tag as TagIcon,
  Download,
  AlertCircle,
  ShieldCheck,
  Lock,
  ArrowRight,
  GitBranch,
  HelpCircle,
  NotebookPen,
  Feather,
} from 'lucide-react';
import type { JournalEntry, ChatMessage, ReflectionMode, ExtractedClaim, ClaimGap } from '../types';

interface JournalWorkspaceProps {
  entry: JournalEntry;
  onUpdateEntry: (updated: JournalEntry) => Promise<void>;
  onSummarizeEntry: (entry: JournalEntry) => Promise<void>;
  onSealSession: (entry: JournalEntry) => Promise<void>;
  isGenerating: boolean;
  isSummarizing: boolean;
  isSealing: boolean;
  onSendMessage: (userText: string, mode: ReflectionMode) => Promise<void>;
  errorMessage: string | null;
  onClearError: () => void;
}

const REFLECTION_MODES: {
  id: ReflectionMode;
  label: string;
  desc: string;
  icon: React.ComponentType<{ className?: string }>;
}[] = [
  {
    id: 'deep_reflection',
    label: 'Deep Reflection',
    desc: 'Empathetic exploration and philosophical inquiry',
    icon: Compass,
  },
  {
    id: 'brainstorm',
    label: 'Brainstorming',
    desc: 'Creative angles, divergent thinking, and ideas',
    icon: Lightbulb,
  },
  {
    id: 'action_steps',
    label: 'Action Steps',
    desc: 'Turn thoughts into actionable, structured priorities',
    icon: ListTodo,
  },
  {
    id: 'gratitude',
    label: 'Gratitude & Wins',
    desc: 'Focus on growth, mindfulness, and appreciation',
    icon: Heart,
  },
  {
    id: 'summary',
    label: 'Summary & Synthesis',
    desc: 'Extract key themes and emotional patterns',
    icon: Feather,
  },
];

const PROMPT_SUGGESTIONS: Record<ReflectionMode, string[]> = {
  deep_reflection: [
    "I'm feeling conflicted about a major decision. Can you help me unpack the underlying values?",
    "What's causing me subtle stress lately and how can I process it with clarity?",
    "Help me reflect on how I handled a difficult conversation today.",
  ],
  brainstorm: [
    "Brainstorm 3 non-obvious approaches to overcome a creative block in my work.",
    "Give me 5 fresh perspectives on optimizing my daily schedule.",
    "What are unusual ways to re-energize when motivation is low?",
  ],
  action_steps: [
    "Here is everything swirling in my head. Help me distill it into 3 clear next steps.",
    "Help me break down a daunting goal into bite-sized 15-minute actions.",
    "What is the single highest-leverage task I should focus on first?",
  ],
  gratitude: [
    "Help me identify 3 small, unnoticed wins from today.",
    "How can I reframe a frustrating setback into a meaningful lesson?",
    "Guide me through a quick reflection on relationships I'm grateful for.",
  ],
  summary: [
    "Synthesize the key emotional patterns and recurring themes in our conversation.",
    "What are the core takeaways from today's journal entry?",
    "Summarize my breakthroughs and lingering open questions.",
  ],
};

function getClassificationBadge(classification: 'reverses' | 'abandons' | 'refines') {
  switch (classification) {
    case 'reverses':
      return {
        label: 'Reverses Prior Stance',
        bg: 'bg-[#FDF7F5] border-[#EAD8D2] text-[#9C3E2D]',
        dot: 'bg-[#9C3E2D]',
      };
    case 'abandons':
      return {
        label: 'Abandons Prior Stance',
        bg: 'bg-[#FDF9F5] border-[#E8D5C0] text-[#8A5832]',
        dot: 'bg-[#8A5832]',
      };
    case 'refines':
      return {
        label: 'Refines Prior Stance',
        bg: 'bg-[#FAF6F0] border-[#E4DCD3] text-[#7A6255]',
        dot: 'bg-[#B9825A]',
      };
  }
}

export const JournalWorkspace: React.FC<JournalWorkspaceProps> = ({
  entry,
  onUpdateEntry,
  onSummarizeEntry,
  onSealSession,
  isGenerating,
  isSummarizing,
  isSealing,
  onSendMessage,
  errorMessage,
  onClearError,
}) => {
  const [inputText, setInputText] = useState('');
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [isEditingTitle, setIsEditingTitle] = useState(false);
  const [titleDraft, setTitleDraft] = useState(entry.title);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    setTitleDraft(entry.title);
  }, [entry.title]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [entry.messages, isGenerating, isSealing]);

  // Adjust textarea height dynamically
  const handleInputChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setInputText(e.target.value);
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 180)}px`;
    }
  };

  const handleSend = async () => {
    if (!inputText.trim() || isGenerating || isSealing) return;
    const text = inputText.trim();
    setInputText('');
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
    }
    await onSendMessage(text, entry.mode);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleModeChange = async (mode: ReflectionMode) => {
    await onUpdateEntry({
      ...entry,
      mode,
    });
  };

  const handleSaveTitle = async () => {
    setIsEditingTitle(false);
    if (titleDraft.trim() && titleDraft !== entry.title) {
      await onUpdateEntry({
        ...entry,
        title: titleDraft.trim(),
      });
    }
  };

  const handleCopyMessage = (id: string, text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const handleExportMarkdown = () => {
    const lines = [
      `# ${entry.title}`,
      `*Date: ${new Date(entry.createdAt).toLocaleDateString()} | Mode: ${entry.mode}*`,
      '',
      entry.summary ? `> **Summary**: ${entry.summary}\n` : '',
      '---',
      '',
    ];

    if (entry.claims && entry.claims.length > 0) {
      lines.push('## Extracted Stances & Claims (Epistemological Ledger)');
      entry.claims.forEach((c) => {
        lines.push(`- **#${c.topicSlug}** (${Math.round(c.conviction * 100)}% Conviction): ${c.statement}`);
      });
      lines.push('\n---\n');
    }

    if (entry.claimGaps && entry.claimGaps.length > 0) {
      lines.push('## Stance Evolution & Perspective Shifts');
      entry.claimGaps.forEach((g) => {
        lines.push(`### Topic: #${g.topicSlug} [${g.classification.toUpperCase()}]`);
        lines.push(`- **Prior Stance**: ${g.previousClaim}`);
        lines.push(`- **New Stance**: ${g.newClaim}`);
        lines.push(`- **Reflective Inquiry**: ${g.question}\n`);
      });
      lines.push('\n---\n');
    }

    entry.messages.forEach((msg) => {
      const speaker = msg.role === 'user' ? '**You**' : '**Gemini Reflection**';
      lines.push(`${speaker} (${new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}):`);
      lines.push(msg.content);
      lines.push('\n---\n');
    });

    const blob = new Blob([lines.join('\n')], { type: 'text/markdown;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${entry.title.replace(/[^a-z0-9]/gi, '_').toLowerCase() || 'reflection'}.md`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const activeModeObj = REFLECTION_MODES.find((m) => m.id === entry.mode) || REFLECTION_MODES[0];
  const suggestions = PROMPT_SUGGESTIONS[entry.mode] || [];

  return (
    <div className="flex flex-1 flex-col bg-[#F7F3ED] overflow-hidden" style={{ height: 'calc(100vh - 53px)' }}>
      {/* Session Header */}
      <div className="border-b border-[#E4DCD3] bg-[#FFFDF9] px-6 py-3.5 shadow-2xs">
        <div className="flex flex-wrap items-center justify-between gap-3">
          {/* Editable Title & Seal Status */}
          <div className="flex items-center gap-2.5 flex-1 min-w-[240px]">
            {isEditingTitle ? (
              <input
                type="text"
                value={titleDraft}
                onChange={(e) => setTitleDraft(e.target.value)}
                onBlur={handleSaveTitle}
                onKeyDown={(e) => e.key === 'Enter' && handleSaveTitle()}
                autoFocus
                className="w-full rounded-md border border-[#B9825A] bg-[#F7F3ED] px-2.5 py-1 text-sm font-serif font-semibold text-[#292321] focus:outline-hidden"
              />
            ) : (
              <div className="flex items-center gap-2 flex-wrap">
                <h2
                  onClick={() => setIsEditingTitle(true)}
                  title="Click to rename entry"
                  className="cursor-pointer font-serif text-lg font-semibold text-[#292321] hover:text-[#7A6255] transition-colors line-clamp-1"
                >
                  {entry.title || 'Untitled Reflection'}
                </h2>
                {entry.isSealed && (
                  <span className="inline-flex items-center gap-1 rounded-md bg-[#F7F3ED] border border-[#E4DCD3] px-2 py-0.5 text-[10px] font-semibold text-[#7A6255]">
                    <ShieldCheck className="h-3 w-3 text-[#B9825A]" />
                    <span>Sealed</span>
                  </span>
                )}
              </div>
            )}

            <span className="text-[11px] text-[#8C817A] shrink-0 font-serif italic">
              {new Date(entry.createdAt).toLocaleDateString([], { month: 'short', day: 'numeric' })}
            </span>
          </div>

          {/* Quick Toolbar Actions */}
          <div className="flex items-center gap-2 flex-wrap">
            {/* Seal Session Button */}
            {entry.messages.length > 0 && (
              <button
                onClick={() => onSealSession(entry)}
                disabled={isSealing || isGenerating || isSummarizing}
                id="btn-seal-session"
                title="Seal session, extract first-person stances, and evaluate topic evolution"
                className={`flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-semibold transition-all disabled:opacity-50 cursor-pointer ${
                  entry.isSealed
                    ? 'border-[#B9825A] bg-[#F7F3ED] text-[#3B2F2A] hover:bg-[#E8D5C0]/40'
                    : 'border-[#3B2F2A] bg-[#3B2F2A] text-[#FFFDF9] hover:bg-[#292321] shadow-xs'
                }`}
              >
                {isSealing ? (
                  <RefreshCw className="h-3.5 w-3.5 animate-spin text-[#E8D5C0]" />
                ) : (
                  <Lock className="h-3.5 w-3.5 text-[#E8D5C0]" />
                )}
                <span>{isSealing ? 'Extracting Stances...' : entry.isSealed ? 'Re-extract & Seal' : 'Seal Session'}</span>
              </button>
            )}

            {/* Auto Summarize & Tag Button */}
            {entry.messages.length >= 2 && (
              <button
                onClick={() => onSummarizeEntry(entry)}
                disabled={isSummarizing || isGenerating || isSealing}
                id="btn-auto-summarize"
                title="Synthesize conversation, title, and tags with Gemini"
                className="flex items-center gap-1.5 rounded-lg border border-[#E4DCD3] bg-[#F7F3ED] px-2.5 py-1.5 text-xs font-medium text-[#7A6255] hover:bg-[#E8D5C0]/40 hover:text-[#292321] transition-colors disabled:opacity-50 cursor-pointer"
              >
                <Sparkles className={`h-3.5 w-3.5 text-[#B9825A] ${isSummarizing ? 'animate-spin' : ''}`} />
                <span>{isSummarizing ? 'Synthesizing...' : 'Summarize'}</span>
              </button>
            )}

            {/* Export Markdown */}
            <button
              onClick={handleExportMarkdown}
              id="btn-export-markdown"
              title="Download Markdown file"
              className="flex items-center gap-1 rounded-lg border border-[#E4DCD3] bg-[#FFFDF9] p-1.5 text-xs text-[#7A6255] hover:bg-[#F7F3ED] hover:text-[#292321] transition-colors cursor-pointer"
            >
              <Download className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>

        {/* Mode Selector Chips */}
        <div className="mt-3 flex items-center gap-1.5 overflow-x-auto pb-0.5">
          <span className="text-[11px] font-medium text-[#8C817A] mr-1 shrink-0 font-serif">Mode:</span>
          {REFLECTION_MODES.map((m) => {
            const isSelected = entry.mode === m.id;
            const Icon = m.icon;
            return (
              <button
                key={m.id}
                onClick={() => handleModeChange(m.id)}
                className={`flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium whitespace-nowrap transition-all cursor-pointer ${
                  isSelected
                    ? 'bg-[#3B2F2A] text-[#FFFDF9] shadow-xs'
                    : 'bg-[#F7F3ED] text-[#7A6255] border border-[#E4DCD3] hover:bg-[#E8D5C0]/40 hover:text-[#292321]'
                }`}
              >
                <Icon className="h-3 w-3" />
                <span>{m.label}</span>
              </button>
            );
          })}
        </div>

        {/* Summary Card if exists */}
        {entry.summary && (
          <div className="mt-3 rounded-xl bg-[#F7F3ED] p-3 border border-[#E4DCD3] text-xs">
            <div className="flex items-start gap-2.5">
              <Sparkles className="h-3.5 w-3.5 text-[#B9825A] mt-0.5 shrink-0" />
              <div className="flex-1">
                <p className="text-[#292321] leading-relaxed font-serif italic">{entry.summary}</p>
                {entry.tags && entry.tags.length > 0 && (
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {entry.tags.map((t) => (
                      <span
                        key={t}
                        className="inline-flex items-center gap-0.5 rounded-md bg-[#FFFDF9] border border-[#E4DCD3] px-2 py-0.5 text-[10px] font-medium text-[#7A6255]"
                      >
                        <TagIcon className="h-2.5 w-2.5 text-[#B9825A]" />
                        #{t}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Error Banner */}
      {errorMessage && (
        <div className="flex items-center justify-between border-b border-rose-200 bg-rose-50 px-6 py-2 text-xs text-rose-800">
          <div className="flex items-center gap-2">
            <AlertCircle className="h-4 w-4 shrink-0" />
            <span>{errorMessage}</span>
          </div>
          <button
            onClick={onClearError}
            className="rounded px-2 py-0.5 font-semibold hover:bg-rose-100"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* Chat Messages Stream & Sealed Claims Display */}
      <div className="flex-1 overflow-y-auto px-4 py-6 sm:px-8">
        <div className="mx-auto max-w-3xl space-y-6">
          {/* Welcome Prompt If Conversation is Empty */}
          {entry.messages.length === 0 && (
            <div className="rounded-2xl border border-dashed border-[#E4DCD3] bg-[#FFFDF9]/80 p-8 text-center">
              <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-xl bg-[#F7F3ED] text-[#3B2F2A] border border-[#E4DCD3] mb-4">
                <NotebookPen className="h-6 w-6 text-[#B9825A]" />
              </div>
              <h3 className="font-serif text-lg font-semibold text-[#292321]">
                Begin your reflection in {activeModeObj.label}
              </h3>
              <p className="mx-auto mt-1 max-w-md text-xs text-[#7A6255] leading-relaxed font-serif">
                {activeModeObj.desc}. Write whatever is on your mind, or choose a prompt to begin:
              </p>

              {/* Inspiration Starters */}
              <div className="mt-6 grid grid-cols-1 gap-2.5 sm:grid-cols-1 text-left">
                {suggestions.map((prompt, idx) => (
                  <button
                    key={idx}
                    onClick={() => {
                      setInputText(prompt);
                      if (textareaRef.current) textareaRef.current.focus();
                    }}
                    className="flex items-start gap-2.5 rounded-xl border border-[#E4DCD3] bg-[#FFFDF9] p-3.5 text-xs text-[#292321] shadow-2xs hover:border-[#B9825A] hover:bg-[#F7F3ED] transition-all text-left group cursor-pointer font-serif"
                  >
                    <Sparkles className="h-3.5 w-3.5 text-[#B9825A] shrink-0 mt-0.5 group-hover:scale-110 transition-transform" />
                    <span>{prompt}</span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Rendered Messages */}
          {entry.messages.map((msg) => {
            const isUser = msg.role === 'user';
            return (
              <div
                key={msg.id}
                className={`flex gap-3.5 ${isUser ? 'flex-row-reverse' : 'flex-row'}`}
              >
                {/* Avatar */}
                <div
                  className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-xs font-semibold ${
                    isUser
                      ? 'bg-[#3B2F2A] text-[#FFFDF9] shadow-xs'
                      : 'bg-[#F7F3ED] text-[#3B2F2A] border border-[#E4DCD3]'
                  }`}
                >
                  {isUser ? <User className="h-4 w-4" /> : <Feather className="h-4 w-4 text-[#B9825A]" />}
                </div>

                {/* Message Bubble */}
                <div
                  className={`group relative max-w-[85%] rounded-2xl p-4 text-xs leading-relaxed shadow-2xs ${
                    isUser
                      ? 'bg-[#3B2F2A] text-[#FFFDF9] rounded-tr-none'
                      : 'bg-[#FFFDF9] text-[#292321] border border-[#E4DCD3] rounded-tl-none'
                  }`}
                >
                  {/* Header / Timestamp */}
                  <div className="mb-1.5 flex items-center justify-between gap-4">
                    <span
                      className={`text-[10px] font-semibold tracking-wide uppercase font-serif ${
                        isUser ? 'text-[#E8D5C0]' : 'text-[#7A6255]'
                      }`}
                    >
                      {isUser ? 'Your Journal Thought' : 'Gemini Reflection'}
                    </span>
                    <span
                      className={`text-[10px] ${
                        isUser ? 'text-[#E8D5C0]/80' : 'text-[#8C817A]'
                      }`}
                    >
                      {new Date(msg.timestamp).toLocaleTimeString([], {
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </span>
                  </div>

                  {/* Body Content with Markdown */}
                  {isUser ? (
                    <div className="whitespace-pre-wrap font-normal text-[#FFFDF9] font-sans">{msg.content}</div>
                  ) : (
                    <div className="prose prose-xs max-w-none text-[#292321] space-y-2 font-serif text-[13px] leading-relaxed prose-headings:font-serif prose-headings:font-semibold prose-headings:text-[#292321] prose-p:leading-relaxed prose-strong:text-[#292321] prose-ul:my-1.5 prose-li:my-0.5">
                      <Markdown>{msg.content}</Markdown>
                    </div>
                  )}

                  {/* Copy Message Button */}
                  <button
                    onClick={() => handleCopyMessage(msg.id, msg.content)}
                    title="Copy message"
                    className={`absolute bottom-2 right-2 opacity-0 group-hover:opacity-100 rounded-md p-1 transition-opacity cursor-pointer ${
                      isUser
                        ? 'bg-[#292321] text-[#E8D5C0] hover:text-[#FFFDF9]'
                        : 'bg-[#F7F3ED] text-[#7A6255] hover:text-[#292321]'
                    }`}
                  >
                    {copiedId === msg.id ? (
                      <Check className="h-3 w-3 text-emerald-600" />
                    ) : (
                      <Copy className="h-3 w-3" />
                    )}
                  </button>
                </div>
              </div>
            );
          })}

          {/* Generating or Sealing Indicator */}
          {isGenerating && (
            <div className="flex gap-3.5 flex-row">
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[#F7F3ED] text-[#3B2F2A] border border-[#E4DCD3]">
                <Feather className="h-4 w-4 text-[#B9825A] animate-pulse" />
              </div>
              <div className="rounded-2xl rounded-tl-none border border-[#E4DCD3] bg-[#FFFDF9] p-4 text-xs shadow-2xs">
                <div className="flex items-center gap-2 text-[#7A6255]">
                  <RefreshCw className="h-3.5 w-3.5 animate-spin text-[#B9825A]" />
                  <span className="font-serif italic font-medium">Reflecting on your entry with Gemini 3.6 Flash...</span>
                </div>
              </div>
            </div>
          )}

          {isSealing && (
            <div className="flex gap-3.5 flex-row">
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[#3B2F2A] text-[#FFFDF9] shadow-xs">
                <Lock className="h-4 w-4 text-[#E8D5C0] animate-pulse" />
              </div>
              <div className="rounded-2xl rounded-tl-none border border-[#E8D5C0] bg-[#FFFDF9] p-4 text-xs shadow-2xs">
                <div className="flex items-center gap-2 text-[#3B2F2A]">
                  <RefreshCw className="h-3.5 w-3.5 animate-spin text-[#B9825A]" />
                  <span className="font-serif italic font-medium">Sealing session: Extracting philosophical stances and classifying topic evolution...</span>
                </div>
              </div>
            </div>
          )}

          {/* Sealed Session Ledger & Claims Section */}
          {entry.isSealed && entry.claims && entry.claims.length > 0 && (
            <div className="mt-8 space-y-6 pt-4 border-t border-[#E4DCD3]">
              {/* Epistemological Ledger Banner */}
              <div className="rounded-2xl border border-[#E4DCD3] bg-[#FFFDF9] p-5 shadow-2xs">
                <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#E4DCD3]/60 pb-3.5">
                  <div className="flex items-center gap-2.5">
                    <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#3B2F2A] text-[#E8D5C0]">
                      <ShieldCheck className="h-4 w-4" />
                    </div>
                    <div>
                      <h3 className="font-serif text-sm font-bold text-[#292321]">
                        Extracted Stances & Convictions ({entry.claims.length})
                      </h3>
                      <p className="text-[11px] text-[#7A6255] font-serif">
                        First-person commitments and stances recorded upon session seal
                      </p>
                    </div>
                  </div>

                  {entry.sealedAt && (
                    <span className="text-[10px] font-medium text-[#8C817A] font-serif italic">
                      Sealed on {new Date(entry.sealedAt).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' })}
                    </span>
                  )}
                </div>

                {/* Grid of Claims */}
                <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
                  {entry.claims.map((claim) => {
                    const convictionPct = Math.round(claim.conviction * 100);
                    return (
                      <div
                        key={claim.id}
                        className="flex flex-col justify-between rounded-xl border border-[#E4DCD3] bg-[#F7F3ED]/70 p-3.5 transition-all hover:bg-[#F7F3ED] hover:border-[#B9825A]/60"
                      >
                        <div>
                          <div className="flex items-center justify-between gap-2 mb-2">
                            <span className="inline-flex items-center rounded-md bg-[#FFFDF9] border border-[#E4DCD3] px-2 py-0.5 text-[10px] font-semibold text-[#7A6255]">
                              #{claim.topicSlug}
                            </span>
                            <span className="text-[10px] font-bold text-[#7A6255]">
                              {convictionPct}% Conviction
                            </span>
                          </div>
                          <p className="font-serif text-xs font-medium text-[#292321] leading-relaxed">
                            "{claim.statement}"
                          </p>
                        </div>

                        {/* Conviction Bar */}
                        <div className="mt-3">
                          <div className="h-1.5 w-full overflow-hidden rounded-full bg-[#E4DCD3]">
                            <div
                              className="h-full rounded-full bg-[#B9825A] transition-all"
                              style={{ width: `${Math.max(8, convictionPct)}%` }}
                            />
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Evolution Gaps (Reverses / Abandons / Refines) */}
              {entry.claimGaps && entry.claimGaps.length > 0 && (
                <div className="rounded-2xl border border-[#E8D5C0] bg-[#FFFDF9] p-5 shadow-2xs">
                  <div className="flex items-center gap-2.5 mb-3.5">
                    <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#3B2F2A] text-[#E8D5C0]">
                      <GitBranch className="h-4 w-4" />
                    </div>
                    <div>
                      <h3 className="font-serif text-sm font-bold text-[#292321]">
                        Perspective Shifts & Historical Evolution ({entry.claimGaps.length})
                      </h3>
                      <p className="text-[11px] text-[#7A6255] font-serif">
                        Classified shifts comparing this session against historical stances on shared topics
                      </p>
                    </div>
                  </div>

                  <div className="space-y-3.5">
                    {entry.claimGaps.map((gap) => {
                      const badge = getClassificationBadge(gap.classification);
                      return (
                        <div
                          key={gap.id}
                          className="rounded-xl border border-[#E4DCD3] bg-[#F7F3ED] p-4 text-xs shadow-2xs space-y-3"
                        >
                          <div className="flex items-center justify-between gap-2 flex-wrap">
                            <span className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider ${badge.bg}`}>
                              <span className={`h-1.5 w-1.5 rounded-full ${badge.dot}`} />
                              {badge.label}
                            </span>
                            <span className="text-[10px] font-semibold text-[#7A6255]">
                              Topic: #{gap.topicSlug}
                            </span>
                          </div>

                          {/* Comparison Grid */}
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-[11px]">
                            <div className="rounded-lg bg-[#FFFDF9] p-2.5 border border-[#E4DCD3]">
                              <span className="text-[10px] font-semibold text-[#8C817A] uppercase tracking-wide block mb-1 font-serif">
                                Prior Stance
                              </span>
                              <p className="text-[#7A6255] italic font-serif">"{gap.previousClaim}"</p>
                            </div>

                            <div className="rounded-lg bg-[#FFFDF9] p-2.5 border border-[#E4DCD3]">
                              <span className="text-[10px] font-semibold text-[#B9825A] uppercase tracking-wide block mb-1 font-serif">
                                New Sealed Stance
                              </span>
                              <p className="text-[#292321] font-medium font-serif">"{gap.newClaim}"</p>
                            </div>
                          </div>

                          {/* Reflective Inquiry Question */}
                          <div className="rounded-lg bg-[#FFFDF9] border border-[#E8D5C0] p-3">
                            <div className="flex items-start gap-2">
                              <HelpCircle className="h-4 w-4 text-[#B9825A] shrink-0 mt-0.5" />
                              <div className="flex-1">
                                <span className="text-[10px] font-bold text-[#7A6255] uppercase tracking-wide font-serif">
                                  Reflective Inquiry
                                </span>
                                <p className="text-[#292321] text-xs font-serif italic mt-0.5 leading-relaxed">
                                  {gap.question}
                                </p>
                                <button
                                  onClick={() => {
                                    setInputText(gap.question);
                                    if (textareaRef.current) textareaRef.current.focus();
                                  }}
                                  className="mt-2 inline-flex items-center gap-1 text-[11px] font-semibold text-[#B9825A] hover:text-[#3B2F2A] hover:underline cursor-pointer"
                                >
                                  <span>Explore this question in reflection</span>
                                  <ArrowRight className="h-3 w-3" />
                                </button>
                              </div>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>
      </div>

      {/* Input Box Footer */}
      <div className="border-t border-[#E4DCD3] bg-[#FFFDF9] p-4">
        <div className="mx-auto max-w-3xl">
          {/* Quick prompt suggestions when ongoing conversation */}
          {entry.messages.length > 0 && (
            <div className="mb-2 flex items-center gap-1.5 overflow-x-auto pb-1">
              <span className="text-[10px] text-[#8C817A] shrink-0 font-medium font-serif italic">Sparks:</span>
              {suggestions.slice(0, 2).map((sug, i) => (
                <button
                  key={i}
                  onClick={() => {
                    setInputText(sug);
                    if (textareaRef.current) textareaRef.current.focus();
                  }}
                  className="rounded-md border border-[#E4DCD3] bg-[#F7F3ED] px-2 py-0.5 text-[10px] text-[#7A6255] hover:bg-[#E8D5C0]/40 hover:text-[#292321] whitespace-nowrap transition-colors cursor-pointer font-serif"
                >
                  {sug.slice(0, 45)}...
                </button>
              ))}
            </div>
          )}

          {/* Textarea Form */}
          <div className="relative flex items-end rounded-xl border border-[#E4DCD3] bg-[#F7F3ED] p-2 shadow-2xs focus-within:border-[#3B2F2A] focus-within:bg-[#FFFDF9] transition-all">
            <textarea
              ref={textareaRef}
              id="textarea-journal-input"
              rows={1}
              value={inputText}
              onChange={handleInputChange}
              onKeyDown={handleKeyDown}
              placeholder={`Record your thoughts in ${activeModeObj.label}... (Press Enter to reflect)`}
              disabled={isGenerating || isSealing}
              className="w-full resize-none bg-transparent px-2 py-1 text-xs text-[#292321] placeholder:text-[#8C817A] focus:outline-hidden disabled:opacity-50 font-serif"
            />

            <button
              onClick={handleSend}
              id="btn-send-message"
              disabled={!inputText.trim() || isGenerating || isSealing}
              title="Send to Gemini"
              className="ml-2 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-[#3B2F2A] text-[#FFFDF9] shadow-xs hover:bg-[#292321] disabled:opacity-40 transition-all cursor-pointer"
            >
              <Send className="h-3.5 w-3.5 text-[#E8D5C0]" />
            </button>
          </div>

          <div className="mt-1.5 flex items-center justify-between text-[10px] text-[#8C817A] px-1 font-serif">
            <span>Press <kbd className="font-mono bg-[#E4DCD3]/60 px-1 py-0.5 rounded text-[#292321]">Enter</kbd> to reflect &middot; <kbd className="font-mono bg-[#E4DCD3]/60 px-1 py-0.5 rounded text-[#292321]">Shift + Enter</kbd> for newline</span>
            <span>Private &middot; Isolated Cloud Firestore</span>
          </div>
        </div>
      </div>
    </div>
  );
};
