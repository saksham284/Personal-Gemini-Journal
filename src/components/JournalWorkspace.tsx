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
  ChevronDown,
  Download,
  AlertCircle,
} from 'lucide-react';
import type { JournalEntry, ChatMessage, ReflectionMode } from '../types';

interface JournalWorkspaceProps {
  entry: JournalEntry;
  onUpdateEntry: (updated: JournalEntry) => Promise<void>;
  onSummarizeEntry: (entry: JournalEntry) => Promise<void>;
  isGenerating: boolean;
  isSummarizing: boolean;
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
    desc: 'Empathetic exploration and gentle inquiry',
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
    icon: Sparkles,
  },
];

const PROMPT_SUGGESTIONS: Record<ReflectionMode, string[]> = {
  deep_reflection: [
    "I'm feeling conflicted about a major decision. Can you help me unpack the underlying values?",
    "What's causing me subtle stress lately and how can I process it?",
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

export const JournalWorkspace: React.FC<JournalWorkspaceProps> = ({
  entry,
  onUpdateEntry,
  onSummarizeEntry,
  isGenerating,
  isSummarizing,
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
  }, [entry.messages, isGenerating]);

  // Adjust textarea height dynamically
  const handleInputChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setInputText(e.target.value);
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 180)}px`;
    }
  };

  const handleSend = async () => {
    if (!inputText.trim() || isGenerating) return;
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
    <div className="flex flex-1 flex-col bg-neutral-50 overflow-hidden" style={{ height: 'calc(100vh - 53px)' }}>
      {/* Session Header */}
      <div className="border-b border-neutral-200 bg-white px-6 py-3.5 shadow-2xs">
        <div className="flex flex-wrap items-center justify-between gap-3">
          {/* Editable Title */}
          <div className="flex items-center gap-2 flex-1 min-w-[240px]">
            {isEditingTitle ? (
              <input
                type="text"
                value={titleDraft}
                onChange={(e) => setTitleDraft(e.target.value)}
                onBlur={handleSaveTitle}
                onKeyDown={(e) => e.key === 'Enter' && handleSaveTitle()}
                autoFocus
                className="w-full rounded-md border border-neutral-300 px-2.5 py-1 text-sm font-semibold text-neutral-900 focus:border-neutral-900 focus:outline-hidden"
              />
            ) : (
              <h2
                onClick={() => setIsEditingTitle(true)}
                title="Click to rename entry"
                className="cursor-pointer text-base font-semibold text-neutral-900 hover:text-neutral-600 transition-colors line-clamp-1"
              >
                {entry.title || 'Untitled Reflection'}
              </h2>
            )}

            <span className="text-[11px] text-neutral-400 shrink-0">
              {new Date(entry.createdAt).toLocaleDateString([], { month: 'short', day: 'numeric' })}
            </span>
          </div>

          {/* Quick Toolbar Actions */}
          <div className="flex items-center gap-2">
            {/* Auto Summarize & Tag Button */}
            {entry.messages.length >= 2 && (
              <button
                onClick={() => onSummarizeEntry(entry)}
                disabled={isSummarizing || isGenerating}
                id="btn-auto-summarize"
                title="Synthesize conversation, title, and tags with Gemini"
                className="flex items-center gap-1.5 rounded-lg border border-neutral-200 bg-neutral-50 px-2.5 py-1.5 text-xs font-medium text-neutral-700 hover:bg-neutral-100 hover:text-neutral-900 transition-colors disabled:opacity-50"
              >
                <Sparkles className={`h-3.5 w-3.5 text-amber-500 ${isSummarizing ? 'animate-spin' : ''}`} />
                <span>{isSummarizing ? 'Synthesizing...' : 'Summarize & Tag'}</span>
              </button>
            )}

            {/* Export Markdown */}
            <button
              onClick={handleExportMarkdown}
              id="btn-export-markdown"
              title="Download Markdown file"
              className="flex items-center gap-1 rounded-lg border border-neutral-200 bg-white p-1.5 text-xs text-neutral-600 hover:bg-neutral-100 transition-colors"
            >
              <Download className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>

        {/* Mode Selector Chips */}
        <div className="mt-3 flex items-center gap-1.5 overflow-x-auto pb-0.5">
          <span className="text-[11px] font-medium text-neutral-400 mr-1 shrink-0">Mode:</span>
          {REFLECTION_MODES.map((m) => {
            const isSelected = entry.mode === m.id;
            const Icon = m.icon;
            return (
              <button
                key={m.id}
                onClick={() => handleModeChange(m.id)}
                className={`flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium whitespace-nowrap transition-all ${
                  isSelected
                    ? 'bg-neutral-900 text-white shadow-xs'
                    : 'bg-neutral-100 text-neutral-600 hover:bg-neutral-200 hover:text-neutral-900'
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
          <div className="mt-3 rounded-lg bg-neutral-50 p-2.5 border border-neutral-200/70 text-xs">
            <div className="flex items-start gap-2">
              <Sparkles className="h-3.5 w-3.5 text-amber-500 mt-0.5 shrink-0" />
              <div className="flex-1">
                <p className="text-neutral-700 leading-relaxed font-normal">{entry.summary}</p>
                {entry.tags && entry.tags.length > 0 && (
                  <div className="mt-1.5 flex flex-wrap gap-1">
                    {entry.tags.map((t) => (
                      <span
                        key={t}
                        className="inline-flex items-center gap-0.5 rounded-md bg-white border border-neutral-200 px-1.5 py-0.5 text-[10px] text-neutral-600"
                      >
                        <TagIcon className="h-2.5 w-2.5 text-neutral-400" />
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
        <div className="flex items-center justify-between border-b border-rose-200 bg-rose-50 px-6 py-2 text-xs text-rose-700">
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

      {/* Chat Messages Stream */}
      <div className="flex-1 overflow-y-auto px-4 py-6 sm:px-8">
        <div className="mx-auto max-w-3xl space-y-6">
          {/* Welcome Prompt If Conversation is Empty */}
          {entry.messages.length === 0 && (
            <div className="rounded-2xl border border-dashed border-neutral-300 bg-white/60 p-8 text-center">
              <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-xl bg-neutral-100 text-neutral-800 mb-4">
                <Compass className="h-6 w-6 text-amber-500" />
              </div>
              <h3 className="text-base font-semibold text-neutral-900">
                Begin your reflection in {activeModeObj.label}
              </h3>
              <p className="mx-auto mt-1 max-w-md text-xs text-neutral-500 leading-relaxed">
                {activeModeObj.desc}. Write whatever is on your mind, or pick one of the reflection starters below:
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
                    className="flex items-start gap-2.5 rounded-xl border border-neutral-200 bg-white p-3 text-xs text-neutral-700 shadow-2xs hover:border-neutral-400 hover:bg-neutral-50 transition-all text-left group cursor-pointer"
                  >
                    <Sparkles className="h-3.5 w-3.5 text-amber-500 shrink-0 mt-0.5 group-hover:scale-110 transition-transform" />
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
                      ? 'bg-neutral-900 text-white shadow-xs'
                      : 'bg-neutral-100 text-neutral-800 border border-neutral-200'
                  }`}
                >
                  {isUser ? <User className="h-4 w-4" /> : <Bot className="h-4 w-4 text-amber-600" />}
                </div>

                {/* Message Bubble */}
                <div
                  className={`group relative max-w-[85%] rounded-2xl p-4 text-xs leading-relaxed shadow-2xs ${
                    isUser
                      ? 'bg-neutral-900 text-white rounded-tr-none'
                      : 'bg-white text-neutral-800 border border-neutral-200/90 rounded-tl-none'
                  }`}
                >
                  {/* Header / Timestamp */}
                  <div className="mb-1.5 flex items-center justify-between gap-4">
                    <span
                      className={`text-[10px] font-semibold tracking-wide uppercase ${
                        isUser ? 'text-neutral-300' : 'text-neutral-500'
                      }`}
                    >
                      {isUser ? 'Your Journal Thought' : 'Gemini Reflection'}
                    </span>
                    <span
                      className={`text-[10px] ${
                        isUser ? 'text-neutral-400' : 'text-neutral-400'
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
                    <div className="whitespace-pre-wrap font-normal text-white">{msg.content}</div>
                  ) : (
                    <div className="prose prose-xs max-w-none text-neutral-800 space-y-2 prose-headings:font-semibold prose-headings:text-neutral-900 prose-p:leading-relaxed prose-strong:text-neutral-900 prose-ul:my-1.5 prose-li:my-0.5">
                      <Markdown>{msg.content}</Markdown>
                    </div>
                  )}

                  {/* Copy Message Button */}
                  <button
                    onClick={() => handleCopyMessage(msg.id, msg.content)}
                    title="Copy message"
                    className={`absolute bottom-2 right-2 opacity-0 group-hover:opacity-100 rounded-md p-1 transition-opacity ${
                      isUser
                        ? 'bg-neutral-800 text-neutral-300 hover:text-white'
                        : 'bg-neutral-100 text-neutral-500 hover:text-neutral-900'
                    }`}
                  >
                    {copiedId === msg.id ? (
                      <Check className="h-3 w-3 text-emerald-500" />
                    ) : (
                      <Copy className="h-3 w-3" />
                    )}
                  </button>
                </div>
              </div>
            );
          })}

          {/* Generating Indicator */}
          {isGenerating && (
            <div className="flex gap-3.5 flex-row">
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-neutral-100 text-neutral-800 border border-neutral-200">
                <Bot className="h-4 w-4 text-amber-600 animate-spin" />
              </div>
              <div className="rounded-2xl rounded-tl-none border border-neutral-200 bg-white p-4 text-xs shadow-2xs">
                <div className="flex items-center gap-2 text-neutral-500">
                  <RefreshCw className="h-3.5 w-3.5 animate-spin text-amber-500" />
                  <span className="font-medium">Reflecting on your entry with Gemini 3.6 Flash...</span>
                </div>
              </div>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>
      </div>

      {/* Input Box Footer */}
      <div className="border-t border-neutral-200 bg-white p-4">
        <div className="mx-auto max-w-3xl">
          {/* Quick prompt suggestions when ongoing conversation */}
          {entry.messages.length > 0 && (
            <div className="mb-2 flex items-center gap-1.5 overflow-x-auto pb-1">
              <span className="text-[10px] text-neutral-400 shrink-0 font-medium">Sparks:</span>
              {suggestions.slice(0, 2).map((sug, i) => (
                <button
                  key={i}
                  onClick={() => {
                    setInputText(sug);
                    if (textareaRef.current) textareaRef.current.focus();
                  }}
                  className="rounded-md border border-neutral-200 bg-neutral-50 px-2 py-0.5 text-[10px] text-neutral-600 hover:bg-neutral-100 hover:text-neutral-900 whitespace-nowrap transition-colors"
                >
                  {sug.slice(0, 45)}...
                </button>
              ))}
            </div>
          )}

          {/* Textarea Form */}
          <div className="relative flex items-end rounded-xl border border-neutral-300 bg-neutral-50/50 p-2 shadow-2xs focus-within:border-neutral-900 focus-within:bg-white transition-colors">
            <textarea
              ref={textareaRef}
              id="textarea-journal-input"
              rows={1}
              value={inputText}
              onChange={handleInputChange}
              onKeyDown={handleKeyDown}
              placeholder={`Write your thought or reflection in ${activeModeObj.label}... (Press Enter to send)`}
              disabled={isGenerating}
              className="w-full resize-none bg-transparent px-2 py-1 text-xs text-neutral-900 placeholder:text-neutral-400 focus:outline-hidden disabled:opacity-50"
            />

            <button
              onClick={handleSend}
              id="btn-send-message"
              disabled={!inputText.trim() || isGenerating}
              title="Send to Gemini"
              className="ml-2 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-neutral-900 text-white shadow-xs hover:bg-neutral-800 disabled:opacity-40 transition-all cursor-pointer"
            >
              <Send className="h-3.5 w-3.5" />
            </button>
          </div>

          <div className="mt-1.5 flex items-center justify-between text-[10px] text-neutral-400 px-1">
            <span>Press <kbd className="font-mono bg-neutral-100 px-1 py-0.5 rounded text-neutral-600">Enter</kbd> to reflect &middot; <kbd className="font-mono bg-neutral-100 px-1 py-0.5 rounded text-neutral-600">Shift + Enter</kbd> for newline</span>
            <span>Isolated to your account &middot; Firestore Encrypted</span>
          </div>
        </div>
      </div>
    </div>
  );
};
