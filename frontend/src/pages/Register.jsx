import { useMemo, useState } from 'react';
import { Check, CheckCircle2, Circle, Lock } from 'lucide-react';
import { Link, Navigate, useNavigate } from 'react-router-dom';
import { apiRequest } from '../api/client.js';
import { useAuth } from '../auth/AuthContext.jsx';
import { homePathFor } from '../auth/roles.js';
import { validateEmail, validatePassword } from '../auth/validators.js';
import BrandLogo from '../components/BrandLogo.jsx';
import Field from '../components/Field.jsx';

function isCollegeEmail(email = '') {
  const lower = email.trim().toLowerCase();
  return lower.endsWith('@iem.edu.in') || lower.endsWith('@uem.edu.in');
}

export default function Register() {
  const { status, user, register } = useAuth();
  const navigate = useNavigate();

  const [enrollmentNo, setEnrollmentNo] = useState('');
  const [lookupBusy, setLookupBusy] = useState(false);
  const [lookupError, setLookupError] = useState('');
  const [verifiedStudent, setVerifiedStudent] = useState(null);

  const [form, setForm] = useState({ email: '', password: '', confirm: '' });
  const [errors, setErrors] = useState({});
  const [formError, setFormError] = useState('');
  const [busy, setBusy] = useState(false);

  const set = (k) => (v) => {
    setForm((f) => ({ ...f, [k]: v }));
    setErrors((prev) => (prev[k] ? { ...prev, [k]: '' } : prev));
  };

  const trimmedEmail = form.email.trim();
  const liveEmailError =
    trimmedEmail.includes('@') && trimmedEmail.split('@')[1]?.includes('.') && !isCollegeEmail(trimmedEmail)
      ? 'Use your @iem.edu.in or @uem.edu.in email address.'
      : '';

  const rules = useMemo(() => {
    const p = form.password || '';
    return {
      length: p.length >= 10 && p.length <= 72,
      letter: /[A-Za-z]/.test(p),
      digit: /\d/.test(p),
    };
  }, [form.password]);

  const strengthCount = [rules.length, rules.letter, rules.digit].filter(Boolean).length;
  const barColor = strengthCount === 3 ? 'bg-ok' : strengthCount === 2 ? 'bg-warn' : 'bg-bad';

  if (status === 'authenticated') return <Navigate to={homePathFor(user.role)} replace />;

  async function verifyEnrollment(e) {
    e.preventDefault();
    const trimmed = enrollmentNo.trim();
    if (!trimmed) {
      setLookupError('Enter your enrollment number.');
      return;
    }
    setLookupError('');
    setLookupBusy(true);
    try {
      const data = await apiRequest(`/auth/enrollment-lookup?enrollmentNo=${encodeURIComponent(trimmed)}`);
      setVerifiedStudent(data);
    } catch (err) {
      setVerifiedStudent(null);
      setLookupError(err.message || 'Could not verify enrollment number.');
    } finally {
      setLookupBusy(false);
    }
  }

  async function onSubmit(e) {
    e.preventDefault();
    if (!verifiedStudent) return;

    const emailErr =
      validateEmail(form.email) ||
      (!isCollegeEmail(form.email) ? 'Use your @iem.edu.in or @uem.edu.in email address.' : '');

    const next = {
      email: emailErr,
      password: validatePassword(form.password),
      confirm: form.confirm === form.password ? '' : 'Passwords do not match.',
    };
    setErrors(next);
    setFormError('');
    if (Object.values(next).some(Boolean)) return;

    setBusy(true);
    try {
      await register({
        enrollmentNo: verifiedStudent.enrollmentNo,
        fullName: verifiedStudent.fullName,
        email: form.email.trim(),
        password: form.password,
      });
      navigate('/signin', { replace: true, state: { registered: true } });
    } catch (err) {
      if (err.status === 409) setErrors({ email: err.message });
      else setFormError(err.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="mx-auto max-w-md px-4 py-10">
      <div className="mb-6 text-center">
        <div className="mx-auto inline-flex items-center justify-center">
          <BrandLogo className="h-11 w-11" />
        </div>
        <h1 className="mt-4 text-3xl font-extrabold">Create a student account</h1>
        <p className="mt-1 text-sm text-mute">
          Verify your college enrollment number first, then register with your @iem.edu.in or @uem.edu.in email.
        </p>
      </div>

      <div className="card cc-glow-card space-y-5">
        <form onSubmit={verifyEnrollment} noValidate>
          <div className="flex items-end gap-2">
            <div className="flex-1">
              <Field
                id="enrollmentNo"
                label="Enrollment number"
                placeholder="e.g. 12023002028154"
                value={enrollmentNo}
                disabled={Boolean(verifiedStudent)}
                onChange={(v) => setEnrollmentNo(v)}
                error={lookupError}
              />
            </div>
            {verifiedStudent ? (
              <button
                type="button"
                className="btn-ghost mb-0.5"
                onClick={() => {
                  setVerifiedStudent(null);
                  setLookupError('');
                }}
              >
                Change
              </button>
            ) : (
              <button type="submit" className="btn mb-0.5" disabled={lookupBusy}>
                {lookupBusy ? 'Checking…' : 'Verify'}
              </button>
            )}
          </div>
        </form>

        {verifiedStudent ? (
          <div className="rounded-xl border border-ok bg-okt p-3 text-xs text-ink">
            <p className="flex items-center gap-1.5 font-bold text-ok">
              <CheckCircle2 size={14} aria-hidden="true" /> Student record verified
            </p>
            <div className="mt-2 grid grid-cols-2 gap-x-3 gap-y-1">
              <div><span className="text-mute">Name:</span> <span className="font-semibold">{verifiedStudent.fullName}</span></div>
              <div><span className="text-mute">Reg No:</span> <span className="font-semibold">{verifiedStudent.registrationNo}</span></div>
              <div><span className="text-mute">Degree:</span> <span className="font-semibold">{verifiedStudent.department}</span></div>
              <div><span className="text-mute">Stream:</span> <span className="font-semibold">{verifiedStudent.stream}</span></div>
            </div>
          </div>
        ) : (
          <div className="flex items-center gap-2 rounded-xl border border-dashed border-line p-3 text-xs text-mute">
            <Lock size={14} className="shrink-0" aria-hidden="true" />
            <span>College email and password fields unlock once your enrollment number is verified.</span>
          </div>
        )}

        {verifiedStudent && (
          <form onSubmit={onSubmit} noValidate>
            <Field
              id="email"
              label="College email (@iem.edu.in or @uem.edu.in)"
              type="email"
              autoComplete="email"
              placeholder="name@iem.edu.in"
              value={form.email}
              onChange={set('email')}
              error={errors.email || liveEmailError}
            />
            <Field
              id="password"
              label="Password"
              type="password"
              autoComplete="new-password"
              placeholder="Minimum 10 characters"
              value={form.password}
              onChange={set('password')}
              error={errors.password}
            />

            <div className="mt-2.5 space-y-1.5">
              <div className="grid grid-cols-3 gap-1.5" aria-hidden="true">
                {[0, 1, 2].map((idx) => (
                  <div
                    key={idx}
                    className={`h-1.5 rounded-full transition-colors ${
                      idx < strengthCount ? barColor : 'bg-line'
                    }`}
                  />
                ))}
              </div>
              <ul className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-mute">
                {[
                  ['10–72 chars', rules.length],
                  ['1 letter', rules.letter],
                  ['1 digit', rules.digit],
                ].map(([label, ok]) => (
                  <li key={label} className={`inline-flex items-center gap-1 ${ok ? 'text-ok' : ''}`}>
                    {ok ? <Check size={12} aria-hidden="true" /> : <Circle size={10} aria-hidden="true" />}
                    {label}
                  </li>
                ))}
              </ul>
            </div>

            <Field
              id="confirm"
              label="Confirm password"
              type="password"
              autoComplete="new-password"
              placeholder="Re-enter your password"
              value={form.confirm}
              onChange={set('confirm')}
              error={errors.confirm}
            />
            {formError && <p role="alert" className="mt-3 rounded-lg bg-badt p-2.5 text-sm text-bad">{formError}</p>}
            <button type="submit" className="btn mt-5 w-full justify-center" disabled={busy}>
              {busy ? 'Creating account…' : 'Create account'}
            </button>
          </form>
        )}
      </div>

      <p className="mt-5 text-center text-sm text-mute">
        Already registered?{' '}
        <Link to="/signin" className="font-bold text-pri hover:underline">
          Sign in
        </Link>
      </p>
    </main>
  );
}