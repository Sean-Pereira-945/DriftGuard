import type { ReactNode } from 'react';
import { Eyebrow } from './Panel';

/** One engraved reading in an instrument strip: a plate label, a large figure, an optional gauge, a note. */
export function Instrument({
  label,
  figure,
  figureTone = 'text-ink',
  note,
  children,
}: {
  label: string;
  figure: string;
  figureTone?: string;
  note?: ReactNode;
  children?: ReactNode;
}) {
  return (
    <div className="flex min-w-0 flex-col gap-1 p-4 sm:p-5">
      <Eyebrow>{label}</Eyebrow>
      <p className={`tabular font-display text-[52px] leading-[1.05] font-semibold ${figureTone}`}>{figure}</p>
      <div className="mt-auto">{children}</div>
      {note && <p className="text-sm text-muted">{note}</p>}
    </div>
  );
}

/** The strip that holds instruments: one panel divided by rules, not a grid of boxes. */
export function InstrumentStrip({ children, columns = 4, label }: { children: ReactNode; columns?: 3 | 4; label: string }) {
  return (
    <section
      aria-label={label}
      className={`grid animate-rise divide-y divide-hairline rounded-md border border-hairline bg-panel sm:grid-cols-2 sm:divide-y-0 ${columns === 4 ? 'lg:grid-cols-4' : 'lg:grid-cols-3'} lg:divide-x [&>*:nth-child(n+3)]:sm:border-t [&>*:nth-child(n+3)]:border-hairline lg:[&>*:nth-child(n+3)]:border-t-0`}
    >
      {children}
    </section>
  );
}
