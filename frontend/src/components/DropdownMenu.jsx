import { useEffect, useRef, useState } from 'react';
import { MoreHorizontal } from 'lucide-react';

export default function DropdownMenu({
  label = 'More actions',
  items = [],
  align = 'right',
  buttonClassName = 'btn-ghost p-1.5',
}) {
  const [open, setOpen] = useState(false);
  const containerRef = useRef(null);

  const visibleItems = items.filter((item) => item && !item.hidden);

  useEffect(() => {
    if (!open) return;

    function handlePointerDown(e) {
      if (containerRef.current && !containerRef.current.contains(e.target)) {
        setOpen(false);
      }
    }

    function handleKeyDown(e) {
      if (e.key === 'Escape') {
        setOpen(false);
      }
    }

    document.addEventListener('mousedown', handlePointerDown);
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('mousedown', handlePointerDown);
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [open]);

  if (visibleItems.length === 0) return null;

  return (
    <div ref={containerRef} className="relative inline-block text-left">
      <button
        type="button"
        className={buttonClassName}
        aria-label={label}
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen((prev) => !prev)}
      >
        <MoreHorizontal size={16} aria-hidden="true" />
      </button>

      {open && (
        <div
          role="menu"
          aria-label={label}
          className={`absolute ${align === 'left' ? 'left-0' : 'right-0'} z-20 mt-1 w-40 rounded-xl border border-line bg-surf p-1 shadow-xl`}
        >
          {visibleItems.map((item) => {
            const toneClass =
              item.tone === 'bad'
                ? 'text-bad hover:bg-badt'
                : 'text-ink hover:bg-bg';
            return (
              <button
                key={item.label}
                type="button"
                role="menuitem"
                disabled={item.disabled}
                className={`flex w-full items-center gap-2 rounded-lg px-3 py-1.5 text-left text-xs font-medium transition disabled:cursor-not-allowed disabled:opacity-50 ${toneClass}`}
                onClick={() => {
                  setOpen(false);
                  item.onClick?.();
                }}
              >
                {item.icon}
                <span>{item.label}</span>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}