import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Calendar, Check, Info, MapPin, X } from 'lucide-react';
import { applyToDrive, listOpenDrives } from '../api/drives.js';
import { getStudentProfile, getStudentResumeMetadata } from '../api/studentProfile.js';
import AppShell from '../components/AppShell.jsx';
import CompanyLogo from '../components/CompanyLogo.jsx';
import FilterToolbar from '../components/FilterToolbar.jsx';
import KpiCard from '../components/KpiCard.jsx';
import { CardSkeleton } from '../components/Skeleton.jsx';
import StatusPill from '../components/StatusPill.jsx';
import { formatDateTime } from '../lib/format.js';

function computeCompleteness(profile, hasResume) {
  if (!profile) return hasResume ? Math.round((1 / 8) * 100) : 0;
  const fields = [
    profile.rollNumber,
    profile.phone,
    profile.dateOfBirth,
    profile.degree,
    profile.branch,
    profile.graduationYear,
    profile.cgpa,
  ];
  const filled =
    fields.filter((v) => String(v ?? '').trim().length > 0).length +
    (hasResume ? 1 : 0);
  return Math.round((filled / 8) * 100);
}

export default function StudentDrives() {
  const [data, setData] = useState(null);
  const [page, setPage] = useState(0);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [busyId, setBusyId] = useState(null);

  const [profile, setProfile] = useState(null);
  const [hasResume, setHasResume] = useState(false);
  const [profileLoaded, setProfileLoaded] = useState(false);

  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [branchFilter, setBranchFilter] = useState('');
  const [eligibleOnly, setEligibleOnly] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => {
      setPage(0);
      setDebouncedSearch(search);
    }, 250);
    return () => clearTimeout(timer);
  }, [search]);

  useEffect(() => {
    let alive = true;
    Promise.all([
      getStudentProfile().catch(() => null),
      getStudentResumeMetadata().catch(() => ({ hasResume: false })),
    ]).then(([prof, meta]) => {
      if (!alive) return;
      setProfile(prof);
      setHasResume(Boolean(meta?.hasResume));
      setProfileLoaded(true);
    });
    return () => {
      alive = false;
    };
  }, []);

  const load = useCallback(async () => {
    try {
      setData(await listOpenDrives({
        search: debouncedSearch || undefined,
        branch: branchFilter || undefined,
        page,
      }));
      setError('');
    } catch (e) {
      setError(e.message);
      setData({ items: [], page: 0, size: 20, total: 0 });
    }
  }, [debouncedSearch, branchFilter, page]);

  useEffect(() => {
    load();
  }, [load]);

  async function apply(view) {
    setNotice('');
    setError('');
    setBusyId(view.drive.id);
    try {
      await applyToDrive(view.drive.id);
      setNotice(`Applied to ${view.drive.companyName}.`);
      await load();
    } catch (e) {
      setError(e.message);
    } finally {
      setBusyId(null);
    }
  }

  const allBranches = useMemo(() => {
    const set = new Set(['CSE', 'CSE (AI & ML)', 'CSIT', 'IT', 'ECE']);
    (data?.items || []).forEach((v) => {
      (v.drive.branches || []).forEach((b) => set.add(b));
    });
    return Array.from(set).sort();
  }, [data]);

  const filteredItems = useMemo(() => {
    return (data?.items || []).filter((v) => {
      if (eligibleOnly && !v.eligibility.eligible) return false;
      return true;
    });
  }, [data, eligibleOnly]);

  const stats = useMemo(() => {
    const items = data?.items || [];
    return {
      total: data?.total ?? items.length,
      eligible: items.filter((v) => v.eligibility.eligible).length,
      applied: items.filter((v) => Boolean(v.applicationId)).length,
      shortlisted: items.filter((v) => v.applicationStatus === 'SHORTLISTED').length,
    };
  }, [data]);

  const completeness = useMemo(
    () => computeCompleteness(profile, hasResume),
    [profile, hasResume],
  );

  const hasFilters = Boolean(search.trim() || branchFilter || eligibleOnly);
  const pages = data ? Math.max(1, Math.ceil(data.total / data.size)) : 1;

  return (
    <AppShell className="grid gap-5">
      <div>
        <h1 className="text-3xl font-extrabold">Open drives</h1>
        <p className="mt-1 text-sm text-mute">
          Eligibility is checked against your saved profile. Keep your{' '}
          <Link to="/student" className="font-bold text-pri hover:underline">profile</Link> up to date.
        </p>
      </div>

      {data && (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
          <KpiCard label="Open Drives" value={stats.total} tone="pri" />
          <KpiCard label="Eligible for You" value={stats.eligible} tone="ok" />
          <KpiCard label="Applied / Active" value={stats.applied} />
          <KpiCard label="Shortlisted" value={stats.shortlisted} tone="warn" />
          <KpiCard
            label="Profile Completeness"
            value={profileLoaded ? `${completeness}%` : '—'}
            tone={profileLoaded && completeness === 100 ? 'ok' : 'default'}
          />
        </div>
      )}

      <FilterToolbar
        search={search}
        onSearchChange={setSearch}
        searchPlaceholder="Search companies, roles, or locations…"
        hasActiveFilters={hasFilters}
        onReset={() => {
          setSearch('');
          setDebouncedSearch('');
          setBranchFilter('');
          setEligibleOnly(false);
          setPage(0);
        }}
      >
        <select
          aria-label="Filter by branch"
          value={branchFilter}
          onChange={(e) => {
            setPage(0);
            setBranchFilter(e.target.value);
          }}
          className="rounded-lg border border-line bg-bg px-3 py-2 text-sm text-ink"
        >
          <option value="">All branches</option>
          {allBranches.map((b) => (
            <option key={b} value={b}>{b}</option>
          ))}
        </select>

        <label className="inline-flex cursor-pointer items-center gap-2 rounded-lg border border-line bg-bg px-3 py-2 text-sm">
          <input
            type="checkbox"
            checked={eligibleOnly}
            onChange={(e) => setEligibleOnly(e.target.checked)}
            className="accent-pri"
          />
          <span>Eligible only</span>
        </label>
      </FilterToolbar>

      {notice && <p role="status" className="rounded-lg bg-okt p-3 text-sm text-ok">{notice}</p>}
      {error && (
        <div role="alert" className="flex items-center justify-between gap-3 rounded-lg bg-badt p-3 text-sm text-bad">
          <span>{error}</span>
          <button type="button" className="btn-ghost text-xs" onClick={load}>Retry</button>
        </div>
      )}

      {data === null && <CardSkeleton count={4} />}

      {data && data.items.length === 0 && !error && !hasFilters && (
        <p className="card text-mute">No drives are open for applications right now.</p>
      )}

      {data && filteredItems.length === 0 && hasFilters && (
        <div className="card flex flex-wrap items-center justify-between gap-3">
          <p className="text-sm text-mute">No drives match your current filters.</p>
          <button
            type="button"
            className="btn-ghost text-xs"
            onClick={() => {
              setSearch('');
              setDebouncedSearch('');
              setBranchFilter('');
              setEligibleOnly(false);
              setPage(0);
            }}
          >
            Reset filters
          </button>
        </div>
      )}

      {filteredItems.length > 0 && (
        <div className="grid gap-5 md:grid-cols-2">
          {filteredItems.map((v) => {
            const ok = v.eligibility.eligible;
            const reasons = v.eligibility.reasons || [];
            const tooltipId = `apply-disabled-tip-${v.drive.id}`;
            const tooltipText = reasons.length
              ? reasons.join(' ')
              : 'You do not meet the eligibility criteria for this drive.';

            return (
              <article
                key={v.drive.id}
                className="card cc-glow-card flex flex-col justify-between transition-colors hover:border-pri"
                aria-label={`${v.drive.companyName} ${v.drive.title}`}
              >
                <div>
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex min-w-0 items-center gap-3">
                      <CompanyLogo
                        name={v.drive.companyName}
                        website={v.drive.companyWebsite}
                        logoUrl={v.drive.companyLogoUrl}
                      />
                      <div className="min-w-0">
                        <h2 className="truncate text-lg font-bold">{v.drive.companyName}</h2>
                        <p className="truncate text-sm text-mute">{v.drive.title}</p>
                      </div>
                    </div>
                    {v.drive.ctcLpa != null && (
                      <span className="pill shrink-0 bg-prit text-pri">{v.drive.ctcLpa} LPA</span>
                    )}
                  </div>

                  <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-mute">
                    <span className="inline-flex items-center gap-1">
                      <Calendar size={13} aria-hidden="true" />
                      Batch {v.drive.graduationYear} · Apply by {formatDateTime(v.drive.applicationDeadline)}
                    </span>
                    {v.drive.location && (
                      <span className="inline-flex items-center gap-1">
                        <MapPin size={13} aria-hidden="true" />
                        {v.drive.location}
                      </span>
                    )}
                  </div>

                  {v.drive.description && (
                    <p className="mt-3 line-clamp-2 text-sm text-ink">{v.drive.description}</p>
                  )}

                  <div className="mt-4 flex flex-wrap gap-2">
                    <span className={`pill inline-flex items-center gap-1 ${ok ? 'bg-okt text-ok' : 'bg-line text-mute'}`}>
                      {ok ? <Check size={12} aria-hidden="true" /> : null}
                      {v.drive.minCgpa != null ? `CGPA ${v.drive.minCgpa}+` : 'Any CGPA'}
                    </span>
                    <span className={`pill inline-flex items-center gap-1 ${ok ? 'bg-okt text-ok' : 'bg-line text-mute'}`}>
                      {ok ? <Check size={12} aria-hidden="true" /> : null}
                      {v.drive.maxActiveBacklogs != null ? `≤ ${v.drive.maxActiveBacklogs} backlogs` : 'Any backlogs'}
                    </span>
                    <span className={`pill inline-flex items-center gap-1 ${ok ? 'bg-okt text-ok' : 'bg-line text-mute'}`}>
                      {ok ? <Check size={12} aria-hidden="true" /> : null}
                      {v.drive.branches.length ? v.drive.branches.join(', ') : 'All branches'}
                    </span>
                  </div>
                </div>

                <div className="mt-5 border-t border-line pt-4">
                  {v.applicationId ? (
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-mute">Your application</span>
                      <StatusPill status={v.applicationStatus} />
                    </div>
                  ) : ok ? (
                    <button
                      type="button"
                      className="btn w-full justify-center"
                      disabled={busyId === v.drive.id}
                      onClick={() => apply(v)}
                    >
                      {busyId === v.drive.id ? 'Applying…' : 'Apply'}
                      <span className="sr-only"> to {v.drive.companyName}</span>
                    </button>
                  ) : (
                    <div className="grid gap-3">
                      <div className="rounded-lg bg-badt p-3">
                        <p className="inline-flex items-center gap-1 text-xs font-bold text-bad">
                          <X size={14} aria-hidden="true" /> You are not eligible yet
                        </p>
                        <ul className="mt-1 list-disc pl-5 text-xs text-mute">
                          {reasons.map((r) => <li key={r}>{r}</li>)}
                        </ul>
                      </div>

                      <div className="group relative" tabIndex={0} aria-describedby={tooltipId}>
                        <button
                          type="button"
                          disabled
                          title={tooltipText}
                          aria-describedby={tooltipId}
                          className="btn w-full cursor-not-allowed justify-center opacity-50"
                        >
                          Apply
                          <Info size={14} aria-hidden="true" />
                          <span className="sr-only"> to {v.drive.companyName} (disabled)</span>
                        </button>
                        <div
                          id={tooltipId}
                          role="tooltip"
                          className="pointer-events-none invisible absolute bottom-full left-1/2 z-20 mb-2 w-72 -translate-x-1/2 rounded-xl border border-line bg-surf p-2.5 text-xs text-ink opacity-0 shadow-xl transition-opacity group-hover:visible group-hover:opacity-100 group-focus-within:visible group-focus-within:opacity-100"
                        >
                          <p className="font-bold text-bad">Apply disabled</p>
                          <p className="mt-0.5 text-mute">{tooltipText}</p>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </article>
            );
          })}
        </div>
      )}

      {data && data.total > data.size && (
        <div className="flex items-center gap-3 text-sm">
          <button type="button" className="btn-ghost" disabled={page === 0} onClick={() => setPage(page - 1)}>Previous</button>
          <span>Page {page + 1} of {pages}</span>
          <button type="button" className="btn-ghost" disabled={page + 1 >= pages} onClick={() => setPage(page + 1)}>Next</button>
        </div>
      )}
    </AppShell>
  );
}