import { useEffect, useState } from 'react';
import { ArrowRight, Building2, GraduationCap, UserCog } from 'lucide-react';
import { Link } from 'react-router-dom';
import { getPublicStats } from '../api/drives.js';
import { useAuth } from '../auth/AuthContext.jsx';
import { homePathFor } from '../auth/roles.js';
import AppShell from '../components/AppShell.jsx';
import CampusGallery from '../components/CampusGallery.jsx';
import Footer from '../components/Footer.jsx';
import OpenDrivesBoard from '../components/OpenDrivesBoard.jsx';

const ROLES = [
  { icon: GraduationCap, name: 'Students', text: 'Track every company and round, check eligibility, and improve your resume.' },
  { icon: UserCog, name: 'Department SPOCs', text: 'See your department’s students, applications, and placement progress.' },
  { icon: Building2, name: 'Placement Cell', text: 'Run drives, update round results, and monitor campus placement outcomes.' },
];

export default function Home() {
  const { status, user } = useAuth();
  const [stats, setStats] = useState(null);

  useEffect(() => {
    let alive = true;
    getPublicStats()
      .then((data) => {
        if (alive) setStats(data);
      })
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, []);

  return (
    <>
      <AppShell className="md:py-12">
        <div className="grid items-center gap-8 md:grid-cols-[1.1fr_1fr]">
          <div>
            <h1 className="text-4xl font-extrabold leading-tight md:text-5xl">
              One place for every placement round.
            </h1>
            <p className="mt-4 max-w-prose text-lg text-mute">
              Students, department coordinators and the placement cell work from one shared record instead of spreadsheets and email threads.
            </p>
            <div className="mt-6 flex flex-wrap items-center gap-3">
              {status === 'authenticated' ? (
                <Link to={homePathFor(user.role)} className="btn">
                  Open my dashboard <ArrowRight size={16} aria-hidden="true" />
                </Link>
              ) : (
                <>
                  <Link to="/signin" className="btn">Sign in</Link>
                  <Link to="/register" className="btn-ghost">Register as a student</Link>
                </>
              )}
            </div>
          </div>

          <div className="grid content-start gap-4">
            <OpenDrivesBoard className="cc-glow-card" />
            <section className="card cc-glow-card" aria-labelledby="snapshot-heading">
              <h2 id="snapshot-heading" className="text-base font-bold">Placement Snapshot</h2>
              <div className="mt-4 grid grid-cols-3 divide-x divide-line text-center">
                <div className="px-2">
                  <p className="font-display text-2xl font-extrabold text-ink">
                    {stats ? stats.activeDrives : '—'}
                  </p>
                  <p className="mt-0.5 text-xs text-mute">Active Drives</p>
                </div>
                <div className="px-2">
                  <p className="font-display text-2xl font-extrabold text-pri">
                    {stats ? stats.registeredCompanies : '—'}
                  </p>
                  <p className="mt-0.5 text-xs text-mute">Participating Companies</p>
                </div>
                <div className="px-2">
                  <p className="font-display text-2xl font-extrabold text-ok">
                    {stats?.eligibleStudents ?? '—'}
                  </p>
                  <p className="mt-0.5 text-xs text-mute">Eligible Students</p>
                </div>
              </div>
            </section>
          </div>
        </div>

        <ul className="mt-10 grid gap-4 md:grid-cols-3">
          {ROLES.map(({ icon: Icon, name, text }) => (
            <li key={name} className="card cc-glow-card flex gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-prit text-pri">
                <Icon size={20} aria-hidden="true" />
              </div>
              <div>
                <h3 className="text-base font-bold">{name}</h3>
                <p className="mt-0.5 text-sm text-mute">{text}</p>
              </div>
            </li>
          ))}
        </ul>
      </AppShell>

      <CampusGallery />
      <Footer />
    </>
  );
}