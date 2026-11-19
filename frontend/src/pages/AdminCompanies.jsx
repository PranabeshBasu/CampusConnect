import { useCallback, useEffect, useMemo, useState } from 'react';
import { Download, ExternalLink, Pencil, Plus, Upload, X } from 'lucide-react';
import {
  createCompany,
  importCompaniesCsv,
  listCompanies,
  setCompanyActive,
  updateCompany,
} from '../api/companies.js';
import CompanyLogo from '../components/CompanyLogo.jsx';
import Field from '../components/Field.jsx';
import FilterToolbar from '../components/FilterToolbar.jsx';
import KpiCard from '../components/KpiCard.jsx';
import { TableSkeleton } from '../components/Skeleton.jsx';

const EMPTY = { name: '', website: '', logoUrl: '', industry: '', description: '' };

function downloadTemplate() {
  const csv = [
    'name,website,industry,description',
    'Tata Consultancy Services,https://www.tcs.com,IT Services & Consulting,Global IT services and consulting firm',
    'IBM,https://www.ibm.com,Software & Cloud,Enterprise software and hybrid cloud provider',
  ].join('\n');
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'companies-template.csv';
  a.click();
  URL.revokeObjectURL(url);
}

export default function AdminCompanies() {
  const [companies, setCompanies] = useState(null);
  const [form, setForm] = useState(EMPTY);
  const [editingCompany, setEditingCompany] = useState(null);
  const [errors, setErrors] = useState({});
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [saving, setSaving] = useState(false);

  const [modalOpen, setModalOpen] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  const [csvFile, setCsvFile] = useState(null);
  const [importing, setImporting] = useState(false);
  const [importResult, setImportResult] = useState(null);

  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');

  const load = useCallback(async () => {
    try {
      setCompanies(await listCompanies());
      setError('');
    } catch (e) {
      setError(e.message);
      setCompanies([]);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  function openCreate() {
    setEditingCompany(null);
    setForm(EMPTY);
    setErrors({});
    setModalOpen(true);
  }

  function openEdit(c) {
    setEditingCompany(c);
    setForm({
      name: c.name || '',
      website: c.website || '',
      logoUrl: c.logoUrl || '',
      industry: c.industry || '',
      description: c.description || '',
    });
    setErrors({});
    setModalOpen(true);
  }

  async function saveCompany(e) {
    e.preventDefault();
    setNotice('');
    const name = form.name.trim();
    const website = form.website.trim();
    const logoUrl = form.logoUrl.trim();

    if (!name) {
      setErrors({ name: 'Enter the company name.' });
      return;
    }
    if (website && !/^https?:\/\/\S+$/.test(website)) {
      setErrors({ website: 'Use a full http:// or https:// address.' });
      return;
    }
    if (logoUrl && !/^https?:\/\/\S+$/.test(logoUrl)) {
      setErrors({ logoUrl: 'Use a full http:// or https:// image URL.' });
      return;
    }

    setErrors({});
    setSaving(true);
    const payload = {
      name,
      website: website || null,
      logoUrl: logoUrl || null,
      industry: form.industry.trim() || null,
      description: form.description.trim() || null,
    };

    try {
      if (editingCompany) {
        await updateCompany(editingCompany.id, payload);
        setNotice(`${name} updated.`);
      } else {
        await createCompany(payload);
        setNotice('Company added.');
      }
      setForm(EMPTY);
      setEditingCompany(null);
      setModalOpen(false);
      load();
    } catch (ex) {
      if (ex.status === 409) setErrors({ name: ex.message });
      else setError(ex.message);
    } finally {
      setSaving(false);
    }
  }

  async function handleImport(e) {
    e.preventDefault();
    if (!csvFile) return;
    setImporting(true);
    setError('');
    setImportResult(null);
    try {
      const res = await importCompaniesCsv(csvFile);
      setImportResult(res);
      setNotice(`Imported ${res.created} companies (${res.skipped} skipped).`);
      load();
    } catch (ex) {
      setError(ex.message);
    } finally {
      setImporting(false);
    }
  }

  async function toggle(c) {
    setNotice('');
    try {
      await setCompanyActive(c.id, !c.active);
      setNotice(`${c.name} ${c.active ? 'deactivated' : 'activated'}.`);
      load();
    } catch (ex) {
      setError(ex.message);
    }
  }

  const stats = useMemo(() => {
    const items = companies || [];
    const active = items.filter((c) => c.active).length;
    return { total: items.length, active, inactive: items.length - active };
  }, [companies]);

  const filteredCompanies = useMemo(() => {
    const q = search.trim().toLowerCase();
    return (companies || []).filter((c) => {
      if (statusFilter === 'active' && !c.active) return false;
      if (statusFilter === 'inactive' && c.active) return false;
      if (q) {
        const hay = `${c.name} ${c.industry || ''}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [companies, search, statusFilter]);

  const hasFilters = Boolean(search.trim() || statusFilter);

  return (
    <main className="mx-auto grid max-w-6xl gap-5 px-4 py-8 sm:px-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-3xl font-extrabold">Companies</h1>
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            className="btn-ghost"
            onClick={() => {
              setCsvFile(null);
              setImportResult(null);
              setImportOpen(true);
            }}
          >
            <Upload size={16} aria-hidden="true" /> Import CSV
          </button>
          <button type="button" className="btn" onClick={openCreate}>
            <Plus size={16} aria-hidden="true" /> Add company
          </button>
        </div>
      </div>

      {companies && (
        <div className="grid gap-4 sm:grid-cols-3">
          <KpiCard label="Total Companies" value={stats.total} />
          <KpiCard label="Active" value={stats.active} tone="ok" />
          <KpiCard label="Inactive" value={stats.inactive} tone="warn" />
        </div>
      )}

      <FilterToolbar
        search={search}
        onSearchChange={setSearch}
        searchPlaceholder="Search companies or industries…"
        hasActiveFilters={hasFilters}
        onReset={() => {
          setSearch('');
          setStatusFilter('');
        }}
      >
        <select
          aria-label="Filter by status"
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="rounded-lg border border-line bg-bg px-3 py-2 text-sm text-ink"
        >
          <option value="">All statuses</option>
          <option value="active">Active</option>
          <option value="inactive">Inactive</option>
        </select>
      </FilterToolbar>

      {notice && <p role="status" className="rounded-lg bg-okt p-3 text-sm text-ok">{notice}</p>}
      {error && <p role="alert" className="rounded-lg bg-badt p-3 text-sm text-bad">{error}</p>}

      <section className="card" aria-labelledby="company-list">
        <h2 id="company-list" className="text-lg font-bold">
          All companies{companies ? ` (${companies.length})` : ''}
        </h2>

        {companies === null && <div className="mt-3"><TableSkeleton rows={4} cols={4} /></div>}

        {companies && companies.length === 0 && (
          <p className="mt-3 text-sm text-mute">
            No companies yet. Add one or import a CSV before creating a placement drive.
          </p>
        )}

        {companies && companies.length > 0 && filteredCompanies.length === 0 && (
          <div className="mt-3 flex flex-wrap items-center justify-between gap-3 rounded-lg border border-line p-4">
            <p className="text-sm text-mute">No companies match your filters.</p>
            <button
              type="button"
              className="btn-ghost text-xs"
              onClick={() => {
                setSearch('');
                setStatusFilter('');
              }}
            >
              Reset filters
            </button>
          </div>
        )}

        {filteredCompanies.length > 0 && (
          <div className="mt-3 overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="text-mute">
                  <th className="py-2.5">Company</th>
                  <th>Industry</th>
                  <th>Status</th>
                  <th className="text-right">Action</th>
                </tr>
              </thead>
              <tbody>
                {filteredCompanies.map((c) => (
                  <tr key={c.id} className="border-t border-line transition-colors hover:bg-bg">
                    <td className="py-3 font-medium">
                      <div className="flex items-center gap-3">
                        <CompanyLogo
                          name={c.name}
                          website={c.website}
                          logoUrl={c.logoUrl}
                          className="h-9 w-9"
                        />
                        <div className="min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="font-semibold text-ink">{c.name}</span>
                            {c.website && (
                              <a
                                href={c.website}
                                target="_blank"
                                rel="noreferrer"
                                aria-label={`Visit ${c.name} website`}
                                className="text-mute hover:text-pri"
                              >
                                <ExternalLink size={13} aria-hidden="true" />
                              </a>
                            )}
                          </div>
                          {c.description && (
                            <p className="mt-0.5 line-clamp-1 text-xs font-normal text-mute">
                              {c.description}
                            </p>
                          )}
                        </div>
                      </div>
                    </td>
                    <td className="text-mute">{c.industry || '—'}</td>
                    <td>
                      <span className={`pill ${c.active ? 'bg-okt text-ok' : 'bg-line text-mute'}`}>
                        {c.active ? 'Active' : 'Inactive'}
                      </span>
                    </td>
                    <td className="text-right">
                      <div className="inline-flex items-center gap-2">
                        <button
                          type="button"
                          className="btn-ghost text-xs"
                          onClick={() => openEdit(c)}
                        >
                          <Pencil size={13} aria-hidden="true" /> Edit
                          <span className="sr-only"> {c.name}</span>
                        </button>
                        <button
                          type="button"
                          className="btn-ghost text-xs"
                          onClick={() => toggle(c)}
                        >
                          {c.active ? 'Deactivate' : 'Activate'}
                          <span className="sr-only"> {c.name}</span>
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {modalOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm"
          role="dialog"
          aria-modal="true"
          aria-labelledby="company-modal-title"
          onClick={(e) => {
            if (e.target === e.currentTarget) setModalOpen(false);
          }}
        >
          <div className="w-full max-w-xl rounded-2xl border border-line bg-surf p-6 shadow-2xl">
            <div className="flex items-center justify-between border-b border-line pb-3">
              <h2 id="company-modal-title" className="text-xl font-bold">
                {editingCompany ? `Edit ${editingCompany.name}` : 'Add a company'}
              </h2>
              <button
                type="button"
                aria-label="Close modal"
                onClick={() => setModalOpen(false)}
                className="rounded-lg p-1 text-mute hover:bg-line hover:text-ink"
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={saveCompany} noValidate className="mt-3 grid gap-x-4 sm:grid-cols-2">
              <Field
                id="cname"
                label="Name"
                value={form.name}
                onChange={(v) => setForm({ ...form, name: v })}
                error={errors.name}
              />
              <Field
                id="cweb"
                label="Website"
                placeholder="https://..."
                value={form.website}
                onChange={(v) => setForm({ ...form, website: v })}
                error={errors.website}
              />
              <Field
                id="clogo"
                label="Logo URL (optional)"
                placeholder="https://.../logo.png"
                value={form.logoUrl}
                onChange={(v) => setForm({ ...form, logoUrl: v })}
                error={errors.logoUrl}
              />
              <Field
                id="cind"
                label="Industry"
                placeholder="e.g. Software & Cloud"
                value={form.industry}
                onChange={(v) => setForm({ ...form, industry: v })}
              />
              <div className="sm:col-span-2">
                <Field
                  id="cdesc"
                  label="Description"
                  value={form.description}
                  onChange={(v) => setForm({ ...form, description: v })}
                />
              </div>
              <div className="mt-5 flex justify-end gap-2 border-t border-line pt-4 sm:col-span-2">
                <button type="button" className="btn-ghost" onClick={() => setModalOpen(false)}>
                  Cancel
                </button>
                <button type="submit" className="btn" disabled={saving}>
                  {saving ? 'Saving…' : editingCompany ? 'Save changes' : 'Add company'}
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
          aria-labelledby="import-companies-title"
          onClick={(e) => {
            if (e.target === e.currentTarget) setImportOpen(false);
          }}
        >
          <div className="w-full max-w-lg rounded-2xl border border-line bg-surf p-6 shadow-2xl">
            <div className="flex items-center justify-between border-b border-line pb-3">
              <h2 id="import-companies-title" className="text-xl font-bold">
                Bulk import companies (CSV)
              </h2>
              <button
                type="button"
                aria-label="Close modal"
                onClick={() => setImportOpen(false)}
                className="rounded-lg p-1 text-mute hover:bg-line hover:text-ink"
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleImport} className="mt-4 grid gap-4">
              <div className="rounded-xl border border-line bg-bg p-3 text-xs text-mute">
                <p className="font-semibold text-ink">Expected CSV columns:</p>
                <code className="mt-1 block text-pri">name,website,industry,description</code>
                <button
                  type="button"
                  onClick={downloadTemplate}
                  className="mt-2 inline-flex items-center gap-1.5 font-semibold text-pri hover:underline"
                >
                  <Download size={13} aria-hidden="true" /> Download sample template
                </button>
              </div>

              <div>
                <label htmlFor="company-csv-input" className="block text-sm font-medium text-ink">
                  Select CSV file
                </label>
                <input
                  id="company-csv-input"
                  type="file"
                  accept=".csv,text/csv"
                  onChange={(e) => setCsvFile(e.target.files?.[0] || null)}
                  className="mt-1.5 block w-full rounded-lg border border-line bg-bg px-3 py-2 text-sm text-ink"
                />
              </div>

              {importResult && (
                <div className="rounded-xl border border-line bg-bg p-3 text-sm">
                  <p className="font-semibold text-ok">
                    Created: {importResult.created} · Skipped: {importResult.skipped}
                  </p>
                  {importResult.errors?.length > 0 && (
                    <ul className="mt-2 max-h-32 list-disc overflow-y-auto pl-5 text-xs text-bad">
                      {importResult.errors.map((err, idx) => (
                        <li key={idx}>{err}</li>
                      ))}
                    </ul>
                  )}
                </div>
              )}

              <div className="flex justify-end gap-2 border-t border-line pt-4">
                <button type="button" className="btn-ghost" onClick={() => setImportOpen(false)}>
                  Close
                </button>
                <button type="submit" className="btn" disabled={!csvFile || importing}>
                  {importing ? 'Importing…' : 'Upload & import'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </main>
  );
}