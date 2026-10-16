import { cn } from './cn';

/* ── EmptyState ──────────────────────────────────────────────────────── */

type EmptyStateProps = {
  icon?: React.ReactNode;
  title: React.ReactNode;
  description?: React.ReactNode;
  action?: React.ReactNode;
  className?: string;
};

export function EmptyState({ icon, title, description, action, className }: EmptyStateProps) {
  return (
    <div className={cn('flex flex-col items-center border border-dashed border-line px-6 py-12 text-center font-brand', className)}>
      {icon && <div className="mb-4 inline-flex h-12 w-12 items-center justify-center bg-surface-muted text-primary">{icon}</div>}
      <h3 className="font-brand text-heading-lg uppercase text-primary">{title}</h3>
      {description && <p className="mt-2 max-w-sm text-body text-muted">{description}</p>}
      {action && <div className="mt-6">{action}</div>}
    </div>
  );
}

/* ── Skeletons ───────────────────────────────────────────────────────── */

export function Skeleton({ className }: { className?: string }) {
  return <div className={cn('animate-pulse bg-surface-muted', className)} />;
}

export function KPISkeleton() {
  return (
    <div className="grid grid-cols-2 gap-px border border-line bg-line lg:grid-cols-4">
      {[...Array(4)].map((_, i) => (
        <div key={i} className="space-y-3 bg-surface p-5">
          <Skeleton className="h-3 w-20" />
          <Skeleton className="h-8 w-24" />
          <Skeleton className="h-3 w-28" />
        </div>
      ))}
    </div>
  );
}

export function ListSkeleton({ rows = 5 }: { rows?: number }) {
  return (
    <div className="divide-y divide-line border border-line bg-surface">
      {[...Array(rows)].map((_, i) => (
        <div key={i} className="flex items-center gap-3 px-4 py-3.5">
          <Skeleton className="h-10 w-10" />
          <div className="flex-1 space-y-2">
            <Skeleton className="h-3.5 w-3/4" />
            <Skeleton className="h-3 w-1/2" />
          </div>
        </div>
      ))}
    </div>
  );
}

export function CardSkeleton() {
  return (
    <div className="border border-line bg-surface">
      <Skeleton className="aspect-[3/4] w-full" />
      <div className="space-y-2 p-3">
        <Skeleton className="h-3 w-1/3" />
        <Skeleton className="h-4 w-2/3" />
        <Skeleton className="h-3.5 w-1/4" />
      </div>
    </div>
  );
}

/* ── StatTile (KPI) ──────────────────────────────────────────────────── */

type StatTileProps = {
  label: React.ReactNode;
  value: React.ReactNode;
  hint?: React.ReactNode;
  /** e.g. "+12%" — rendered green when it starts with "+", muted otherwise. */
  delta?: string;
  icon?: React.ReactNode;
  tone?: 'default' | 'accent' | 'dark';
  className?: string;
};

export function StatTile({ label, value, hint, delta, icon, tone = 'default', className }: StatTileProps) {
  const toneClasses = {
    default: 'border border-line bg-surface text-primary',
    accent: 'bg-accent text-on-primary',
    dark: 'bg-primary text-on-primary',
  }[tone];
  const sub = tone === 'default' ? 'text-muted' : 'text-on-primary/70';
  return (
    <div className={cn('flex flex-col gap-2 p-5 font-brand', toneClasses, className)}>
      <div className="flex items-center justify-between gap-2">
        <p className={cn('text-label uppercase', sub)}>{label}</p>
        {icon && <span className={sub}>{icon}</span>}
      </div>
      <p className="text-heading-xl">{value}</p>
      {(hint || delta) && (
        <p className={cn('text-caption', sub)}>
          {delta && (
            <span className={cn('mr-1.5 font-medium', tone === 'default' && delta.startsWith('+') && 'text-success')}>{delta}</span>
          )}
          {hint}
        </p>
      )}
    </div>
  );
}
