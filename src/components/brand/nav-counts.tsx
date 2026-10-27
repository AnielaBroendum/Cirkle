'use client';

import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase';

// Sidebar counts for the brand portal (Figma: Orders 3, Returns 1).
// Orders = not shipped yet; Returns = waiting for the brand to act
// (get_brand_nav_counts, migration 010). Kept fresh without a reload by
// Supabase Realtime, by pages calling refreshNavCounts() after an action,
// and when the tab regains focus.

export type NavCounts = { orders: number; returns: number };

const REFRESH_EVENT = 'flaym:nav-counts';

export function refreshNavCounts() {
  window.dispatchEvent(new Event(REFRESH_EVENT));
}

export function useBrandNavCounts(enabled: boolean): NavCounts {
  const [counts, setCounts] = useState<NavCounts>({ orders: 0, returns: 0 });

  useEffect(() => {
    if (!enabled) return;
    const supabase = createClient();
    let alive = true;
    let timer: ReturnType<typeof setTimeout> | undefined;

    const load = async () => {
      const { data } = await supabase.rpc('get_brand_nav_counts');
      if (alive && data) setCounts({ orders: Number(data.orders) || 0, returns: Number(data.returns) || 0 });
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

  return counts;
}
