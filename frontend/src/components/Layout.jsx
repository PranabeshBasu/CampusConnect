import { useEffect, useRef, useState } from 'react';
import {
  Briefcase,
  Building2,
  Calendar,
  Check,
  ChevronDown,
  ClipboardList,
  Compass,
  FileSearch,
  LogOut,
  Shield,
  User,
} from 'lucide-react';
import { Link, NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext.jsx';
import { ROLE_LABELS } from '../auth/roles.js';
import { getAvatar } from '../lib/avatarStorage.js';
import BrandLogo from './BrandLogo.jsx';
import NotificationBell from './NotificationBell.jsx';
import ThemeToggle from './ThemeToggle.jsx';

const NAV = {
  STUDENT: [
    { to: '/student', label: 'My account', end: true, icon: User },
    { to: '/student/drives', label: 'Drives', icon: Briefcase },
    { to: '/student/applications', label: 'Applications', icon: ClipboardList },
    { to: '/calendar', label: 'Calendar', icon: Calendar },
    { to: '/student/ats', label: 'Resume Analyzer', icon: FileSearch },
  ],
  DEPARTMENT_SPOC: [
    { to: '/spoc', label: 'Department', end: true, icon: Building2 },
    { to: '/spoc/applications', label: 'Applications', icon: ClipboardList },
    { to: '/calendar', label: 'Calendar', icon: Calendar },
  ],
  PLACEMENT_ADMIN: [
    { to: '/admin', label: 'Administration', end: true, icon: Shield },
    { to: '/admin/companies', label: 'Companies', icon: Building2 },
    { to: '/admin/drives', label: 'Drives', icon: Briefcase },
    { to: '/admin/applications', label: 'Applications', icon: ClipboardList },
    { to: '/calendar', label: 'Calendar', icon: Calendar },
  ],
};

function initials(name = '') {
  return (
    name
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((p) => p[0].toUpperCase())
      .join('') || 'U'
  );
}

export default function Layout() {
  const { status, user, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const [navOpen, setNavOpen] = useState(false);
  const [userOpen, setUserOpen] = useState(false);
  const [avatarUrl, setAvatarUrl] = useState('');

  const navRef = useRef(null);
  const userRef = useRef(null);

  useEffect(() => {
    if (!user?.email) {
      setAvatarUrl('');
      return;
    }
    const sync = () => setAvatarUrl(getAvatar(user.email));
    sync();
    window.addEventListener('cc-avatar-updated', sync);
    return () => window.removeEventListener('cc-avatar-updated', sync);
  }, [user?.email]);

  useEffect(() => {
    setNavOpen(false);
    setUserOpen(false);
  }, [location.pathname]);

  useEffect(() => {
    function handleOutside(e) {
      if (navRef.current && !navRef.current.contains(e.target)) {
        setNavOpen(false);
      }
      if (userRef.current && !userRef.current.contains(e.target)) {
        setUserOpen(false);
      }
    }
    function handleKey(e) {
      if (e.key === 'Escape') {
        setNavOpen(false);
        setUserOpen(false);
      }
    }
    document.addEventListener('mousedown', handleOutside);
    document.addEventListener('keydown', handleKey);
    return () => {
      document.removeEventListener('mousedown', handleOutside);
      document.removeEventListener('keydown', handleKey);
    };
  }, []);

  async function onSignOut() {
    setUserOpen(false);
    await logout();
    navigate('/', { replace: true });
  }

  const navItems = status === 'authenticated' ? NAV[user?.role] || [] : [];
  const activeItem = navItems.find((item) =>
    item.end
      ? location.pathname === item.to
      : location.pathname === item.to || location.pathname.startsWith(item.to + '/')
  );

  const ActiveIcon = activeItem?.icon || Compass;
  const triggerLabel = activeItem?.label || 'Portal menu';

  return (
    <div
      style={{
        paddingTop: 'env(safe-area-inset-top, 0px)',
        paddingBottom: 'env(safe-area-inset-bottom, 0px)',
      }}
    >
      <header className="sticky top-0 z-30 border-b border-line bg-surf/95 backdrop-blur-md">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-3 px-4 py-3 sm:px-6">
          <div className="flex min-w-0 items-center gap-3 sm:gap-4">
            <Link
              to="/"
              className="flex shrink-0 items-center gap-2 font-display text-lg font-extrabold text-ink sm:text-xl"
            >
              <BrandLogo className="h-7 w-7" />
              <span>
                Campus<span className="text-pri">Connect</span>
              </span>
            </Link>

            {status === 'authenticated' && navItems.length > 0 && (
              <div ref={navRef} className="relative">
                <button
                  type="button"
                  aria-haspopup="menu"
                  aria-expanded={navOpen}
                  onClick={() => {
                    setNavOpen((v) => !v);
                    setUserOpen(false);
                  }}
                  className={`inline-flex items-center gap-2 whitespace-nowrap rounded-full border px-3.5 py-1.5 text-sm font-medium shadow-sm transition-all duration-150 ${
                    navOpen
                      ? 'border-pri bg-prit text-ink'
                      : 'border-line bg-bg text-ink hover:border-pri hover:bg-prit'
                  }`}
                >
                  <ActiveIcon className="h-4 w-4 text-pri" />
                  <span>{triggerLabel}</span>
                  <ChevronDown
                    className={`h-4 w-4 text-mute transition-transform duration-150 ${
                      navOpen ? 'rotate-180 text-pri' : ''
                    }`}
                  />
                </button>

                {navOpen && (
                  <nav
                    aria-label="Portal navigation"
                    role="menu"
                    className="absolute left-0 z-50 mt-2 w-60 rounded-2xl border border-line bg-surf p-1.5 shadow-2xl"
                  >
                    <div className="mb-1 border-b border-line px-3 pb-2 pt-1.5 text-[11px] font-bold uppercase tracking-wider text-mute">
                      {ROLE_LABELS[user?.role] || 'Portal'}
                    </div>
                    <div className="space-y-1">
                      {navItems.map((item) => {
                        const Icon = item.icon;
                        return (
                          <NavLink
                            key={item.to}
                            to={item.to}
                            end={item.end}
                            role="menuitem"
                            onClick={() => setNavOpen(false)}
                            className={({ isActive }) =>
                              `group flex items-center justify-between gap-2.5 rounded-xl px-3 py-2 text-sm font-medium transition-all duration-150 ${
                                isActive
                                  ? 'bg-pri text-onpri shadow-sm'
                                  : 'text-ink hover:bg-prit'
                              }`
                            }
                          >
                            {({ isActive }) => (
                              <>
                                <span className="flex items-center gap-2.5">
                                  <Icon
                                    className={`h-4 w-4 shrink-0 transition-colors ${
                                      isActive ? 'text-onpri' : 'text-mute group-hover:text-pri'
                                    }`}
                                  />
                                  <span className="whitespace-nowrap">{item.label}</span>
                                </span>
                                {isActive && <Check className="h-4 w-4 shrink-0 text-onpri" />}
                              </>
                            )}
                          </NavLink>
                        );
                      })}
                    </div>
                  </nav>
                )}
              </div>
            )}
          </div>

          <div className="flex shrink-0 items-center gap-2 sm:gap-2.5">
            {status === 'authenticated' && user ? (
              <>
                <div ref={userRef} className="relative">
                  <button
                    type="button"
                    aria-haspopup="menu"
                    aria-expanded={userOpen}
                    onClick={() => {
                      setUserOpen((v) => !v);
                      setNavOpen(false);
                    }}
                    className={`inline-flex items-center gap-2 rounded-full border py-1 pl-1.5 pr-2.5 text-sm font-medium shadow-sm transition-all duration-150 ${
                      userOpen
                        ? 'border-pri bg-prit text-ink'
                        : 'border-line bg-bg text-ink hover:border-pri hover:bg-prit'
                    }`}
                  >
                    {avatarUrl ? (
                      <img
                        src={avatarUrl}
                        alt={user.fullName || 'User'}
                        className="h-7 w-7 rounded-full object-cover ring-1 ring-line"
                      />
                    ) : (
                      <span className="flex h-7 w-7 items-center justify-center rounded-full bg-pri text-xs font-bold text-onpri">
                        {initials(user.fullName)}
                      </span>
                    )}
                    <span className="hidden max-w-[140px] truncate sm:inline">
                      {user.fullName}
                    </span>
                    <ChevronDown
                      className={`h-4 w-4 text-mute transition-transform duration-150 ${
                        userOpen ? 'rotate-180 text-pri' : ''
                      }`}
                    />
                  </button>

                  {userOpen && (
                    <div
                      role="menu"
                      className="absolute right-0 z-50 mt-2 w-64 rounded-2xl border border-line bg-surf p-2 shadow-2xl"
                    >
                      <div className="rounded-xl border border-line bg-bg px-3 py-2.5">
                        <p className="truncate text-sm font-semibold text-ink">
                          {user.fullName}
                        </p>
                        <p className="truncate text-xs text-mute">{user.email}</p>
                        <span className="mt-2 inline-block rounded-full bg-prit px-2.5 py-0.5 text-[11px] font-bold text-pri">
                          {ROLE_LABELS[user.role] || user.role}
                        </span>
                      </div>
                      <button
                        type="button"
                        role="menuitem"
                        onClick={onSignOut}
                        className="mt-1.5 flex w-full items-center gap-2.5 rounded-xl px-3 py-2 text-left text-sm font-semibold text-bad transition-colors hover:bg-badt"
                      >
                        <LogOut className="h-4 w-4" />
                        <span>Sign out</span>
                      </button>
                    </div>
                  )}
                </div>

                <NotificationBell />
              </>
            ) : status === 'unauthenticated' ? (
              <>
                <Link to="/signin" className="btn-ghost whitespace-nowrap">
                  Sign in
                </Link>
                <Link to="/register" className="btn-ghost whitespace-nowrap">
                  Register
                </Link>
              </>
            ) : null}

            <ThemeToggle />
          </div>
        </div>
      </header>

      <Outlet />
    </div>
  );
}