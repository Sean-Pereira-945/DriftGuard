/** The DriftGuard wordmark. Text only: there is no symbol. */
export function Logo({ className = '' }: { className?: string }) {
  return <span className={`font-display text-[26px] leading-none font-bold tracking-[0.02em] text-ink ${className}`}>DriftGuard</span>;
}
