export default function BrandLogo({ className = 'h-8 w-8' }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 64 64"
      fill="none"
      className={className}
      aria-hidden="true"
    >
      <defs>
        <linearGradient id="cc-nav-grad" x1="12" y1="52" x2="52" y2="12" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#8B5CF6" />
          <stop offset="50%" stopColor="#6366F1" />
          <stop offset="100%" stopColor="#38BDF8" />
        </linearGradient>
      </defs>
      <rect width="64" height="64" rx="16" fill="#0B1120" stroke="#1E293B" strokeWidth="2" />
      <path
        d="M41 21L35 16H25L17 24V40L25 48H35L41 43"
        stroke="url(#cc-nav-grad)"
        strokeWidth="3.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M38 25L33.5 21.5H27L22.5 26V38L27 42.5H33.5L38 39"
        stroke="url(#cc-nav-grad)"
        strokeWidth="3.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <circle cx="44" cy="21" r="3.5" fill="#0B1120" stroke="url(#cc-nav-grad)" strokeWidth="3" />
      <circle cx="44" cy="43" r="3.5" fill="#0B1120" stroke="url(#cc-nav-grad)" strokeWidth="3" />
    </svg>
  );
}