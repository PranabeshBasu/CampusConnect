import { Search, X } from 'lucide-react';

export default function FilterToolbar({
  search = '',
  onSearchChange,
  searchPlaceholder = 'Search…',
  children,
  onReset,
  hasActiveFilters = false,
}) {
  return (
    <div className="flex flex-wrap items-center gap-3 rounded-xl border border-line bg-surf p-3">
      {onSearchChange && (
        <div className="relative min-w-[220px] flex-1">
          <Search
            size={16}
            className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-mute"
            aria-hidden="true"
          />
          <input
            type="search"
            value={search}
            onChange={(e) => onSearchChange(e.target.value)}
            placeholder={searchPlaceholder}
            aria-label={searchPlaceholder}
            className="w-full rounded-lg border border-line bg-bg py-2 pl-9 pr-8 text-sm text-ink placeholder:text-mute focus:border-pri focus:outline-none"
          />
          {search && (
            <button
              type="button"
              onClick={() => onSearchChange('')}
              aria-label="Clear search"
              className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-0.5 text-mute hover:text-ink"
            >
              <X size={14} />
            </button>
          )}
        </div>
      )}
      {children}
      {hasActiveFilters && onReset && (
        <button type="button" onClick={onReset} className="btn-ghost text-xs">
          Reset filters
        </button>
      )}
    </div>
  );
}
