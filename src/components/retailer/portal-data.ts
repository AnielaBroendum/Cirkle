'use client';

import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase';
import { PAYOUT_DAY_OF_MONTH } from '@/lib/payouts';
import type { Database } from '@/lib/database.types';
import type { PortalNotification, SearchGroup } from '@/components/ds';

// Retail portal sidebar data (Portals v2 shell): nav count and Next payout box
// from get_retailer_portal_shell (migration 016), plus ⌘K search and the bell.
// Read-only, under RLS: the store only gets its own samples, partners and requests.

export type RetailerPortalShell = NonNullable<Database['public']['Functions']['get_retailer_portal_shell']['Returns']>;

export function useRetailerPortalShell(enabled: boolean): RetailerPortalShell | null {
  const [shell, setShell] = useState<RetailerPortalShell | null>(null);

  useEffect(() => {
    if (!enabled) return;
    const supabase = createClient();
    let alive = true;
    const load = async () => {
      const { data } = await supabase.rpc('get_retailer_portal_shell', { p_payout_day: PAYOUT_DAY_OF_MONTH });
      if (alive && data) setShell(data as RetailerPortalShell);
    };
    load();
    const onFocus = () => document.visibilityState === 'visible' && load();
    document.addEventListener('visibilitychange', onFocus);
    return () => {
      alive = false;
      document.removeEventListener('visibilitychange', onFocus);
    };
  }, [enabled]);

  return shell;
}

const LIMIT = 5;

export async function searchRetailerPortal(retailerId: string, query: string): Promise<SearchGroup[]> {
  const supabase = createClient();
  const needle = query.trim().toLowerCase();
  if (!needle) return [];

  const [samples, partnerships] = await Promise.all([
    supabase
      .from('samples')
      .select('product_id, products(name), brand_profiles(name)')
      .eq('retailer_id', retailerId)
      .eq('status', 'active'),
    supabase
      .from('brand_retailer_partnerships')
      .select('brand_id, status, brand_profiles(name)')
      .eq('retailer_id', retailerId)
      .in('status', ['active', 'invited', 'paused']),
  ]);

  type SampleRow = { product_id: string; products: { name: string } | null; brand_profiles: { name: string } | null };
  const seen = new Set<string>();
  const products = ((samples.data ?? []) as unknown as SampleRow[])
    .filter((s) => {
      if (!s.products || seen.has(s.product_id)) return false;
      seen.add(s.product_id);
      return `${s.products.name} ${s.brand_profiles?.name ?? ''}`.toLowerCase().includes(needle);
    })
    .slice(0, LIMIT);

  type BrandRow = { brand_id: string; status: string; brand_profiles: { name: string } | null };
  const brands = ((partnerships.data ?? []) as unknown as BrandRow[])
    .filter((b) => b.brand_profiles?.name.toLowerCase().includes(needle))
    .slice(0, LIMIT);

  return [
    {
      heading: 'Products',
      results: products.map((p) => ({
        id: p.product_id,
        label: p.products!.name,
        detail: p.brand_profiles?.name,
        href: '/retailer/samples',
      })),
    },
    {
      heading: 'Brands',
      results: brands.map((b) => ({
        id: b.brand_id,
        label: b.brand_profiles!.name,
        detail: b.status === 'active' ? undefined : 'Pending',
        href: '/retailer/brands',
      })),
    },
  ];
}

const SWAP_UPDATES = ['approved', 'new_shipped', 'inspected_damaged', 'cancelled'] as const;

/**
 * Recent items for the store: brand invitations, sample requests on their way and
 * swap updates. Built from existing tables; nothing is stored.
 */
export function useRetailerNotifications(retailerId: string | null): PortalNotification[] {
  const [items, setItems] = useState<PortalNotification[]>([]);

  useEffect(() => {
    if (!retailerId) return;
    const supabase = createClient();
    let alive = true;

    Promise.all([
      supabase
        .from('brand_retailer_partnerships')
        .select('id, invitation_token, created_at, brand_profiles(name)')
        .eq('retailer_id', retailerId)
        .eq('status', 'invited')
        .not('invitation_token', 'is', null)
        .order('created_at', { ascending: false })
        .limit(10),
      supabase
        .from('sample_requests')
        .select('id, updated_at, brand_profiles(name)')
        .eq('retailer_id', retailerId)
        .eq('status', 'shipped')
        .order('updated_at', { ascending: false })
        .limit(10),
      supabase
        .from('swap_requests')
        .select('id, status, updated_at, brand_profiles(name)')
        .eq('retailer_id', retailerId)
        .in('status', [...SWAP_UPDATES])
        .order('updated_at', { ascending: false })
        .limit(10),
    ]).then(([invites, requests, swaps]) => {
      if (!alive) return;
      type Named = { brand_profiles: { name: string } | null };
      const brand = (r: Named) => r.brand_profiles?.name ?? 'A brand';
      const out: PortalNotification[] = [];
      for (const p of (invites.data ?? []) as unknown as ({ id: string; created_at: string } & Named)[]) {
        out.push({ id: `invite-${p.id}`, title: `${brand(p)} wants to partner with you`, href: '/retailer/brands', at: p.created_at });
      }
      for (const r of (requests.data ?? []) as unknown as ({ id: string; updated_at: string } & Named)[]) {
        out.push({ id: `request-${r.id}`, title: 'Samples on their way', detail: brand(r), href: '/retailer/samples', at: r.updated_at });
      }
      const swapTitle: Record<string, string> = {
        approved: 'Swap approved',
        new_shipped: 'New sample on its way',
        inspected_damaged: 'Returned sample marked damaged',
        cancelled: 'Swap cancelled',
      };
      for (const s of (swaps.data ?? []) as unknown as ({ id: string; status: string; updated_at: string } & Named)[]) {
        out.push({ id: `swap-${s.id}`, title: swapTitle[s.status] ?? 'Swap update', detail: brand(s), href: '/retailer/samples', at: s.updated_at });
      }
      setItems(out.sort((a, b) => b.at.localeCompare(a.at)).slice(0, 10));
    });

    return () => {
      alive = false;
    };
  }, [retailerId]);

  return items;
}
