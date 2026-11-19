import { useEffect, useState } from 'react';
import { ArrowRight } from 'lucide-react';
import { Link } from 'react-router-dom';
import { listPublicDrives } from '../api/drives.js';
import { useAuth } from '../auth/AuthContext.jsx';
import CompanyLogo from './CompanyLogo.jsx';

const DRIVES_PATH = {
  STUDENT: '/student/drives',
  PLACEMENT_ADMIN: '/admin/drives',
  DEPARTMENT_SPOC: '/spoc/applications',
};

export default function OpenDrivesBoard({ className = '' }) {
  const { status, user } = useAuth();
  const [data, setData] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    let alive = true;
    listPublicDrives(0, 4)
      .then((result) => alive && setData(result))
      .catch((e) => {
        if (!alive) return;
        setError(e.message || 'Unable to load placement drives.');
        setData({ items: [] });
      });
    return () => {
      alive = false;
    };
  }, []);

  const viewAllTo = status === 'authenticated' ? DRIVES_PATH[user?.role] || '/' : '/signin';
  const items = data?.items ?? [];

  return (
    <section className={`card ${className}`} aria-labelledby="open-drives-heading">
      <div className="flex items-center justify-between gap-3">
        <h2 id="open-drives-heading" className="text-base font-bold">Open Placement Drives</h2>
        <Link
          to={viewAllTo}
          className="inline-flex items-center gap-1 text-xs font-semibold text-pri hover:underline"
        >
          View all drives <ArrowRight size={12} aria-hidden="true" />
        </Link>
      </div>

      {data === null && (
        <ul className="mt-4 grid gap-3" role="status" aria-label="Loading drives">
          {[0, 1].map((i) => (
            <li key={i} className="flex animate-pulse items-center gap-3 rounded-xl border border-line p-3">
              <div className="h-10 w-10 rounded-lg bg-line" />
              <div className="flex-1 space-y-2">
                <div className="h-3.5 w-1/3 rounded bg-line" />
                <div className="h-3 w-2/3 rounded bg-line" />
              </div>
            </li>
          ))}
        </ul>
      )}

      {error && (
        <p role="alert" className="mt-3 rounded-lg bg-badt p-3 text-sm text-bad">{error}</p>
      )}

      {data && items.length === 0 && !error && (
        <p className="mt-4 rounded-xl border border-dashed border-line p-4 text-center text-sm text-mute">
          No placement drives are currently open.
        </p>
      )}

      {items.length > 0 && (
        <ul className="mt-4 grid gap-3">
          {items.map((drive) => (
            <li
              key={drive.id}
              className="flex items-center gap-3 rounded-xl border border-line bg-bg p-3 transition-colors hover:border-pri"
            >
              <CompanyLogo
                name={drive.companyName}
                website={drive.companyWebsite}
                logoUrl={drive.companyLogoUrl}
              />
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-bold text-ink">{drive.companyName}</p>
                <p className="truncate text-xs text-mute">
                  {drive.title}
                  {drive.ctcLpa != null ? ` • ${drive.ctcLpa} LPA` : ''}
                  {drive.graduationYear ? ` • Batch ${drive.graduationYear}` : ''}
                </p>
              </div>
              <span className="pill shrink-0 bg-okt text-ok">Active</span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}