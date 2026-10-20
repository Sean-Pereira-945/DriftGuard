/** DriftGuard mark: a signal post with a lit lamp beside a track (same geometry as public/driftguard.svg). */
export function LogoMark({ className = 'size-7' }: { className?: string }) {
  return (
    <svg viewBox="0 0 32 32" fill="none" aria-hidden className={className}>
      <rect x="2" y="2" width="28" height="28" rx="4" fill="#111C19" stroke="#ECE4C6" strokeWidth="2" />
      <path d="M6 22.5h20" stroke="#ECE4C6" strokeWidth="2" strokeLinecap="round" />
      <path d="M9 25.5v-6M14 25.5v-6M19 25.5v-6M24 25.5v-6" stroke="#ECE4C6" strokeOpacity="0.45" strokeWidth="1.5" strokeLinecap="round" />
      <path d="M21 17V9" stroke="#ECE4C6" strokeWidth="2" strokeLinecap="round" />
      <circle cx="21" cy="8" r="3.4" fill="#FF6350" />
    </svg>
  );
}

export function Logo({ className = '' }: { className?: string }) {
  return (
    <span className={`inline-flex items-center gap-2.5 ${className}`}>
      <LogoMark />
      <span className="font-display text-[22px] font-bold tracking-[0.02em] text-ink">DriftGuard</span>
    </span>
  );
}
