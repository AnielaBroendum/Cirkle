'use client';

import { useEffect, useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { useAuth } from '@/components/providers/auth-provider';
import { createClient } from '@/lib/supabase';
import { buttonClasses } from '@/components/ds';
import { useFlayms } from '@/components/consumer/use-flayms';

// Figma 18 "Owned item": one delivered order item.

type ItemRow = {
  id: string;
  product_id: string;
  product_name: string;
  orders: {
    id: string;
    status: string;
    consumer_user_id: string;
    created_at: string;
    order_events: { status: string; created_at: string }[];
  };
  products: { images: string[] | null; brand_profiles: { name: string } | null } | null;
};

export default function OwnedItemPage() {
  const router = useRouter();
  const { itemId } = useParams<{ itemId: string }>();
  const { user } = useAuth();
  const { stats } = useFlayms();
  const [item, setItem] = useState<ItemRow | null>(null);
  const [boughtAt, setBoughtAt] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    const supabase = createClient();
    (async () => {
      const { data } = await supabase
        .from('order_items')
        .select(
          'id, product_id, product_name, orders!inner ( id, status, consumer_user_id, created_at, order_events ( status, created_at ) ), products ( images, brand_profiles ( name ) )'
        )
        .eq('id', itemId)
        .eq('orders.consumer_user_id', user.id)
        .maybeSingle();
      const row = data as ItemRow | null;
      setItem(row);
      setLoading(false);
      if (!row) return;

      // Where you first found it (same "first scan wins" rule as the product page).
      const { data: scan } = await supabase
        .from('scans')
        .select('source_type, retailer_profiles:source_retailer_id ( name ), profiles:source_user_id ( name )')
        .eq('product_id', row.product_id)
        .eq('scanner_user_id', user.id)
        .order('scanned_at', { ascending: true })
        .limit(1)
        .maybeSingle();
      const s = scan as { source_type: string; retailer_profiles: { name: string } | null; profiles: { name: string } | null } | null;
      if (s) setBoughtAt(s.source_type === 'retailer' ? s.retailer_profiles?.name ?? null : s.profiles?.name ? `via ${s.profiles.name.split(' ')[0]}` : null);
    })();
  }, [user, itemId]);

  if (loading) {
    return (
      <div aria-busy>
        <div className="h-[380px] animate-pulse bg-surface-dark" />
        <div className="space-y-3 px-5 pt-5">
          <div className="h-3 w-20 animate-pulse bg-surface-dark" />
          <div className="h-6 w-48 animate-pulse bg-surface-dark" />
          <div className="h-[103px] animate-pulse bg-surface-dark" />
        </div>
      </div>
    );
  }

  if (!item || item.orders.status !== 'delivered') {
    return (
      <div className="flex flex-col items-center px-5 pt-32 text-center">
        <p className="font-brand text-title uppercase tracking-[0.4px] text-on-primary">{item ? 'Not delivered yet' : 'Item not found'}</p>
        <p className="mt-3 max-w-[260px] text-body text-ash">
          {item ? 'It moves to Owned once it arrives.' : 'It may belong to another account, or the link is wrong.'}
        </p>
        <Link
          href={item ? `/consumer/orders/${item.orders.id}` : '/consumer/profile'}
          className={buttonClasses({ variant: 'accent', className: 'mt-8 w-full max-w-[280px]' })}
        >
          {item ? 'Follow your order' : 'Back to Profile'}
        </Link>
      </div>
    );
  }

  const image = item.products?.images?.[0] ?? null;
  const deliveredAt = item.orders.order_events.find((e) => e.status === 'delivered')?.created_at ?? item.orders.created_at;
  const productStats = stats?.byProduct[item.product_id] ?? { passedOn: 0, lit: 0 };

  return (
    <div className="pb-36">
      <div className="relative h-[380px] bg-flaym-gradient">
        {image && <Image src={image} alt={item.product_name} fill className="object-cover" sizes="(max-width: 512px) 100vw, 512px" priority />}
        <button
          type="button"
          onClick={() => router.back()}
          aria-label="Back"
          className="absolute left-5 top-14 grid h-9 w-9 place-items-center rounded-pill bg-primary/60 text-body text-on-primary"
        >
          ←
        </button>
      </div>

      <div className="px-5 pt-[18px]">
        <p className="text-label uppercase text-smoke">{item.products?.brand_profiles?.name}</p>
        <h1 className="mt-1.5 font-brand text-heading-lg font-normal uppercase text-on-primary">{item.product_name}</h1>
        <span className="mt-3 inline-block rounded-pill bg-accent-subtle px-2.5 py-0.5 text-caption font-medium text-accent-strong">
          Owned since {new Date(deliveredAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}
        </span>

        <dl className="mt-3.5 space-y-2.5 bg-surface-dark p-4 text-body-sm">
          <div className="flex justify-between">
            <dt className="text-smoke">Passed on</dt>
            <dd className="text-on-primary">{stats ? `${productStats.passedOn} ${productStats.passedOn === 1 ? 'time' : 'times'}` : '–'}</dd>
          </div>
          <div className="flex justify-between">
            <dt className="text-smoke">Flames lit</dt>
            <dd className="text-accent">{stats ? productStats.lit : '–'}</dd>
          </div>
          {boughtAt && (
            <div className="flex justify-between">
              <dt className="text-smoke">Bought at</dt>
              <dd className="text-on-primary">{boughtAt}</dd>
            </div>
          )}
        </dl>

        <Link href={`/d/${item.product_id}/about`} className="mt-1.5 flex items-center justify-between py-2 text-body text-on-primary">
          About this product <span className="text-body-sm text-accent">›</span>
        </Link>
      </div>

      <div className="fixed inset-x-0 bottom-16 z-30 bg-canvas-dark">
        <div className="mx-auto max-w-lg px-5 pb-2 pt-3">
          <Link
            href={`/consumer/qr?order=${item.orders.id}&product=${item.product_id}`}
            className="flex h-[52px] w-full items-center justify-center bg-accent text-body-lg font-medium text-on-primary hover:bg-accent/90"
          >
            Pass it on
          </Link>
          <Link
            href={`/consumer/orders/${item.orders.id}/return?item=${item.id}`}
            className="mt-2 block text-center text-caption text-ash underline-offset-2 hover:underline"
          >
            Request a return
          </Link>
        </div>
      </div>
    </div>
  );
}
