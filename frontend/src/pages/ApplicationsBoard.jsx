import { useCallback, useEffect, useMemo, useState } from 'react';
import { Award, Download, X } from 'lucide-react';
import { listApplications, setApplicationStatus } from '../api/applications.js';
import { upsertOffer } from '../api/offers.js';
import AppShell from '../components/AppShell.jsx';
import Field from '../components/Field.jsx';
import FilterToolbar from '../components/FilterToolbar.jsx';
import KpiCard from '../components/KpiCard.jsx';
import { TableSkeleton } from '../components/Skeleton.jsx';
import StatusPill from '../components/StatusPill.jsx';
import { formatDateTime } from '../lib/format.js';

const STATUSES = ['APPLIED', 'SHORTLISTED', 'SELECTED', 'REJECTED', 'WITHDRAWN'];
const ACTIONS = {
  APPLIED: [['SHORTLISTED', 'Shortlist'], ['REJECTED', 'Reject']],
  SHORTLISTED: [['SELECTED', 'Select'], ['REJECTED', 'Reject']],
};

function exportCsv(rows) {
  const headers = ['Student Name', 'Email', 'Branch', 'Batch', 'CGPA', 'Company', 'Role', 'Applied', 'Status'];
  const escape = (val) => `"${String(val ?? '').replace(/"/g, '""')}"`;
  const csv = [
    headers.join(','),
    ...rows.map((r) =>
      [
        r.studentName,
        r.studentEmail,
        r.branch || '',
        r.graduationYear || '',
        r.cgpa ?? '',
        r.companyName,
        r.driveTitle,
        formatDateTime(r.appliedAt),
        r.status,
      ]
        .map(escape)
        .join(',')
    ),
  ].join('\n');

  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'campusconnect-applications.csv';
  document.body.appendChild(a);
  a.click();
  a.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/** Shared by the placement admin (canManage) and the department SPOC (read-only, limited to their department by the server). */
export default function ApplicationsBoard({ canManage = false, title = 'Applications' }) {
  const [data, setData] = useState(null);
  const [status, setStatus] = useState('');
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [batchFilter, setBatchFilter] = useState('');
  const [page, setPage] = useState(0);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  const [offerRow, setOfferRow] = useState(null);
  const [offerForm, setOfferForm] = useState({ offeredCtcLpa: '', joiningDate: '', offerStatus: 'PENDING', notes: '' });
  const [offerBusy, setOfferBusy] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => {
      setPage(0);
      setDebouncedSearch(search);
    }, 250);
    return () => clearTimeout(timer);
  }, [search]);

  const load = useCallback(async () => {
    try {
      setData(await listApplications({
        status: status || undefined,
        search: debouncedSearch || undefined,
        batch: batchFilter ? Number(batchFilter) : undefined,
        page,
      }));
      setError('');
    } catch (e) {
      setError(e.message);
      setData({ items: [], page: 0, size: 25, total: 0 });
    }
  }, [status, debouncedSearch, batchFilter, page]);

  useEffect(() => {
    load();
  }, [load]);

  async function act(row, target) {
    setNotice('');
    try {
      await setApplicationStatus(row.id, target);
      setNotice(`${row.studentName}: ${row.companyName} is now ${target}.`);
      load();
    } catch (e) {
      setError(e.message);
    }
  }

  async function saveOffer(e) {
    e.preventDefault();
    if (!offerRow) return;
    if (!offerForm.offeredCtcLpa || Number(offerForm.offeredCtcLpa) < 0) {
      setError('Enter a valid offered CTC (LPA).');
      return;
    }
    setOfferBusy(true);
    setError('');
    setNotice('');
    try {
      await upsertOffer(offerRow.id, {
        offeredCtcLpa: Number(offerForm.offeredCtcLpa),
        joiningDate: offerForm.joiningDate || null,
        offerStatus: offerForm.offerStatus,
        notes: offerForm.notes.trim() || null,
      });
      setNotice(`Offer recorded for ${offerRow.studentName} (${offerRow.companyName}).`);
      setOfferRow(null);
    } catch (ex) {
      setError(ex.message || 'Could not record offer.');
    } finally {
      setOfferBusy(false);
    }
  }

  const batches = useMemo(() => {
    const set = new Set(['2025', '2026', '2027', '2028']);
    (data?.items || []).forEach((r) => {
      if (r.graduationYear) set.add(String(r.graduationYear));
    });
    return Array.from(set).sort();
  }, [data]);

  const items = data?.items || [];

  const stats = useMemo(() => ({
    total: data?.total ?? items.length,
    shortlisted: items.filter((r) => r.status === 'SHORTLISTED').length,
    selected: items.filter((r) => r.status === 'SELECTED').length,
  }), [data, items]);

  const hasFilters = Boolean(search.trim() || status || batchFilter);
  const pages = data ? Math.max(1, Math.ceil(data.total / data.size)) : 1;

  return (
    <AppShell className="grid gap-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-3xl font-extrabold">{title}</h1>
        {items.length > 0 && (
          <button
            type="button"
            className="btn-ghost"
            onClick={() => exportCsv(items)}
          >
            <Download size={16} aria-hidden="true" /> Export CSV
          </button>
        )}
      </div>

      {data && (
        <div className="grid gap-4 sm:grid-cols-3">
          <KpiCard label="Total Applications" value={stats.total} />
          <KpiCard label="Shortlisted" value={stats.shortlisted} tone="warn" />
          <KpiCard label="Selected" value={stats.selected} tone="ok" />
        </div>
      )}

      <FilterToolbar
        search={search}
        onSearchChange={setSearch}
        searchPlaceholder="Search student, email, company…"
        hasActiveFilters={hasFilters}
        onReset={() => {
          setSearch('');
          setDebouncedSearch('');
          setStatus('');
          setBatchFilter('');
          setPage(0);
        }}
      >
        <div className="flex items-center gap-2">
          <label htmlFor="status-filter" className="text-xs font-bold uppercase tracking-wider text-mute">
            Status
          </label>
          <select
            id="status-filter"
            className="rounded-lg border border-line bg-bg px-3 py-2 text-sm text-ink"
            value={status}
            onChange={(e) => {
              setPage(0);
              setStatus(e.target.value);
            }}
          >
            <option value="">All</option>
            {STATUSES.map((s) => (
              <option key={s} value={s}>{s}</option>
            ))}
          </select>
        </div>

        <select
          aria-label="Filter by batch"
          className="rounded-lg border border-line bg-bg px-3 py-2 text-sm text-ink"
          value={batchFilter}
          onChange={(e) => {
            setPage(0);
            setBatchFilter(e.target.value);
          }}
        >
          <option value="">All batches</option>
          {batches.map((b) => (
            <option key={b} value={b}>Batch {b}</option>
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

      {data === null && <TableSkeleton rows={4} cols={canManage ? 7 : 6} />}
      {data && items.length === 0 && !error && !hasFilters && <p className="card text-mute">No applications match.</p>}
      {data && items.length === 0 && hasFilters && (
        <div className="card flex flex-wrap items-center justify-between gap-3">
          <p className="text-sm text-mute">No applications match your filters.</p>
          <button
            type="button"
            className="btn-ghost text-xs"
            onClick={() => {
              setSearch('');
              setDebouncedSearch('');
              setStatus('');
              setBatchFilter('');
              setPage(0);
            }}
          >
            Reset filters
          </button>
        </div>
      )}

      {items.length > 0 && (
        <div className="card overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="text-mute">
                <th className="py-2.5">Student</th>
                <th>Branch / batch</th>
                <th>CGPA</th>
                <th>Company and role</th>
                <th>Applied</th>
                <th>Status</th>
                {canManage && <th />}
              </tr>
            </thead>
            <tbody>
              {items.map((r) => (
                <tr key={r.id} className="border-t border-line align-top transition-colors hover:bg-bg">
                  <td className="py-3 font-medium">
                    {r.studentName}
                    <div className="text-xs font-normal text-mute">{r.studentEmail}</div>
                  </td>
                  <td>{r.branch || '—'} / {r.graduationYear || '—'}</td>
                  <td>{r.cgpa ?? '—'}</td>
                  <td className="font-medium">
                    {r.companyName}
                    <div className="text-xs font-normal text-mute">{r.driveTitle}</div>
                  </td>
                  <td className="text-mute">{formatDateTime(r.appliedAt)}</td>
                  <td><StatusPill status={r.status} /></td>
                  {canManage && (
                    <td className="space-x-2 whitespace-nowrap">
                      {(ACTIONS[r.status] || []).map(([target, label]) => (
                        <button key={target} type="button" className="btn-ghost text-xs" onClick={() => act(r, target)}>
                          {label}<span className="sr-only"> {r.studentName} at {r.companyName}</span>
                        </button>
                      ))}
                      {r.status === 'SELECTED' && (
                        <button
                          type="button"
                          className="btn-ghost text-xs text-pri hover:border-pri"
                          onClick={() => {
                            setOfferForm({ offeredCtcLpa: '', joiningDate: '', offerStatus: 'PENDING', notes: '' });
                            setOfferRow(r);
                          }}
                        >
                          <Award size={13} aria-hidden="true" /> Record offer
                        </button>
                      )}
                    </td>
                  )}
                </tr>
              ))}
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

      {offerRow && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm"
          role="dialog"
          aria-modal="true"
          aria-labelledby="record-offer-title"
          onClick={(e) => {
            if (e.target === e.currentTarget && !offerBusy) setOfferRow(null);
          }}
        >
          <div className="w-full max-w-md rounded-2xl border border-line bg-surf p-6 shadow-2xl">
            <div className="flex items-center justify-between border-b border-line pb-3">
              <div>
                <h2 id="record-offer-title" className="text-lg font-bold">Record offer</h2>
                <p className="text-xs text-mute">{offerRow.studentName} · {offerRow.companyName}</p>
              </div>
              <button
                type="button"
                aria-label="Close modal"
                onClick={() => setOfferRow(null)}
                disabled={offerBusy}
                className="rounded-lg p-1 text-mute hover:bg-line hover:text-ink"
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={saveOffer} noValidate className="mt-3 grid gap-2">
              <Field
                id="offer-ctc"
                label="Offered CTC (LPA)"
                type="number"
                step="0.01"
                value={offerForm.offeredCtcLpa}
                onChange={(v) => setOfferForm((f) => ({ ...f, offeredCtcLpa: v }))}
              />
              <Field
                id="offer-joining"
                label="Joining date (optional)"
                type="date"
                value={offerForm.joiningDate}
                onChange={(v) => setOfferForm((f) => ({ ...f, joiningDate: v }))}
              />
              <div className="mt-3">
                <label htmlFor="offer-status" className="mb-1 block text-sm font-bold">Offer status</label>
                <select
                  id="offer-status"
                  className="w-full rounded-lg border border-line bg-bg px-3 py-2 text-sm text-ink"
                  value={offerForm.offerStatus}
                  onChange={(e) => setOfferForm((f) => ({ ...f, offerStatus: e.target.value }))}
                >
                  <option value="PENDING">PENDING</option>
                  <option value="ACCEPTED">ACCEPTED</option>
                  <option value="DECLINED">DECLINED</option>
                </select>
              </div>
              <Field
                id="offer-notes"
                label="Notes (optional)"
                value={offerForm.notes}
                onChange={(v) => setOfferForm((f) => ({ ...f, notes: v }))}
              />
              <div className="mt-4 flex justify-end gap-2 border-t border-line pt-4">
                <button type="button" className="btn-ghost" onClick={() => setOfferRow(null)} disabled={offerBusy}>Cancel</button>
                <button type="submit" className="btn" disabled={offerBusy}>{offerBusy ? 'Saving…' : 'Save offer'}</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </AppShell>
  );
}