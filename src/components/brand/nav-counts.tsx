'use client';

import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase';
import { PAYOUT_DAY_OF_MONTH } from '@/lib/payouts';
import type { Database } from '@/lib/database.types';

// Sidebar data for the brand portal (Portals v2 shell): nav counts and the
// Next payout box, from get_brand_portal_shell (migration 016).
// Orders = not shipped yet; Returns = waiting for the brand to act (same rules
// as get_brand_nav_counts, 010). Kept fresh without a reload by Supabase
// Realtime, by pages calling refreshNavCounts() after an action, and when the
// tab regains focus.

export type BrandPortalShell = NonNullable<Database['public']['Functions']['get_brand_portal_shell']['Returns']>;

const REFRESH_EVENT = 'flaym:nav-counts';

export function refreshNavCounts() {
  window.dispatchEvent(new Event(REFRESH_EVENT));
}

export function useBrandPortalShell(enabled: boolean): BrandPortalShell | null {
  const [shell, setShell] = useState<BrandPortalShell | null>(null);

  useEffect(() => {
    if (!enabled) return;
    const supabase = createClient();
    let alive = true;
    let timer: ReturnType<typeof setTimeout> | undefined;

    const load = async () => {
      const { data } = await supabase.rpc('get_brand_portal_shell', { p_payout_day: PAYOUT_DAY_OF_MONTH });
      if (alive && data) setShell(data as BrandPortalShell);
    };
    // Several row changes often arrive together (e.g. a bulk ship): load once.
    const soon = () => {
      clearTimeout(timer);
      timer = setTimeout(load, 300);
    };

    load();
    const channel = supabase
      .channel('brand-nav-counts')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'orders' }, soon)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'returns' }, soon)
      .subscribe();
    const onFocus = () => document.visibilityState === 'visible' && soon();
    window.addEventListener(REFRESH_EVENT, soon);
    document.addEventListener('visibilitychange', onFocus);

    return () => {
      alive = false;
      clearTimeout(timer);
      supabase.removeChannel(channel);
      window.removeEventListener(REFRESH_EVENT, soon);
      document.removeEventListener('visibilitychange', onFocus);
    };
  }, [enabled]);

  return shell;
}
