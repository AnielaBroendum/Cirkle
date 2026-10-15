'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useAuth } from '@/components/providers/auth-provider';
import { createClient } from '@/lib/supabase';
import { cn } from '@/components/ds';
import { FlameIcon } from './checkout-parts';
import { useFlayms } from './use-flayms';

// Figma 09b / 19 / 20: avatar, name, "N lit", and the Owned · Saved · History
// folder tabs. Each tab is its own route; the counts are light read queries.

type Counts = { owned: number; saved: number; history: number };

function useProfileCounts() {
  const { user } = useAuth();
  const [counts, setCounts] = useState<Counts | null>(null);

  useEffect(() => {
    if (!user) return;
    const supabase = createClient();
    Promise.all([
      supabase.from('orders').select('order_items ( id )').eq('consumer_user_id', user.id).eq('status', 'delivered'),
      supabase.from('saved_products').select('id', { count: 'exact', head: true }).eq('user_id', user.id),
      supabase.from('scans').select('product_id').eq('scanner_user_id', user.id),
    ]).then(([owned, saved, scans]) => {
      const ownedCount = ((owned.data as { order_items: unknown[] }[] | null) ?? []).reduce((n, o) => n + (o.order_items?.length ?? 0), 0);
      const scanned = new Set(((scans.data as { product_id: string }[] | null) ?? []).map((s) => s.product_id));
      setCounts({ owned: ownedCount, saved: saved.count ?? 0, history: scanned.size });
    });
  }, [user]);

  return counts;
}

const TABS = [
  { href: '/consumer/profile', label: 'Owned', key: 'owned' },
  { href: '/consumer/saved', label: 'Saved', key: 'saved' },
  { href: '/consumer/history', label: 'History', key: 'history' },
] as const;

export default function ProfileHeader() {
  const { profile } = useAuth();
  const pathname = usePathname();
  const counts = useProfileCounts();
  const { stats } = useFlayms();
  const name = profile?.name?.trim() || 'You';

  return (
    <div className="px-5 pt-[55px]">
      <div className="flex items-center gap-3.5">
        <span className="grid h-10 w-10 shrink-0 place-items-center rounded-pill bg-line text-body font-medium text-primary" aria-hidden>
          {name.charAt(0).toUpperCase()}
        </span>
        <div className="min-w-0 flex-1">
          <p className="truncate text-body text-on-primary">{name}</p>
          {profile?.email && <p className="truncate text-caption text-muted">{profile.email}</p>}
        </div>
        <Link href="/consumer/flayms" className="flex items-center gap-1.5 text-[13px] text-line">
          <FlameIcon /> {stats ? stats.lit : '–'} lit
        </Link>
      </div>

      <nav className="mt-3 flex border-b border-line-dark" aria-label="Profile sections">
        {TABS.map((tab) => {
          const on = pathname === tab.href;
          return (
            <Link
              key={tab.href}
              href={tab.href}
              aria-current={on ? 'page' : undefined}
              className={cn(
                '-mb-px border-b px-3.5 pb-2.5 pt-2.5 text-[13px] transition-colors',
                on ? 'border-accent text-accent' : 'border-transparent text-muted hover:text-on-primary'
              )}
            >
              {tab.label} {counts ? counts[tab.key] : ''}
            </Link>
          );
        })}
      </nav>
    </div>
  );
}
