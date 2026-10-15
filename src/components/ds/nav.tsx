'use client';

import { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { ChevronLeft, Menu, X, type LucideIcon } from 'lucide-react';
import { cn } from './cn';
import { Logo } from './logo';

/** Same shape as the NAV_ITEMS arrays in the current portal layouts. */
export type NavItem = {
  href: string;
  label: string;
  icon: LucideIcon;
  /** Extra route prefixes that also mark this item active (e.g. Profile's sub-tabs). */
  match?: string[];
};

// Same active rule as the current layouts.
function isActive(pathname: string, href: string) {
  return pathname === href || pathname.startsWith(href + '/');
}

function isItemActive(pathname: string, item: NavItem) {
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
      {/* Figma "Tab bar": 24px icon at 10px from the top, 11px label below. */}
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
                  on ? 'text-accent' : 'text-muted hover:text-on-primary'
                )}
              >
                <item.icon className="h-6 w-6" strokeWidth={on ? 2 : 1.5} />
                {item.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

/* ── SidebarNav (brand & retailer dashboards) ────────────────────────── */

type SidebarNavProps = {
  items: NavItem[];
  homeHref: string;
  /** Account block under the logo, e.g. brand / store name + role. */
  account?: { name: React.ReactNode; role?: React.ReactNode };
  /** Bottom slot, e.g. a sign-out button. Receives a close() for the mobile drawer. */
  footer?: (close: () => void) => React.ReactNode;
  /** Render in-flow instead of fixed (for previews). */
  embedded?: boolean;
  className?: string;
};

export function SidebarNav({ items, homeHref, account, footer, embedded = false, className }: SidebarNavProps) {
  const pathname = usePathname() ?? '';
  const [open, setOpen] = useState(false);
  const close = () => setOpen(false);

  return (
    <>
      {/* Mobile top bar */}
      <header
        className={cn(
          'z-40 flex h-14 items-center justify-between bg-primary px-4 font-brand text-on-primary lg:hidden',
          !embedded && 'sticky top-0'
        )}
      >
        <button type="button" onClick={() => setOpen(true)} aria-label="Open menu" className="-ml-2 inline-flex h-10 w-10 items-center justify-center">
          <Menu className="h-5 w-5" />
        </button>
        <Link href={homeHref} aria-label="Home">
          <Logo height={20} />
        </Link>
        <span className="w-10" />
      </header>

      {open && <div className="fixed inset-0 z-50 bg-primary/60 lg:hidden" onClick={close} aria-hidden />}

      <aside
        className={cn(
          'z-50 flex w-64 flex-col bg-primary font-brand text-on-primary transition-transform duration-200',
          embedded
            ? open
              ? 'fixed left-0 top-0 h-full lg:relative'
              : 'hidden h-full lg:relative lg:flex'
            : cn('fixed left-0 top-0 h-full lg:translate-x-0', open ? 'translate-x-0' : '-translate-x-full'),
          className
        )}
      >
        <div className="flex h-16 items-center justify-between px-5">
          <Link href={homeHref} aria-label="Home" onClick={close}>
            <Logo height={22} />
          </Link>
          <button type="button" onClick={close} aria-label="Close menu" className="inline-flex h-9 w-9 items-center justify-center text-on-primary/60 lg:hidden">
            <X className="h-5 w-5" />
          </button>
        </div>

        {account && (
          <div className="border-y border-on-primary/10 px-5 py-3.5">
            <p className="truncate text-body">{account.name}</p>
            {account.role && <p className="mt-0.5 text-label uppercase text-on-primary/50">{account.role}</p>}
          </div>
        )}

        <nav className="flex-1 overflow-y-auto py-3">
          {items.map((item) => {
            const on = isActive(pathname, item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={close}
                aria-current={on ? 'page' : undefined}
                className={cn(
                  'flex items-center gap-3 border-l-2 px-5 py-2.5 text-body transition-colors',
                  on ? 'border-accent bg-on-primary/5 text-on-primary' : 'border-transparent text-on-primary/60 hover:text-on-primary'
                )}
              >
                <item.icon className={cn('h-[18px] w-[18px] shrink-0', on && 'text-accent')} />
                {item.label}
              </Link>
            );
          })}
        </nav>

        {footer && <div className="border-t border-on-primary/10 p-3">{footer(close)}</div>}
      </aside>
    </>
  );
}
