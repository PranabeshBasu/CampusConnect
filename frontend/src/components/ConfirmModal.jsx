import { useEffect, useRef } from 'react';
import { AlertTriangle, X } from 'lucide-react';

export default function ConfirmModal({
  open,
  title,
  description,
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  tone = 'bad',
  busy = false,
  onConfirm,
  onCancel,
}) {
  const cancelRef = useRef(null);

  useEffect(() => {
    if (!open) return;
    cancelRef.current?.focus();
    const onKeyDown = (e) => {
      if (e.key === 'Escape' && !busy) {
        onCancel?.();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [open, busy, onCancel]);

  if (!open) return null;

  const confirmClass =
    tone === 'bad'
      ? 'inline-flex items-center justify-center gap-2 rounded-lg bg-bad px-4 py-2 text-sm font-bold text-white hover:opacity-90 disabled:opacity-50'
      : 'btn text-sm';

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-labelledby="confirm-modal-title"
      onClick={(e) => {
        if (e.target === e.currentTarget && !busy) onCancel?.();
      }}
    >
      <div className="w-full max-w-md rounded-2xl border border-line bg-surf p-6 shadow-2xl">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-3">
            <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full ${tone === 'bad' ? 'bg-badt text-bad' : 'bg-prit text-pri'}`}>
              <AlertTriangle size={20} aria-hidden="true" />
            </span>
            <h2 id="confirm-modal-title" className="text-lg font-bold text-ink">
              {title}
            </h2>
          </div>
          <button
            type="button"
            onClick={onCancel}
            disabled={busy}
            aria-label="Close dialog"
            className="rounded-lg p-1 text-mute hover:bg-line hover:text-ink"
          >
            <X size={18} />
          </button>
        </div>

        {description && <p className="mt-3 text-sm leading-relaxed text-mute">{description}</p>}

        <div className="mt-6 flex justify-end gap-2">
          <button
            ref={cancelRef}
            type="button"
            className="btn-ghost"
            onClick={onCancel}
            disabled={busy}
          >
            {cancelLabel}
          </button>
          <button
            type="button"
            className={confirmClass}
            onClick={onConfirm}
            disabled={busy}
          >
            {busy ? 'Please wait…' : confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
