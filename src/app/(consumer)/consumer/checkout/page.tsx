'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/components/providers/auth-provider';
import { createClient } from '@/lib/supabase';
import { DELIVERY_FEE_ORE, clearBasket, groupByBrand, useBasket, type BasketItem } from '@/components/consumer/basket-store';
import {
  BottomAction,
  DeliverToCard,
  DeliveryCard,
  FlaymsCard,
  OrderPlaced,
  PaymentPicker,
  ScreenHeader,
  SummaryCard,
  type PaymentMethod,
  type PlacedItem,
} from '@/components/consumer/checkout-parts';
import { formatDKK } from '@/lib/utils';

type OrderResult = { order_id: string; order_number: number; brand_name: string; product_name: string };

// Figma 06: checkout for the whole basket. Each basket item is sent to the
// existing POST /api/checkout on its own, so every item becomes its own order
// exactly as a single "buy" always has. Points are redeemed on the first one.
export default function BasketCheckoutPage() {
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();
  const items = useBasket();
  const [mounted, setMounted] = useState(false);

  const [shipping, setShipping] = useState({ name: '', address: '', postalCode: '', city: '' });
  const [payment, setPayment] = useState<PaymentMethod>('mobilepay');
  const [pointsBalance, setPointsBalance] = useState(0);
  const [pointsToUse, setPointsToUse] = useState(0);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [placed, setPlaced] = useState<{ orders: OrderResult[]; items: BasketItem[]; failed: BasketItem[] } | null>(null);

  useEffect(() => setMounted(true), []);

  useEffect(() => {
    if (!authLoading && !user) {
      router.push(`/auth/signup?role=consumer&redirect=/consumer/checkout`);
    }
  }, [authLoading, user, router]);

  useEffect(() => {
    if (!user) return;
    createClient()
      .rpc('get_points_balance', { p_user_id: user.id })
      .then(({ data }: { data: number | null }) => setPointsBalance(data ?? 0));
  }, [user]);

  // Nothing to check out (and nothing just placed): back to the basket.
  useEffect(() => {
    if (mounted && items.length === 0 && !placed && !submitting) router.replace('/consumer/basket');
  }, [mounted, items.length, placed, submitting, router]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (items.length === 0) return;
    setError('');
    setSubmitting(true);

    const toOrder = [...items];
    const orders: OrderResult[] = [];
    const done: BasketItem[] = [];
    const failed: { item: BasketItem; message: string }[] = [];

    for (let i = 0; i < toOrder.length; i++) {
      const item = toOrder[i];
      try {
        const res = await fetch('/api/checkout', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            product_id: item.productId,
            size: item.size,
            color: item.color,
            shipping_name: shipping.name,
            shipping_address: shipping.address,
            shipping_city: shipping.city,
            shipping_postal_code: shipping.postalCode,
            points_to_use: i === 0 ? pointsToUse : 0,
          }),
        });
        const data = await res.json();
        if (!res.ok) {
          failed.push({ item, message: data.error || 'Something went wrong' });
          continue;
        }
        orders.push(data);
        done.push(item);
      } catch {
        failed.push({ item, message: 'Network error — please try again' });
      }
    }

    // Ordered items leave the basket; failed ones stay so they can be retried.
    clearBasket(done.map((d) => d.key));

    if (orders.length === 0) {
      setError(failed.map((f) => `${f.item.name}: ${f.message}`).join('\n'));
      setSubmitting(false);
      return;
    }
    setPlaced({ orders, items: done, failed: failed.map((f) => f.item) });
    setSubmitting(false);
  }

  // ---- Order placed (Figma 14) ----
  if (placed) {
    const placedItems: PlacedItem[] = placed.items.map((i) => ({
      name: i.name,
      brand: i.brandName,
      size: i.size,
      priceOre: i.priceOre,
      image: i.image,
    }));
    const store = placed.items.find((i) => i.foundVia?.type === 'retailer')?.foundVia?.name;
    return (
      <OrderPlaced
        items={placedItems}
        supporting={store}
        orderHref={placed.orders.length === 1 ? `/consumer/orders/${placed.orders[0].order_id}` : '/consumer/orders'}
        note={
          placed.failed.length > 0 && (
            <p>
              {placed.failed.map((f) => f.name).join(', ')} couldn&rsquo;t be ordered and {placed.failed.length === 1 ? 'is' : 'are'} still in your
              basket.
            </p>
          )
        }
      />
    );
  }

  // ---- Loading ----
  if (!mounted || authLoading || !user || items.length === 0) {
    return (
      <div aria-busy>
        <ScreenHeader title="Checkout" />
        <div className="space-y-4 px-5 pt-5">
          <div className="h-[93px] animate-pulse bg-surface-dark" />
          <div className="h-[142px] animate-pulse bg-surface-dark" />
          <div className="h-14 animate-pulse bg-surface-dark" />
        </div>
      </div>
    );
  }

  const groups = groupByBrand(items);
  const subtotal = items.reduce((sum, i) => sum + i.priceOre, 0);
  const delivery = groups.length * DELIVERY_FEE_ORE;
  // Same cap as the single-item checkout, applied to the first order.
  const pointsCapped = Math.min(pointsBalance, Math.floor(items[0].priceOre / 100));
  const discountOre = pointsToUse * 100;
  const totalOre = Math.max(subtotal + delivery - discountOre, 0);

  return (
    <form onSubmit={handleSubmit} className="pb-40">
      <ScreenHeader title="Checkout" onBack={() => router.back()} />

      <div className="space-y-4 px-5 pt-5">
        <DeliverToCard value={shipping} onChange={setShipping} />
        <DeliveryCard brands={groups.map((g) => ({ name: g.brandName, feeOre: DELIVERY_FEE_ORE }))} />
        {pointsBalance > 0 && <FlaymsCard balance={pointsBalance} value={pointsToUse} max={pointsCapped} onChange={setPointsToUse} />}
        <PaymentPicker value={payment} onChange={setPayment} />
        <SummaryCard
          rows={[
            { label: `Subtotal (${items.length} ${items.length === 1 ? 'item' : 'items'})`, valueOre: subtotal },
            { label: 'Delivery', valueOre: delivery },
            ...(pointsToUse > 0 ? [{ label: `Flayms (−${pointsToUse})`, valueOre: -discountOre, accent: true }] : []),
          ]}
          totalOre={totalOre}
        />
        {error && (
          <p role="alert" className="whitespace-pre-line border border-accent/40 bg-surface-dark px-4 py-3 text-caption text-on-primary">
            {error}
          </p>
        )}
      </div>

      <BottomAction type="submit" loading={submitting} note="One payment to Flaym. Each brand gets its own order.">
        {submitting ? 'Placing order…' : `Pay ${formatDKK(totalOre)}`}
      </BottomAction>
    </form>
  );
}
