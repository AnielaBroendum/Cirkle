'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { ChevronLeft } from 'lucide-react';
import { cn } from './cn';
import { Logo } from './logo';

/** Same shape as the NAV_ITEMS arrays in the current portal layouts. */
export type NavItem = {
  href: string;
  label: string;
  /** A lucide icon or a Flaym icon from `ds/icons`. */
  icon: React.ComponentType<{ className?: string; strokeWidth?: string | number }>;
  /** Extra route prefixes that also mark this item active (e.g. Profile's sub-tabs). */
  match?: string[];
  /** Count pill after the label (Figma portal nav: Orders 3). Hidden at 0. */
  badge?: number;
};

// Same active rule as the current layouts.
function isActive(pathname: string, href: string) {
  return pathname === href || pathname.startsWith(href + '/');
}

export function isItemActive(pathname: string, item: NavItem) {
  return [item.href, ...(item.match ?? [])].some((href) => isActive(pathname, href));
}

/* ── TopBar (mobile app bar) ─────────────────────────────────────────── */

type TopBarProps = {
  title?: React.ReactNode;
  /** Show the flaym logo instead of a title. */
  logo?: boolean;
  backHref?: string;
  onBack?: () => void;
  left?: React.ReactNode;
  right?: React.ReactNode;
  tone?: 'light' | 'dark';
  sticky?: boolean;
  className?: string;
};

export function TopBar({ title, logo, backHref, onBack, left, right, tone = 'light', sticky = true, className }: TopBarProps) {
  const dark = tone === 'dark';
  const backClasses = cn('-ml-2 inline-flex h-10 w-10 items-center justify-center', dark ? 'text-on-primary' : 'text-primary');
  const back = backHref ? (
    <Link href={backHref} aria-label="Back" className={backClasses}>
      <ChevronLeft className="h-5 w-5" />
    </Link>
  ) : onBack ? (
    <button type="button" onClick={onBack} aria-label="Back" className={backClasses}>
      <ChevronLeft className="h-5 w-5" />
    </button>
  ) : null;

  return (
    <header
      className={cn(
        'z-40 grid h-14 grid-cols-[1fr_auto_1fr] items-center px-4 font-brand',
        sticky && 'sticky top-0',
        dark ? 'bg-primary text-on-primary' : 'border-b border-line bg-canvas text-primary',
        className
      )}
    >
      <div className="flex items-center">{left ?? back}</div>
      <div className="min-w-0 text-center">
        {logo ? (
          dark ? <Logo height={20} /> : <Logo height={16} framed className="px-2.5 py-1.5" />
        ) : (
          <span className="block truncate text-body font-medium uppercase tracking-[0.4px]">{title}</span>
        )}
      </div>
      <div className="flex items-center justify-end gap-1">{right}</div>
    </header>
  );
}

/* ── BottomNav (consumer PWA) ────────────────────────────────────────── */

type BottomNavProps = {
  items: NavItem[];
  /** Fixed to the viewport bottom (default). Set false to render in-flow, e.g. in a preview. */
  fixed?: boolean;
  className?: string;
};

export function BottomNav({ items, fixed = true, className }: BottomNavProps) {
  const pathname = usePathname() ?? '';
  return (
    <nav
      className={cn(
        'z-40 border-t border-line-dark bg-primary pb-[env(safe-area-inset-bottom)] font-brand',
        fixed && 'fixed inset-x-0 bottom-0',
        className
      )}
    >
      {/* Figma "Tab bar": 24px icon at 10px from the top, 12px label below. */}
      <ul className="mx-auto flex h-16 max-w-lg items-stretch">
        {items.map((item) => {
          const on = isItemActive(pathname, item);
          return (
            <li key={item.href} className="flex-1">
              <Link
                href={item.href}
                aria-current={on ? 'page' : undefined}
                className={cn(
                  'flex h-full flex-col items-center justify-start gap-1.5 pt-2.5 text-label leading-none tracking-normal transition-colors',
                  on ? 'text-accent' : 'text-smoke hover:text-on-primary'
                )}
              >
                <item.icon className="h-6 w-6" />
                {item.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

