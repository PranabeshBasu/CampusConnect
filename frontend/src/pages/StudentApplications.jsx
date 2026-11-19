import { useCallback, useEffect, useMemo, useState } from 'react';
import { Calendar, MapPin, X } from 'lucide-react';
import { myApplications, withdrawApplication } from '../api/applications.js';
import ConfirmModal from '../components/ConfirmModal.jsx';
import FilterToolbar from '../components/FilterToolbar.jsx';
import KpiCard from '../components/KpiCard.jsx';
import { TableSkeleton } from '../components/Skeleton.jsx';
import StatusPill from '../components/StatusPill.jsx';
import { formatDateTime } from '../lib/format.js';

const STATUSES = ['APPLIED', 'SHORTLISTED', 'SELECTED', 'REJECTED', 'WITHDRAWN'];

const OUTCOME_TONE = {
  PASSED: 'bg-okt text-ok',
  FAILED: 'bg-badt text-bad',
  ABSENT: 'bg-badt text-bad',
  PENDING: 'bg-warnt text-warn',
};

function summarizeRound(app) {
  const rounds = app.rounds || [];
  if (rounds.length === 0) {
    if (app.status === 'SELECTED') return { label: 'Selected (Final)', filled: 1, total: 1, meta: '' };
    if (app.status === 'WITHDRAWN') return { label: 'Withdrawn by student', filled: 0, total: 1, meta: '' };
    return { label: 'Awaiting round schedule', filled: 0, total: 1, meta: '' };
  }

  const participated = rounds.filter((r) => Boolean(r.outcome));
  const current = participated.length > 0
    ? participated[participated.length - 1]
    : rounds.find((r) => r.roundStatus !== 'COMPLETED') || rounds[0];

  const metaParts = [];
  if (current.outcome) metaParts.push(current.outcome);
  if (current.scheduledAt) metaParts.push(formatDateTime(current.scheduledAt));

  return {
    label: `Round ${current.sequenceNumber} of ${rounds.length}: ${current.name}`,
    filled: participated.length > 0 ? current.sequenceNumber : 0,
    total: rounds.length,
    meta: metaParts.join(' · '),
  };
}

export default function StudentApplications() {
  const [data, setData] = useState(null);
  const [page, setPage] = useState(0);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [withdrawTarget, setWithdrawTarget] = useState(null);
  const [withdrawBusy, setWithdrawBusy] = useState(false);
  const [detailRow, setDetailRow] = useState(null);

  useEffect(() => {
    const timer = setTimeout(() => {
      setPage(0);
      setDebouncedSearch(search);
    }, 250);
    return () => clearTimeout(timer);
  }, [search]);

  const load = useCallback(async () => {
    try {
      setData(await myApplications({
        search: debouncedSearch || undefined,
        status: statusFilter || undefined,
        page,
      }));
      setError('');
    } catch (e) {
      setError(e.message);
      setData({ items: [], page: 0, size: 20, total: 0 });
    }
  }, [debouncedSearch, statusFilter, page]);

  useEffect(() => {
    load();
  }, [load]);

  async function confirmWithdraw() {
    if (!withdrawTarget) return;
    setNotice('');
    setWithdrawBusy(true);
    try {
      await withdrawApplication(withdrawTarget.id);
      setNotice('Application withdrawn.');
      setWithdrawTarget(null);
      load();
    } catch (e) {
      setError(e.message);
    } finally {
      setWithdrawBusy(false);
    }
  }

  const items = data?.items || [];

  const stats = useMemo(() => ({
    total: data?.total ?? items.length,
    shortlisted: items.filter((a) => a.status === 'SHORTLISTED').length,
    selected: items.filter((a) => a.status === 'SELECTED').length,
  }), [data, items]);

  const hasFilters = Boolean(search.trim() || statusFilter);
  const pages = data ? Math.max(1, Math.ceil(data.total / data.size)) : 1;

  function resetFilters() {
    setSearch('');
    setDebouncedSearch('');
    setStatusFilter('');
    setPage(0);
  }

  return (
    <main className="mx-auto grid max-w-6xl gap-5 px-4 py-8 sm:px-6">
      <h1 className="text-3xl font-extrabold">My applications</h1>

      {data && (
        <div className="grid gap-4 sm:grid-cols-3">
          <KpiCard label="Total Applied" value={stats.total} />
          <KpiCard label="Shortlisted" value={stats.shortlisted} tone="warn" />
          <KpiCard label="Selected" value={stats.selected} tone="ok" />
        </div>
      )}

      <FilterToolbar
        search={search}
        onSearchChange={setSearch}
        searchPlaceholder="Search by company or role…"
        hasActiveFilters={hasFilters}
        onReset={resetFilters}
      >
        <select
          aria-label="Filter by status"
          value={statusFilter}
          onChange={(e) => {
            setPage(0);
            setStatusFilter(e.target.value);
          }}
          className="rounded-lg border border-line bg-bg px-3 py-2 text-sm text-ink"
        >
          <option value="">All statuses</option>
          {STATUSES.map((s) => (
            <option key={s} value={s}>{s}</option>
          ))}
        </select>
      </FilterToolbar>

      {notice && <p role="status" className="rounded-lg bg-okt p-3 text-sm text-ok">{notice}</p>}
      {error && (
        <div role="alert" className="flex items-center justify-between gap-3 rounded-lg bg-badt p-3 text-sm text-bad">
          <span>{error}</span>
          <button type="button" className="btn-ghost text-xs" onClick={load}>Retry</button>
        </div>
      )}

      {data === null && <TableSkeleton rows={4} cols={5} />}

      {data && items.length === 0 && !error && !hasFilters && (
        <p className="card text-mute">You have not applied to any drive yet.</p>
      )}

      {data && items.length === 0 && hasFilters && (
        <div className="card flex flex-wrap items-center justify-between gap-3">
          <p className="text-sm text-mute">No applications match your filters.</p>
          <button type="button" className="btn-ghost text-xs" onClick={resetFilters}>
            Reset filters
          </button>
        </div>
      )}

      {items.length > 0 && (
        <div className="card overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="text-mute">
                <th className="py-2.5">Company &amp; Role</th>
                <th>Applied Date</th>
                <th>Current Round</th>
                <th>Status</th>
                <th className="text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {items.map((a) => {
                const step = summarizeRound(a);
                return (
                  <tr key={a.id} className="border-t border-line transition-colors hover:bg-bg">
                    <td className="py-3 font-medium">
                      {a.companyName} <span className="text-mute">· {a.driveTitle}</span>
                    </td>
                    <td className="text-mute">{formatDateTime(a.appliedAt)}</td>
                    <td>
                      <div className="text-xs font-medium text-ink">{step.label}</div>
                      {step.meta && <div className="mt-0.5 text-xs text-mute">{step.meta}</div>}
                      <div className="mt-1 flex gap-1" aria-hidden="true">
                        {Array.from({ length: step.total }).map((_, idx) => (
                          <span
                            key={idx}
                            className={`h-1.5 w-1.5 rounded-full ${
                              idx < step.filled ? 'bg-pri' : 'bg-line'
                            }`}
                          />
                        ))}
                      </div>
                    </td>
                    <td><StatusPill status={a.status} /></td>
                    <td className="space-x-2 whitespace-nowrap text-right">
                      <button
                        type="button"
                        className="btn-ghost text-xs"
                        onClick={() => setDetailRow(a)}
                      >
                        View details
                      </button>
                      {(a.status === 'APPLIED' || a.status === 'SHORTLISTED') && (
                        <button
                          type="button"
                          className="btn-ghost text-xs text-bad hover:border-bad"
                          onClick={() => setWithdrawTarget(a)}
                        >
                          Withdraw<span className="sr-only"> from {a.companyName}</span>
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {data && data.total > data.size && (
        <div className="flex items-center gap-3 text-sm">
          <button type="button" className="btn-ghost" disabled={page === 0} onClick={() => setPage(page - 1)}>Previous</button>
          <span>Page {page + 1} of {pages}</span>
          <button type="button" className="btn-ghost" disabled={page + 1 >= pages} onClick={() => setPage(page + 1)}>Next</button>
        </div>
      )}

      <ConfirmModal
        open={Boolean(withdrawTarget)}
        title={`Withdraw from ${withdrawTarget?.companyName || ''}?`}
        description="Once withdrawn, you may not be able to re-apply to this placement drive."
        confirmLabel="Withdraw application"
        busy={withdrawBusy}
        onConfirm={confirmWithdraw}
        onCancel={() => setWithdrawTarget(null)}
      />

      {detailRow && (
        <div
          className="fixed inset-0 z-50 flex justify-end bg-black/50 backdrop-blur-sm"
          role="dialog"
          aria-modal="true"
          aria-labelledby="app-detail-title"
          onClick={(e) => {
            if (e.target === e.currentTarget) setDetailRow(null);
          }}
        >
          <div className="flex h-full w-full max-w-md flex-col overflow-y-auto border-l border-line bg-surf p-6 shadow-2xl">
            <div className="flex items-start justify-between gap-3 border-b border-line pb-4">
              <div>
                <h2 id="app-detail-title" className="text-xl font-bold">{detailRow.companyName}</h2>
                <p className="text-sm text-mute">{detailRow.driveTitle}</p>
              </div>
              <button
                type="button"
                aria-label="Close details"
                onClick={() => setDetailRow(null)}
                className="rounded-lg p-1 text-mute hover:bg-line hover:text-ink"
              >
                <X size={18} />
              </button>
            </div>

            <dl className="mt-5 grid gap-3 text-sm">
              <div className="flex items-center justify-between">
                <dt className="text-mute">Current Status</dt>
                <dd><StatusPill status={detailRow.status} /></dd>
              </div>
              <div className="flex items-center justify-between">
                <dt className="text-mute">Applied On</dt>
                <dd>{formatDateTime(detailRow.appliedAt)}</dd>
              </div>
              <div className="flex items-center justify-between">
                <dt className="text-mute">Application ID</dt>
                <dd className="font-mono text-xs text-mute">#{detailRow.id}</dd>
              </div>
            </dl>

            <div className="mt-6 border-t border-line pt-5">
              <h3 className="text-sm font-bold uppercase tracking-wider text-mute">Round Timeline</h3>
              {!detailRow.rounds || detailRow.rounds.length === 0 ? (
                <p className="mt-3 text-sm text-mute">No rounds have been scheduled for this drive yet.</p>
              ) : (
                <ol className="mt-3 grid gap-3">
                  {detailRow.rounds.map((r) => (
                    <li key={r.roundId} className="rounded-xl border border-line bg-bg p-3">
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-sm font-bold text-ink">
                          Round {r.sequenceNumber}: {r.name}
                        </span>
                        {r.outcome ? (
                          <span className={`pill ${OUTCOME_TONE[r.outcome] || 'bg-prit text-pri'}`}>
                            {r.outcome}
                          </span>
                        ) : (
                          <span className="pill bg-line text-mute">{r.roundStatus}</span>
                        )}
                      </div>
                      {(r.scheduledAt || r.venue) && (
                        <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-mute">
                          {r.scheduledAt && (
                            <span className="inline-flex items-center gap-1">
                              <Calendar size={12} aria-hidden="true" />
                              {formatDateTime(r.scheduledAt)}
                            </span>
                          )}
                          {r.venue && (
                            <span className="inline-flex items-center gap-1">
                              <MapPin size={12} aria-hidden="true" />
                              {r.venue}
                            </span>
                          )}
                        </div>
                      )}
                      {r.feedback && (
                        <p className="mt-2 text-xs text-ink">Feedback: {r.feedback}</p>
                      )}
                    </li>
                  ))}
                </ol>
              )}
            </div>
          </div>
        </div>
      )}
    </main>
  );
}