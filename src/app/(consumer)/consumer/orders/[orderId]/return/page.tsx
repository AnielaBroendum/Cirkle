'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import { useAuth } from '@/components/providers/auth-provider';
import { createClient } from '@/lib/supabase';
import { formatDKK } from '@/lib/utils';
import { buttonClasses, cn } from '@/components/ds';
import { BottomAction, ScreenHeader, Thumb } from '@/components/consumer/checkout-parts';

// Figma 11 "Request a return". Saves through POST /api/returns.

type Item = {
  id: string;
  product_name: string;
  size: string | null;
  unit_price_dkk: number;
  products: { images: string[] } | null;
};

type Order = {
  id: string;
  order_number: number;
  status: string;
  brand_profiles: { name: string } | null;
  order_items: Item[];
};

type ExistingReturn = { order_item_id: string; status: string; created_at: string };

const REASONS = [
  { id: 'too_big', label: 'Too big' },
  { id: 'too_small', label: 'Too small' },
  { id: 'not_as_expected', label: 'Not as expected' },
  { id: 'faulty', label: 'Faulty' },
] as const;

const STATUS_TEXT: Record<string, string> = {
  requested: 'Return requested. The brand is reviewing it.',
  approved: 'Return approved. Send it back to the brand.',
  rejected: 'The brand declined this return.',
  received: 'The brand has received your return.',
  refunded: 'Refunded.',
};

export default function RequestReturnPage() {
  const router = useRouter();
  const { orderId } = useParams<{ orderId: string }>();
  const itemParam = useSearchParams().get('item');
  const { user } = useAuth();

  const [order, setOrder] = useState<Order | null>(null);
  const [existing, setExisting] = useState<ExistingReturn[]>([]);
  const [loading, setLoading] = useState(true);
  const [itemId, setItemId] = useState<string | null>(itemParam);
  const [reason, setReason] = useState<(typeof REASONS)[number]['id'] | null>(null);
  const [comment, setComment] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [sent, setSent] = useState(false);

  useEffect(() => {
    if (!user) return;
    createClient()
      .from('orders')
      .select('id, order_number, status, brand_profiles (name), order_items (id, product_name, size, unit_price_dkk, products (images))')
      .eq('id', orderId)
      .eq('consumer_user_id', user.id)
      .single()
      .then(({ data }: { data: Order | null }) => {
        setOrder(data);
        if (data && !itemParam && data.order_items.length === 1) setItemId(data.order_items[0].id);
        setLoading(false);
      });

    fetch(`/api/returns?order_id=${orderId}`)
      .then((r) => (r.ok ? r.json() : { returns: [] }))
      .then((d) => setExisting(d.returns ?? []))
      .catch(() => {});
  }, [user, orderId, itemParam]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!itemId) return setError('Pick the item you want to return');
    if (!reason) return setError('Tell us why you’re returning it');
    setError('');
    setSubmitting(true);
    try {
      const res = await fetch('/api/returns', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ order_item_id: itemId, reason, comment }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error || 'Something went wrong');
        setSubmitting(false);
        return;
      }
      setSent(true);
    } catch {
      setError('Network error — please try again');
    }
    setSubmitting(false);
  }

  const back = () => router.back();

  if (loading) {
    return (
      <div aria-busy>
        <ScreenHeader title="Return" onBack={back} />
        <div className="space-y-4 px-5 pt-5">
          <div className="h-[70px] animate-pulse bg-surface-dark" />
          {[0, 1, 2, 3].map((i) => (
            <div key={i} className="h-[50px] animate-pulse bg-surface-dark" />
          ))}
        </div>
      </div>
    );
  }

  if (!order || order.status !== 'delivered') {
    return (
      <div>
        <ScreenHeader title="Return" onBack={back} />
        <div className="flex flex-col items-center px-5 pt-24 text-center">
          <p className="font-brand text-[18px] uppercase tracking-[0.4px] text-on-primary">
            {order ? 'Not delivered yet' : 'Order not found'}
          </p>
          <p className="mt-3 max-w-[260px] text-body text-line">
            {order ? 'You can request a return once your order has arrived.' : 'It may belong to another account, or the link is wrong.'}
          </p>
          <Link href={order ? `/consumer/orders/${order.id}` : '/consumer/orders'} className={buttonClasses({ variant: 'accent', className: 'mt-8 w-full max-w-[280px]' })}>
            {order ? 'Back to your order' : 'See your orders'}
          </Link>
        </div>
      </div>
    );
  }

  const brand = order.brand_profiles?.name ?? 'The brand';

  if (sent) {
    return (
      <div className="px-5 pb-28 pt-[117px] text-center">
        <div className="mx-auto grid h-[88px] w-[88px] place-items-center rounded-pill border-[3px] border-accent text-[40px] leading-none text-accent">✓</div>
        <h1 className="mt-6 font-brand text-[24px] font-normal uppercase tracking-[0.5px] text-on-primary">Return requested</h1>
        <p className="mx-auto mt-4 max-w-[280px] text-body text-line">
          {brand} will review it. Flaym refunds you once the brand approves.
        </p>
        <BottomAction href={`/consumer/orders/${order.id}`}>Back to your order</BottomAction>
      </div>
    );
  }

  const selected = order.order_items.find((i) => i.id === itemId);
  const already = existing.find((r) => r.order_item_id === itemId);

  return (
    <form onSubmit={handleSubmit} className="pb-36">
      <ScreenHeader title="Return" onBack={back} />

      <div className="px-5 pt-4">
        {/* Item(s) */}
        <ul className="space-y-2">
          {(selected ? [selected] : order.order_items).map((item) => {
            const pickable = !selected && order.order_items.length > 1;
            const content = (
              <>
                <Thumb src={item.products?.images?.[0] ?? null} alt={item.product_name} className="h-[70px] w-14" />
                <div className="min-w-0 text-left">
                  <p className="truncate text-body text-on-primary">{item.product_name}</p>
                  <p className="truncate text-caption text-muted">
                    {[item.size && `Size ${item.size}`, formatDKK(item.unit_price_dkk), `#${order.order_number}`].filter(Boolean).join(' · ')}
                  </p>
                </div>
              </>
            );
            return (
              <li key={item.id}>
                {pickable ? (
                  <button type="button" onClick={() => setItemId(item.id)} className="flex w-full items-center gap-3.5 bg-surface-dark p-3 hover:outline hover:outline-1 hover:outline-muted">
                    {content}
                  </button>
                ) : (
                  <div className="flex items-center gap-3.5">{content}</div>
                )}
              </li>
            );
          })}
        </ul>
        {!selected && order.order_items.length > 1 && <p className="mt-3 text-caption text-line">Which item do you want to return?</p>}
        {selected && order.order_items.length > 1 && (
          <button type="button" onClick={() => setItemId(null)} className="mt-2 text-caption text-muted underline-offset-2 hover:underline">
            Choose another item
          </button>
        )}

        {already ? (
          <div className="mt-6 bg-surface-dark p-4">
            <p className="text-label uppercase text-muted">Already requested</p>
            <p className="mt-2 text-body text-on-primary">{STATUS_TEXT[already.status] ?? already.status}</p>
            <p className="mt-1 text-caption text-muted">
              Sent {new Date(already.created_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'long' })}
            </p>
          </div>
        ) : (
          selected && (
            <>
              <fieldset className="mt-4">
                <legend className="text-label uppercase text-muted">Why are you returning it?</legend>
                <div className="mt-3 space-y-4">
                  {REASONS.map((r) => {
                    const on = reason === r.id;
                    return (
                      <label key={r.id} className={cn('flex h-[50px] cursor-pointer items-center justify-between bg-surface-dark px-4', on && 'outline outline-1 outline-accent/40')}>
                        <input
                          type="radio"
                          name="reason"
                          value={r.id}
                          checked={on}
                          onChange={() => {
                            setReason(r.id);
                            setError('');
                          }}
                          className="sr-only"
                        />
                        <span className="text-body text-on-primary">{r.label}</span>
                        <span className={cn('h-[18px] w-[18px] rounded-pill', on ? 'border-[5px] border-accent' : 'border-[1.5px] border-muted')} aria-hidden />
                      </label>
                    );
                  })}
                </div>
              </fieldset>

              <label className="mt-4 block">
                <span className="text-label uppercase text-muted">Anything else? (optional)</span>
                <textarea
                  value={comment}
                  onChange={(e) => setComment(e.target.value)}
                  rows={3}
                  maxLength={1000}
                  className="mt-2 w-full resize-none border border-line-dark bg-transparent p-3 text-body text-on-primary placeholder:text-muted focus:border-accent focus:outline-none"
                  placeholder="E.g. the colour looked different"
                />
              </label>

              <p className="mt-4 text-caption leading-[19px] text-line">
                {brand}&rsquo;s return policy applies: 30 days, unused, with tags. Flaym refunds you once the brand approves.
              </p>
            </>
          )
        )}

        {error && (
          <p role="alert" className="mt-4 border border-accent/40 bg-surface-dark px-4 py-3 text-caption text-on-primary">
            {error}
          </p>
        )}
      </div>

      {!already && (
        <BottomAction type="submit" loading={submitting} disabled={!selected}>
          Send return request
        </BottomAction>
      )}
    </form>
  );
}
