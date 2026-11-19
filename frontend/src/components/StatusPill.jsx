const TONE = {
  OPEN: { wrap: 'bg-okt text-ok border-ok', dot: 'bg-ok' },
  SELECTED: { wrap: 'bg-okt text-ok border-ok', dot: 'bg-ok' },
  SHORTLISTED: { wrap: 'bg-warnt text-warn border-warn', dot: 'bg-warn' },
  APPLIED: { wrap: 'bg-prit text-pri border-pri', dot: 'bg-pri' },
  CLOSED: { wrap: 'bg-prit text-pri border-pri', dot: 'bg-pri' },
  REJECTED: { wrap: 'bg-badt text-bad border-bad', dot: 'bg-bad' },
  CANCELLED: { wrap: 'bg-badt text-bad border-bad', dot: 'bg-bad' },
  WITHDRAWN: { wrap: 'bg-badt text-bad border-bad', dot: 'bg-bad' },
  DRAFT: { wrap: 'bg-line text-mute border-line', dot: 'bg-mute' },
};

const FALLBACK = { wrap: 'bg-prit text-pri border-pri', dot: 'bg-pri' };

/** Unified status pill for drives and applications. */
export default function StatusPill({ status }) {
  const tone = TONE[status] || FALLBACK;
  return (
    <span
      className={`inline-flex items-center gap-1.5 whitespace-nowrap rounded-full border px-2.5 py-0.5 text-[11px] font-bold uppercase tracking-wider ${tone.wrap}`}
    >
      <span aria-hidden="true" className={`h-1.5 w-1.5 rounded-full ${tone.dot}`} />
      {status}
    </span>
  );
}