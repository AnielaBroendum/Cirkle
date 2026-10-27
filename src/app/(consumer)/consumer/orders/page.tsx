'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/components/providers/auth-provider';
import { createClient } from '@/lib/supabase';
import { buttonClasses, cn } from '@/components/ds';
import { ScreenHeader } from '@/components/consumer/checkout-parts';
import { ACTIVE_STATUSES, expectedDelivery, formatDay, isPastDay } from '@/components/consumer/order-utils';

type Order = {
  id: string;
  order_number: number;
  status: string;
  total_dkk: number;
  created_at: string;
  tracking_number: string | null;
  brand_profiles: { name: string } | null;
  order_items: {
    product_name: string;
    size: string | null;
    color: string | null;
    products: { images: string[] };
  }[];
  order_events: { status: string; created_at: string }[];
};

function fmt(iso: string, withTime = false) {
  return new Date(iso).toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'short',
    ...(withTime ? { hour: '2-digit', minute: '2-digit' } : {}),
  });
}

/** Figma 07 card: three steps, Placed → Shipped → Delivered. */
function OrderCard({ order }: { order: Order }) {
  const at = (status: string) => order.order_events?.find((e) => e.status === status)?.created_at;
  const cancelled = order.status === 'cancelled';
  const shippedAt = at('shipped');
  const deliveredAt = at('delivered');
  const steps = [
    { label: 'Order placed', done: true, meta: fmt(at('pending') ?? order.created_at, true) },
    {
      label: 'Shipped',
      done: !!shippedAt || order.status === 'delivered',
      meta: shippedAt ? [fmt(shippedAt), order.tracking_number].filter(Boolean).join(' · ') : null,
    },
    cancelled
      ? { label: 'Cancelled', done: true, meta: null }
      : { label: 'Delivered', done: order.status === 'delivered', meta: deliveredAt ? fmt(deliveredAt) : 'Moves to Owned' },
  ];
  const count = order.order_items?.length ?? 0;

  return (
    <Link href={`/consumer/orders/${order.id}`} className="block bg-surface-dark p-4 transition-colors hover:bg-surface-dark/80">
      <div className="flex items-start justify-between gap-3">
        <p className="min-w-0 truncate text-body text-on-primary">
          {order.brand_profiles?.name ?? order.order_items?.[0]?.product_name ?? 'Order'} · {count} {count === 1 ? 'item' : 'items'}
        </p>
        <span className="shrink-0 rounded-pill bg-line-dark px-2.5 py-0.5 text-caption font-medium text-on-primary">#{order.order_number}</span>
      </div>
      <ol className="mt-4 space-y-4">
        {steps.map((s) => (
          <li key={s.label} className="flex gap-3.5">
            <span
              className={cn('mt-0.5 h-3.5 w-3.5 shrink-0 rounded-pill border-2', s.done ? 'border-accent bg-accent' : 'border-char bg-canvas-dark')}
              aria-hidden
            />
            <div>
              <p className={cn('text-body', s.done ? 'text-on-primary' : 'text-smoke')}>{s.label}</p>
              {s.meta && <p className="mt-1 text-caption text-smoke">{s.meta}</p>}
            </div>
          </li>
        ))}
      </ol>
    </Link>
  );
}

export default function ConsumerOrdersPage() {
  const router = useRouter();
  const { user } = useAuth();
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    const supabase = createClient();

    supabase
      .from('orders')
      .select(`
        id, order_number, status, total_dkk, created_at, tracking_number,
        brand_profiles (name),
        order_items (
          product_name, size, color,
          products (images)
        ),
        order_events (status, created_at)
      `)
      .eq('consumer_user_id', user.id)
      .order('created_at', { ascending: false })
      .then(({ data }: { data: Order[] | null }) => {
        setOrders(data ?? []);
        setLoading(false);
      });
  }, [user]);

  // "Arriving": the soonest expected delivery among orders still on their way.
  const nextArrival = orders
    .filter((o) => ACTIVE_STATUSES.includes(o.status))
    .map((o) => expectedDelivery(o.created_at).from)
    .sort((a, b) => a.getTime() - b.getTime())[0];

  return (
    <div className="pb-6">
      <ScreenHeader title="Your orders" onBack={() => router.back()} />

      {loading ? (
        <div className="space-y-4 px-5 pt-5" aria-busy>
          <div className="h-[99px] animate-pulse bg-surface-dark" />
          <div className="h-[195px] animate-pulse bg-surface-dark" />
          <div className="h-[195px] animate-pulse bg-surface-dark" />
        </div>
      ) : orders.length === 0 ? (
        <div className="flex flex-col items-center px-5 pt-24 text-center">
          <p className="font-brand text-title uppercase tracking-[0.4px] text-on-primary">No orders yet</p>
          <p className="mt-3 max-w-[260px] text-body text-ash">Scan a Flaym tag in a store to discover and buy something.</p>
          <Link href="/consumer/home" className={buttonClasses({ variant: 'accent', className: 'mt-8 w-full max-w-[280px]' })}>
            Scan a tag
          </Link>
        </div>
      ) : (
        <div className="space-y-4 px-5 pt-5">
          {nextArrival && (
            <div className="bg-accent px-5 py-5 text-on-primary">
              <p className="text-label uppercase">{isPastDay(nextArrival) ? 'Was expected' : 'Arriving'}</p>
              <p className="mt-1 text-[30px] font-medium leading-tight">{formatDay(nextArrival)}</p>
            </div>
          )}
          {orders.map((order) => (
            <OrderCard key={order.id} order={order} />
          ))}
        </div>
      )}
    </div>
  );
}
