import { createContext, useCallback, useContext, useMemo, useState } from 'react';
import { AlertCircle, CheckCircle2, Info, X } from 'lucide-react';

const ToastContext = createContext(null);

const TONE = {
  success: {
    wrap: 'border-ok bg-surf text-ink',
    icon: <CheckCircle2 size={18} className="shrink-0 text-ok" aria-hidden="true" />,
  },
  error: {
    wrap: 'border-bad bg-surf text-ink',
    icon: <AlertCircle size={18} className="shrink-0 text-bad" aria-hidden="true" />,
  },
  info: {
    wrap: 'border-pri bg-surf text-ink',
    icon: <Info size={18} className="shrink-0 text-pri" aria-hidden="true" />,
  },
};

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);

  const dismiss = useCallback((id) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const push = useCallback((type, message, duration = 4000) => {
    if (!message) return;
    const id = `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    setToasts((prev) => [...prev.slice(-3), { id, type, message }]);
    if (duration > 0) {
      window.setTimeout(() => dismiss(id), duration);
    }
  }, [dismiss]);

  const api = useMemo(() => ({
    success: (msg, ms) => push('success', msg, ms),
    error: (msg, ms) => push('error', msg, ms),
    info: (msg, ms) => push('info', msg, ms),
  }), [push]);

  return (
    <ToastContext.Provider value={api}>
      {children}
      <div
        aria-live="polite"
        aria-atomic="true"
        className="pointer-events-none fixed bottom-4 right-4 z-50 flex w-full max-w-sm flex-col gap-2 px-4 sm:px-0"
      >
        {toasts.map((t) => {
          const style = TONE[t.type] || TONE.info;
          return (
            <div
              key={t.id}
              role="status"
              className={`pointer-events-auto flex items-start gap-3 rounded-xl border p-3.5 shadow-xl ${style.wrap}`}
            >
              {style.icon}
              <p className="flex-1 text-sm font-medium">{t.message}</p>
              <button
                type="button"
                onClick={() => dismiss(t.id)}
                aria-label="Dismiss notification"
                className="rounded p-0.5 text-mute hover:text-ink"
              >
                <X size={15} />
              </button>
            </div>
          );
        })}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) {
    return {
      success: () => {},
      error: () => {},
      info: () => {},
    };
  }
  return ctx;
}