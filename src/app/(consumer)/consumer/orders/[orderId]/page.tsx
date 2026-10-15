'use client';

import { useEffect, useState } from 'react';
import { useRouter, useParams } from 'next/navigation';
import Image from 'next/image';
import Link from 'next/link';
import { ExternalLink, Share2, Download } from 'lucide-react';
import { useAuth } from '@/components/providers/auth-provider';
import { createClient } from '@/lib/supabase';
import { formatDKK } from '@/lib/utils';
import OrderTimeline from '@/components/consumer/order-timeline';
import { buttonClasses } from '@/components/ds';
import { DarkCard, ScreenHeader, Thumb } from '@/components/consumer/checkout-parts';
import { expectedDelivery, formatRange, isPastDay } from '@/components/consumer/order-utils';

type OrderDetail = {
  id: string;
  order_number: number;
  status: string;
  total_dkk: number;
  points_used: number;
  discount_dkk: number;
  shipping_name: string;
  shipping_address: string;
  shipping_city: string;
  shipping_postal_code: string;
  tracking_number: string | null;
  tracking_url: string | null;
  created_at: string;
  brand_profiles: { name: string };
  order_items: {
    id: string;
    product_name: string;
    size: string | null;
    color: string | null;
    quantity: number;
    unit_price_dkk: number;
    products: { images: string[] };
  }[];
  order_events: {
    id: string;
    status: string;
    note: string | null;
    created_at: string;
  }[];
};

export default function OrderDetailPage() {
  const router = useRouter();
  const { orderId } = useParams<{ orderId: string }>();
  const { user } = useAuth();
  const [order, setOrder] = useState<OrderDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [peerQR, setPeerQR] = useState<{ product_id: string; url: string; qr_data_url: string }[] | null>(null);

  useEffect(() => {
    if (!user) return;
    const supabase = createClient();

    supabase
      .from('orders')
      .select(`
        *,
        brand_profiles (name),
        order_items (
          id, product_name, size, color, quantity, unit_price_dkk,
          products (images)
        ),
        order_events (
          id, status, note, created_at
        )
      `)
      .eq('id', orderId)
      .eq('consumer_user_id', user.id)
      .single()
      .then(({ data }: { data: OrderDetail | null }) => {
        setOrder(data);
        setLoading(false);
      });
  }, [user, orderId]);

  useEffect(() => {
    if (!order || order.status !== 'delivered') return;
    fetch(`/api/orders/${orderId}/qr`)
      .then((r) => r.json())
      .then((data) => {
        if (data.qr_codes) setPeerQR(data.qr_codes);
      })
      .catch(() => {});
  }, [order, orderId]);

  function downloadQR(dataUrl: string) {
    const link = document.createElement('a');
    link.download = 'flaym-share-qr.png';
    link.href = dataUrl;
    link.click();
  }

  async function shareQR(url: string) {
    if (navigator.share) {
      await navigator.share({
        title: 'Pass it on — Flaym',
        text: 'Scan this QR code to discover this product!',
        url,
      });
    } else {
      await navigator.clipboard.writeText(url);
    }
  }

  if (loading) {
    return (
      <div aria-busy>
        <ScreenHeader title="" onBack={() => router.back()} />
        <div className="space-y-4 px-5 pt-5">
          <div className="h-3 w-32 animate-pulse bg-surface-dark" />
          <div className="h-10 w-48 animate-pulse bg-surface-dark" />
          <div className="h-48 animate-pulse bg-surface-dark" />
        </div>
      </div>
    );
  }

  if (!order) {
    return (
      <div>
        <ScreenHeader title="" onBack={() => router.back()} />
        <div className="flex flex-col items-center px-5 pt-24 text-center">
          <p className="font-brand text-[18px] uppercase tracking-[0.4px] text-on-primary">Order not found</p>
          <p className="mt-3 max-w-[260px] text-body text-line">It may belong to another account, or the link is wrong.</p>
          <Link href="/consumer/orders" className={buttonClasses({ variant: 'accent', className: 'mt-8 w-full max-w-[280px]' })}>
            See your orders
          </Link>
        </div>
      </div>
    );
  }

  const delivered = order.status === 'delivered';
  const cancelled = order.status === 'cancelled';
  const { from, to } = expectedDelivery(order.created_at);
  const deliveredAt = order.order_events.find((e) => e.status === 'delivered')?.created_at;
  const firstImage = order.order_items[0]?.products?.images?.[0] ?? null;

  return (
    <div className="pb-10">
      <ScreenHeader
        title=""
        onBack={() => router.back()}
        right={<span className="text-caption leading-none text-line">#{order.order_number}</span>}
      />

      <div className="px-5">
        {delivered ? (
          /* Figma 17 "Delivered" */
          <section className="pt-6 text-center">
            <h1 className="font-brand text-[28px] font-normal uppercase tracking-[0.6px] text-on-primary">It&rsquo;s here.</h1>
            <p className="mt-3 text-body text-line">Now it&rsquo;s yours.</p>
            <div className="relative mx-auto mt-6 aspect-square w-full max-w-[260px] bg-flaym-gradient">
              {firstImage && <Image src={firstImage} alt={order.order_items[0].product_name} fill className="object-cover" sizes="260px" />}
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src="/icons/flame-white.svg" alt="" width={18} height={26} className="absolute right-3.5 top-3.5" />
            </div>
            <span className="mt-6 inline-block rounded-pill bg-accent-subtle px-2.5 py-0.5 text-caption font-medium text-accent-strong">Moved to Owned</span>
            <p className="mt-4 text-body text-line">
              When someone asks,
              <br />
              pass the flame on.
            </p>
            <a href="#pass-it-on" className="mt-8 flex h-[52px] w-full items-center justify-center bg-accent text-[15px] font-medium text-on-primary hover:bg-accent/90">
              Pass it on
            </a>
            {deliveredAt && <p className="mt-3 text-caption text-muted">Delivered {new Date(deliveredAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'long' })}</p>}
          </section>
        ) : (
          /* Figma 15 "Tracking" */
          <section className="pt-4">
            <p className="text-label uppercase text-muted">{cancelled ? 'Order' : isPastDay(to) ? 'Was expected' : 'Expected delivery'}</p>
            <p className="mt-2 text-[34px] font-medium leading-tight text-on-primary">{cancelled ? 'Cancelled' : formatRange(from, to)}</p>
            <p className="mt-2 text-[13px] text-line">
              {order.tracking_number ? `Tracking ${order.tracking_number}` : 'Ships from the brand'} · {order.brand_profiles.name}
            </p>
          </section>
        )}

        {/* Status timeline */}
        <section className={delivered ? 'mt-10' : 'mt-7'}>
          {delivered && <p className="mb-4 text-label uppercase text-muted">Status</p>}
          <OrderTimeline
            events={order.order_events.sort(
              (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
            )}
          />
        </section>

        {/* Tracking link */}
        {order.tracking_url && (
          <a
            href={order.tracking_url}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-2 inline-flex items-center gap-1.5 text-body text-accent hover:underline"
          >
            Track parcel <ExternalLink className="h-3.5 w-3.5" />
          </a>
        )}

        {/* Live map: Phase 2 in Figma */}
        {!delivered && !cancelled && (
          <div className="mt-6 flex flex-col items-center gap-2 rounded-[14px] border-[1.5px] border-dashed border-muted px-4 py-5 text-center">
            <p className="text-[13px] text-line">Live map if the carrier supports it</p>
            <span className="rounded-pill bg-warning-subtle px-2 py-0.5 text-[10px] font-medium uppercase tracking-[0.6px] text-warning">Phase 2</span>
          </div>
        )}

        {/* Peer discovery QR (Figma 10b "Pass it on") */}
        {peerQR && peerQR.length > 0 && (
          <section id="pass-it-on" className="mt-8 scroll-mt-6 bg-surface-dark p-5">
            <p className="text-label uppercase text-muted">Pass it on</p>
            <p className="mt-2 text-body text-line">Friends scan this code to find it. When they buy, you get 50 Flayms.</p>
            {peerQR.map((qr) => (
              <div key={qr.product_id} className="mt-5 space-y-4">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={qr.qr_data_url} alt="Peer discovery QR code" className="mx-auto h-48 w-48 bg-on-primary p-2" />
                <div className="flex gap-2.5">
                  <button
                    type="button"
                    onClick={() => shareQR(qr.url)}
                    className="flex h-11 flex-1 items-center justify-center gap-2 bg-accent text-body font-medium text-on-primary hover:bg-accent/90"
                  >
                    <Share2 className="h-4 w-4" /> Share
                  </button>
                  <button
                    type="button"
                    onClick={() => downloadQR(qr.qr_data_url)}
                    className="flex h-11 flex-1 items-center justify-center gap-2 border border-muted text-body font-medium text-on-primary hover:border-on-primary"
                  >
                    <Download className="h-4 w-4" /> Download
                  </button>
                </div>
              </div>
            ))}
          </section>
        )}

        {/* Items */}
        <section className="mt-8">
          <p className="text-label uppercase text-muted">Products</p>
          <ul className="mt-3 space-y-2">
            {order.order_items.map((item) => (
              <li key={item.id} className="flex items-center gap-3.5 bg-surface-dark p-4">
                <Thumb src={item.products?.images?.[0] ?? null} alt={item.product_name} className="h-[70px] w-14" />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-body text-on-primary">{item.product_name}</p>
                  {(item.size || item.color) && (
                    <p className="text-caption text-muted">{[item.size && `Size ${item.size}`, item.color].filter(Boolean).join(' · ')}</p>
                  )}
                  <p className="mt-0.5 text-caption text-line">
                    {item.quantity} × {formatDKK(item.unit_price_dkk)}
                  </p>
                </div>
              </li>
            ))}
          </ul>
        </section>

        {/* Summary */}
        <DarkCard className="mt-4 space-y-3 text-body">
          <div className="flex justify-between">
            <span className="text-muted">Subtotal</span>
            <span>{formatDKK(order.total_dkk + order.discount_dkk)}</span>
          </div>
          {order.points_used > 0 && (
            <div className="flex justify-between text-accent">
              <span>Flayms ({order.points_used})</span>
              <span>−{formatDKK(order.discount_dkk)}</span>
            </div>
          )}
          <div className="flex justify-between">
            <span className="text-muted">Delivery</span>
            <span>Free</span>
          </div>
          <div className="flex justify-between font-medium">
            <span>Total</span>
            <span>{formatDKK(order.total_dkk)}</span>
          </div>
        </DarkCard>

        {/* Shipping */}
        <DarkCard className="mt-4">
          <p className="text-label uppercase text-muted">Deliver to</p>
          <p className="mt-2 text-body text-on-primary">{order.shipping_name}</p>
          <p className="mt-1 text-[13px] text-line">{order.shipping_address}</p>
          <p className="text-[13px] text-line">
            {order.shipping_postal_code} {order.shipping_city}
          </p>
        </DarkCard>

        <p className="mt-6 text-center text-caption text-muted">
          Packed and shipped by {order.brand_profiles.name} ·{' '}
          {new Date(order.created_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })}
        </p>
      </div>
    </div>
  );
}
