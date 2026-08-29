import React, { useEffect, useRef } from 'react';
import { AlertTriangle, Trash2, X } from 'lucide-react';
import type { JournalEntry } from '../types';

interface DeleteModalProps {
  entry: JournalEntry | null;
  onConfirm: () => void;
  onCancel: () => void;
  isDeleting: boolean;
}

export const DeleteModal: React.FC<DeleteModalProps> = ({
  entry,
  onConfirm,
  onCancel,
  isDeleting,
}) => {
  const modalRef = useRef<HTMLDivElement>(null);
  const cancelButtonRef = useRef<HTMLButtonElement>(null);

  // Close on Escape key press
  useEffect(() => {
    if (!entry) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !isDeleting) {
        onCancel();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    // Focus the cancel button on mount for safe keyboard navigation
    cancelButtonRef.current?.focus();

    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [entry, isDeleting, onCancel]);

  if (!entry) return null;

  return (
    <div
      role="alertdialog"
      aria-modal="true"
      aria-labelledby="delete-modal-title"
      aria-describedby="delete-modal-description"
      className="fixed inset-0 z-50 flex items-center justify-center bg-[#3B2F2A]/50 p-4 backdrop-blur-xs"
    >
      <div
        ref={modalRef}
        className="w-full max-w-sm rounded-2xl border border-[#E4DCD3] bg-[#FFFDF9] p-6 shadow-xl animate-in fade-in zoom-in-95 duration-150 focus:outline-hidden"
      >
        <div className="flex items-center justify-between">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-rose-50 text-rose-700 border border-rose-200">
            <AlertTriangle className="h-5 w-5" />
          </div>
          <button
            onClick={onCancel}
            disabled={isDeleting}
            aria-label="Close delete dialog"
            className="rounded-md p-1 text-[#8C817A] hover:bg-[#F7F3ED] hover:text-[#292321] focus-visible:ring-2 focus-visible:ring-[#3B2F2A] focus:outline-hidden cursor-pointer"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <h3 id="delete-modal-title" className="mt-4 font-serif text-base font-semibold text-[#292321]">
          Delete this reflection?
        </h3>
        <p id="delete-modal-description" className="mt-1.5 font-serif text-xs text-[#7A6255] leading-relaxed">
          Are you sure you want to delete <span className="font-semibold text-[#292321]">&ldquo;{entry.title}&rdquo;</span>? This will permanently remove all {entry.messages.length} conversation messages from your Firestore database.
        </p>

        <div className="mt-6 flex items-center justify-end gap-2.5">
          <button
            ref={cancelButtonRef}
            type="button"
            onClick={onCancel}
            disabled={isDeleting}
            className="rounded-lg border border-[#E4DCD3] bg-[#F7F3ED] px-3.5 py-2 text-xs font-medium text-[#7A6255] hover:bg-[#E8D5C0]/40 focus-visible:ring-2 focus-visible:ring-[#3B2F2A] focus:outline-hidden transition-colors cursor-pointer"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={onConfirm}
            id="btn-confirm-delete"
            disabled={isDeleting}
            className="flex items-center gap-1.5 rounded-lg bg-rose-700 px-3.5 py-2 text-xs font-medium text-white shadow-xs hover:bg-rose-800 focus-visible:ring-2 focus-visible:ring-rose-800 focus:outline-hidden transition-colors disabled:opacity-50 cursor-pointer"
          >
            <Trash2 className="h-3.5 w-3.5" />
            <span>{isDeleting ? 'Deleting...' : 'Delete Permanently'}</span>
          </button>
        </div>
      </div>
    </div>
  );
};
