'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { useAuth } from '@/components/providers/auth-provider';
import { createClient } from '@/lib/supabase';
import { formatDKK } from '@/lib/utils';
import { Coins, ChevronRight, MapPin, Users, QrCode, Heart } from 'lucide-react';

type ScanRow = {
  product_id: string;
  source_type: string;
  scanned_at: string;
  products: {
    id: string;
    name: string;
    price_dkk: number;
    images: string[] | null;
    brand_profiles: { name: string; logo_url: string | null } | null;
  } | null;
  retailer_profiles: { name: string } | null;
};

type SavedRow = {
  product_id: string;
  saved_at: string;
  products: {
    id: string;
    name: string;
    price_dkk: number;
    images: string[] | null;
    brand_profiles: { name: string; logo_url: string | null } | null;
  } | null;
};

type Discovery = {
  id: string;
  name: string;
  price_dkk: number;
  image?: string;
  brandName: string;
  brandLogo?: string;
  retailerName?: string;
  when: string;
  via: 'scan-retailer' | 'scan-peer' | 'saved';
};

const GRADIENTS = [
  'linear-gradient(160deg,#E0915C 0%,#7a3f1f 70%,#2a1308 100%)',
  'linear-gradient(160deg,#C9A06A 0%,#6f4c30 65%,#241509 100%)',
  'linear-gradient(160deg,#b97e63 0%,#5e3320 70%,#1c0f08 100%)',
  'linear-gradient(160deg,#caa57e 0%,#7a5c44 60%,#241509 100%)',
];

function timeAgo(iso: string): string {
  const mins = Math.floor((Date.now() - new Date(iso).getTime()) / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins} min ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs} hr ago`;
  const days = Math.floor(hrs / 24);
  if (days < 30) return `${days} day${days > 1 ? 's' : ''} ago`;
  return new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
}

export default function ConsumerHomePage() {
  const { user, profile } = useAuth();
  const [discoveries, setDiscoveries] = useState<Discovery[]>([]);
  const [loading, setLoading] = useState(true);
  const [points, setPoints] = useState<number | null>(null);

  useEffect(() => {
    if (!user) return;
    const supabase = createClient();

    (async () => {
      const [{ data: scanData }, { data: savedData }] = await Promise.all([
        supabase
          .from('scans')
          .select(
            `product_id, source_type, scanned_at,
             products ( id, name, price_dkk, images, brand_profiles ( name, logo_url ) ),
             retailer_profiles:source_retailer_id ( name )`
          )
          .eq('scanner_user_id', user.id)
          .order('scanned_at', { ascending: false }),
        supabase
          .from('saved_products')
          .select(
            `product_id, saved_at,
             products ( id, name, price_dkk, images, brand_profiles ( name, logo_url ) )`
          )
          .eq('user_id', user.id)
          .order('saved_at', { ascending: false }),
      ]);

      const seen = new Set<string>();
      const list: Discovery[] = [];

      // Scanned discoveries first (they carry where/when you scanned).
      for (const row of (scanData as ScanRow[] | null) ?? []) {
        if (!row.products || seen.has(row.product_id)) continue;
        seen.add(row.product_id);
        list.push({
          id: row.products.id,
          name: row.products.name,
          price_dkk: row.products.price_dkk,
          image: row.products.images?.[0],
          brandName: row.products.brand_profiles?.name ?? '',
          brandLogo: row.products.brand_profiles?.logo_url ?? undefined,
          retailerName: row.retailer_profiles?.name,
          when: row.scanned_at,
          via: row.source_type === 'retailer' ? 'scan-retailer' : 'scan-peer',
        });
      }

      // Saved products you haven't got a personal scan row for yet.
      for (const row of (savedData as SavedRow[] | null) ?? []) {
        if (!row.products || seen.has(row.product_id)) continue;
        seen.add(row.product_id);
        list.push({
          id: row.products.id,
          name: row.products.name,
          price_dkk: row.products.price_dkk,
          image: row.products.images?.[0],
          brandName: row.products.brand_profiles?.name ?? '',
          brandLogo: row.products.brand_profiles?.logo_url ?? undefined,
          when: row.saved_at,
          via: 'saved',
        });
      }

      setDiscoveries(list);
      setLoading(false);
    })();

    supabase
      .rpc('get_points_balance', { p_user_id: user.id })
      .then(({ data }: { data: number | null }) => setPoints(data ?? 0));
  }, [user]);

  const firstName = (profile?.name ?? '').split(' ')[0];

  return (
    <div className="space-y-5">
      {/* Greeting */}
      <div>
        {firstName && <p className="text-sm text-espresso-muted">Welcome back, {firstName}</p>}
        <h1 className="text-[34px] leading-tight text-espresso-cream">
          Your <em className="italic">discoveries</em>
        </h1>
      </div>

      {/* Points banner */}
      <Link
        href="/consumer/profile"
        className="relative flex items-center justify-between overflow-hidden rounded-2xl border border-espresso-line p-4 no-underline"
        style={{ background: 'linear-gradient(115deg,#3a2417,#1f120a)' }}
      >
        <span
          className="pointer-events-none absolute -right-8 -top-10 h-36 w-36 rounded-full"
          style={{ background: 'radial-gradient(circle,rgba(216,160,58,0.4),transparent 70%)' }}
        />
        <span className="relative">
          <span className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-[1.4px] text-terracotta">
            <Coins className="h-3.5 w-3.5" /> Cirkle Points
          </span>
          <span className="mt-1 block font-display text-2xl text-espresso-cream">{points ?? '—'}</span>
        </span>
        <span className="relative flex items-center gap-1 text-xs text-espresso-cream/80">
          View rewards <ChevronRight className="h-4 w-4" />
        </span>
      </Link>

      {/* Discoveries grid */}
      {loading ? (
        <div className="grid grid-cols-2 gap-3.5">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="aspect-[3/4] animate-pulse rounded-2xl bg-espresso-surface" />
          ))}
        </div>
      ) : discoveries.length === 0 ? (
        <div className="rounded-2xl border border-espresso-line bg-espresso-surface px-6 py-14 text-center">
          <QrCode className="mx-auto h-12 w-12 text-espresso-muted-2" />
          <p className="mt-3 font-medium text-espresso-cream">Nothing discovered yet</p>
          <p className="mx-auto mt-1 max-w-[240px] text-sm text-espresso-muted">
            Scan a Cirkle tag in a shop or café to discover the maker behind it.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-3.5">
          {discoveries.map((d, i) => (
            <Link
              key={d.id}
              href={`/d/${d.id}`}
              className="group block overflow-hidden rounded-2xl border border-espresso-line bg-espresso-surface no-underline active:scale-[0.98]"
            >
              {/* Image / brand-logo fallback */}
              <div className="relative aspect-[3/4]" style={d.image ? undefined : { background: GRADIENTS[i % GRADIENTS.length] }}>
                {d.image ? (
                  <Image src={d.image} alt={d.name} fill className="object-cover" sizes="50vw" />
                ) : d.brandLogo ? (
                  <span className="absolute inset-0 grid place-items-center p-6">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={d.brandLogo} alt={d.brandName} className="max-h-16 max-w-[70%] object-contain opacity-90" />
                  </span>
                ) : (
                  <span className="absolute inset-0 grid place-items-center font-display text-5xl italic text-white/25">
                    {d.brandName.charAt(0)}
                  </span>
                )}
              </div>

              {/* Meta */}
              <div className="p-3">
                <div className="flex items-center gap-1.5">
                  {d.brandLogo && (
                    <span className="relative h-4 w-4 flex-none overflow-hidden rounded-full border border-espresso-line bg-white">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={d.brandLogo} alt="" className="absolute inset-0 h-full w-full object-cover" />
                    </span>
                  )}
                  <span className="truncate text-[9px] font-bold uppercase tracking-[1.2px] text-terracotta">
                    {d.brandName}
                  </span>
                </div>
                <p className="mt-1 truncate font-display text-[15px] leading-tight text-espresso-cream">{d.name}</p>
                <p className="mt-0.5 text-[12.5px] font-semibold text-espresso-cream">{formatDKK(d.price_dkk)}</p>
                <p className="mt-2 flex items-center gap-1 text-[10.5px] text-espresso-muted">
                  {d.via === 'scan-retailer' ? (
                    <MapPin className="h-3 w-3 flex-none text-espresso-muted-2" />
                  ) : d.via === 'scan-peer' ? (
                    <Users className="h-3 w-3 flex-none text-espresso-muted-2" />
                  ) : (
                    <Heart className="h-3 w-3 flex-none text-espresso-muted-2" />
                  )}
                  <span className="truncate">
                    {d.via === 'scan-retailer'
                      ? `Scanned at ${d.retailerName ?? 'a shop'}`
                      : d.via === 'scan-peer'
                      ? 'Shared with you'
                      : 'Saved'}{' '}
                    · {timeAgo(d.when)}
                  </span>
                </p>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
