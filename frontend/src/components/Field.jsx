import { useState } from 'react';
import { Eye, EyeOff } from 'lucide-react';

export default function Field({ id, label, error, value, onChange, type = 'text', ...rest }) {
  const [showPassword, setShowPassword] = useState(false);
  const isPassword = type === 'password';
  const inputType = isPassword && showPassword ? 'text' : type;

  return (
    <div className="mt-3">
      <label htmlFor={id} className="mb-1 block text-sm font-bold">{label}</label>
      <div className="relative">
        <input
          id={id}
          type={inputType}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          aria-invalid={error ? 'true' : undefined}
          aria-describedby={error ? `${id}-error` : undefined}
          className={`w-full rounded-lg border border-line bg-bg px-3 py-2 text-sm text-ink placeholder:text-mute focus:border-pri focus:outline-none ${
            isPassword ? 'pr-10' : ''
          }`}
          {...rest}
        />
        {isPassword && (
          <button
            type="button"
            onClick={() => setShowPassword((s) => !s)}
            aria-label={showPassword ? 'Hide password' : 'Show password'}
            className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-1 text-mute hover:text-ink"
          >
            {showPassword ? <EyeOff size={16} aria-hidden="true" /> : <Eye size={16} aria-hidden="true" />}
          </button>
        )}
      </div>
      {error && <p id={`${id}-error`} role="alert" className="mt-1 text-sm text-bad">{error}</p>}
    </div>
  );
}