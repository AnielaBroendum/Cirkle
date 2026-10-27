'use client';

import { useCallback, useEffect, useState } from 'react';
import Image from 'next/image';
import { useAuth } from '@/components/providers/auth-provider';
import { createClient } from '@/lib/supabase';
import { formatDKK } from '@/lib/utils';
import { Undo2, Package } from 'lucide-react';
import { Button, EmptyState, ListSkeleton, StatusPill, Tabs, THead, TBody, TR, TH, TD } from '@/components/ds';

// Figma "Brand Portal / 07 Returns". Consumers request returns in the app
// (POST /api/returns, migration 003). RLS lets the brand read and update
// returns on its own orders, so the brand's decisions are plain updates.

type ReturnStatus = 'requested' | 'approved' | 'rejected' | 'received' | 'refunded';

type ReturnRow = {
  id: string;
  order_id: string;
  order_item_id: string;
  reason: string;
  comment: string | null;
  status: ReturnStatus;
  created_at: string;
  order_number: number | null;
  product_name: string;
  size: string | null;
  color: string | null;
  image: string | null;
  refund_dkk: number;
};

const REASON_LABEL: Record<string, string> = {
  too_big: 'Too big',
  too_small: 'Too small',
  not_as_expected: 'Not as expected',
  faulty: 'Faulty',
};

// Next step for the brand after each status
const NEXT_STEP: Partial<Record<ReturnStatus, { status: ReturnStatus; label: string }>> = {
  approved: { status: 'received', label: 'Mark received' },
  received: { status: 'refunded', label: 'Mark refunded' },
};

const STATUS_ORDER: Record<ReturnStatus, number> = { requested: 0, approved: 1, received: 2, refunded: 3, rejected: 4 };

type Filter = 'open' | 'all';

export default function BrandReturnsPage() {
  const { user } = useAuth();
  const [returns, setReturns] = useState<ReturnRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [updating, setUpdating] = useState<string | null>(null);
  const [actionError, setActionError] = useState('');
  const [filter, setFilter] = useState<Filter>('open');

  const loadReturns = useCallback(async () => {
    if (!user) return;
    const supabase = createClient();

    const { data, error } = await supabase
      .from('returns')
      .select('id, order_id, order_item_id, reason, comment, status, created_at')
      .order('created_at', { ascending: false });

    if (error) {
      setLoadError(true);
      setLoading(false);
      return;
    }

    type Raw = Omit<ReturnRow, 'order_number' | 'product_name' | 'size' | 'color' | 'image' | 'refund_dkk'>;
    const raw = (data ?? []) as Raw[];
    if (!raw.length) {
      setReturns([]);
      setLoading(false);
      return;
    }

    const [itemsRes, ordersRes] = await Promise.all([
      supabase
        .from('order_items')
        .select('id, product_id, product_name, size, color, quantity, unit_price_dkk')
        .in('id', raw.map((r) => r.order_item_id)),
      supabase.from('orders').select('id, order_number').in('id', Array.from(new Set(raw.map((r) => r.order_id)))),
    ]);

    type Item = { id: string; product_id: string | null; product_name: string; size: string | null; color: string | null; quantity: number; unit_price_dkk: number };
    const items = new Map(((itemsRes.data ?? []) as Item[]).map((i) => [i.id, i]));
    const orderNumbers = new Map(((ordersRes.data ?? []) as { id: string; order_number: number }[]).map((o) => [o.id, o.order_number]));

    const productIds = Array.from(new Set(Array.from(items.values()).map((i) => i.product_id).filter(Boolean))) as string[];
    const { data: products } = productIds.length
      ? await supabase.from('products').select('id, images').in('id', productIds)
      : { data: [] };
    const images = new Map(((products ?? []) as { id: string; images: string[] | null }[]).map((p) => [p.id, p.images?.[0] ?? null]));

    const rows: ReturnRow[] = raw.map((r) => {
      const item = items.get(r.order_item_id);
      return {
        ...r,
        order_number: orderNumbers.get(r.order_id) ?? null,
        product_name: item?.product_name ?? 'Unknown product',
        size: item?.size ?? null,
        color: item?.color ?? null,
        image: item?.product_id ? images.get(item.product_id) ?? null : null,
        refund_dkk: item ? item.unit_price_dkk * item.quantity : 0,
      };
    });
    rows.sort((a, b) => STATUS_ORDER[a.status] - STATUS_ORDER[b.status] || b.created_at.localeCompare(a.created_at));

    setReturns(rows);
    setLoading(false);
  }, [user]);

  useEffect(() => {
    loadReturns();
  }, [loadReturns]);

  async function setStatus(id: string, status: ReturnStatus) {
    setUpdating(id);
    setActionError('');
    const supabase = createClient();
    const { error } = await supabase.from('returns').update({ status }).eq('id', id);
    if (error) {
      setActionError('Could not update this return. Please try again.');
    } else {
      setReturns((prev) => prev.map((r) => (r.id === id ? { ...r, status } : r)));
    }
    setUpdating(null);
  }

  const open = returns.filter((r) => r.status === 'requested' || r.status === 'approved' || r.status === 'received');
  const visible = filter === 'open' ? open : returns;

  const header = (
    <div>
      <h1 className="font-brand text-heading-xl uppercase text-primary">Returns</h1>
      <p className="mt-1 text-body text-slate">Requested in the app. Your return policy applies. Flaym refunds once you approve.</p>
    </div>
  );

  if (loading) {
    return (
      <div className="space-y-6">
        {header}
        <ListSkeleton rows={4} />
      </div>
    );
  }

  if (loadError) {
    return (
      <div className="space-y-6">
        {header}
        <EmptyState
          className="bg-surface"
          icon={<Undo2 className="h-5 w-5" />}
          title="Returns aren't available yet"
          description="We couldn't load return requests. Try again in a moment."
          action={
            <Button
              variant="secondary"
              onClick={() => {
                setLoading(true);
                setLoadError(false);
                loadReturns();
              }}
            >
              Try again
            </Button>
          }
        />
      </div>
    );
  }

  const returnId = (id: string) => `R-${id.slice(0, 4).toUpperCase()}`;
  const date = (iso: string) => new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });

  const actions = (r: ReturnRow) => {
    if (r.status === 'requested') {
      return (
        <div className="flex gap-2">
          <Button variant="secondary" size="sm" disabled={updating === r.id} onClick={() => setStatus(r.id, 'rejected')}>
            Decline
          </Button>
          <Button size="sm" loading={updating === r.id} onClick={() => setStatus(r.id, 'approved')}>
            Approve
          </Button>
        </div>
      );
    }
    const next = NEXT_STEP[r.status];
    return (
      <div className="flex items-center justify-end gap-2">
        <StatusPill status={r.status} label={r.status === 'rejected' ? 'Declined' : undefined} />
        {next && (
          <Button variant="secondary" size="sm" loading={updating === r.id} onClick={() => setStatus(r.id, next.status)}>
            {next.label}
          </Button>
        )}
      </div>
    );
  };

  return (
    <div className="space-y-6">
      {header}

      {returns.length > 0 && (
        <Tabs
          items={[
            { value: 'open', label: 'Open', count: open.length },
            { value: 'all', label: 'All', count: returns.length },
          ]}
          value={filter}
          onValueChange={(v) => setFilter(v as Filter)}
        />
      )}

      {actionError && (
        <p role="alert" className="border border-accent bg-accent-subtle px-4 py-3 text-body text-accent-strong">
          {actionError}
        </p>
      )}

      {visible.length === 0 ? (
        <EmptyState
          className="bg-surface"
          icon={<Undo2 className="h-5 w-5" />}
          title={returns.length === 0 ? 'No returns' : 'Nothing to review'}
          description={
            returns.length === 0
              ? 'When a customer asks to return an item, it shows up here for you to approve or decline.'
              : 'All return requests are handled. See All for the history.'
          }
        />
      ) : (
        <>
          {/* Mobile: cards */}
          <ul className="divide-y divide-line border border-line bg-surface md:hidden">
            {visible.map((r) => (
              <li key={r.id} className="space-y-3 p-4">
                <div className="flex gap-3">
                  <Thumb src={r.image} />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-body-sm text-primary">{r.product_name}</p>
                    <p className="text-caption text-slate">
                      {[r.size && `Size ${r.size}`, r.color].filter(Boolean).join(' · ')}
                    </p>
                    <p className="mt-1 text-caption text-slate">
                      {returnId(r.id)} · #{r.order_number ?? '—'} · {date(r.created_at)}
                    </p>
                  </div>
                  <span className="whitespace-nowrap text-body-sm tabular-nums text-primary">{formatDKK(r.refund_dkk)}</span>
                </div>
                <p className="text-body-sm text-primary">
                  {REASON_LABEL[r.reason] ?? r.reason}
                  {r.comment && <span className="block text-caption text-slate">&ldquo;{r.comment}&rdquo;</span>}
                </p>
                {actions(r)}
              </li>
            ))}
          </ul>

          {/* Desktop: table */}
          <div className="hidden overflow-x-auto border border-line bg-surface md:block">
            <table className="w-full border-collapse font-brand text-body-sm text-primary">
              <THead>
                <tr>
                  <TH className="px-5">Return</TH>
                  <TH>Order</TH>
                  <TH>Product</TH>
                  <TH>Reason</TH>
                  <TH>Requested</TH>
                  <TH className="text-right">Refund</TH>
                  <TH className="px-5">
                    <span className="sr-only">Actions</span>
                  </TH>
                </tr>
              </THead>
              <TBody>
                {visible.map((r) => (
                  <TR key={r.id}>
                    <TD className={r.status === 'requested' ? 'px-5 font-medium' : 'px-5'}>{returnId(r.id)}</TD>
                    <TD>#{r.order_number ?? '—'}</TD>
                    <TD>
                      <div className="flex items-center gap-3">
                        <Thumb src={r.image} />
                        <div className="min-w-0">
                          <p className="truncate">{r.product_name}</p>
                          <p className="text-caption text-slate">{[r.size && `Size ${r.size}`, r.color].filter(Boolean).join(' · ')}</p>
                        </div>
                      </div>
                    </TD>
                    <TD className="max-w-[220px]">
                      {REASON_LABEL[r.reason] ?? r.reason}
                      {r.comment && <p className="truncate text-caption text-slate" title={r.comment}>&ldquo;{r.comment}&rdquo;</p>}
                    </TD>
                    <TD className="whitespace-nowrap">{date(r.created_at)}</TD>
                    <TD className="whitespace-nowrap text-right tabular-nums">{formatDKK(r.refund_dkk)}</TD>
                    <TD className="px-5 text-right">{actions(r)}</TD>
                  </TR>
                ))}
              </TBody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}

function Thumb({ src }: { src: string | null }) {
  return src ? (
    <div className="relative h-10 w-[34px] shrink-0 overflow-hidden bg-surface-muted">
      <Image src={src} alt="" fill className="object-cover" sizes="34px" />
    </div>
  ) : (
    <div className="flex h-10 w-[34px] shrink-0 items-center justify-center bg-surface-muted">
      <Package className="h-4 w-4 text-slate" />
    </div>
  );
}
