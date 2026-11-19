import { useCallback, useEffect, useMemo, useState } from 'react';
import { ExternalLink, Eye, FileText, Lock, ShieldCheck, Unlock, X } from 'lucide-react';
import { listDepartmentUsers } from '../api/accounts.js';
import { listDepartmentStudents, verifyStudentProfile } from '../api/spoc.js';
import { listStudentDocumentsForStaff, viewStudentDocumentForStaff } from '../api/studentProfile.js';
import { useAuth } from '../auth/AuthContext.jsx';
import { ROLE_LABELS } from '../auth/roles.js';
import AppShell from '../components/AppShell.jsx';
import ConfirmModal from '../components/ConfirmModal.jsx';
import FilterToolbar from '../components/FilterToolbar.jsx';
import KpiCard from '../components/KpiCard.jsx';
import { TableSkeleton } from '../components/Skeleton.jsx';
import { formatDateTime } from '../lib/format.js';

const DOC_TYPE_LABELS = {
  AADHAAR_ID: 'Aadhaar ID',
  COLLEGE_ID: 'College ID',
  TENTH_MARKSHEET: '10th Marksheet',
  TWELFTH_MARKSHEET: '12th Marksheet',
  SEMESTER_TRANSCRIPT: 'Semester Transcript',
  RESUME: 'Resume',
};

export default function SpocHome() {
  const { user } = useAuth();
  const [tab, setTab] = useState('students');

  const [studentsData, setStudentsData] = useState(null);
  const [studentsError, setStudentsError] = useState('');
  const [notice, setNotice] = useState('');
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [verifiedFilter, setVerifiedFilter] = useState('');
  const [page, setPage] = useState(0);

  const [confirmTarget, setConfirmTarget] = useState(null);
  const [verifyNote, setVerifyNote] = useState('');
  const [verifyBusy, setVerifyBusy] = useState(false);

  const [docsTarget, setDocsTarget] = useState(null);
  const [docsList, setDocsList] = useState([]);
  const [docsLoading, setDocsLoading] = useState(false);
  const [docsError, setDocsError] = useState('');
  const [docViewId, setDocViewId] = useState(null);

  const [accountsState, setAccountsState] = useState({ loading: true, error: '', data: null });

  useEffect(() => {
    const timer = setTimeout(() => {
      setPage(0);
      setDebouncedSearch(search);
    }, 250);
    return () => clearTimeout(timer);
  }, [search]);

  const loadStudents = useCallback(async () => {
    if (!user?.departmentId) return;
    try {
      const res = await listDepartmentStudents(user.departmentId, {
        search: debouncedSearch || undefined,
        verified: verifiedFilter === '' ? undefined : verifiedFilter === 'verified',
        page,
      });
      setStudentsData(res);
      setStudentsError('');
    } catch (e) {
      setStudentsError(e.message);
      setStudentsData({ items: [], page: 0, size: 25, total: 0 });
    }
  }, [user?.departmentId, debouncedSearch, verifiedFilter, page]);

  useEffect(() => {
    loadStudents();
  }, [loadStudents]);

  useEffect(() => {
    if (!user?.departmentId) return;
    let alive = true;
    listDepartmentUsers(user.departmentId)
      .then((data) => alive && setAccountsState({ loading: false, error: '', data }))
      .catch((e) => alive && setAccountsState({ loading: false, error: e.message, data: null }));
    return () => {
      alive = false;
    };
  }, [user?.departmentId]);

  async function openDocsModal(student) {
    setDocsTarget(student);
    setDocsList([]);
    setDocsError('');
    setDocsLoading(true);
    try {
      const list = await listStudentDocumentsForStaff(student.studentUserId);
      setDocsList(Array.isArray(list) ? list : []);
    } catch (e) {
      setDocsError(e.message || 'Could not load student documents.');
    } finally {
      setDocsLoading(false);
    }
  }

  async function handleViewDoc(doc) {
    if (!docsTarget) return;
    setDocViewId(doc.docType);
    setDocsError('');
    try {
      const blob = await viewStudentDocumentForStaff(docsTarget.studentUserId, doc.docType);
      const url = URL.createObjectURL(blob);
      window.open(url, '_blank', 'noopener,noreferrer');
      window.setTimeout(() => URL.revokeObjectURL(url), 60_000);
    } catch (e) {
      setDocsError(e.message || 'Could not open document.');
    } finally {
      setDocViewId(null);
    }
  }

  async function executeVerification() {
    if (!confirmTarget) return;
    setVerifyBusy(true);
    setNotice('');
    setStudentsError('');
    try {
      await verifyStudentProfile(user.departmentId, confirmTarget.studentUserId, {
        verified: confirmTarget.nextVerified,
        note: verifyNote,
      });
      setNotice(
        confirmTarget.nextVerified
          ? `${confirmTarget.fullName}'s profile is now verified and locked.`
          : `${confirmTarget.fullName}'s profile has been unlocked for edits.`,
      );
      setConfirmTarget(null);
      setVerifyNote('');
      await loadStudents();
    } catch (e) {
      setStudentsError(e.message);
    } finally {
      setVerifyBusy(false);
    }
  }

  const items = studentsData?.items || [];
  const stats = useMemo(() => {
    const verified = items.filter((s) => s.verified).length;
    const missingProfile = items.filter((s) => !s.hasProfile).length;
    const pending = items.filter((s) => s.hasProfile && !s.verified).length;
    return {
      total: studentsData?.total ?? items.length,
      verified,
      pending,
      missingProfile,
    };
  }, [studentsData, items]);

  const hasFilters = Boolean(search.trim() || verifiedFilter);
  const pages = studentsData ? Math.max(1, Math.ceil(studentsData.total / studentsData.size)) : 1;

  return (
    <AppShell className="grid gap-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-3xl font-extrabold">Department</h1>
          <p className="mt-1 text-sm text-mute">
            Department #{user.departmentId} · Audit student academic records, inspect uploaded documents, and verify CGPA &amp; backlogs before drives open.
          </p>
        </div>

        <div role="tablist" aria-label="Department views" className="inline-flex rounded-xl border border-line bg-bg p-1">
          <button
            type="button"
            role="tab"
            aria-selected={tab === 'students'}
            onClick={() => setTab('students')}
            className={`rounded-lg px-3 py-1.5 text-xs font-bold transition ${
              tab === 'students' ? 'bg-surf text-ink shadow-sm' : 'text-mute hover:text-ink'
            }`}
          >
            Student Directory
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={tab === 'accounts'}
            onClick={() => setTab('accounts')}
            className={`rounded-lg px-3 py-1.5 text-xs font-bold transition ${
              tab === 'accounts' ? 'bg-surf text-ink shadow-sm' : 'text-mute hover:text-ink'
            }`}
          >
            All Accounts
          </button>
        </div>
      </div>

      {tab === 'students' ? (
        <>
          {studentsData && (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <KpiCard label="Total Students" value={stats.total} />
              <KpiCard label="Verified & Locked" value={stats.verified} tone="ok" />
              <KpiCard label="Pending Verification" value={stats.pending} tone="warn" />
              <KpiCard label="Missing Profile" value={stats.missingProfile} tone="bad" />
            </div>
          )}

          <FilterToolbar
            search={search}
            onSearchChange={setSearch}
            searchPlaceholder="Search by name, email, enrollment number, or branch…"
            hasActiveFilters={hasFilters}
            onReset={() => {
              setSearch('');
              setDebouncedSearch('');
              setVerifiedFilter('');
              setPage(0);
            }}
          >
            <select
              aria-label="Filter by verification status"
              value={verifiedFilter}
              onChange={(e) => {
                setPage(0);
                setVerifiedFilter(e.target.value);
              }}
              className="rounded-lg border border-line bg-bg px-3 py-2 text-sm text-ink"
            >
              <option value="">All verification states</option>
              <option value="verified">Verified</option>
              <option value="pending">Pending</option>
            </select>
          </FilterToolbar>

          {notice && <p role="status" className="rounded-lg bg-okt p-3 text-sm text-ok">{notice}</p>}
          {studentsError && (
            <div role="alert" className="flex items-center justify-between gap-3 rounded-lg bg-badt p-3 text-sm text-bad">
              <span>{studentsError}</span>
              <button type="button" className="btn-ghost text-xs" onClick={loadStudents}>Retry</button>
            </div>
          )}

          <section className="card" aria-labelledby="student-dir">
            <h2 id="student-dir" className="text-lg font-bold">
              Student directory{studentsData ? ` (${studentsData.total})` : ''}
            </h2>

            {studentsData === null && <div className="mt-3"><TableSkeleton rows={4} cols={7} /></div>}

            {studentsData && items.length === 0 && !studentsError && (
              <p className="mt-3 text-sm text-mute">
                {hasFilters ? 'No students match your current filters.' : 'No students assigned to this department yet.'}
              </p>
            )}

            {items.length > 0 && (
              <div className="mt-3 overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead>
                    <tr className="text-mute">
                      <th className="py-2.5">Student</th>
                      <th>Enrollment / Branch</th>
                      <th>Batch</th>
                      <th>CGPA</th>
                      <th>Backlogs</th>
                      <th>Resume</th>
                      <th>Verification</th>
                      <th className="text-right">Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {items.map((s) => (
                      <tr key={s.studentUserId} className="border-t border-line transition-colors hover:bg-bg">
                        <td className="py-3 font-medium">
                          {s.fullName}
                          <div className="text-xs font-normal text-mute">{s.email}</div>
                        </td>
                        <td className="text-xs">
                          <div className="font-medium text-ink">{s.enrollmentNo || s.rollNumber || '—'}</div>
                          <div className="text-mute">{s.branch || '—'}</div>
                        </td>
                        <td className="text-mute">{s.graduationYear || '—'}</td>
                        <td className="font-semibold">{s.cgpa != null ? s.cgpa : '—'}</td>
                        <td>{s.hasProfile ? s.activeBacklogs : '—'}</td>
                        <td>
                          {s.hasResume ? (
                            <span className="pill inline-flex items-center gap-1 bg-prit text-pri">
                              <FileText size={11} aria-hidden="true" /> Uploaded
                            </span>
                          ) : (
                            <span className="text-xs text-mute">None</span>
                          )}
                        </td>
                        <td>
                          {!s.hasProfile ? (
                            <span className="pill bg-line text-mute">No profile</span>
                          ) : s.verified ? (
                            <div>
                              <span className="pill inline-flex items-center gap-1 bg-okt text-ok">
                                <ShieldCheck size={12} aria-hidden="true" /> Verified
                              </span>
                              {s.verifiedAt && (
                                <div className="mt-0.5 text-[11px] text-mute">{formatDateTime(s.verifiedAt)}</div>
                              )}
                            </div>
                          ) : (
                            <span className="pill bg-warnt text-warn">Pending</span>
                          )}
                        </td>
                        <td className="whitespace-nowrap text-right">
                          <div className="inline-flex items-center justify-end gap-1.5">
                            {s.hasProfile && (
                              <button
                                type="button"
                                className="btn-ghost text-xs"
                                onClick={() => openDocsModal(s)}
                              >
                                <Eye size={13} aria-hidden="true" />
                                Docs<span className="sr-only"> for {s.fullName}</span>
                              </button>
                            )}
                            {s.hasProfile ? (
                              s.verified ? (
                                <button
                                  type="button"
                                  className="btn-ghost text-xs"
                                  onClick={() => {
                                    setVerifyNote(s.verificationNote || '');
                                    setConfirmTarget({ ...s, nextVerified: false });
                                  }}
                                >
                                  <Unlock size={13} aria-hidden="true" />
                                  Unlock<span className="sr-only"> {s.fullName}</span>
                                </button>
                              ) : (
                                <button
                                  type="button"
                                  className="btn text-xs"
                                  onClick={() => {
                                    setVerifyNote('');
                                    setConfirmTarget({ ...s, nextVerified: true });
                                  }}
                                >
                                  <Lock size={13} aria-hidden="true" />
                                  Verify &amp; Lock<span className="sr-only"> {s.fullName}</span>
                                </button>
                              )
                            ) : (
                              <span className="text-xs text-mute">Awaiting profile</span>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {studentsData && studentsData.total > studentsData.size && (
              <div className="mt-4 flex items-center gap-3 text-sm">
                <button type="button" className="btn-ghost" disabled={page === 0} onClick={() => setPage(page - 1)}>Previous</button>
                <span>Page {page + 1} of {pages}</span>
                <button type="button" className="btn-ghost" disabled={page + 1 >= pages} onClick={() => setPage(page + 1)}>Next</button>
              </div>
            )}
          </section>
        </>
      ) : (
        <section className="card" aria-labelledby="accts">
          <h2 id="accts" className="text-lg font-bold">Department accounts</h2>
          {accountsState.loading && <div className="mt-3"><TableSkeleton rows={2} cols={4} /></div>}
          {accountsState.error && <p role="alert" className="mt-3 rounded-lg bg-badt p-3 text-sm text-bad">{accountsState.error}</p>}
          {accountsState.data && accountsState.data.items.length === 0 && (
            <p className="mt-3 text-sm text-mute">No accounts are assigned to this department yet.</p>
          )}
          {accountsState.data && accountsState.data.items.length > 0 && (
            <div className="mt-3 overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="text-mute">
                    <th className="py-2.5">Name</th>
                    <th>Email</th>
                    <th>Role</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {accountsState.data.items.map((u) => (
                    <tr key={u.id} className="border-t border-line">
                      <td className="py-3 font-medium">{u.fullName}</td>
                      <td className="text-mute">{u.email}</td>
                      <td>{ROLE_LABELS[u.role]}</td>
                      <td>
                        <span className={`pill ${u.enabled ? 'bg-okt text-ok' : 'bg-badt text-bad'}`}>
                          {u.enabled ? 'Active' : 'Disabled'}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      )}

      {docsTarget && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm"
          role="dialog"
          aria-modal="true"
          aria-labelledby="spoc-docs-title"
          onClick={(e) => {
            if (e.target === e.currentTarget) setDocsTarget(null);
          }}
        >
          <div className="max-h-[90vh] w-full max-w-xl overflow-y-auto rounded-2xl border border-line bg-surf p-6 shadow-2xl">
            <div className="flex items-center justify-between border-b border-line pb-3">
              <div>
                <h2 id="spoc-docs-title" className="text-xl font-bold">{docsTarget.fullName} — Documents</h2>
                <p className="text-xs text-mute">
                  {docsTarget.enrollmentNo || docsTarget.rollNumber || 'No enrollment no'} · {docsTarget.branch || '—'} · CGPA: {docsTarget.cgpa ?? '—'} · Backlogs: {docsTarget.activeBacklogs ?? 0}
                </p>
              </div>
              <button
                type="button"
                aria-label="Close modal"
                onClick={() => setDocsTarget(null)}
                className="rounded-lg p-1 text-mute hover:bg-line hover:text-ink"
              >
                <X size={18} />
              </button>
            </div>

            {docsError && <p role="alert" className="mt-3 rounded-lg bg-badt p-3 text-sm text-bad">{docsError}</p>}

            {docsLoading ? (
              <p className="mt-4 text-sm text-mute">Loading uploaded documents…</p>
            ) : docsList.length === 0 ? (
              <p className="mt-4 rounded-lg border border-line bg-bg p-4 text-sm text-mute">
                No supporting documents uploaded yet.
              </p>
            ) : (
              <ul className="mt-4 grid gap-2">
                {docsList.map((doc) => (
                  <li key={doc.docType} className="flex items-center justify-between gap-3 rounded-xl border border-line bg-bg p-3">
                    <div className="min-w-0">
                      <div className="text-xs font-bold text-pri">
                        {DOC_TYPE_LABELS[doc.docType] || doc.docType}
                      </div>
                      <div className="truncate text-sm font-medium text-ink">{doc.fileName}</div>
                      {doc.uploadedAt && (
                        <div className="text-[11px] text-mute">Uploaded {formatDateTime(doc.uploadedAt)}</div>
                      )}
                    </div>
                    <button
                      type="button"
                      className="btn-ghost shrink-0 text-xs"
                      disabled={docViewId === doc.docType}
                      onClick={() => handleViewDoc(doc)}
                    >
                      <ExternalLink size={13} aria-hidden="true" />
                      {docViewId === doc.docType ? 'Opening…' : 'View'}
                    </button>
                  </li>
                ))}
              </ul>
            )}

            <div className="mt-5 flex flex-wrap items-center justify-end gap-2 border-t border-line pt-4">
              <button type="button" className="btn-ghost" onClick={() => setDocsTarget(null)}>
                Close
              </button>
              <button
                type="button"
                className={docsTarget.verified ? 'btn-ghost' : 'btn'}
                onClick={() => {
                  const target = docsTarget;
                  setDocsTarget(null);
                  setVerifyNote(target.verificationNote || '');
                  setConfirmTarget({ ...target, nextVerified: !target.verified });
                }}
              >
                {docsTarget.verified ? (
                  <>
                    <Unlock size={14} aria-hidden="true" /> Unlock profile
                  </>
                ) : (
                  <>
                    <Lock size={14} aria-hidden="true" /> Verify &amp; Lock
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      <ConfirmModal
        open={Boolean(confirmTarget)}
        title={
          confirmTarget?.nextVerified
            ? `Verify & lock ${confirmTarget?.fullName}'s profile?`
            : `Unlock ${confirmTarget?.fullName}'s profile?`
        }
        description={
          confirmTarget?.nextVerified
            ? `Confirm CGPA (${confirmTarget?.cgpa ?? '—'}) and Active Backlogs (${confirmTarget?.activeBacklogs ?? 0}). Once locked, the student cannot modify these academic fields.`
            : 'Unlocking allows the student to edit their CGPA and active backlogs again.'
        }
        confirmLabel={confirmTarget?.nextVerified ? 'Verify & Lock' : 'Unlock profile'}
        tone={confirmTarget?.nextVerified ? 'pri' : 'bad'}
        busy={verifyBusy}
        onConfirm={executeVerification}
        onCancel={() => setConfirmTarget(null)}
      />
    </AppShell>
  );
}