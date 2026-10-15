import Link from 'next/link';
import { ChevronRight } from 'lucide-react';
import { cn } from './cn';

/* ── ListRow ─────────────────────────────────────────────────────────── */

type ListRowProps = {
  leading?: React.ReactNode;
  title: React.ReactNode;
  subtitle?: React.ReactNode;
  trailing?: React.ReactNode;
  href?: string;
  onClick?: () => void;
  /** Show a chevron when the row is a link/button (default true). */
  chevron?: boolean;
  className?: string;
};

export function ListRow({ leading, title, subtitle, trailing, href, onClick, chevron = true, className }: ListRowProps) {
  const interactive = Boolean(href || onClick);
  const content = (
    <>
      {leading && <div className="shrink-0">{leading}</div>}
      <div className="min-w-0 flex-1">
        <p className="truncate text-body text-primary">{title}</p>
        {subtitle && <p className="mt-0.5 truncate text-caption text-muted">{subtitle}</p>}
      </div>
      {trailing && <div className="shrink-0 text-right">{trailing}</div>}
      {interactive && chevron && <ChevronRight className="h-4 w-4 shrink-0 text-muted" />}
    </>
  );
  const classes = cn(
    'flex w-full items-center gap-3 px-4 py-3.5 text-left font-brand',
    interactive && 'transition-colors hover:bg-surface-muted/50',
    className
  );
  if (href) return <Link href={href} className={classes}>{content}</Link>;
  if (onClick) return <button type="button" onClick={onClick} className={classes}>{content}</button>;
  return <div className={classes}>{content}</div>;
}

/** Bordered container for ListRows. */
export function List({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn('divide-y divide-line border border-line bg-surface', className)} {...props} />;
}

/* ── Table ───────────────────────────────────────────────────────────── */

export function Table({ className, ...props }: React.TableHTMLAttributes<HTMLTableElement>) {
  return (
    <div className="w-full overflow-x-auto border border-line bg-surface">
      <table className={cn('w-full min-w-[560px] border-collapse font-brand text-body text-primary', className)} {...props} />
    </div>
  );
}

export function THead(props: React.HTMLAttributes<HTMLTableSectionElement>) {
  return <thead {...props} />;
}

export function TBody({ className, ...props }: React.HTMLAttributes<HTMLTableSectionElement>) {
  return <tbody className={cn('divide-y divide-line', className)} {...props} />;
}

export function TR({ className, ...props }: React.HTMLAttributes<HTMLTableRowElement>) {
  return <tr className={cn('transition-colors hover:bg-surface-muted/40', className)} {...props} />;
}

export function TH({ className, ...props }: React.ThHTMLAttributes<HTMLTableCellElement>) {
  return (
    <th
      className={cn('border-b border-line px-4 py-3 text-left text-label font-normal uppercase text-muted', className)}
      {...props}
    />
  );
}

export function TD({ className, ...props }: React.TdHTMLAttributes<HTMLTableCellElement>) {
  return <td className={cn('px-4 py-3.5 align-middle', className)} {...props} />;
}
