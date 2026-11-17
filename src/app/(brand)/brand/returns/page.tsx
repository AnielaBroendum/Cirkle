'use client';

import { useCallback, useEffect, useState } from 'react';
import { useAuth } from '@/components/providers/auth-provider';
import { createClient } from '@/lib/supabase';
import { refreshNavCounts } from '@/components/brand/nav-counts';
import { formatDKK } from '@/lib/utils';
import type { Database } from '@/lib/database.types';
import { Info, Undo2 } from 'lucide-react';
import { Button, Chip, EmptyState, ListSkeleton, MetricTile, PageHeader, Panel, PanelHeader, Segmented, Skeleton, StatusPill, Thumb, buttonClasses } from '@/components/ds';

// Figma "Brand Portal v2 / 07 Returns" (367:400). Consumers request returns in the app
// (POST /api/returns, migration 003). RLS lets the brand read and update returns on its
// own orders, so the brand's decisions are plain updates (unchanged in v2). Tiles from
// get_brand_return_stats (022).
//
// Not in the app, so not on this page: a return label for the customer, and an automatic
// reversal of the store's cut. The note says what does happen.

type Stats = NonNullable<Database['public']['Functions']['get_brand_return_stats']['Returns']>;

/** Display only: the deadline shown on "Waiting for you". Nothing is approved automatically. */
const RETURN_APPROVAL_DAYS = 3;

const TOP_REASON: Record<string, { title: string; detail: string }> = {
  size: { title: 'Size', detail: 'Too big or too small' },
  not_as_expected: { title: 'Not as expected', detail: 'Looked or felt different' },
  faulty: { title: 'Faulty', detail: 'Damaged or broken' },
};

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

type Filter = 'open' | 'refunded' | 'all';

export default function BrandReturnsPage() {
  const { user } = useAuth();
  const [returns, setReturns] = useState<ReturnRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [updating, setUpdating] = useState<string | null>(null);
  const [actionError, setActionError] = useState('');
  const [filter, setFilter] = useState<Filter>('open');
  const [stats, setStats] = useState<Stats | null>(null);
  const [policyUrl, setPolicyUrl] = useState<string | null>(null);

  const loadStats = useCallback(() => {
    createClient()
      .rpc('get_brand_return_stats', { p_tz: 'Europe/Copenhagen' })
      .then(({ data }: { data: Stats | null }) => setStats(data ?? null));
  }, []);

  useEffect(() => {
    if (!user) return;
    loadStats();
    createClient()
      .from('brand_profiles')
      .select('return_policy_url')
      .eq('user_id', user.id)
      .single()
      .then(({ data }: { data: { return_policy_url: string | null } | null }) => setPolicyUrl(data?.return_policy_url ?? null));
  }, [user, loadStats]);

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
      refreshNavCounts();
      loadStats();
    }
    setUpdating(null);
  }

  const open = returns.filter((r) => r.status === 'requested' || r.status === 'approved' || r.status === 'received');
  const refunded = returns.filter((r) => r.status === 'refunded');
  const visible = filter === 'open' ? open : filter === 'refunded' ? refunded : returns;

  const policyHref = policyUrl ? (/^https?:\/\//i.test(policyUrl) ? policyUrl : `https://${policyUrl}`) : null;
  const header = (
    <PageHeader
      title="Returns"
      subtitle="Requested in the app. Your return policy applies."
      actions={
        policyHref ? (
          <a href={policyHref} target="_blank" rel="noreferrer" className={buttonClasses({ variant: 'secondary', className: 'h-[43px]' })}>
            Return policy ↗
          </a>
        ) : undefined
      }
    />
  );

  if (loading) {
    return (
      <div className="space-y-6">
        {header}
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          {[0, 1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-[99px]" />
          ))}
        </div>
        <ListSkeleton rows={4} />
      </div>
    );
  }

  if (loadError) {
    return (
      <div className="space-y-6">
        {header}
        <EmptyState
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
  const pct = (n: number | null) => (n === null ? '–' : `${n.toLocaleString('en-GB', { maximumFractionDigits: 1 })}%`);

  const waiting = stats?.waiting ?? 0;
  const due = stats?.oldest_waiting_at ? new Date(new Date(stats.oldest_waiting_at).getTime() + RETURN_APPROVAL_DAYS * 86_400_000) : null;
  const rateHint =
    stats?.prev_rate === null || stats?.prev_rate === undefined
      ? 'Returns ÷ pieces sold this month'
      : stats.rate === null
        ? `${pct(stats.prev_rate)} last month`
        : `${stats.rate < stats.prev_rate ? 'Down' : stats.rate > stats.prev_rate ? 'Up' : 'Same as'} ${stats.rate === stats.prev_rate ? '' : 'from '}${pct(stats.prev_rate)} last month`;
  const top = stats?.top_reason ? TOP_REASON[stats.top_reason.reason] ?? { title: stats.top_reason.reason, detail: '' } : null;

  const actions = (r: ReturnRow) => {
    if (r.status === 'requested') {
      return (
        <div className="flex justify-end gap-2">
          <Button variant="secondary" size="sm" disabled={updating === r.id} onClick={() => setStatus(r.id, 'rejected')}>
            Decline
          </Button>
          <Button variant="flame" size="sm" loading={updating === r.id} onClick={() => setStatus(r.id, 'approved')}>
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

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <MetricTile
          flame
          label="Waiting for you"
          value={`${waiting} request${waiting === 1 ? '' : 's'}`}
          hint={
            due
              ? `Approve within ${RETURN_APPROVAL_DAYS} days · oldest ${due.getTime() < Date.now() ? 'was due' : 'due'} ${date(due.toISOString())}`
              : `Approve within ${RETURN_APPROVAL_DAYS} days`
          }
        />
        <MetricTile label="Return rate" value={pct(stats?.rate ?? null)} hint={rateHint} />
        <MetricTile
          label="Refunded this month"
          value={formatDKK(stats?.refunded_amount ?? 0)}
          hint={`${stats?.refunded_count ?? 0} return${stats?.refunded_count === 1 ? '' : 's'} completed`}
        />
        <MetricTile
          label="Top reason"
          value={top?.title ?? '–'}
          hint={top && stats?.top_reason ? `${top.detail ? `${top.detail} · ` : ''}${stats.top_reason.count} of ${stats.top_reason.total}` : 'No returns yet'}
        />
      </div>

      {actionError && (
        <p role="alert" className="border border-accent bg-accent-subtle px-4 py-3 text-body text-accent-strong">
          {actionError}
        </p>
      )}

      <Panel className="flex flex-col gap-4">
        <PanelHeader
          title="Return requests"
          subtitle="Waiting first, then newest"
          action={
            <Segmented
              label="Returns shown"
              items={[
                { value: 'open', label: `Open ${open.length}` },
                { value: 'refunded', label: `Refunded ${refunded.length}` },
                { value: 'all', label: 'All' },
              ]}
              value={filter}
              onValueChange={(v) => setFilter(v as Filter)}
              className="border border-line-dark-subtle bg-obsidian"
            />
          }
        />

        {visible.length === 0 ? (
          <EmptyState
            className="border-none py-10"
            icon={<Undo2 className="h-5 w-5" />}
            title={returns.length === 0 ? 'No returns' : 'Nothing here'}
            description={
              returns.length === 0
                ? 'When a customer asks to return an item, it shows up here for you to approve or decline.'
                : filter === 'open'
                  ? 'All return requests are handled. See All for the history.'
                  : 'No returns with this status.'
            }
          />
        ) : (
          <>
            {/* Phone: cards */}
            <ul className="divide-y divide-line-dark-subtle md:hidden">
              {visible.map((r) => (
                <li key={r.id} className="space-y-3 py-4">
                  <div className="flex gap-3">
                    <Thumb src={r.image} size={36} />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-body-sm font-medium text-flare">{r.product_name}</p>
                      <p className="text-caption text-smoke">{[r.size && `Size ${r.size}`, r.color].filter(Boolean).join(' · ')}</p>
                      <p className="mt-1 text-caption text-smoke">
                        {returnId(r.id)} · #{r.order_number ?? '–'} · {date(r.created_at)}
                      </p>
                    </div>
                    <span className="whitespace-nowrap text-body-sm font-medium tabular-nums text-flare">{formatDKK(r.refund_dkk)}</span>
                  </div>
                  <Chip>{REASON_LABEL[r.reason] ?? r.reason}</Chip>
                  {r.comment && <p className="text-caption text-smoke">&ldquo;{r.comment}&rdquo;</p>}
                  {actions(r)}
                </li>
              ))}
            </ul>

            {/* Tablet and up: table */}
            <div className="-mx-1 hidden overflow-x-auto md:block">
              <table className="w-full border-collapse font-brand text-body-sm">
                <thead>
                  <tr className="border-b border-line-dark-subtle text-left text-label uppercase text-smoke">
                    <th className="px-2 pb-2.5 font-medium">Return</th>
                    <th className="px-2 pb-2.5 font-medium">Order</th>
                    <th className="px-2 pb-2.5 font-medium">Product</th>
                    <th className="px-2 pb-2.5 font-medium">Reason</th>
                    <th className="hidden px-2 pb-2.5 font-medium lg:table-cell">Requested</th>
                    <th className="px-2 pb-2.5 font-medium">Refund</th>
                    <th className="px-2 pb-2.5">
                      <span className="sr-only">Actions</span>
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {visible.map((r) => (
                    <tr key={r.id} className={r.status === 'requested' ? 'border-b border-line-dark-subtle bg-accent-tint last:border-b-0' : 'border-b border-line-dark-subtle last:border-b-0'}>
                      <td className="px-2 py-3 font-semibold text-flare">{returnId(r.id)}</td>
                      <td className="px-2 text-ash">#{r.order_number ?? '–'}</td>
                      <td className="px-2">
                        <div className="flex items-center gap-3">
                          <Thumb src={r.image} size={32} />
                          <div className="min-w-0">
                            <p className="truncate font-medium text-flare">{r.product_name}</p>
                            <p className="text-caption text-smoke">{[r.size && `Size ${r.size}`, r.color].filter(Boolean).join(' · ')}</p>
                          </div>
                        </div>
                      </td>
                      <td className="max-w-[200px] px-2">
                        <Chip>{REASON_LABEL[r.reason] ?? r.reason}</Chip>
                        {r.comment && (
                          <p className="mt-1 truncate text-caption text-smoke" title={r.comment}>
                            &ldquo;{r.comment}&rdquo;
                          </p>
                        )}
                      </td>
                      <td className="hidden whitespace-nowrap px-2 text-ash lg:table-cell">{date(r.created_at)}</td>
                      <td className="whitespace-nowrap px-2 font-medium tabular-nums text-flare">{formatDKK(r.refund_dkk)}</td>
                      <td className="px-2">{actions(r)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}

        <p className="flex gap-2.5 bg-surface-dark/60 px-3.5 py-3 text-caption text-ash">
          <Info className="mt-px h-4 w-4 shrink-0 text-accent-bright" />
          When you approve, the customer sends the piece back. Mark it received, then refunded once the customer has their money back. From approval on,
          the item no longer counts towards the store&apos;s payout.
        </p>
      </Panel>
    </div>
  );
}
