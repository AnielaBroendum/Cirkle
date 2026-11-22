'use client';

import { useEffect, useState, useCallback } from 'react';
import { useAuth } from '@/components/providers/auth-provider';
import { createClient } from '@/lib/supabase';
import { formatDKK } from '@/lib/utils';
import { ShoppingBag, ChevronRight } from 'lucide-react';
import { CARRIERS, waitingDays } from '@/lib/orders';
import { refreshNavCounts } from '@/components/brand/nav-counts';
import type { Database } from '@/lib/database.types';
import {
  Badge,
  Button,
  Checkbox,
  EmptyState,
  Field,
  Input,
  ListSkeleton,
  Modal,
  PageHeader,
  Panel,
  Segmented,
  Select,
  Skeleton,
  StatusPill,
  Thumb,
  cn,
  portalPanel,
} from '@/components/ds';

/*
 * Orders, Portals v2 (Figma "Brand Portal v2 / 06 Orders", 365:645).
 * Shipping is unchanged: bulk "Mark as shipped" (/api/orders/ship), and per order carrier,
 * tracking and status steps (/api/orders/[id]/status, /tracking). New: the chain block
 * (get_brand_order_chain, 029: Scanned at → Passed on by → Bought by, short chain ID).
 * Tabs New / Shipped / Delivered / All: confirmed and packed orders sit under New, since they
 * still need shipping. Export CSV writes the orders on the current tab with their chain.
 */

type Chain = NonNullable<Database['public']['Functions']['get_brand_order_chain']['Returns']>;

type OrderItem = {
  id: string;
  products: { images: string[] | null } | null;
  product_name: string;
  size: string | null;
  color: string | null;
  quantity: number;
  unit_price_dkk: number;
};

type OrderEvent = {
  id: string;
  status: string;
  note: string | null;
  created_at: string;
};

type Order = {
  id: string;
  order_number: number;
  status: string;
  total_dkk: number;
  shipping_name: string;
  shipping_address: string;
  shipping_city: string;
  shipping_postal_code: string;
  shipping_country: string;
  carrier: string | null;
  tracking_number: string | null;
  tracking_url: string | null;
  shipped_at: string | null;
  created_at: string;
  consumer_user_id: string;
  order_items: OrderItem[];
  order_events: OrderEvent[];
  profiles: { name: string; email: string } | null;
};

// Figma pills: pending orders read "New".
const STATUS_LABEL: Record<string, string> = {
  pending: 'New',
  confirmed: 'Confirmed',
  packed: 'Packed',
  shipped: 'Shipped',
  delivered: 'Delivered',
  cancelled: 'Cancelled',
};

// Who the sale is credited to (attributions)
type Credit = { store: string | null; peer: boolean };

const STATUS_SORT_ORDER: Record<string, number> = {
  pending: 0,
  confirmed: 1,
  packed: 2,
  shipped: 3,
  delivered: 4,
  cancelled: 5,
};

// Optional steps before shipping. Shipping itself is always offered (Figma 06
// ships straight from New), with carrier and tracking.
const STEP_BEFORE_SHIPPING: Record<string, { status: string; label: string }> = {
  pending: { status: 'confirmed', label: 'Confirm' },
  confirmed: { status: 'packed', label: 'Mark as packed' },
};
const SHIPPABLE = ['pending', 'confirmed', 'packed'];

type FilterStatus = 'all' | 'new' | 'shipped' | 'delivered';

const FILTER_STATUSES: Record<Exclude<FilterStatus, 'all'>, string[]> = {
  new: ['pending', 'confirmed', 'packed'],
  shipped: ['shipped'],
  delivered: ['delivered'],
};

export default function BrandOrdersPage() {
  const { user } = useAuth();
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedOrder, setExpandedOrder] = useState<string | null>(null);
  const [carrierInput, setCarrierInput] = useState('');
  const [trackingInput, setTrackingInput] = useState('');
  const [trackingUrlInput, setTrackingUrlInput] = useState('');
  const [updatingOrder, setUpdatingOrder] = useState<string | null>(null);
  const [checked, setChecked] = useState<Set<string>>(new Set());
  const [bulkShipping, setBulkShipping] = useState(false);
  const [actionError, setActionError] = useState('');
  const [filter, setFilter] = useState<FilterStatus>('new');
  const [chain, setChain] = useState<{ id: string; data: Chain | null } | null>(null);
  const [credits, setCredits] = useState<Map<string, Credit>>(new Map());
  // xl and up show the detail panel beside the table; smaller screens use a sheet.
  const [wide, setWide] = useState(false);

  useEffect(() => {
    const mq = window.matchMedia('(min-width: 1280px)');
    const update = () => setWide(mq.matches);
    update();
    mq.addEventListener('change', update);
    return () => mq.removeEventListener('change', update);
  }, []);

  const loadOrders = useCallback(async () => {
    if (!user) return;
    const supabase = createClient();

    const { data: bp } = await supabase
      .from('brand_profiles')
      .select('id')
      .eq('user_id', user.id)
      .single();

    if (!bp) return;

    const { data } = await supabase
      .from('orders')
      .select(`
        id, order_number, status, total_dkk,
        shipping_name, shipping_address, shipping_city, shipping_postal_code, shipping_country,
        carrier, tracking_number, tracking_url, shipped_at, created_at, consumer_user_id,
        order_items (id, product_name, size, color, quantity, unit_price_dkk, products (images)),
        order_events (id, status, note, created_at),
        profiles!orders_consumer_user_id_fkey (name, email)
      `)
      .eq('brand_id', (bp as { id: string }).id)
      .order('created_at', { ascending: false });

    const allOrders = (data ?? []) as unknown as Order[];
    allOrders.sort((a, b) => {
      const sa = STATUS_SORT_ORDER[a.status] ?? 99;
      const sb = STATUS_SORT_ORDER[b.status] ?? 99;
      if (sa !== sb) return sa - sb;
      return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
    });

    setOrders(allOrders);
    setLoading(false);

    // Credited store per order (attributions → retailer_profiles)
    const orderIds = allOrders.map((o) => o.id);
    if (orderIds.length) {
      const { data: attrs } = await supabase
        .from('attributions')
        .select('order_id, source_retailer_id, source_user_id')
        .in('order_id', orderIds);
      const rows = (attrs ?? []) as { order_id: string; source_retailer_id: string | null; source_user_id: string | null }[];
      const retailerIds = Array.from(new Set(rows.map((r) => r.source_retailer_id).filter(Boolean))) as string[];
      const { data: retailers } = retailerIds.length
        ? await supabase.from('retailer_profiles').select('id, name').in('id', retailerIds)
        : { data: [] };
      const names = new Map(((retailers ?? []) as { id: string; name: string }[]).map((r) => [r.id, r.name]));
      setCredits(
        new Map(
          rows.map((r) => [
            r.order_id,
            { store: r.source_retailer_id ? names.get(r.source_retailer_id) ?? null : null, peer: !!r.source_user_id },
          ])
        )
      );
    }
  }, [user]);

  useEffect(() => {
    loadOrders();
  }, [loadOrders]);

  // Open the order a search result links to (/brand/orders?order=<id>), once.
  const [linkedOrder, setLinkedOrder] = useState<string | null>(null);
  useEffect(() => {
    setLinkedOrder(new URLSearchParams(window.location.search).get('order'));
  }, []);
  useEffect(() => {
    if (!linkedOrder || !orders.some((o) => o.id === linkedOrder)) return;
    setFilter('all');
    setExpandedOrder(linkedOrder);
    setLinkedOrder(null);
  }, [linkedOrder, orders]);

  // Fill the carrier and tracking fields from the order being looked at.
  useEffect(() => {
    const o = orders.find((x) => x.id === expandedOrder);
    setCarrierInput(o?.carrier ?? '');
    setTrackingInput(o?.tracking_number ?? '');
    setTrackingUrlInput(o?.carrier === 'Other' ? o.tracking_url ?? '' : '');
    setActionError('');
  }, [expandedOrder]); // eslint-disable-line react-hooks/exhaustive-deps

  // The chain for the order being looked at.
  useEffect(() => {
    if (!expandedOrder) return;
    let stale = false;
    createClient()
      .rpc('get_brand_order_chain', { p_order: expandedOrder })
      .then(({ data }: { data: Chain | null }) => {
        if (!stale) setChain({ id: expandedOrder, data: data ?? null });
      });
    return () => {
      stale = true;
    };
  }, [expandedOrder]);

  async function afterChange() {
    await loadOrders();
    refreshNavCounts();
  }

  async function updateStatus(orderId: string, newStatus: string) {
    setUpdatingOrder(orderId);
    setActionError('');
    try {
      const body: Record<string, string> = { status: newStatus };
      if (newStatus === 'shipped') {
        if (carrierInput) body.carrier = carrierInput;
        if (trackingInput) body.tracking_number = trackingInput;
        if (carrierInput === 'Other' && trackingUrlInput) body.tracking_url = trackingUrlInput;
      }

      const res = await fetch(`/api/orders/${orderId}/status`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      if (res.ok) {
        setChecked((prev) => {
          const next = new Set(prev);
          next.delete(orderId);
          return next;
        });
        await afterChange();
      } else {
        setActionError((await res.json().catch(() => null))?.error ?? 'Could not update the order.');
      }
    } finally {
      setUpdatingOrder(null);
    }
  }

  // Carrier and tracking can be added or corrected after shipping.
  async function saveTracking(orderId: string) {
    setUpdatingOrder(orderId);
    setActionError('');
    try {
      const res = await fetch(`/api/orders/${orderId}/tracking`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          carrier: carrierInput || null,
          tracking_number: trackingInput || null,
          tracking_url: carrierInput === 'Other' ? trackingUrlInput || null : null,
        }),
      });
      if (res.ok) await loadOrders();
      else setActionError((await res.json().catch(() => null))?.error ?? 'Could not save tracking.');
    } finally {
      setUpdatingOrder(null);
    }
  }

  async function shipSelected() {
    setBulkShipping(true);
    setActionError('');
    try {
      const res = await fetch('/api/orders/ship', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ order_ids: Array.from(checked) }),
      });
      const data = await res.json().catch(() => null);
      const failed = ((data?.results ?? []) as { ok: boolean; error?: string }[]).filter((r) => !r.ok);
      if (!res.ok && res.status !== 207) setActionError(data?.error ?? 'Could not ship the selected orders.');
      else if (failed.length) setActionError(failed.map((f) => f.error).join(' '));
      setChecked(new Set());
      await afterChange();
    } finally {
      setBulkShipping(false);
    }
  }

  const filteredOrders = filter === 'all' ? orders : orders.filter((o) => FILTER_STATUSES[filter].includes(o.status));

  // CSV of the orders on the current tab, with their chain (get_brand_order_chains, 029).
  const [exporting, setExporting] = useState(false);
  async function exportCsv() {
    setExporting(true);
    setActionError('');
    try {
      const ids = filteredOrders.map((o) => o.id);
      const chains = new Map<string, Chain>();
      for (let i = 0; i < ids.length; i += 200) {
        const { data, error } = await createClient().rpc('get_brand_order_chains', { p_orders: ids.slice(i, i + 200) });
        if (error) throw error;
        for (const row of (data ?? []) as { order_id: string; chain: Chain }[]) chains.set(row.order_id, row.chain);
      }
      const header = ['Order number', 'Date', 'Product', 'Store', 'Passed on by', 'Buyer', 'Chain ID', 'Store share DKK'];
      const lines = filteredOrders.map((o) => {
        const c = chains.get(o.id);
        return [
          o.order_number,
          o.created_at.slice(0, 10),
          o.order_items.map((it) => it.product_name).join('; '),
          c?.credited ? c.store ?? 'Unknown' : '',
          c?.credited ? (c.passed_on ? (c.givers.length ? c.givers.join(' > ') : 'Unknown') : '') : '',
          c?.buyer ?? '',
          c?.chain_id ? c.chain_id.slice(0, 8) : '',
          c?.store_share_dkk != null ? (c.store_share_dkk / 100).toFixed(2) : '',
        ]
          .map(csvCell)
          .join(',');
      });
      const blob = new Blob([[header.join(','), ...lines].join('\n') + '\n'], { type: 'text/csv;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `orders-${filter}-${new Date().toISOString().slice(0, 10)}.csv`;
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      setActionError('Could not export the orders. Try again.');
    } finally {
      setExporting(false);
    }
  }

  const counts = orders.reduce(
    (acc, o) => {
      acc[o.status] = (acc[o.status] || 0) + 1;
      return acc;
    },
    {} as Record<string, number>,
  );

  const header = (
    <PageHeader title="Orders" subtitle="Paid to Flaym. You ship by hand and mark each step." />
  );

  if (loading) {
    return (
      <div className="space-y-6">
        {header}
        <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_380px]">
          <ListSkeleton rows={5} />
          <Skeleton className="hidden h-96 w-full xl:block" />
        </div>
      </div>
    );
  }

  const count = (key: Exclude<FilterStatus, 'all'>) => orders.filter((o) => FILTER_STATUSES[key].includes(o.status)).length;
  const shippableShown = filteredOrders.filter((o) => SHIPPABLE.includes(o.status));
  const allChecked = shippableShown.length > 0 && shippableShown.every((o) => checked.has(o.id));
  const toggle = (id: string) =>
    setChecked((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  const toggleAll = () => setChecked(allChecked ? new Set() : new Set(shippableShown.map((o) => o.id)));
  const waitingPill = (order: Order) => {
    const days = waitingDays(order);
    return days === null ? null : (
      <Badge tone="warning" title={`New for ${days} days`}>
        Waiting
      </Badge>
    );
  };
  const selected = orders.find((o) => o.id === expandedOrder) ?? null;
  const select = (id: string) => setExpandedOrder(id === expandedOrder ? null : id);
  const shortDate = (iso: string) => new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
  const itemCount = (o: Order) => o.order_items.reduce((n, i) => n + i.quantity, 0);
  const creditLabel = (orderId: string) => {
    const c = credits.get(orderId);
    if (c?.store) return c.store;
    if (c?.peer) return 'Passed on by a friend';
    return '–';
  };
  const label = 'text-label uppercase text-smoke';

  // Order detail: ship to, items, the chain, the next step and history
  const detail = (order: Order) => {
    const canShip = SHIPPABLE.includes(order.status);
    const stepBefore = STEP_BEFORE_SHIPPING[order.status];
    const isUpdating = updatingOrder === order.id;
    const c = chain?.id === order.id ? chain.data : undefined;
    const n = itemCount(order);
    return (
      <div className="flex flex-col gap-4 font-brand">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-heading-lg font-semibold text-flare">#{order.order_number}</p>
            <p className="mt-1 text-caption text-smoke">
              {shortDate(order.created_at)} · {n} item{n !== 1 ? 's' : ''} · {formatDKK(order.total_dkk)}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <StatusPill status={order.status} label={STATUS_LABEL[order.status]} />
            {waitingPill(order)}
          </div>
        </div>

        <div className="bg-canvas-dark px-3.5 py-3">
          <p className={label}>Ship to</p>
          <p className="mt-1.5 text-body-sm font-medium text-flare">{order.shipping_name}</p>
          {order.profiles?.name && order.profiles.name !== order.shipping_name && (
            <p className="text-caption text-smoke">Ordered by {order.profiles.name}</p>
          )}
          <p className="mt-0.5 text-body-sm text-ash">
            {order.shipping_address}, {order.shipping_postal_code} {order.shipping_city}, {order.shipping_country}
          </p>
        </div>

        <ul className="flex flex-col gap-2.5">
          {order.order_items.map((item) => (
            <li key={item.id} className="flex items-center gap-3">
              <Thumb src={item.products?.images?.[0]} size={36} />
              <div className="min-w-0 flex-1">
                <p className="truncate text-body-sm font-medium text-flare">{item.product_name}</p>
                <p className="text-caption text-smoke">
                  {[item.size && `Size ${item.size}`, item.color].filter(Boolean).join(' · ') || 'One size'}
                  {item.quantity > 1 ? ` · ×${item.quantity}` : ''} · {formatDKK(item.unit_price_dkk * item.quantity)}
                </p>
              </div>
            </li>
          ))}
        </ul>

        {/* The chain: scanned at → passed on by → bought by */}
        <div className="border border-accent/30 bg-accent-tint p-3.5">
          <p className="text-label uppercase text-accent-bright">The chain</p>
          {c === undefined ? (
            <p className="mt-2.5 text-caption text-smoke">Loading…</p>
          ) : !c || !c.credited ? (
            <p className="mt-2.5 text-caption text-ash">Bought without a scan.</p>
          ) : (
            <>
              <div className="mt-2.5 flex flex-col items-stretch gap-1.5 sm:flex-row">
                <ChainStep label="Scanned at" value={c.store ?? 'Unknown'} />
                <ChainArrow />
                <ChainStep label="Passed on by" value={chainGivers(c)} />
                <ChainArrow />
                <ChainStep label="Bought by" value={c.buyer ?? 'Unknown'} />
              </div>
              <p className="mt-2.5 text-caption text-smoke">
                Chain ID <span className="font-semibold text-ash">{shortChainId(c.chain_id)}</span>
                {c.store_share_dkk != null && <> · Store share {formatDKK(c.store_share_dkk)}</>}
              </p>
              {c.store_traced && (
                <p className="mt-1 text-caption text-smoke">The store is where {c.giver ?? 'the friend'} bought it first.</p>
              )}
            </>
          )}
        </div>

        {order.shipped_at && (
          <div>
            <p className={label}>Shipped</p>
            <p className="mt-1 text-body-sm text-flare">
              {new Date(order.shipped_at).toLocaleString('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
              {order.carrier ? ` · ${order.carrier}` : ''}
              {order.tracking_number ? ` · ${order.tracking_number}` : ''}
            </p>
            {order.tracking_url && (
              <a href={order.tracking_url} target="_blank" rel="noreferrer" className="text-caption text-ash underline">
                Open tracking page
              </a>
            )}
          </div>
        )}

        {/* Next step: ship (with carrier and tracking), or deliver */}
        {(canShip || order.status === 'shipped') && (
          <div className="flex flex-col gap-3">
            <div className="grid grid-cols-2 gap-2.5">
              <Field label="Carrier" htmlFor={`carrier-${order.id}`}>
                <Select id={`carrier-${order.id}`} value={carrierInput} onChange={(e) => setCarrierInput(e.target.value)}>
                  <option value="">Choose carrier</option>
                  {CARRIERS.map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                </Select>
              </Field>
              <Field label="Tracking (optional)" htmlFor={`tracking-${order.id}`}>
                <Input
                  id={`tracking-${order.id}`}
                  type="text"
                  placeholder="e.g. 00370…"
                  value={trackingInput}
                  onChange={(e) => setTrackingInput(e.target.value)}
                />
              </Field>
            </div>
            {carrierInput === 'Other' && (
              <Field label="Tracking link (optional)" htmlFor={`tracking-url-${order.id}`}>
                <Input
                  id={`tracking-url-${order.id}`}
                  type="url"
                  placeholder="https://"
                  value={trackingUrlInput}
                  onChange={(e) => setTrackingUrlInput(e.target.value)}
                />
              </Field>
            )}
            {actionError && <p className="text-caption text-accent-strong">{actionError}</p>}
            {canShip ? (
              <Button fullWidth size="lg" variant="flame" onClick={() => updateStatus(order.id, 'shipped')} disabled={isUpdating} loading={isUpdating}>
                Mark as shipped
              </Button>
            ) : (
              <>
                <Button fullWidth size="lg" variant="flame" onClick={() => updateStatus(order.id, 'delivered')} disabled={isUpdating} loading={isUpdating}>
                  Mark as delivered
                </Button>
                <Button fullWidth variant="secondary" onClick={() => saveTracking(order.id)} disabled={isUpdating}>
                  Save tracking
                </Button>
              </>
            )}
            <p className="text-caption text-smoke">The customer sees each step in the Flaym app.</p>
            {(stepBefore || order.status === 'pending' || order.status === 'confirmed') && (
              <div className="flex flex-wrap gap-2">
                {stepBefore && (
                  <Button size="sm" variant="secondary" onClick={() => updateStatus(order.id, stepBefore.status)} disabled={isUpdating}>
                    {stepBefore.label}
                  </Button>
                )}
                {(order.status === 'pending' || order.status === 'confirmed') && (
                  <Button size="sm" variant="ghost" onClick={() => updateStatus(order.id, 'cancelled')} disabled={isUpdating}>
                    Cancel order
                  </Button>
                )}
              </div>
            )}
          </div>
        )}

        <details className="group border-t border-line-dark-subtle pt-3">
          <summary className="cursor-pointer list-none text-label uppercase text-smoke hover:text-ash">History ▾</summary>
          <ol className="mt-2.5 space-y-1.5">
            {[...order.order_events]
              .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
              .map((event, i) => (
                <li key={event.id} className="flex items-center gap-2.5 text-body-sm">
                  <span className={cn('h-2 w-2 shrink-0', i === 0 ? 'bg-accent' : 'bg-surface-dark')} />
                  <span className="text-flare">{STATUS_LABEL[event.status] === 'New' ? 'Placed' : STATUS_LABEL[event.status] ?? event.status}</span>
                  <span className="text-caption text-smoke">
                    {new Date(event.created_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
                  </span>
                </li>
              ))}
          </ol>
        </details>
      </div>
    );
  };

  return (
    <div className="space-y-6">
      {header}

      <div className="grid grid-cols-[minmax(0,1fr)] items-start gap-4 xl:grid-cols-[minmax(0,1fr)_380px]">
        <Panel className="flex min-w-0 flex-col gap-4">
          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <Segmented
              label="Order status"
              items={[
                { value: 'new', label: `New ${count('new')}` },
                { value: 'shipped', label: `Shipped ${count('shipped')}` },
                { value: 'delivered', label: `Delivered ${count('delivered')}` },
                { value: 'all', label: 'All' },
              ]}
              value={filter}
              onValueChange={(v) => setFilter(v as FilterStatus)}
              className="self-start"
            />
            <div className="flex items-center gap-3">
              <Button size="sm" variant="ghost" onClick={exportCsv} disabled={filteredOrders.length === 0 || exporting} loading={exporting}>
                Export CSV
              </Button>
              <span className="whitespace-nowrap text-caption text-smoke">{checked.size} selected</span>
              <Button size="sm" variant="flame" onClick={shipSelected} disabled={checked.size === 0 || bulkShipping} loading={bulkShipping}>
                Mark as shipped
              </Button>
            </div>
          </div>
          {actionError && !selected && <p className="text-caption text-accent-strong">{actionError}</p>}

          {filteredOrders.length === 0 ? (
            <EmptyState
              className="border-none py-12"
              icon={<ShoppingBag className="h-5 w-5" />}
              title={orders.length === 0 ? 'No orders yet' : 'Nothing here'}
              description={orders.length === 0 ? 'Orders appear here when customers buy through a scan.' : 'No orders with this status right now.'}
            />
          ) : (
            <>
              {/* Phone: list */}
              <ul className="divide-y divide-line-dark-subtle md:hidden">
                {filteredOrders.map((order) => (
                  <li key={order.id} className="flex items-center">
                    {SHIPPABLE.includes(order.status) && (
                      <Checkbox aria-label={`Select order ${order.order_number}`} checked={checked.has(order.id)} onChange={() => toggle(order.id)} />
                    )}
                    <button type="button" onClick={() => select(order.id)} className="flex min-w-0 flex-1 items-center gap-3 py-3 pl-3 text-left">
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <span className="text-body-sm font-semibold text-flare">#{order.order_number}</span>
                          <StatusPill status={order.status} label={STATUS_LABEL[order.status]} />
                          {waitingPill(order)}
                        </div>
                        <p className="mt-1 truncate text-caption text-smoke">
                          {shortDate(order.created_at)} · {itemCount(order)} item{itemCount(order) !== 1 ? 's' : ''} · {creditLabel(order.id)}
                        </p>
                      </div>
                      <span className="whitespace-nowrap text-body-sm tabular-nums text-flare">{formatDKK(order.total_dkk)}</span>
                      <ChevronRight className="h-4 w-4 shrink-0 text-smoke" />
                    </button>
                  </li>
                ))}
              </ul>

              {/* Tablet and up: table */}
              <div className="-mx-1 hidden overflow-x-auto md:block">
                <table className="w-full border-collapse font-brand text-body-sm">
                  <thead>
                    <tr className="border-b border-line-dark-subtle text-left text-label uppercase text-smoke">
                      <th className="w-9 px-1 pb-2.5">
                        <Checkbox
                          aria-label="Select all orders that can be shipped"
                          checked={allChecked}
                          disabled={shippableShown.length === 0}
                          onChange={toggleAll}
                        />
                      </th>
                      <th className="px-2 pb-2.5 font-medium">Order</th>
                      <th className="px-2 pb-2.5 font-medium">Date</th>
                      <th className="px-2 pb-2.5 font-medium">Items</th>
                      <th className="px-2 pb-2.5 font-medium">Credited store</th>
                      <th className="px-2 pb-2.5 font-medium">Total</th>
                      <th className="px-2 pb-2.5 font-medium">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredOrders.map((order) => {
                      const on = order.id === expandedOrder;
                      return (
                        <tr
                          key={order.id}
                          onClick={() => select(order.id)}
                          aria-selected={on}
                          className={cn(
                            'cursor-pointer border-b border-line-dark-subtle transition-colors last:border-b-0',
                            on || checked.has(order.id) ? 'bg-accent-tint' : 'hover:bg-surface-dark/50'
                          )}
                        >
                          <td className="px-1 py-3" onClick={(e) => e.stopPropagation()}>
                            {SHIPPABLE.includes(order.status) && (
                              <Checkbox aria-label={`Select order ${order.order_number}`} checked={checked.has(order.id)} onChange={() => toggle(order.id)} />
                            )}
                          </td>
                          <td className="px-2">
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                select(order.id);
                              }}
                              className="font-semibold text-flare hover:underline"
                            >
                              #{order.order_number}
                            </button>
                          </td>
                          <td className="whitespace-nowrap px-2 text-ash">{shortDate(order.created_at)}</td>
                          <td className="px-2 tabular-nums text-ash">{itemCount(order)}</td>
                          <td className="max-w-[180px] truncate px-2 text-ash">{creditLabel(order.id)}</td>
                          <td className="whitespace-nowrap px-2 tabular-nums text-ash">{formatDKK(order.total_dkk)}</td>
                          <td className="px-2">
                            <div className="flex items-center gap-2">
                              <StatusPill status={order.status} label={STATUS_LABEL[order.status]} />
                              {waitingPill(order)}
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </Panel>

        {/* Detail panel (wide screens) */}
        <aside className={cn(portalPanel, 'sticky top-6 hidden p-6 xl:block')}>
          {selected ? (
            detail(selected)
          ) : (
            <EmptyState
              className="border-none py-16"
              icon={<ShoppingBag className="h-5 w-5" />}
              title="Select an order"
              description="Pick an order to see where it goes and mark the next step."
            />
          )}
        </aside>
      </div>

      {/* Detail sheet (phone and tablet) */}
      <Modal open={!!selected && !wide} onClose={() => setExpandedOrder(null)} variant="sheet" className="sm:max-w-lg">
        {selected && detail(selected)}
      </Modal>
    </div>
  );
}

function ChainStep({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0 flex-1 bg-surface-dark px-2.5 py-2">
      <p className="text-caption text-smoke">{label}</p>
      <p className="truncate text-caption font-semibold text-flare">{value}</p>
    </div>
  );
}

function ChainArrow() {
  return (
    <span className="flex items-center justify-center text-caption text-accent-bright" aria-hidden>
      <span className="sm:hidden">↓</span>
      <span className="hidden sm:inline">→</span>
    </span>
  );
}

/** "Passed on by": every giver in order; "Unknown" when a pass-on lost its giver. */
function chainGivers(c: Chain): string {
  if (!c.passed_on) return 'Not passed on';
  return c.givers.length ? c.givers.join(' → ') : 'Unknown';
}

function shortChainId(id: string | null): string {
  return id ? id.slice(0, 8) : 'Unknown';
}

function csvCell(v: string | number | null | undefined): string {
  const t = v == null ? '' : String(v);
  return /[",\n]/.test(t) ? `"${t.replace(/"/g, '""')}"` : t;
}
