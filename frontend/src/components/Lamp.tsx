import type { Severity } from '../types';

export type LampState = Severity | 'idle';

const LAMP: Record<LampState, string> = {
  critical: 'bg-coral lamp-critical',
  warning: 'bg-amber',
  stable: 'bg-green',
  idle: 'bg-faint',
};

const SIZES = { sm: 'size-2.5', md: 'size-4', lg: 'size-7' } as const;

/** A lit lamp. Decorative: the state is always also written in words beside it. */
export function Lamp({ state, size = 'md', className = '' }: { state: LampState; size?: keyof typeof SIZES; className?: string }) {
  return (
    <span
      aria-hidden
      className={`inline-block shrink-0 rounded-full ring-2 ring-black/40 ring-offset-0 ${SIZES[size]} ${LAMP[state]} ${className}`}
    />
  );
}

const RANK: Record<LampState, number> = { idle: 0, stable: 1, warning: 2, critical: 3 };

/** The more severe of two states, so one lamp can summarise drift and agent health. */
export function worst(a: LampState, b: LampState): LampState {
  return RANK[a] >= RANK[b] ? a : b;
}
