import { useEffect, useState } from 'react';

function initials(name = '') {
  return (
    name
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((p) => p[0].toUpperCase())
      .join('') || '?'
  );
}

function extractDomain(website) {
  if (!website) return '';
  try {
    const normalized = /^https?:\/\//i.test(website.trim())
      ? website.trim()
      : `https://${website.trim()}`;
    return new URL(normalized).hostname.replace(/^www\./, '');
  } catch {
    return '';
  }
}

export default function CompanyLogo({ name, website, logoUrl: customLogoUrl, className = 'h-10 w-10' }) {
  const domain = extractDomain(website);
  const sources = [
    ...(customLogoUrl?.trim() ? [customLogoUrl.trim()] : []),
    ...(domain
      ? [
          `https://icons.duckduckgo.com/ip3/${encodeURIComponent(domain)}.ico`,
          `https://www.google.com/s2/favicons?domain=${encodeURIComponent(domain)}&sz=128`,
        ]
      : []),
  ];

  const [idx, setIdx] = useState(0);

  useEffect(() => {
    setIdx(0);
  }, [customLogoUrl, domain]);

  const logoUrl = sources[idx] || '';

  if (!logoUrl) {
    return (
      <span
        aria-hidden="true"
        className={`flex shrink-0 items-center justify-center rounded-lg bg-prit text-sm font-bold text-pri ${className}`}
      >
        {initials(name)}
      </span>
    );
  }

  return (
    <span
      className={`flex shrink-0 items-center justify-center overflow-hidden rounded-lg border border-line bg-white p-1.5 ${className}`}
    >
      <img
        src={logoUrl}
        alt={`${name || 'Company'} logo`}
        className="h-full w-full object-contain"
        loading="lazy"
        onLoad={(e) => {
          if (idx === sources.length - 1 && domain && e.currentTarget.naturalWidth <= 16) {
            setIdx((prev) => prev + 1);
          }
        }}
        onError={() => setIdx((prev) => prev + 1)}
      />
    </span>
  );
}