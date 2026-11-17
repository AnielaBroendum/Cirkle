'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { cn } from './cn';

/*
 * Portals v2 screen pieces (Figma "Portals v2 · Dynamic", 358:151): page header, panel,
 * segmented switch, metric tile and scan bar. Used inside `.portal-dark`, so `primary` is
 * the light #F3EFE8 and `on-primary` Obsidian. Figma's 10–11px meta text is 12px here
 * (nothing under 12px) and Smoke instead of Char (Char is never text).
 */

export const portalPanel = 'border border-line-dark-subtle bg-obsidian font-brand';

/** Today in Copenhagen, e.g. "Friday 13 November". Rendered after mount so server and client agree. */
export function useToday() {
  const [today, setToday] = useState('');
  useEffect(
    () =>
      setToday(
        new Intl.DateTimeFormat('en-GB', { weekday: 'long', day: 'numeric', month: 'long', timeZone: 'Europe/Copenhagen' }).format(
          new Date()
        )
      ),
    []
  );
  return today;
}

type PageHeaderProps = {
  title: React.ReactNode;
  subtitle?: React.ReactNode;
  /** Small line above the title; defaults to today's date. Pass a node (e.g. a breadcrumb) to replace it. */
  eyebrow?: React.ReactNode;
  actions?: React.ReactNode;
  className?: string;
};

export function PageHeader({ title, subtitle, eyebrow, actions, className }: PageHeaderProps) {
  const today = useToday();
  return (
    <div className={cn('flex flex-col gap-4 font-brand md:flex-row md:items-end md:justify-between', className)}>
      <div className="min-w-0">
        <div className="min-h-4 text-caption text-smoke">{eyebrow ?? today}</div>
        <h1 className="mt-1.5 text-heading-xl font-medium tracking-[-0.6px] text-flare lg:text-display lg:tracking-[-0.72px]">
          {title}
        </h1>
        {subtitle && <p className="mt-1.5 text-body-sm text-ash">{subtitle}</p>}
      </div>
      {actions && <div className="flex shrink-0 flex-wrap gap-3">{actions}</div>}
    </div>
  );
}

export function Panel({ className, ...props }: React.HTMLAttributes<HTMLElement>) {
  return <section className={cn(portalPanel, 'p-5 lg:p-6', className)} {...props} />;
}

export function PanelHeader({
  title,
  subtitle,
  action,
  className,
}: {
  title: React.ReactNode;
  subtitle?: React.ReactNode;
  action?: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn('flex flex-wrap items-start justify-between gap-3', className)}>
      <div className="min-w-0">
        <h2 className="text-body-lg font-semibold text-flare">{title}</h2>
        {subtitle && <p className="mt-1 text-caption text-smoke">{subtitle}</p>}
      </div>
      {action && <div className="shrink-0">{action}</div>}
    </div>
  );
}

export type SegmentItem = { value: string; label: React.ReactNode };

/** Figma v2 segmented switch: near-black track, light active segment. */
export function Segmented({
  items,
  value,
  onValueChange,
  label,
  className,
}: {
  items: SegmentItem[];
  value: string;
  onValueChange: (value: string) => void;
  label?: string;
  className?: string;
}) {
  return (
    <div role="tablist" aria-label={label} className={cn('inline-flex max-w-full gap-0.5 overflow-x-auto bg-canvas-dark p-1 font-brand', className)}>
      {items.map((item) => {
        const on = item.value === value;
        return (
          <button
            key={item.value}
            type="button"
            role="tab"
            aria-selected={on}
            onClick={() => onValueChange(item.value)}
            className={cn(
              'whitespace-nowrap px-3.5 py-[7px] text-caption font-medium transition-colors',
              on ? 'bg-primary text-on-primary' : 'text-ash hover:text-flare'
            )}
          >
            {item.label}
          </button>
        );
      })}
    </div>
  );
}

/** Metric tile (Product library, Returns). `flame` = the highlighted first tile. */
export function MetricTile({
  label,
  value,
  hint,
  flame,
  className,
}: {
  label: React.ReactNode;
  value: React.ReactNode;
  hint?: React.ReactNode;
  flame?: boolean;
  className?: string;
}) {
  return (
    <div
      className={cn(
        'flex min-w-0 flex-col gap-1.5 p-5 font-brand',
        flame ? 'bg-flame-gradient text-flare' : portalPanel,
        className
      )}
    >
      <p className={cn('text-caption', flame ? 'text-flare' : 'text-smoke')}>{label}</p>
      <p className="truncate text-heading-lg font-medium text-flare lg:text-heading-xl">{value}</p>
      {hint && <p className={cn('text-caption', flame ? 'text-flare' : 'text-smoke')}>{hint}</p>}
    </div>
  );
}

/** Horizontal bar with the number after it (Scans columns). */
export function ScanBar({ value, max, className }: { value: number | null; max: number; className?: string }) {
  const pct = value && max > 0 ? Math.max(3, (value / max) * 100) : 0;
  return (
    <div className={cn('flex items-center gap-2', className)}>
      <div className="h-1.5 w-[70px] shrink-0 bg-surface-dark">
        <div className="h-1.5 bg-flaym-progress" style={{ width: `${pct}%` }} />
      </div>
      <span className="text-caption font-medium tabular-nums text-flare">{value === null ? '–' : value.toLocaleString('en-GB')}</span>
    </div>
  );
}

/** Square ↗ / action link used on panels. */
export function ArrowLink({ href, label, round, className }: { href: string; label: string; round?: boolean; className?: string }) {
  return (
    <Link
      href={href}
      aria-label={label}
      className={cn(
        'flex h-9 w-9 shrink-0 items-center justify-center text-body text-ash transition-colors hover:text-flare',
        round ? 'rounded-pill border border-flare/10 hover:border-flare/30' : 'bg-surface-dark',
        className
      )}
    >
      ↗
    </Link>
  );
}

/** Small square tag: "31 sold", "Too big". */
export function Chip({ className, ...props }: React.HTMLAttributes<HTMLSpanElement>) {
  return <span className={cn('inline-flex items-center gap-1.5 bg-surface-dark px-2.5 py-1 text-caption font-medium text-ash', className)} {...props} />;
}

/** Placeholder thumbnail when a product or store has no image (Figma's gradient square). */
export function Thumb({ src, alt = '', size = 32, className }: { src?: string | null; alt?: string; size?: number; className?: string }) {
  return src ? (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={src} alt={alt} width={size} height={size} className={cn('shrink-0 object-cover', className)} style={{ width: size, height: size }} />
  ) : (
    <span aria-hidden className={cn('shrink-0 bg-flaym-gradient', className)} style={{ width: size, height: size }} />
  );
}
