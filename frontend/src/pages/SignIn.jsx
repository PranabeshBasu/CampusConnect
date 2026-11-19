import { useState } from 'react';
import { Link, Navigate, useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext.jsx';
import { homePathFor } from '../auth/roles.js';
import { validateEmail } from '../auth/validators.js';
import BrandLogo from '../components/BrandLogo.jsx';
import Field from '../components/Field.jsx';
import OAuthButtons from '../components/OAuthButtons.jsx';

const OAUTH_ERRORS = {
  not_registered:
    'No CampusConnect account matches that email. Register with your Enrollment No first, or link your personal Gmail inside your student profile.',
  disabled: 'Your account is disabled. Contact the placement cell.',
  missing_email: 'Your OAuth provider did not return an email address.',
  failed: 'Could not sign in with your external account. Please try again.',
};

export default function SignIn() {
  const { status, user, login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams] = useSearchParams();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [errors, setErrors] = useState({});
  const [formError, setFormError] = useState('');
  const [busy, setBusy] = useState(false);

  if (status === 'authenticated') return <Navigate to={homePathFor(user.role)} replace />;

  const oauthErrorKey = searchParams.get('oauthError');
  const oauthErrorMsg = oauthErrorKey ? OAUTH_ERRORS[oauthErrorKey] || OAUTH_ERRORS.failed : '';

  async function onSubmit(e) {
    e.preventDefault();
    const next = { email: validateEmail(email), password: password ? '' : 'Enter your password.' };
    setErrors(next);
    setFormError('');
    if (next.email || next.password) return;
    setBusy(true);
    try {
      const u = await login(email.trim(), password);
      navigate(homePathFor(u.role), { replace: true });
    } catch (err) {
      setFormError(err.status === 401 ? 'Invalid email or password.' : err.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="mx-auto max-w-md px-4 py-12">
      <div className="mb-6 text-center">
        <div className="mx-auto inline-flex items-center justify-center">
          <BrandLogo className="h-11 w-11" />
        </div>
        <h1 className="mt-4 text-3xl font-extrabold">Sign in</h1>
        <p className="mt-1 text-sm text-mute">
          Access your CampusConnect placement dashboard.
        </p>
      </div>

      {location.state?.registered && (
        <p role="status" className="mb-4 rounded-xl bg-okt p-3 text-sm text-ok">
          Account created. Sign in to continue.
        </p>
      )}

      <form onSubmit={onSubmit} noValidate className="card cc-glow-card">
        <Field
          id="email"
          label="Email"
          type="email"
          autoComplete="username"
          placeholder="you@iem.edu.in or you@uem.edu.in"
          value={email}
          onChange={setEmail}
          error={errors.email}
        />
        <Field
          id="password"
          label="Password"
          type="password"
          autoComplete="current-password"
          placeholder="Enter your password"
          value={password}
          onChange={setPassword}
          error={errors.password}
        />
        {(formError || oauthErrorMsg) && (
          <p role="alert" className="mt-3 rounded-lg bg-badt p-2.5 text-sm text-bad">
            {formError || oauthErrorMsg}
          </p>
        )}
        <button type="submit" className="btn mt-5 w-full justify-center" disabled={busy}>
          {busy ? 'Signing in…' : 'Sign in'}
        </button>

        <OAuthButtons />
      </form>

      <p className="mt-5 text-center text-sm text-mute">
        New student?{' '}
        <Link to="/register" className="font-bold text-pri hover:underline">
          Create an account
        </Link>
      </p>
    </main>
  );
}