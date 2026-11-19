export default function KpiCard({ label, value, tone = 'default', hint }) {
  const toneClasses = {
    default: 'border-line bg-surf text-ink',
    pri: 'border-pri bg-prit text-pri',
    ok: 'border-ok bg-okt text-ok',
    warn: 'border-warn bg-warnt text-warn',
    bad: 'border-bad bg-badt text-bad',
  };

  const valueClasses = {
    default: 'text-ink',
    pri: 'text-pri',
    ok: 'text-ok',
    warn: 'text-warn',
    bad: 'text-bad',
  };

  return (
    <div className={`rounded-xl border p-4 transition-colors ${toneClasses[tone] || toneClasses.default}`}>
      <p className="text-xs font-semibold uppercase tracking-wider text-mute">{label}</p>
      <p className={`mt-1.5 font-display text-2xl font-extrabold ${valueClasses[tone] || valueClasses.default}`}>
        {value}
      </p>
      {hint && <p className="mt-1 text-xs text-mute">{hint}</p>}
    </div>
  );
}
