import { useContext } from 'react';
import { Link } from 'react-router-dom';
import { AuthContext } from '../auth/AuthContext.jsx';
import { homePathFor } from '../auth/roles.js';
import BrandLogo from './BrandLogo.jsx';

export default function Footer() {
  const auth = useContext(AuthContext);
  const isSignedIn = auth?.status === 'authenticated' && auth?.user;

  return (
    <footer className="relative overflow-hidden bg-surf">
      <div
        aria-hidden="true"
        className="h-px w-full bg-gradient-to-r from-transparent via-indigo-500/40 to-transparent"
      />

      <div className="mx-auto grid max-w-6xl gap-8 px-4 py-10 sm:grid-cols-3 md:px-6">
        <div>
          <Link to="/" className="inline-flex items-center gap-2.5 font-display text-lg font-extrabold tracking-tight">
            <BrandLogo className="h-7 w-7 shrink-0" />
            <span>Campus<span className="text-pri">Connect</span></span>
          </Link>
          <p className="mt-3 max-w-xs text-sm text-mute">
            A unified placement portal for students, department coordinators, and the placement cell.
          </p>
        </div>

        <div>
          <h3 className="text-sm font-bold text-ink">Portals</h3>
          <ul className="mt-3 grid gap-2 text-sm text-mute">
            <li><Link to="/student" className="transition-colors hover:text-pri">Student Portal</Link></li>
            <li><Link to="/spoc" className="transition-colors hover:text-pri">Department SPOC</Link></li>
            <li><Link to="/admin" className="transition-colors hover:text-pri">Placement Admin</Link></li>
          </ul>
        </div>

        <div>
          <h3 className="text-sm font-bold text-ink">Get Started</h3>
          <ul className="mt-3 grid gap-2 text-sm text-mute">
            {isSignedIn ? (
              <li>
                <Link to={homePathFor(auth.user.role)} className="font-medium text-pri transition-colors hover:underline">
                  Open my dashboard →
                </Link>
              </li>
            ) : (
              <>
                <li><Link to="/signin" className="transition-colors hover:text-pri">Sign in</Link></li>
                <li><Link to="/register" className="transition-colors hover:text-pri">Register as a student</Link></li>
              </>
            )}
            <li><Link to="/student/ats" className="transition-colors hover:text-pri">ATS Resume Analyzer</Link></li>
          </ul>
        </div>
      </div>

      <div className="border-t border-line">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-2 px-4 py-4 text-xs text-mute md:px-6">
          <span>© {new Date().getFullYear()} CampusConnect. All rights reserved.</span>
          <span>Built for campus placements</span>
        </div>
      </div>
    </footer>
  );
}