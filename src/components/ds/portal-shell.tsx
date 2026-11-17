'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { Bell, Loader2, Menu, Search, X } from 'lucide-react';
import { cn } from './cn';
import { Logo } from './logo';
import { isItemActive, type NavItem } from './nav';

/*
 * Portals v2 shell (Figma "Portals v2 · Dynamic", sidebar 358:170, top bar 358:260).
 * Shared by the Brand and Retail portals. Renders inside `.portal-dark` (set by PortalShell),
 * where `primary` is the light #F3EFE8 used for the active nav item.
 * Figma uses Char (#7B7673) for small meta text; the design system keeps Char off text,
 * so meta text here is Smoke.
 */

const panel = 'border border-line-dark-subtle bg-obsidian';

/* ── Types ──────────────────────────────────────────────────────────── */

/** A nav link, or an action row (e.g. Log out). */
export type PortalNavItem =
  | (NavItem & { onClick?: never })
  | { label: string; icon: NavItem['icon']; onClick: () => void; href?: never; badge?: never; match?: never };

export type PortalNavGroup = { heading: string; items: PortalNavItem[] };

export type NextPayout = {
  /** e.g. "1 Dec" */
  date: string;
  /** e.g. "DKK 41.072" */
  amount: string;
  /** 0–1. Omit to hide the bar. */
  progress?: number;
  caption?: React.ReactNode;
};

export type SearchResult = { id: string; label: string; detail?: string; href: string };
export type SearchGroup = { heading: string; results: SearchResult[] };

export type PortalNotification = {
  id: string;
  title: string;
  detail?: string;
  href: string;
  /** ISO time, used for order and the unread dot. */
  at: string;
};

/* ── Sidebar ────────────────────────────────────────────────────────── */

type PortalSidebarProps = {
  name: string;
  portalLabel: string;
  homeHref: string;
  groups: PortalNavGroup[];
  payout?: NextPayout | null;
  onNavigate?: () => void;
  className?: string;
};

export function PortalSidebar({ name, portalLabel, homeHref, groups, payout, onNavigate, className }: PortalSidebarProps) {
  const pathname = usePathname() ?? '';

  return (
    <div className={cn('flex h-full w-[248px] flex-col gap-4 font-brand', className)}>
      <nav className={cn(panel, 'flex min-h-0 flex-1 flex-col gap-1.5 overflow-y-auto px-3 py-5')} aria-label="Portal">
        <Link href={homeHref} onClick={onNavigate} className="flex items-center gap-3 px-2 pb-3">
          <span className="flex h-11 w-11 shrink-0 items-center justify-center bg-flaym-tile">
            <Logo height={9} />
          </span>
          <span className="flex min-w-0 flex-col gap-0.5">
            <span className="truncate text-body-lg font-semibold text-flare">{name}</span>
            <span className="truncate text-caption text-smoke">{portalLabel}</span>
          </span>
        </Link>

        {groups.map((group) => (
          <div key={group.heading} className="flex flex-col gap-1.5">
            <p className="px-0.5 pt-1 text-label uppercase text-smoke">{group.heading}</p>
            {group.items.map((item) => {
              const row = 'flex h-11 w-full items-center gap-3 pl-3.5 pr-3 text-left text-body font-medium transition-colors';
              const icon = <item.icon className="h-5 w-5 shrink-0" strokeWidth={2} />;
              if (item.onClick) {
                return (
                  <button
                    key={item.label}
                    type="button"
                    onClick={() => {
                      onNavigate?.();
                      item.onClick();
                    }}
                    className={cn(row, 'text-ash hover:bg-surface-dark hover:text-flare')}
                  >
                    {icon}
                    <span className="flex-1">{item.label}</span>
                  </button>
                );
              }
              const on = isItemActive(pathname, item);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={onNavigate}
                  aria-current={on ? 'page' : undefined}
                  className={cn(row, on ? 'bg-primary text-on-primary' : 'text-ash hover:bg-surface-dark hover:text-flare')}
                >
                  {icon}
                  <span className="flex-1 truncate">{item.label}</span>
                  {typeof item.badge === 'number' && (
                    <span
                      className={cn(
                        'px-2 py-0.5 text-caption font-medium tabular-nums',
                        on ? 'bg-on-primary/10 text-on-primary' : 'bg-surface-dark text-ash'
                      )}
                    >
                      {item.badge}
                    </span>
                  )}
                </Link>
              );
            })}
          </div>
        ))}
      </nav>

      {payout && <NextPayoutCard {...payout} />}
    </div>
  );
}

export function NextPayoutCard({ date, amount, progress, caption }: NextPayout) {
  const pct = progress === undefined ? null : Math.round(Math.min(1, Math.max(0, progress)) * 100);
  return (
    <section className={cn(panel, 'flex flex-col gap-2.5 p-[18px] font-brand')} aria-label="Next payout">
      <div className="flex items-center text-caption">
        <span className="flex-1 text-smoke">Next payout</span>
        <span className="font-medium text-ash">{date}</span>
      </div>
      <p className="text-heading-lg font-medium tabular-nums text-flare">{amount}</p>
      {pct !== null && (
        <div className="h-2 w-full bg-surface-dark" role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100}>
          <div className="h-2 bg-flaym-progress" style={{ width: `${pct}%` }} />
        </div>
      )}
      {caption && <p className="text-caption text-smoke">{caption}</p>}
    </section>
  );
}

/* ── Top bar ────────────────────────────────────────────────────────── */

type PortalTopBarProps = {
  searchPlaceholder: string;
  onOpenSearch: () => void;
  onOpenMenu?: () => void;
  action?: { label: string; href: string };
  notifications: React.ReactNode;
  account: { name: string; role: string };
};

function initials(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '?';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

function todayLabel() {
  return new Intl.DateTimeFormat('en-GB', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    timeZone: 'Europe/Copenhagen',
  }).format(new Date());
}

export function PortalTopBar({ searchPlaceholder, onOpenSearch, onOpenMenu, action, notifications, account }: PortalTopBarProps) {
  // Rendered after mount so the server and client agree on the date.
  const [today, setToday] = useState('');
  useEffect(() => setToday(todayLabel()), []);
  const isMac = typeof navigator !== 'undefined' && /Mac|iPhone|iPad/.test(navigator.platform);

  return (
    <header className="flex items-center gap-2.5 font-brand">
      {onOpenMenu && (
        <button
          type="button"
          onClick={onOpenMenu}
          aria-label="Open menu"
          className={cn(panel, 'flex h-[46px] w-[46px] shrink-0 items-center justify-center text-ash lg:hidden')}
        >
          <Menu className="h-5 w-5" />
        </button>
      )}

      <button
        type="button"
        onClick={onOpenSearch}
        className={cn(panel, 'flex h-[46px] min-w-0 flex-1 items-center gap-2.5 pl-[18px] pr-4 text-left md:w-[420px] md:flex-none')}
      >
        <Search className="h-[18px] w-[18px] shrink-0 text-smoke" />
        <span className="flex-1 truncate text-body-sm text-smoke">{searchPlaceholder}</span>
        <kbd className="hidden bg-surface-dark px-2 py-[3px] font-brand text-caption font-medium text-ash sm:inline">
          {isMac ? '⌘K' : 'Ctrl K'}
        </kbd>
      </button>

      <span className="hidden flex-1 md:block" />

      {today && (
        <span className={cn(panel, 'hidden h-[46px] items-center gap-1.5 px-4 text-body-sm font-medium text-ash xl:flex')}>
          <span className="h-2 w-2 rounded-pill bg-accent" aria-hidden />
          {today}
        </span>
      )}

      {action && (
        <Link
          href={action.href}
          className={cn(panel, 'hidden h-[46px] items-center whitespace-pre px-4 text-body-sm font-medium text-flare hover:bg-surface-dark lg:flex')}
        >
          {`+  ${action.label}`}
        </Link>
      )}

      {notifications}

      <div className={cn(panel, 'flex h-12 shrink-0 items-center gap-2.5 py-1.5 pl-1.5 pr-1.5 md:pr-4')}>
        <span className="flex h-[34px] w-[34px] items-center justify-center rounded-pill bg-flaym-avatar text-caption font-semibold text-obsidian">
          {initials(account.name)}
        </span>
        <span className="hidden min-w-0 flex-col md:flex">
          <span className="max-w-[160px] truncate text-body-sm font-medium text-flare">{account.name}</span>
          <span className="text-caption text-smoke">{account.role}</span>
        </span>
      </div>
    </header>
  );
}

/* ── Notifications ──────────────────────────────────────────────────── */

type NotificationsMenuProps = {
  items: PortalNotification[];
  /** localStorage key for "last opened", e.g. `flaym:brand-notifications-seen`. */
  storageKey: string;
  emptyText?: string;
};

function readSeen(key: string) {
  try {
    return window.localStorage.getItem(key) ?? '';
  } catch {
    return '';
  }
}

function timeAgo(iso: string) {
  const mins = Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 60000));
  if (mins < 60) return `${mins} min ago`;
  const hours = Math.round(mins / 60);
  if (hours < 24) return `${hours} h ago`;
  const days = Math.round(hours / 24);
  return days === 1 ? 'Yesterday' : `${days} days ago`;
}

/**
 * Bell with a dropdown of recent items. Items newer than the last time the menu was
 * opened are unread; that time is remembered per browser (no notification table).
 */
export function NotificationsMenu({ items, storageKey, emptyText = 'Nothing new right now.' }: NotificationsMenuProps) {
  const [open, setOpen] = useState(false);
  const [seen, setSeen] = useState('');
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => setSeen(readSeen(storageKey)), [storageKey]);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => ref.current && !ref.current.contains(e.target as Node) && setOpen(false);
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false);
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  const sorted = useMemo(() => [...items].sort((a, b) => b.at.localeCompare(a.at)), [items]);
  const isUnread = (n: PortalNotification) => !seen || n.at > seen;
  const unread = sorted.filter(isUnread).length;

  const toggle = () => {
    if (open) {
      // Mark as read when the menu closes, so the dots stay visible while it is open.
      const now = new Date().toISOString();
      try {
        window.localStorage.setItem(storageKey, now);
      } catch {}
      setSeen(now);
    }
    setOpen(!open);
  };

  return (
    <div ref={ref} className="relative shrink-0">
      <button
        type="button"
        onClick={toggle}
        aria-expanded={open}
        aria-label={unread ? `Notifications, ${unread} new` : 'Notifications'}
        className={cn(panel, 'relative flex h-[46px] w-[46px] items-center justify-center text-ash hover:text-flare')}
      >
        <Bell className="h-5 w-5" />
        {unread > 0 && <span className="absolute right-3 top-3 h-2 w-2 rounded-pill bg-accent" aria-hidden />}
      </button>

      {open && (
        <div className={cn(panel, 'absolute right-0 top-[54px] z-40 w-[min(360px,calc(100vw-32px))] font-brand')}>
          <p className="border-b border-line-dark-subtle px-4 py-3 text-label uppercase text-smoke">Notifications</p>
          {sorted.length === 0 ? (
            <p className="px-4 py-5 text-body-sm text-smoke">{emptyText}</p>
          ) : (
            <ul className="max-h-[420px] overflow-y-auto py-1">
              {sorted.map((n) => (
                <li key={n.id}>
                  <Link
                    href={n.href}
                    onClick={toggle}
                    className="flex gap-3 px-4 py-3 hover:bg-surface-dark"
                  >
                    <span
                      className={cn('mt-1.5 h-2 w-2 shrink-0 rounded-pill', isUnread(n) ? 'bg-accent' : 'bg-transparent')}
                      aria-hidden
                    />
                    <span className="min-w-0 flex-1">
                      <span className="block text-body-sm text-flare">{n.title}</span>
                      {n.detail && <span className="block truncate text-caption text-smoke">{n.detail}</span>}
                    </span>
                    <span className="shrink-0 text-caption text-smoke">{timeAgo(n.at)}</span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}

/* ── Search (⌘K) ────────────────────────────────────────────────────── */

type CommandSearchProps = {
  open: boolean;
  onClose: () => void;
  placeholder: string;
  search: (query: string) => Promise<SearchGroup[]>;
};

export function CommandSearch({ open, onClose, placeholder, search }: CommandSearchProps) {
  const router = useRouter();
  const [query, setQuery] = useState('');
  const [groups, setGroups] = useState<SearchGroup[]>([]);
  const [loading, setLoading] = useState(false);
  const [active, setActive] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!open) return;
    setQuery('');
    setGroups([]);
    setActive(0);
    const t = setTimeout(() => inputRef.current?.focus(), 0);
    const overflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      clearTimeout(t);
      document.body.style.overflow = overflow;
    };
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const q = query.trim();
    if (q.length < 2) {
      setGroups([]);
      setLoading(false);
      return;
    }
    let cancelled = false;
    setLoading(true);
    const t = setTimeout(() => {
      search(q)
        .then((g) => !cancelled && (setGroups(g.filter((x) => x.results.length > 0)), setActive(0)))
        .catch(() => !cancelled && setGroups([]))
        .finally(() => !cancelled && setLoading(false));
    }, 200);
    return () => {
      cancelled = true;
      clearTimeout(t);
    };
  }, [query, open, search]);

  const flat = groups.flatMap((g) => g.results);

  const go = (r: SearchResult) => {
    onClose();
    router.push(r.href);
  };

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') onClose();
    else if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActive((i) => Math.min(flat.length - 1, i + 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActive((i) => Math.max(0, i - 1));
    } else if (e.key === 'Enter' && flat[active]) {
      e.preventDefault();
      go(flat[active]);
    }
  };

  if (!open) return null;

  let index = -1;
  return (
    <div className="fixed inset-0 z-[90] flex items-start justify-center px-4 pt-[12vh] font-brand" onKeyDown={onKeyDown}>
      <div className="absolute inset-0 bg-obsidian/70" onClick={onClose} aria-hidden />
      <div role="dialog" aria-modal="true" aria-label="Search" className={cn(panel, 'relative w-full max-w-[560px]')}>
        <div className="flex h-14 items-center gap-3 border-b border-line-dark-subtle px-4">
          <Search className="h-[18px] w-[18px] shrink-0 text-smoke" />
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={placeholder}
            className="h-full flex-1 bg-transparent text-body text-flare outline-none placeholder:text-smoke"
            aria-label={placeholder}
          />
          {loading && <Loader2 className="h-4 w-4 animate-spin text-smoke" />}
          <button type="button" onClick={onClose} aria-label="Close" className="text-smoke hover:text-flare">
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="max-h-[60vh] overflow-y-auto py-2">
          {query.trim().length < 2 ? (
            <p className="px-4 py-3 text-body-sm text-smoke">Type at least 2 characters.</p>
          ) : !loading && flat.length === 0 ? (
            <p className="px-4 py-3 text-body-sm text-smoke">No results for “{query.trim()}”.</p>
          ) : (
            groups.map((g) => (
              <div key={g.heading} className="py-1">
                <p className="px-4 py-1.5 text-label uppercase text-smoke">{g.heading}</p>
                {g.results.map((r) => {
                  index += 1;
                  const i = index;
                  return (
                    <button
                      key={`${g.heading}-${r.id}`}
                      type="button"
                      onMouseEnter={() => setActive(i)}
                      onClick={() => go(r)}
                      className={cn(
                        'flex w-full items-center gap-3 px-4 py-2.5 text-left',
                        i === active ? 'bg-surface-dark' : ''
                      )}
                    >
                      <span className="min-w-0 flex-1 truncate text-body-sm text-flare">{r.label}</span>
                      {r.detail && <span className="shrink-0 text-caption text-smoke">{r.detail}</span>}
                    </button>
                  );
                })}
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}

/* ── Shell ──────────────────────────────────────────────────────────── */

type PortalShellProps = {
  sidebar: Omit<PortalSidebarProps, 'onNavigate' | 'className'>;
  topBar: Omit<PortalTopBarProps, 'onOpenSearch' | 'onOpenMenu'>;
  search: (query: string) => Promise<SearchGroup[]>;
  children: React.ReactNode;
};

/**
 * Brand and Retail portal frame: dark page (`.portal-dark`), sidebar on the left
 * (a drawer below lg), top bar, ⌘K search.
 */
export function PortalShell({ sidebar, topBar, search, children }: PortalShellProps) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const pathname = usePathname();

  useEffect(() => setMenuOpen(false), [pathname]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setSearchOpen((o) => !o);
      }
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, []);

  const closeSearch = useCallback(() => setSearchOpen(false), []);

  return (
    <div className="portal-dark min-h-screen bg-canvas-dark font-brand text-flare">
      {/* Desktop sidebar */}
      <div className="fixed bottom-4 left-4 top-4 z-30 hidden lg:block">
        <PortalSidebar {...sidebar} />
      </div>

      {/* Mobile drawer */}
      {menuOpen && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div className="absolute inset-0 bg-obsidian/70" onClick={() => setMenuOpen(false)} aria-hidden />
          <div className="absolute bottom-4 left-4 top-4">
            <PortalSidebar {...sidebar} onNavigate={() => setMenuOpen(false)} />
          </div>
        </div>
      )}

      <div className="px-4 pb-10 pt-4 lg:pl-[280px] lg:pr-4">
        <PortalTopBar {...topBar} onOpenSearch={() => setSearchOpen(true)} onOpenMenu={() => setMenuOpen(true)} />
        <main className="mx-auto max-w-[1144px] pt-6 lg:pt-8">{children}</main>
      </div>

      <CommandSearch open={searchOpen} onClose={closeSearch} placeholder={topBar.searchPlaceholder} search={search} />
    </div>
  );
}
