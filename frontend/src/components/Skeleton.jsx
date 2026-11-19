export function CardSkeleton({ count = 2 }) {
  return (
    <div className="grid gap-4 md:grid-cols-2" role="status" aria-label="Loading">
      {Array.from({ length: count }).map((_, idx) => (
        <div key={idx} className="card animate-pulse space-y-3">
          <div className="flex items-center justify-between gap-4">
            <div className="h-5 w-1/2 rounded bg-line" />
            <div className="h-5 w-16 rounded-full bg-line" />
          </div>
          <div className="h-3.5 w-2/3 rounded bg-line" />
          <div className="h-10 w-full rounded bg-line" />
          <div className="flex gap-2">
            <div className="h-6 w-20 rounded-full bg-line" />
            <div className="h-6 w-24 rounded-full bg-line" />
          </div>
        </div>
      ))}
    </div>
  );
}

export function TableSkeleton({ rows = 4, cols = 5 }) {
  return (
    <div className="card animate-pulse space-y-3 overflow-hidden" role="status" aria-label="Loading">
      <div className="grid gap-4" style={{ gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))` }}>
        {Array.from({ length: cols }).map((_, idx) => (
          <div key={idx} className="h-4 rounded bg-line" />
        ))}
      </div>
      {Array.from({ length: rows }).map((_, rIdx) => (
        <div
          key={rIdx}
          className="grid gap-4 border-t border-line pt-3"
          style={{ gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))` }}
        >
          {Array.from({ length: cols }).map((_, cIdx) => (
            <div key={cIdx} className="h-4 rounded bg-line" />
          ))}
        </div>
      ))}
    </div>
  );
}
