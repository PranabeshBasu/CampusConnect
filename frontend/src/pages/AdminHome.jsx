import { useCallback, useEffect, useMemo, useState } from 'react';
import { Download, ExternalLink, Eye, FileText, Lock, Plus, ShieldCheck, Unlock, Upload, X } from 'lucide-react';
import {
  createDepartment,
  createUser,
  importStudentRegistryCsv,
  importStudentsCsv,
  listDepartments,
  listUsers,
  updateUser,
} from '../api/accounts.js';
import { listDepartmentStudents, verifyStudentProfile } from '../api/spoc.js';
import { listStudentDocumentsForStaff, viewStudentDocumentForStaff } from '../api/studentProfile.js';
import { useAuth } from '../auth/AuthContext.jsx';
import { ROLE_LABELS } from '../auth/roles.js';
import { validateEmail, validateName, validatePassword } from '../auth/validators.js';
import AppShell from '../components/AppShell.jsx';
import ConfirmModal from '../components/ConfirmModal.jsx';
import Field from '../components/Field.jsx';
import FilterToolbar from '../components/FilterToolbar.jsx';
import KpiCard from '../components/KpiCard.jsx';
import { TableSkeleton } from '../components/Skeleton.jsx';
import { formatDateTime } from '../lib/format.js';

const SELECT = 'rounded-lg border border-line bg-bg px-3 py-1.5 text-sm text-ink';

const DOC_TYPE_LABELS = {
  AADHAAR_ID: 'Aadhaar ID',
  COLLEGE_ID: 'College ID',
  TENTH_MARKSHEET: '10th Marksheet',
  TWELFTH_MARKSHEET: '12th Marksheet',
  SEMESTER_TRANSCRIPT: 'Semester Transcript',
  RESUME: 'Resume',
};

const SAMPLE_CSV = [
  'fullName,email,rollNumber,departmentCode,branch,graduationYear,cgpa,activeBacklogs',
  'Asha Roy,asha.roy@college.edu,CSE2027001,CSE,CSE,2027,8.75,0',
  'Kabir Das,kabir.das@college.edu,AIML2027012,CSE-AIML,CSE (AI & ML),2027,9.10,0',
].join('\n');

const SAMPLE_REGISTRY_CSV = [
  'Name,Enrollment No,Registration No,Degree,Stream,Graduation Year',
  'Test Student,12023002028999,304202300901999,B.Tech,CSE (AI & ML),2027',
  'Asha Roy,12023002028001,304202300901001,B.Tech,CSE,2027',
].join('\n');

function triggerCsvDownload(content, filename) {
  const blob = new Blob([content], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function UserRow({ u, departments, isSelf, onSaved, onError }) {
  const [role, setRole] = useState(u.role);
  const [dept, setDept] = useState(u.departmentId ?? '');
  const [enabled, setEnabled] = useState(u.enabled);
  const dirty = role !== u.role || String(dept) !== String(u.departmentId ?? '') || enabled !== u.enabled;

  async function save() {
    try {
      await updateUser(u.id, { role, departmentId: dept === '' ? null : Number(dept), enabled });
      onSaved();
    } catch (e) {
      onError(e.message);
    }
  }

  return (
    <tr className="border-t border-line transition-colors hover:bg-bg">
      <td className="py-3 font-medium">
        {u.fullName}
        <div className="text-xs font-normal text-mute">{u.email}</div>
      </td>
      <td>
        <select
          aria-label={`Role for ${u.email}`}
          className={SELECT}
          value={role}
          disabled={isSelf}
          onChange={(e) => setRole(e.target.value)}
        >
          {Object.entries(ROLE_LABELS).map(([k, v]) => (
            <option key={k} value={k}>{v}</option>
          ))}
        </select>
      </td>
      <td>
        <select
          aria-label={`Department for ${u.email}`}
          className={SELECT}
          value={dept}
          onChange={(e) => setDept(e.target.value)}
        >
          <option value="">None</option>
          {departments.map((d) => (
            <option key={d.id} value={d.id}>{d.code}</option>
          ))}
        </select>
      </td>
      <td>
        <input
          type="checkbox"
          aria-label={`Enabled for ${u.email}`}
          checked={enabled}
          disabled={isSelf}
          onChange={(e) => setEnabled(e.target.checked)}
          className="h-4 w-4 accent-pri"
        />
      </td>
      <td className="text-right">
        <button type="button" className="btn-ghost text-xs" disabled={!dirty} onClick={save}>
          Save
        </button>
      </td>
    </tr>
  );
}

export default function AdminHome() {
  const { user } = useAuth();
  const [tab, setTab] = useState('accounts');

  const [departments, setDepartments] = useState([]);
  const [users, setUsers] = useState(null);
  const [page, setPage] = useState(0);
  const [notice, setNotice] = useState('');
  const [error, setError] = useState('');

  const [dep, setDep] = useState({ code: '', name: '' });
  const [nu, setNu] = useState({ fullName: '', email: '', password: '', role: 'DEPARTMENT_SPOC', departmentId: '' });
  const [formErrors, setFormErrors] = useState({});
  const [createOpen, setCreateOpen] = useState(false);

  const [importOpen, setImportOpen] = useState(false);
  const [csvFile, setCsvFile] = useState(null);
  const [defaultPassword, setDefaultPassword] = useState('Campus@2027');
  const [importing, setImporting] = useState(false);
  const [importError, setImportError] = useState('');
  const [importResult, setImportResult] = useState(null);

  const [registryOpen, setRegistryOpen] = useState(false);
  const [registryFile, setRegistryFile] = useState(null);
  const [registryImporting, setRegistryImporting] = useState(false);
  const [registryError, setRegistryError] = useState('');
  const [registryResult, setRegistryResult] = useState(null);

  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState('');

  const [selectedDeptId, setSelectedDeptId] = useState('');
  const [studentsData, setStudentsData] = useState(null);
  const [studentsError, setStudentsError] = useState('');
  const [studentSearch, setStudentSearch] = useState('');
  const [debouncedStudentSearch, setDebouncedStudentSearch] = useState('');
  const [verifiedFilter, setVerifiedFilter] = useState('');
  const [studentPage, setStudentPage] = useState(0);

  const [confirmTarget, setConfirmTarget] = useState(null);
  const [verifyNote, setVerifyNote] = useState('');
  const [verifyBusy, setVerifyBusy] = useState(false);

  const [docsTarget, setDocsTarget] = useState(null);
  const [docsList, setDocsList] = useState([]);
  const [docsLoading, setDocsLoading] = useState(false);
  const [docsError, setDocsError] = useState('');
  const [docViewId, setDocViewId] = useState(null);

  const load = useCallback(async () => {
    try {
      const [d, u] = await Promise.all([listDepartments(), listUsers(page, 25)]);
      setDepartments(d);
      setUsers(u);
      setError('');
      setSelectedDeptId((prev) => prev || (d[0]?.id ? String(d[0].id) : ''));
    } catch (e) {
      setError(e.message);
      setUsers({ items: [], page: 0, size: 25, total: 0 });
    }
  }, [page]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    const timer = setTimeout(() => {
      setStudentPage(0);
      setDebouncedStudentSearch(studentSearch);
    }, 250);
    return () => clearTimeout(timer);
  }, [studentSearch]);

  const loadDepartmentStudents = useCallback(async () => {
    if (!selectedDeptId) {
      setStudentsData({ items: [], page: 0, size: 25, total: 0 });
      return;
    }
    try {
      const res = await listDepartmentStudents(Number(selectedDeptId), {
        search: debouncedStudentSearch || undefined,
        verified: verifiedFilter === '' ? undefined : verifiedFilter === 'verified',
        page: studentPage,
      });
      setStudentsData(res);
      setStudentsError('');
    } catch (e) {
      setStudentsError(e.message);
      setStudentsData({ items: [], page: 0, size: 25, total: 0 });
    }
  }, [selectedDeptId, debouncedStudentSearch, verifiedFilter, studentPage]);

  useEffect(() => {
    if (tab === 'verification') {
      loadDepartmentStudents();
    }
  }, [tab, loadDepartmentStudents]);

  const done = (msg) => {
    setError('');
    setNotice(msg);
    load();
  };

  async function addDepartment(e) {
    e.preventDefault();
    if (!dep.code.trim() || !dep.name.trim()) {
      setError('Enter a department code and name.');
      return;
    }
    try {
      await createDepartment(dep.code.trim(), dep.name.trim());
      setDep({ code: '', name: '' });
      done('Department created.');
    } catch (ex) {
      setError(ex.message);
    }
  }

  async function addUser(e) {
    e.preventDefault();
    const errs = {
      fullName: validateName(nu.fullName),
      email: validateEmail(nu.email),
      password: validatePassword(nu.password),
    };
    if (nu.role === 'DEPARTMENT_SPOC' && !nu.departmentId) {
      errs.departmentId = 'Choose a department for a SPOC.';
    }
    setFormErrors(errs);
    if (Object.values(errs).some(Boolean)) return;
    try {
      await createUser({
        ...nu,
        email: nu.email.trim(),
        fullName: nu.fullName.trim(),
        departmentId: nu.departmentId === '' ? null : Number(nu.departmentId),
      });
      setNu({ fullName: '', email: '', password: '', role: 'DEPARTMENT_SPOC', departmentId: '' });
      setFormErrors({});
      setCreateOpen(false);
      done('Account created.');
    } catch (ex) {
      setError(ex.message);
    }
  }

  async function handleCsvImport(e) {
    e.preventDefault();
    setImportError('');
    setImportResult(null);
    if (!csvFile) {
      setImportError('Please choose a CSV file first.');
      return;
    }
    const pwErr = validatePassword(defaultPassword);
    if (pwErr) {
      setImportError(`Default password: ${pwErr}`);
      return;
    }

    setImporting(true);
    try {
      const res = await importStudentsCsv(csvFile, defaultPassword);
      setImportResult(res);
      setCsvFile(null);
      if (res.createdCount > 0) {
        setNotice(`Imported ${res.createdCount} student account(s).`);
        await load();
      }
    } catch (ex) {
      setImportError(ex.message || 'Could not import CSV.');
    } finally {
      setImporting(false);
    }
  }

  async function handleRegistryImport(e) {
    e.preventDefault();
    setRegistryError('');
    setRegistryResult(null);
    if (!registryFile) {
      setRegistryError('Please choose a CSV file first.');
      return;
    }

    setRegistryImporting(true);
    try {
      const res = await importStudentRegistryCsv(registryFile);
      setRegistryResult(res);
      setRegistryFile(null);
      const added = res.insertedCount ?? res.createdCount ?? 0;
      const updated = res.updatedCount ?? 0;
      if (added > 0 || updated > 0) {
        setNotice(`Student registry updated: ${added} added, ${updated} updated.`);
      }
    } catch (ex) {
      setRegistryError(ex.message || 'Could not import student registry CSV.');
    } finally {
      setRegistryImporting(false);
    }
  }

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
    if (!confirmTarget || !selectedDeptId) return;
    setVerifyBusy(true);
    setNotice('');
    setStudentsError('');
    try {
      await verifyStudentProfile(Number(selectedDeptId), confirmTarget.studentUserId, {
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
      await loadDepartmentStudents();
    } catch (e) {
      setStudentsError(e.message);
    } finally {
      setVerifyBusy(false);
    }
  }

  const filteredUsers = useMemo(() => {
    const q = search.trim().toLowerCase();
    return (users?.items || []).filter((u) => {
      if (roleFilter && u.role !== roleFilter) return false;
      if (q) {
        const hay = `${u.fullName} ${u.email}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [users, search, roleFilter]);

  const stats = useMemo(() => {
    const items = users?.items || [];
    return {
      total: users?.total ?? items.length,
      active: items.filter((u) => u.enabled).length,
      departments: departments.length,
    };
  }, [users, departments]);

  const studentItems = studentsData?.items || [];
  const studentStats = useMemo(() => {
    const verified = studentItems.filter((s) => s.verified).length;
    const missingProfile = studentItems.filter((s) => !s.hasProfile).length;
    const pending = studentItems.filter((s) => s.hasProfile && !s.verified).length;
    return {
      total: studentsData?.total ?? studentItems.length,
      verified,
      pending,
      missingProfile,
    };
  }, [studentsData, studentItems]);

  const hasFilters = Boolean(search.trim() || roleFilter);
  const pages = users ? Math.max(1, Math.ceil(users.total / users.size)) : 1;

  const hasStudentFilters = Boolean(studentSearch.trim() || verifiedFilter);
  const studentPages = studentsData ? Math.max(1, Math.ceil(studentsData.total / studentsData.size)) : 1;

  return (
    <AppShell className="grid gap-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-4">
          <h1 className="text-3xl font-extrabold">Administration</h1>
          <div role="tablist" aria-label="Admin sections" className="inline-flex rounded-xl border border-line bg-bg p-1">
            <button
              type="button"
              role="tab"
              aria-selected={tab === 'accounts'}
              onClick={() => setTab('accounts')}
              className={`rounded-lg px-3 py-1.5 text-xs font-bold transition ${
                tab === 'accounts' ? 'bg-surf text-ink shadow-sm' : 'text-mute hover:text-ink'
              }`}
            >
              Accounts &amp; Registry
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={tab === 'verification'}
              onClick={() => setTab('verification')}
              className={`rounded-lg px-3 py-1.5 text-xs font-bold transition ${
                tab === 'verification' ? 'bg-surf text-ink shadow-sm' : 'text-mute hover:text-ink'
              }`}
            >
              Student Verification
            </button>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            className="btn-ghost"
            onClick={() => {
              setRegistryError('');
              setRegistryResult(null);
              setRegistryOpen(true);
            }}
          >
            <Upload size={16} aria-hidden="true" /> Import Registry (CSV)
          </button>
          <button
            type="button"
            className="btn-ghost"
            onClick={() => {
              setImportError('');
              setImportResult(null);
              setImportOpen(true);
            }}
          >
            <Upload size={16} aria-hidden="true" /> Import CSV
          </button>
          <button type="button" className="btn" onClick={() => setCreateOpen(true)}>
            <Plus size={16} aria-hidden="true" /> Create account
          </button>
        </div>
      </div>

      {notice && <p role="status" className="rounded-lg bg-okt p-3 text-sm text-ok">{notice}</p>}
      {error && <p role="alert" className="rounded-lg bg-badt p-3 text-sm text-bad">{error}</p>}

      {tab === 'accounts' ? (
        <>
          {users && (
            <div className="grid gap-4 sm:grid-cols-3">
              <KpiCard label="Total Accounts" value={stats.total} />
              <KpiCard label="Active on Page" value={stats.active} tone="ok" />
              <KpiCard label="Departments" value={stats.departments} tone="pri" />
            </div>
          )}

          <section className="card" aria-labelledby="deps">
            <h2 id="deps" className="text-lg font-bold">Departments</h2>
            {departments.length ? (
              <div className="mt-3 flex flex-wrap gap-2">
                {departments.map((d) => (
                  <span key={d.id} className="pill border border-line bg-bg text-ink">
                    <strong className="text-pri">{d.code}</strong> · {d.name}
                  </span>
                ))}
              </div>
            ) : (
              <p className="mt-1 text-sm text-mute">
                No departments yet. Create one before adding a Department SPOC.
              </p>
            )}
            <form onSubmit={addDepartment} noValidate className="mt-3 grid gap-2 sm:grid-cols-[1fr_2fr_auto] sm:items-end">
              <Field id="dcode" label="Code" placeholder="e.g. CSE-AIML" value={dep.code} onChange={(v) => setDep({ ...dep, code: v })} />
              <Field id="dname" label="Name" placeholder="e.g. CSE (AI & ML)" value={dep.name} onChange={(v) => setDep({ ...dep, name: v })} />
              <button type="submit" className="btn">Add department</button>
            </form>
          </section>

          <FilterToolbar
            search={search}
            onSearchChange={setSearch}
            searchPlaceholder="Search users by name or email…"
            hasActiveFilters={hasFilters}
            onReset={() => {
              setSearch('');
              setRoleFilter('');
            }}
          >
            <select
              aria-label="Filter by role"
              value={roleFilter}
              onChange={(e) => setRoleFilter(e.target.value)}
              className="rounded-lg border border-line bg-bg px-3 py-2 text-sm text-ink"
            >
              <option value="">All roles</option>
              {Object.entries(ROLE_LABELS).map(([k, v]) => (
                <option key={k} value={k}>{v}</option>
              ))}
            </select>
          </FilterToolbar>

          <section className="card" aria-labelledby="all-users">
            <h2 id="all-users" className="text-lg font-bold">
              Accounts{users ? ` (${users.total})` : ''}
            </h2>

            {users === null ? (
              <div className="mt-3"><TableSkeleton rows={4} cols={5} /></div>
            ) : filteredUsers.length === 0 ? (
              <div className="mt-3 flex flex-wrap items-center justify-between gap-3 rounded-lg border border-line p-4">
                <p className="text-sm text-mute">No accounts match your filters.</p>
                {hasFilters && (
                  <button type="button" className="btn-ghost text-xs" onClick={() => { setSearch(''); setRoleFilter(''); }}>
                    Reset filters
                  </button>
                )}
              </div>
            ) : (
              <div className="mt-3 overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead>
                    <tr className="text-mute">
                      <th className="py-2.5">User</th>
                      <th>Role</th>
                      <th>Department</th>
                      <th>Enabled</th>
                      <th className="text-right">Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredUsers.map((u) => (
                      <UserRow
                        key={`${u.id}-${u.role}-${u.departmentId}-${u.enabled}`}
                        u={u}
                        departments={departments}
                        isSelf={u.id === user.id}
                        onSaved={() => done('Account updated.')}
                        onError={setError}
                      />
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            <div className="mt-4 flex items-center gap-3 text-sm">
              <button type="button" className="btn-ghost" disabled={page === 0} onClick={() => setPage(page - 1)}>Previous</button>
              <span>Page {page + 1} of {pages}</span>
              <button type="button" className="btn-ghost" disabled={page + 1 >= pages} onClick={() => setPage(page + 1)}>Next</button>
            </div>
          </section>
        </>
      ) : (
        <>
          {studentsData && (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <KpiCard label="Total Students" value={studentStats.total} />
              <KpiCard label="Verified & Locked" value={studentStats.verified} tone="ok" />
              <KpiCard label="Pending Verification" value={studentStats.pending} tone="warn" />
              <KpiCard label="Missing Profile" value={studentStats.missingProfile} tone="bad" />
            </div>
          )}

          <FilterToolbar
            search={studentSearch}
            onSearchChange={setStudentSearch}
            searchPlaceholder="Search by name, email, enrollment number, or branch…"
            hasActiveFilters={hasStudentFilters}
            onReset={() => {
              setStudentSearch('');
              setDebouncedStudentSearch('');
              setVerifiedFilter('');
              setStudentPage(0);
            }}
          >
            <select
              aria-label="Select department"
              value={selectedDeptId}
              onChange={(e) => {
                setStudentPage(0);
                setSelectedDeptId(e.target.value);
              }}
              className="rounded-lg border border-line bg-bg px-3 py-2 text-sm text-ink"
            >
              {departments.length === 0 && <option value="">No departments</option>}
              {departments.map((d) => (
                <option key={d.id} value={String(d.id)}>
                  {d.code} · {d.name}
                </option>
              ))}
            </select>

            <select
              aria-label="Filter by verification status"
              value={verifiedFilter}
              onChange={(e) => {
                setStudentPage(0);
                setVerifiedFilter(e.target.value);
              }}
              className="rounded-lg border border-line bg-bg px-3 py-2 text-sm text-ink"
            >
              <option value="">All verification states</option>
              <option value="verified">Verified</option>
              <option value="pending">Pending</option>
            </select>
          </FilterToolbar>

          {studentsError && (
            <div role="alert" className="flex items-center justify-between gap-3 rounded-lg bg-badt p-3 text-sm text-bad">
              <span>{studentsError}</span>
              <button type="button" className="btn-ghost text-xs" onClick={loadDepartmentStudents}>Retry</button>
            </div>
          )}

          <section className="card" aria-labelledby="admin-student-dir">
            <h2 id="admin-student-dir" className="text-lg font-bold">
              Student verification{studentsData ? ` (${studentsData.total})` : ''}
            </h2>

            {studentsData === null && <div className="mt-3"><TableSkeleton rows={4} cols={7} /></div>}

            {studentsData && studentItems.length === 0 && !studentsError && (
              <p className="mt-3 text-sm text-mute">
                {hasStudentFilters ? 'No students match your current filters.' : 'No students assigned to this department yet.'}
              </p>
            )}

            {studentItems.length > 0 && (
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
                    {studentItems.map((s) => (
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
                <button type="button" className="btn-ghost" disabled={studentPage === 0} onClick={() => setStudentPage(studentPage - 1)}>Previous</button>
                <span>Page {studentPage + 1} of {studentPages}</span>
                <button type="button" className="btn-ghost" disabled={studentPage + 1 >= studentPages} onClick={() => setStudentPage(studentPage + 1)}>Next</button>
              </div>
            )}
          </section>
        </>
      )}

      {createOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm"
          role="dialog"
          aria-modal="true"
          aria-labelledby="new-user"
          onClick={(e) => {
            if (e.target === e.currentTarget) setCreateOpen(false);
          }}
        >
          <div className="w-full max-w-xl rounded-2xl border border-line bg-surf p-6 shadow-2xl">
            <div className="flex items-center justify-between border-b border-line pb-3">
              <h2 id="new-user" className="text-xl font-bold">Create an account</h2>
              <button
                type="button"
                aria-label="Close modal"
                onClick={() => setCreateOpen(false)}
                className="rounded-lg p-1 text-mute hover:bg-line hover:text-ink"
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={addUser} noValidate className="mt-3 grid gap-x-4 sm:grid-cols-2">
              <Field id="nfn" label="Full name" value={nu.fullName} onChange={(v) => setNu({ ...nu, fullName: v })} error={formErrors.fullName} />
              <Field id="nem" label="Email" type="email" value={nu.email} onChange={(v) => setNu({ ...nu, email: v })} error={formErrors.email} />
              <Field id="npw" label="Initial password" type="password" autoComplete="new-password" value={nu.password} onChange={(v) => setNu({ ...nu, password: v })} error={formErrors.password} />
              <div className="mt-3">
                <label htmlFor="nrole" className="mb-1 block text-sm font-bold">Role</label>
                <select id="nrole" className={`${SELECT} w-full py-2`} value={nu.role} onChange={(e) => setNu({ ...nu, role: e.target.value })}>
                  {Object.entries(ROLE_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                </select>
                <label htmlFor="ndept" className="mb-1 mt-3 block text-sm font-bold">Department</label>
                <select id="ndept" className={`${SELECT} w-full py-2`} value={nu.departmentId} onChange={(e) => setNu({ ...nu, departmentId: e.target.value })}>
                  <option value="">None</option>
                  {departments.map((d) => <option key={d.id} value={d.id}>{d.code}</option>)}
                </select>
                {formErrors.departmentId && <p role="alert" className="mt-1 text-sm text-bad">{formErrors.departmentId}</p>}
              </div>
              <div className="mt-5 flex justify-end gap-2 border-t border-line pt-4 sm:col-span-2">
                <button type="button" className="btn-ghost" onClick={() => setCreateOpen(false)}>Cancel</button>
                <button type="submit" className="btn">Create account</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {registryOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm"
          role="dialog"
          aria-modal="true"
          aria-labelledby="import-registry-title"
          onClick={(e) => {
            if (e.target === e.currentTarget && !registryImporting) setRegistryOpen(false);
          }}
        >
          <div className="max-h-[90vh] w-full max-w-xl overflow-y-auto rounded-2xl border border-line bg-surf p-6 shadow-2xl">
            <div className="flex items-center justify-between border-b border-line pb-3">
              <h2 id="import-registry-title" className="text-xl font-bold">Import Student Registry (CSV)</h2>
              <button
                type="button"
                aria-label="Close modal"
                onClick={() => setRegistryOpen(false)}
                disabled={registryImporting}
                className="rounded-lg p-1 text-mute hover:bg-line hover:text-ink"
              >
                <X size={18} />
              </button>
            </div>

            <p className="mt-3 text-sm text-mute">
              Upload verified student enrollment records so students can sign up using their Enrollment No on the registration page.
            </p>

            <div className="mt-3 flex flex-wrap items-center justify-between gap-2 rounded-xl border border-line bg-bg p-3 text-xs">
              <span className="text-mute">
                Columns: <code className="text-ink">Name, Enrollment No, Registration No, Degree, Stream, Graduation Year</code>
              </span>
              <button
                type="button"
                className="btn-ghost text-xs"
                onClick={() => triggerCsvDownload(SAMPLE_REGISTRY_CSV, 'campusconnect-registry-template.csv')}
              >
                <Download size={13} aria-hidden="true" /> Sample CSV
              </button>
            </div>

            <form onSubmit={handleRegistryImport} noValidate className="mt-4 grid gap-3">
              <div>
                <label htmlFor="registry-csv-file" className="mb-1 block text-sm font-bold">
                  Choose Registry CSV file
                </label>
                <input
                  id="registry-csv-file"
                  type="file"
                  accept=".csv,text/csv"
                  className="block w-full text-sm file:mr-4 file:cursor-pointer file:rounded-lg file:border-0 file:bg-pri file:px-4 file:py-2 file:font-semibold file:text-onpri hover:file:opacity-90"
                  onChange={(e) => {
                    setRegistryFile(e.target.files?.[0] || null);
                    setRegistryError('');
                    setRegistryResult(null);
                  }}
                />
              </div>

              {registryError && <p role="alert" className="rounded-lg bg-badt p-3 text-sm text-bad">{registryError}</p>}

              {registryResult && (
                <div className="rounded-xl border border-line bg-bg p-3 text-sm">
                  <p className="font-bold text-ink">
                    Registry import complete: {registryResult.insertedCount ?? registryResult.createdCount ?? 0} added,{' '}
                    {registryResult.updatedCount ?? 0} updated, {registryResult.skippedCount ?? 0} skipped
                    {registryResult.totalRows != null ? ` (of ${registryResult.totalRows} rows)` : ''}
                  </p>
                  {registryResult.errors?.length > 0 && (
                    <ul className="mt-2 max-h-36 list-disc space-y-1 overflow-y-auto pl-5 text-xs text-bad">
                      {registryResult.errors.map((err, idx) => (
                        <li key={idx}>
                          Row {err.row} ({err.enrollmentNo || err.identifier || err.email || 'record'}): {err.reason}
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              )}

              <div className="mt-2 flex justify-end gap-2 border-t border-line pt-4">
                <button type="button" className="btn-ghost" onClick={() => setRegistryOpen(false)} disabled={registryImporting}>
                  Close
                </button>
                <button type="submit" className="btn" disabled={registryImporting || !registryFile}>
                  {registryImporting ? 'Importing…' : 'Import registry'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {importOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm"
          role="dialog"
          aria-modal="true"
          aria-labelledby="import-csv-title"
          onClick={(e) => {
            if (e.target === e.currentTarget && !importing) setImportOpen(false);
          }}
        >
          <div className="max-h-[90vh] w-full max-w-xl overflow-y-auto rounded-2xl border border-line bg-surf p-6 shadow-2xl">
            <div className="flex items-center justify-between border-b border-line pb-3">
              <h2 id="import-csv-title" className="text-xl font-bold">Bulk student import (CSV)</h2>
              <button
                type="button"
                aria-label="Close modal"
                onClick={() => setImportOpen(false)}
                disabled={importing}
                className="rounded-lg p-1 text-mute hover:bg-line hover:text-ink"
              >
                <X size={18} />
              </button>
            </div>

            <div className="mt-3 flex flex-wrap items-center justify-between gap-2 rounded-xl border border-line bg-bg p-3 text-xs">
              <span className="text-mute">
                Columns: <code className="text-ink">fullName, email, rollNumber, departmentCode, branch, graduationYear, cgpa, activeBacklogs</code>
              </span>
              <button
                type="button"
                className="btn-ghost text-xs"
                onClick={() => triggerCsvDownload(SAMPLE_CSV, 'campusconnect-students-template.csv')}
              >
                <Download size={13} aria-hidden="true" /> Sample CSV
              </button>
            </div>

            <form onSubmit={handleCsvImport} noValidate className="mt-4 grid gap-3">
              <Field
                id="csv-default-pw"
                label="Initial password for imported students"
                type="text"
                value={defaultPassword}
                onChange={setDefaultPassword}
              />

              <div>
                <label htmlFor="student-csv-file" className="mb-1 block text-sm font-bold">
                  Choose CSV file
                </label>
                <input
                  id="student-csv-file"
                  type="file"
                  accept=".csv,text/csv"
                  className="block w-full text-sm file:mr-4 file:cursor-pointer file:rounded-lg file:border-0 file:bg-pri file:px-4 file:py-2 file:font-semibold file:text-onpri hover:file:opacity-90"
                  onChange={(e) => {
                    setCsvFile(e.target.files?.[0] || null);
                    setImportError('');
                    setImportResult(null);
                  }}
                />
              </div>

              {importError && <p role="alert" className="rounded-lg bg-badt p-3 text-sm text-bad">{importError}</p>}

              {importResult && (
                <div className="rounded-xl border border-line bg-bg p-3 text-sm">
                  <p className="font-bold text-ink">
                    Import complete: {importResult.createdCount} created, {importResult.skippedCount} skipped (of {importResult.totalRows} rows)
                  </p>
                  {importResult.errors?.length > 0 && (
                    <ul className="mt-2 max-h-36 list-disc space-y-1 overflow-y-auto pl-5 text-xs text-bad">
                      {importResult.errors.map((err, idx) => (
                        <li key={idx}>
                          Row {err.row} ({err.email || 'no email'}): {err.reason}
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              )}

              <div className="mt-2 flex justify-end gap-2 border-t border-line pt-4">
                <button type="button" className="btn-ghost" onClick={() => setImportOpen(false)} disabled={importing}>
                  Close
                </button>
                <button type="submit" className="btn" disabled={importing || !csvFile}>
                  {importing ? 'Importing…' : 'Import students'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {docsTarget && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm"
          role="dialog"
          aria-modal="true"
          aria-labelledby="admin-docs-title"
          onClick={(e) => {
            if (e.target === e.currentTarget) setDocsTarget(null);
          }}
        >
          <div className="max-h-[90vh] w-full max-w-xl overflow-y-auto rounded-2xl border border-line bg-surf p-6 shadow-2xl">
            <div className="flex items-center justify-between border-b border-line pb-3">
              <div>
                <h2 id="admin-docs-title" className="text-xl font-bold">{docsTarget.fullName} — Documents</h2>
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