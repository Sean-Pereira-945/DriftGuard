import type { ReactNode } from 'react';

interface PanelProps {
  title?: string;
  description?: ReactNode;
  actions?: ReactNode;
  children: ReactNode;
  className?: string;
  bodyClassName?: string;
  id?: string;
  /**
   * `plate` names the panel with an engraved plate label over a sleeper rule, like an
   * instrument, so a chart or list below the Overview's first screen reads as part of the
   * same desk rather than a separate card. The default keeps the 22px title.
   */
  variant?: 'default' | 'plate';
}

export function Panel({
  title,
  description,
  actions,
  children,
  className = '',
  bodyClassName = 'p-4 sm:p-5',
  id,
  variant = 'default',
}: PanelProps) {
  const headingId = id ? `${id}-title` : undefined;
  const plate = variant === 'plate';
  return (
    <section
      id={id}
      aria-labelledby={title ? headingId : undefined}
      className={`min-w-0 animate-rise rounded-md border border-hairline bg-panel ${className}`}
    >
      {(title || actions) && (
        <header
          className={`flex flex-wrap items-start justify-between gap-3 px-4 sm:px-5 ${plate ? 'pt-4 pb-3 sm:pt-5' : 'border-b border-hairline py-3'}`}
        >
          <div className="min-w-0">
            {title && (
              <h2 id={headingId} className={plate ? 'plate-label text-muted' : 'text-[22px] font-semibold'}>
                {title}
              </h2>
            )}
            {description && <p className={`mt-0.5 ${plate ? 'text-[15px] text-body' : 'text-sm text-muted'}`}>{description}</p>}
          </div>
          {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
        </header>
      )}
      {plate && (title || actions) && <div aria-hidden className="sleepers mx-4 h-px sm:mx-5" />}
      <div className={bodyClassName}>{children}</div>
    </section>
  );
}

export function PageHeader({ title, description, actions }: { title: string; description?: ReactNode; actions?: ReactNode }) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
      <div className="min-w-0">
        <h1 className="text-[38px] font-bold">{title}</h1>
        {description && <div className="mt-1 text-[15px] text-muted">{description}</div>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </div>
  );
}

/** An engraved plate label for metric names and field groups. */
export function Eyebrow({ children, className = '' }: { children: ReactNode; className?: string }) {
  return <span className={`plate-label text-muted ${className}`}>{children}</span>;
}
