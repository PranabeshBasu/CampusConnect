import { useCallback, useEffect, useMemo, useState } from 'react';
import { Plus, X } from 'lucide-react';
import { listCompanies } from '../api/companies.js';
import {
  changeDriveStatus,
  createDrive,
  deleteDrive,
  listAdminDrives,
} from '../api/drives.js';
import AppShell from '../components/AppShell.jsx';
import ConfirmModal from '../components/ConfirmModal.jsx';
import DriveRounds from '../components/DriveRounds.jsx';
import DropdownMenu from '../components/DropdownMenu.jsx';
import Field from '../components/Field.jsx';
import FilterToolbar from '../components/FilterToolbar.jsx';
import KpiCard from '../components/KpiCard.jsx';
import { TableSkeleton } from '../components/Skeleton.jsx';
import StatusPill from '../components/StatusPill.jsx';
import { formatDateTime } from '../lib/format.js';

const PRESET_BRANCHES = ['CSE', 'CSE (AI & ML)', 'CSIT', 'IT', 'ECE'];

const EMPTY = {
  companyId: '',
  title: '',
  location: '',
  ctcLpa: '',
  graduationYear: '',
  minCgpa: '',
  maxActiveBacklogs: '',
  branches: [],
  applicationDeadline: '',
  description: '',
};

const SELECT = 'w-full rounded-lg border border-line bg-bg px-3 py-2 text-sm text-ink';

export function validateDrive(f) {
  const errs = {};

  if (!f.companyId) errs.companyId = 'Choose a company.';
  if (!f.title.trim()) errs.title = 'Enter the role title.';

  const year = Number(f.graduationYear);
  if (
    !f.graduationYear ||
    !Number.isInteger(year) ||
    year < 2000 ||
    year > 2100
  ) {
    errs.graduationYear = 'Enter a batch year such as 2027.';
  }

  if (
    f.minCgpa !== '' &&
    (Number(f.minCgpa) < 0 || Number(f.minCgpa) > 10)
  ) {
    errs.minCgpa = 'CGPA must be between 0 and 10.';
  }

  if (
    f.maxActiveBacklogs !== '' &&
    (!Number.isInteger(Number(f.maxActiveBacklogs)) ||
      Number(f.maxActiveBacklogs) < 0)
  ) {
    errs.maxActiveBacklogs = 'Use a whole number, 0 or more.';
  }

  if (f.ctcLpa !== '' && Number(f.ctcLpa) < 0) {
    errs.ctcLpa = 'CTC cannot be negative.';
  }

  const when = new Date(f.applicationDeadline);

  if (!f.applicationDeadline || Number.isNaN(when.getTime())) {
    errs.applicationDeadline = 'Choose the application deadline.';
  } else if (when.getTime() <= Date.now()) {
    errs.applicationDeadline = 'The deadline must be in the future.';
  }

  return errs;
}

export default function AdminDrives() {
  const [companies, setCompanies] = useState([]);
  const [drives, setDrives] = useState(null);
  const [page, setPage] = useState(0);
  const [form, setForm] = useState(EMPTY);
  const [customBranch, setCustomBranch] = useState('');
  const [errors, setErrors] = useState({});
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [roundDriveId, setRoundDriveId] = useState(null);
  const [submitting, setSubmitting] = useState(false);

  const [createOpen, setCreateOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [confirmState, setConfirmState] = useState(null);
  const [confirmBusy, setConfirmBusy] = useState(false);

  const set = (k) => (v) => setForm((f) => ({ ...f, [k]: v }));

  useEffect(() => {
    const timer = setTimeout(() => {
      setPage(0);
      setDebouncedSearch(search);
    }, 250);
    return () => clearTimeout(timer);
  }, [search]);

  const load = useCallback(async () => {
    try {
      const [c, d] = await Promise.all([
        listCompanies(),
        listAdminDrives({
          status: statusFilter || undefined,
          search: debouncedSearch || undefined,
          page,
        }),
      ]);

      setCompanies(c.filter((x) => x.active));
      setDrives(d);
      setError('');
    } catch (e) {
      setError(e.message);
      setDrives({ items: [], page: 0, size: 25, total: 0 });
    }
  }, [statusFilter, debouncedSearch, page]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    if (
      roundDriveId !== null &&
      drives?.items &&
      !drives.items.some((d) => d.id === roundDriveId && d.status !== 'CANCELLED')
    ) {
      setRoundDriveId(null);
    }
  }, [drives, roundDriveId]);

  function toggleBranchChip(branch) {
    setForm((prev) => {
      const exists = prev.branches.includes(branch);
      return {
        ...prev,
        branches: exists
          ? prev.branches.filter((b) => b !== branch)
          : [...prev.branches, branch],
      };
    });
  }

  function addCustomBranch() {
    const parts = customBranch
      .split(',')
      .map((b) => b.trim())
      .filter(Boolean);
    if (!parts.length) return;
    setForm((prev) => ({
      ...prev,
      branches: [...new Set([...prev.branches, ...parts])],
    }));
    setCustomBranch('');
  }

  async function saveDrive(publishImmediately) {
    setNotice('');
    setError('');

    const errs = validateDrive(form);
    setErrors(errs);
    if (Object.keys(errs).length) return;

    const pendingCustom = customBranch
      .split(',')
      .map((b) => b.trim())
      .filter(Boolean);
    const branches = [...new Set([...form.branches, ...pendingCustom])];
    const num = (v) => (v === '' ? null : Number(v));

    setSubmitting(true);
    try {
      const created = await createDrive({
        companyId: Number(form.companyId),
        title: form.title.trim(),
        description: form.description.trim() || null,
        location: form.location.trim() || null,
        ctcLpa: num(form.ctcLpa),
        graduationYear: Number(form.graduationYear),
        minCgpa: num(form.minCgpa),
        maxActiveBacklogs: num(form.maxActiveBacklogs),
        branches,
        applicationDeadline: new Date(form.applicationDeadline).toISOString(),
      });

      if (publishImmediately && created?.id) {
        await changeDriveStatus(created.id, 'OPEN');
        setNotice('Drive created and published for students.');
      } else {
        setNotice('Drive saved as a draft. Publish it when it is ready for students.');
      }

      setForm(EMPTY);
      setCustomBranch('');
      setErrors({});
      setCreateOpen(false);
      await load();
    } catch (ex) {
      setError(ex.message);
    } finally {
      setSubmitting(false);
    }
  }

  function submit(e) {
    e.preventDefault();
    saveDrive(false);
  }

  async function move(d, status) {
    setNotice('');
    setError('');
    try {
      await changeDriveStatus(d.id, status);
      setNotice(`${d.title} is now ${status}.`);
      load();
    } catch (ex) {
      setError(ex.message);
    }
  }

  async function executeConfirmedAction() {
    if (!confirmState) return;
    setConfirmBusy(true);
    setNotice('');
    setError('');
    try {
      if (confirmState.type === 'delete') {
        await deleteDrive(confirmState.drive.id);
        setRoundDriveId(null);
        setNotice(`Drive "${confirmState.drive.title}" was removed.`);
      } else {
        await changeDriveStatus(confirmState.drive.id, confirmState.status);
        setNotice(`${confirmState.drive.title} is now ${confirmState.status}.`);
      }
      setConfirmState(null);
      await load();
    } catch (ex) {
      setError(ex.message);
    } finally {
      setConfirmBusy(false);
    }
  }

  const stats = useMemo(() => {
    const items = drives?.items || [];
    return {
      total: drives?.total ?? items.length,
      open: items.filter((d) => d.status === 'OPEN').length,
      closed: items.filter((d) => d.status === 'CLOSED').length,
      cancelled: items.filter((d) => d.status === 'CANCELLED').length,
    };
  }, [drives]);

  const filteredDrives = drives?.items || [];
  const hasFilters = Boolean(search.trim() || statusFilter);
  const pages = drives ? Math.max(1, Math.ceil(drives.total / drives.size)) : 1;
  const selectedDrive = drives?.items?.find((d) => d.id === roundDriveId);
  const customSelectedBranches = form.branches.filter((b) => !PRESET_BRANCHES.includes(b));

  function resetFilters() {
    setSearch('');
    setDebouncedSearch('');
    setStatusFilter('');
    setPage(0);
  }

  return (
    <AppShell className="grid gap-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-3xl font-extrabold">Placement drives</h1>
        <button
          type="button"
          className="btn"
          onClick={() => setCreateOpen(true)}
        >
          <Plus size={16} aria-hidden="true" /> Create drive
        </button>
      </div>

      {drives && (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <KpiCard label="Total Drives" value={stats.total} />
          <KpiCard label="Open" value={stats.open} tone="ok" />
          <KpiCard label="Closed" value={stats.closed} tone="pri" />
          <KpiCard label="Cancelled" value={stats.cancelled} tone="bad" />
        </div>
      )}

      <FilterToolbar
        search={search}
        onSearchChange={setSearch}
        searchPlaceholder="Search drives, companies, batches…"
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
          <option value="DRAFT">DRAFT</option>
          <option value="OPEN">OPEN</option>
          <option value="CLOSED">CLOSED</option>
          <option value="CANCELLED">CANCELLED</option>
        </select>
      </FilterToolbar>

      {notice && (
        <p role="status" className="rounded-lg bg-okt p-3 text-sm text-ok">
          {notice}
        </p>
      )}

      {error && (
        <div role="alert" className="flex items-center justify-between gap-3 rounded-lg bg-badt p-3 text-sm text-bad">
          <span>{error}</span>
          <button type="button" className="btn-ghost text-xs" onClick={load}>Retry</button>
        </div>
      )}

      <section className="card" aria-labelledby="drive-list">
        <h2 id="drive-list" className="text-lg font-bold">
          All drives{drives ? ` (${drives.total})` : ''}
        </h2>

        {drives === null && <div className="mt-3"><TableSkeleton rows={4} cols={6} /></div>}

        {drives && filteredDrives.length === 0 && !hasFilters && (
          <p className="mt-3 text-sm text-mute">No drives yet.</p>
        )}

        {drives && filteredDrives.length === 0 && hasFilters && (
          <div className="mt-3 flex flex-wrap items-center justify-between gap-3 rounded-lg border border-line p-4">
            <p className="text-sm text-mute">No drives match your filters.</p>
            <button type="button" className="btn-ghost text-xs" onClick={resetFilters}>
              Reset filters
            </button>
          </div>
        )}

        {filteredDrives.length > 0 && (
          <div className="mt-3 overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="text-mute">
                  <th className="py-2.5">Company and role</th>
                  <th>Batch</th>
                  <th>Criteria</th>
                  <th>Deadline</th>
                  <th>Status</th>
                  <th className="text-right">Actions</th>
                </tr>
              </thead>

              <tbody>
                {filteredDrives.map((d) => {
                  const menuItems = [
                    {
                      label: 'Close drive',
                      hidden: d.status !== 'OPEN',
                      onClick: () =>
                        setConfirmState({
                          type: 'status',
                          status: 'CLOSED',
                          drive: d,
                          title: `Close "${d.title}"?`,
                          description: 'Closing this drive stops new student applications.',
                          confirmLabel: 'Close drive',
                        }),
                    },
                    {
                      label: 'Cancel drive',
                      tone: 'bad',
                      hidden: d.status !== 'DRAFT' && d.status !== 'OPEN',
                      onClick: () =>
                        setConfirmState({
                          type: 'status',
                          status: 'CANCELLED',
                          drive: d,
                          title: `Cancel "${d.title}"?`,
                          description: 'Cancelling this drive cannot be undone.',
                          confirmLabel: 'Cancel drive',
                        }),
                    },
                    {
                      label: 'Remove drive',
                      tone: 'bad',
                      hidden: d.status !== 'CANCELLED',
                      onClick: () =>
                        setConfirmState({
                          type: 'delete',
                          drive: d,
                          title: `Remove "${d.title}"?`,
                          description: 'This cancelled drive will be permanently deleted. This action cannot be undone.',
                          confirmLabel: 'Remove drive',
                        }),
                    },
                  ];

                  return (
                    <tr key={d.id} className="border-t border-line align-top transition-colors hover:bg-bg">
                      <td className="py-3 font-medium">
                        {d.companyName}
                        <div className="text-xs font-normal text-mute">{d.title}</div>
                      </td>

                      <td>{d.graduationYear}</td>

                      <td className="text-xs text-mute">
                        {d.minCgpa != null ? `CGPA ≥ ${d.minCgpa}` : 'Any CGPA'};{' '}
                        {d.maxActiveBacklogs != null ? `≤ ${d.maxActiveBacklogs} backlogs` : 'any backlogs'};{' '}
                        {d.branches?.length ? d.branches.join(', ') : 'all branches'}
                      </td>

                      <td className="text-mute">{formatDateTime(d.applicationDeadline)}</td>

                      <td><StatusPill status={d.status} /></td>

                      <td className="relative whitespace-nowrap text-right">
                        <div className="inline-flex items-center gap-2">
                          {d.status === 'DRAFT' && (
                            <button
                              type="button"
                              className="btn-ghost text-xs"
                              onClick={() => move(d, 'OPEN')}
                            >
                              Publish<span className="sr-only"> {d.title}</span>
                            </button>
                          )}

                          {d.status !== 'CANCELLED' && (
                            <button
                              type="button"
                              className="btn-ghost text-xs"
                              onClick={() => setRoundDriveId(roundDriveId === d.id ? null : d.id)}
                            >
                              {roundDriveId === d.id ? 'Hide rounds' : 'Manage rounds'}
                              <span className="sr-only"> for {d.title}</span>
                            </button>
                          )}

                          <DropdownMenu
                            label={`More actions for ${d.title}`}
                            items={menuItems}
                          />
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {selectedDrive && <DriveRounds drive={selectedDrive} />}

        <div className="mt-4 flex items-center gap-3 text-sm">
          <button type="button" className="btn-ghost" disabled={page === 0} onClick={() => setPage(page - 1)}>Previous</button>
          <span>Page {page + 1} of {pages}</span>
          <button type="button" className="btn-ghost" disabled={page + 1 >= pages} onClick={() => setPage(page + 1)}>Next</button>
        </div>
      </section>

      {createOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm"
          role="dialog"
          aria-modal="true"
          aria-labelledby="new-drive"
          onClick={(e) => {
            if (e.target === e.currentTarget) setCreateOpen(false);
          }}
        >
          <div className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-2xl border border-line bg-surf p-6 shadow-2xl">
            <div className="flex items-center justify-between border-b border-line pb-3">
              <h2 id="new-drive" className="text-xl font-bold">Create a drive</h2>
              <button
                type="button"
                aria-label="Close modal"
                onClick={() => setCreateOpen(false)}
                className="rounded-lg p-1 text-mute hover:bg-line hover:text-ink"
              >
                <X size={18} />
              </button>
            </div>

            {companies.length === 0 && (
              <p className="mt-3 text-sm text-mute">
                There are no active companies yet. Add one on the Companies page first.
              </p>
            )}

            <form onSubmit={submit} noValidate className="mt-3 grid gap-x-4 sm:grid-cols-2">
              <div className="mt-3">
                <label htmlFor="dcompany" className="mb-1 block text-sm font-bold">Company</label>
                <select
                  id="dcompany"
                  className={SELECT}
                  value={form.companyId}
                  onChange={(e) => set('companyId')(e.target.value)}
                  aria-invalid={errors.companyId ? 'true' : undefined}
                >
                  <option value="">Choose…</option>
                  {companies.map((c) => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </select>
                {errors.companyId && <p role="alert" className="mt-1 text-sm text-bad">{errors.companyId}</p>}
              </div>

              <Field id="dtitle" label="Role title" value={form.title} onChange={set('title')} error={errors.title} />
              <Field id="dyear" label="Batch (graduation year)" type="number" value={form.graduationYear} onChange={set('graduationYear')} error={errors.graduationYear} />
              <Field id="ddeadline" label="Application deadline" type="datetime-local" value={form.applicationDeadline} onChange={set('applicationDeadline')} error={errors.applicationDeadline} />
              <Field id="dcgpa" label="Minimum CGPA (optional)" type="number" step="0.01" value={form.minCgpa} onChange={set('minCgpa')} error={errors.minCgpa} />
              <Field id="dback" label="Max active backlogs (optional)" type="number" value={form.maxActiveBacklogs} onChange={set('maxActiveBacklogs')} error={errors.maxActiveBacklogs} />

              <div className="mt-3 sm:col-span-2">
                <span className="mb-1.5 block text-sm font-bold">
                  Eligible branches (select chips or leave empty for all)
                </span>
                <div className="flex flex-wrap gap-1.5" role="group" aria-label="Eligible branches">
                  {PRESET_BRANCHES.map((b) => {
                    const active = form.branches.includes(b);
                    return (
                      <button
                        key={b}
                        type="button"
                        aria-pressed={active}
                        onClick={() => toggleBranchChip(b)}
                        className={`pill cursor-pointer border transition ${
                          active ? 'border-pri bg-prit text-pri' : 'border-line bg-bg text-mute hover:text-ink'
                        }`}
                      >
                        {active ? '✓ ' : '+ '}{b}
                      </button>
                    );
                  })}
                  {customSelectedBranches.map((b) => (
                    <button
                      key={b}
                      type="button"
                      aria-pressed="true"
                      onClick={() => toggleBranchChip(b)}
                      className="pill cursor-pointer border border-pri bg-prit text-pri transition"
                    >
                      ✓ {b} ×
                    </button>
                  ))}
                </div>
                <div className="mt-2 flex gap-2">
                  <input
                    id="dbranch"
                    type="text"
                    aria-label="Add custom branch"
                    value={customBranch}
                    onChange={(e) => setCustomBranch(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        addCustomBranch();
                      }
                    }}
                    placeholder="Add another branch (e.g. ME, Civil) and press Add"
                    className={SELECT}
                  />
                  <button
                    type="button"
                    className="btn-ghost shrink-0 text-xs"
                    onClick={addCustomBranch}
                  >
                    Add
                  </button>
                </div>
              </div>

              <Field id="dctc" label="CTC in LPA (optional)" type="number" step="0.01" value={form.ctcLpa} onChange={set('ctcLpa')} error={errors.ctcLpa} />
              <Field id="dloc" label="Location (optional)" value={form.location} onChange={set('location')} />
              <Field id="ddesc" label="Description (optional)" value={form.description} onChange={set('description')} />

              <div className="mt-5 flex flex-wrap justify-end gap-2 border-t border-line pt-4 sm:col-span-2">
                <button type="button" className="btn-ghost" onClick={() => setCreateOpen(false)} disabled={submitting}>
                  Cancel
                </button>
                <button type="submit" className="btn-ghost" disabled={submitting}>
                  Save as draft
                </button>
                <button
                  type="button"
                  className="btn"
                  disabled={submitting}
                  onClick={() => saveDrive(true)}
                >
                  Publish drive
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      <ConfirmModal
        open={Boolean(confirmState)}
        title={confirmState?.title || ''}
        description={confirmState?.description || ''}
        confirmLabel={confirmState?.confirmLabel || 'Confirm'}
        busy={confirmBusy}
        onConfirm={executeConfirmedAction}
        onCancel={() => setConfirmState(null)}
      />
    </AppShell>
  );
}