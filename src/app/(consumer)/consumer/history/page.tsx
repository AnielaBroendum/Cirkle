'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useAuth } from '@/components/providers/auth-provider';
import { createClient } from '@/lib/supabase';
import ProfileHeader from '@/components/consumer/profile-header';
import { Thumb } from '@/components/consumer/checkout-parts';

// Figma 20 "Profile – History". The same "discoveries" the old Home feed
// showed (first scan per product, plus saved items you never scanned), grouped
// by Today / This week / Earlier.

type ScanRow = {
  product_id: string;
  source_type: string;
  scanned_at: string;
  products: { id: string; name: string; images: string[] | null } | null;
  retailer_profiles: { name: string } | null;
  profiles: { name: string } | null;
};

type SavedRow = {
  product_id: string;
  saved_at: string;
  products: { id: string; name: string; images: string[] | null } | null;
};

type Discovery = {
  id: string;
  name: string;
  image: string | null;
  when: string;
  how: string;
};

function startOfDay(d: Date) {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}

function groupLabel(iso: string) {
  const day = startOfDay(new Date(iso)).getTime();
  const today = startOfDay(new Date()).getTime();
  if (day === today) return 'Today';
  if (today - day < 7 * 24 * 60 * 60 * 1000) return 'This week';
  return 'Earlier';
}

function whenLabel(iso: string, group: string) {
  const d = new Date(iso);
  if (group === 'Today') return d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
  if (group === 'This week') return d.toLocaleDateString('en-GB', { weekday: 'short' });
  return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
}

export default function ConsumerHistoryPage() {
  const { user } = useAuth();
  const [items, setItems] = useState<Discovery[] | null>(null);

  useEffect(() => {
    if (!user) return;
    const supabase = createClient();

    (async () => {
      const [{ data: scanData }, { data: savedData }] = await Promise.all([
        supabase
          .from('scans')
          .select(
            `product_id, source_type, scanned_at,
             products ( id, name, images ),
             retailer_profiles:source_retailer_id ( name ),
             profiles:source_user_id ( name )`
          )
          .eq('scanner_user_id', user.id)
          .order('scanned_at', { ascending: true }),
        supabase
          .from('saved_products')
          .select(`product_id, saved_at, products ( id, name, images )`)
          .eq('user_id', user.id)
          .order('saved_at', { ascending: false }),
      ]);

      const seen = new Set<string>();
      const list: Discovery[] = [];

      // Scans come oldest-first, so the first one kept per product is where you FIRST found it.
      for (const row of (scanData as ScanRow[] | null) ?? []) {
        if (!row.products || seen.has(row.product_id)) continue;
        seen.add(row.product_id);
        const friend = row.profiles?.name?.split(' ')[0];
        list.push({
          id: row.products.id,
          name: row.products.name,
          image: row.products.images?.[0] ?? null,
          when: row.scanned_at,
          how:
            row.source_type === 'retailer'
              ? `Scanned at ${row.retailer_profiles?.name ?? 'a store'}`
              : `Passed on by ${friend ?? 'a friend'}`,
        });
      }

      // Saved products you haven't got a personal scan row for yet.
      for (const row of (savedData as SavedRow[] | null) ?? []) {
        if (!row.products || seen.has(row.product_id)) continue;
        seen.add(row.product_id);
        list.push({ id: row.products.id, name: row.products.name, image: row.products.images?.[0] ?? null, when: row.saved_at, how: 'Saved' });
      }

      list.sort((a, b) => new Date(b.when).getTime() - new Date(a.when).getTime());
      setItems(list);
    })();
  }, [user]);

  const groups: { label: string; items: Discovery[] }[] = [];
  for (const item of items ?? []) {
    const label = groupLabel(item.when);
    const g = groups.find((x) => x.label === label);
    if (g) g.items.push(item);
    else groups.push({ label, items: [item] });
  }

  return (
    <div className="pb-8">
      <ProfileHeader />

      <div className="px-5 pt-3.5">
        {items === null ? (
          <div className="space-y-3.5" aria-busy>
            {[0, 1, 2].map((i) => (
              <div key={i} className="flex items-center gap-3.5">
                <div className="h-[60px] w-12 animate-pulse bg-surface-dark" />
                <div className="h-4 w-44 animate-pulse bg-surface-dark" />
              </div>
            ))}
          </div>
        ) : items.length === 0 ? (
          <div className="bg-surface-dark p-4">
            <p className="text-body text-on-primary">No history yet</p>
            <p className="mt-1 text-caption text-muted">
              Everything you scan shows up here.{' '}
              <Link href="/consumer/home" className="text-accent">
                Scan a tag
              </Link>
            </p>
          </div>
        ) : (
          groups.map((group) => (
            <section key={group.label} className="mb-5">
              <p className="text-label uppercase text-muted">{group.label}</p>
              <ul className="mt-3.5 space-y-3.5">
                {group.items.map((item) => (
                  <li key={item.id}>
                    <Link href={`/d/${item.id}`} className="flex items-center gap-3.5">
                      <Thumb src={item.image} alt={item.name} className="h-[60px] w-12" />
                      <div className="min-w-0">
                        <p className="truncate text-body text-on-primary">{item.name}</p>
                        <p className="truncate text-caption text-muted">
                          {item.how} · {whenLabel(item.when, group.label)}
                        </p>
                      </div>
                    </Link>
                  </li>
                ))}
              </ul>
            </section>
          ))
        )}
      </div>
    </div>
  );
}
