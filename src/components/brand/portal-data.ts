'use client';

import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase';
import type { PortalNotification, SearchGroup } from '@/components/ds';

// Brand portal search (⌘K) and notifications (bell). Read-only queries under RLS:
// the brand only gets its own products, partner stores and orders.

const LIMIT = 5;

/** Strip characters that have a meaning in a PostgREST `or` filter. */
function clean(q: string) {
  return q.replace(/[,()%*\\]/g, ' ').trim();
}

export async function searchBrandPortal(brandId: string, query: string): Promise<SearchGroup[]> {
  const supabase = createClient();
  const q = clean(query);
  if (!q) return [];
  const orderNumber = Number(q.replace(/^#/, ''));

  const [products, partnerships, orders] = await Promise.all([
    supabase
      .from('products')
      .select('id, name, category')
      .eq('brand_id', brandId)
      .or(`name.ilike.%${q}%,category.ilike.%${q}%`)
      .order('name')
      .limit(LIMIT),
    supabase
      .from('brand_retailer_partnerships')
      .select('retailer_id, status, retailer_profiles(id, name, city)')
      .eq('brand_id', brandId)
      .in('status', ['active', 'invited', 'paused'])
      .not('retailer_id', 'is', null),
    Number.isInteger(orderNumber) && orderNumber > 0
      ? supabase
          .from('orders')
          .select('id, order_number, status, created_at')
          .eq('brand_id', brandId)
          .eq('order_number', orderNumber)
          .limit(LIMIT)
      : Promise.resolve({ data: [] as { id: string; order_number: number; status: string; created_at: string }[] }),
  ]);

  type StoreRow = { retailer_id: string; status: string; retailer_profiles: { id: string; name: string; city: string | null } | null };
  const needle = q.toLowerCase();
  const stores = ((partnerships.data ?? []) as unknown as StoreRow[])
    .filter((p) => p.retailer_profiles && `${p.retailer_profiles.name} ${p.retailer_profiles.city ?? ''}`.toLowerCase().includes(needle))
    .slice(0, LIMIT);

  return [
    {
      heading: 'Products',
      results: ((products.data ?? []) as { id: string; name: string; category: string | null }[]).map((p) => ({
        id: p.id,
        label: p.name,
        detail: p.category ?? undefined,
        href: `/brand/products/${p.id}/edit`,
      })),
    },
    {
      heading: 'Stores',
      results: stores.map((s) => ({
        id: s.retailer_id,
        label: s.retailer_profiles!.name,
        detail: s.status === 'active' ? s.retailer_profiles!.city ?? undefined : 'Pending',
        href: s.status === 'active' ? `/brand/samples?store=${s.retailer_id}` : '/brand/partnerships',
      })),
    },
    {
      heading: 'Orders',
      results: ((orders.data ?? []) as { id: string; order_number: number; status: string }[]).map((o) => ({
        id: o.id,
        label: `#${o.order_number}`,
        detail: o.status.charAt(0).toUpperCase() + o.status.slice(1),
        href: `/brand/orders?order=${o.id}`,
      })),
    },
  ];
}

/**
 * Recent items that need the brand: new orders, return requests, store requests
 * and invitations still waiting. Built from existing tables; nothing is stored.
 * Reloads when `version` changes (the shell's counts).
 */
export function useBrandNotifications(brandId: string | null, version: string): PortalNotification[] {
  const [items, setItems] = useState<PortalNotification[]>([]);

  useEffect(() => {
    if (!brandId) return;
    const supabase = createClient();
    let alive = true;

    Promise.all([
      supabase
        .from('orders')
        .select('id, order_number, created_at, total_dkk')
        .eq('brand_id', brandId)
        .eq('status', 'pending')
        .order('created_at', { ascending: false })
        .limit(10),
      // RLS limits returns to the brand's own orders.
      supabase
        .from('returns')
        .select('id, created_at, orders(order_number)')
        .eq('status', 'requested')
        .order('created_at', { ascending: false })
        .limit(10),
      supabase
        .from('brand_retailer_partnerships')
        .select('id, invitation_token, invitation_email, created_at, retailer_profiles(name)')
        .eq('brand_id', brandId)
        .eq('status', 'invited')
        .order('created_at', { ascending: false })
        .limit(10),
    ]).then(([orders, returns, invites]) => {
      if (!alive) return;
      const out: PortalNotification[] = [];
      for (const o of orders.data ?? []) {
        out.push({
          id: `order-${o.id}`,
          title: `New order #${o.order_number}`,
          detail: 'Waiting to ship',
          href: `/brand/orders?order=${o.id}`,
          at: o.created_at,
        });
      }
      type ReturnRow = { id: string; created_at: string; orders: { order_number: number } | null };
      for (const r of (returns.data ?? []) as unknown as ReturnRow[]) {
        out.push({
          id: `return-${r.id}`,
          title: 'Return request',
          detail: r.orders ? `Order #${r.orders.order_number}` : undefined,
          href: '/brand/returns',
          at: r.created_at,
        });
      }
      type InviteRow = { id: string; invitation_token: string | null; invitation_email: string | null; created_at: string; retailer_profiles: { name: string } | null };
      for (const p of (invites.data ?? []) as unknown as InviteRow[]) {
        const name = p.retailer_profiles?.name ?? p.invitation_email ?? 'A store';
        out.push({
          id: `invite-${p.id}`,
          // Brand invitations carry a token; requests from a store don't.
          title: p.invitation_token ? `Invitation to ${name} is waiting` : `${name} wants to partner with you`,
          href: '/brand/partnerships',
          at: p.created_at,
        });
      }
      setItems(out.sort((a, b) => b.at.localeCompare(a.at)).slice(0, 10));
    });

    return () => {
      alive = false;
    };
  }, [brandId, version]);

  return items;
}
