'use client';

import { useEffect, useState, useCallback } from 'react';
import { useAuth } from '@/components/providers/auth-provider';
import { createClient } from '@/lib/supabase';
import { formatDKK } from '@/lib/utils';
import { ShoppingBag, ChevronRight } from 'lucide-react';
import {
  Button,
  EmptyState,
  Field,
  Input,
  ListSkeleton,
  Modal,
  Skeleton,
  StatusPill,
  Tabs,
  THead,
  TBody,
  TH,
  TD,
  cn,
} from '@/components/ds';

type OrderItem = {
  id: string;
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
  tracking_number: string | null;
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

const NEXT_STATUS: Record<string, { status: string; label: string; needsTracking?: boolean }> = {
  pending: { status: 'confirmed', label: 'Confirm' },
  confirmed: { status: 'packed', label: 'Mark as packed' },
  packed: { status: 'shipped', label: 'Mark as shipped', needsTracking: true },
  shipped: { status: 'delivered', label: 'Mark as delivered' },
};

type FilterStatus = 'all' | 'new' | 'in_progress' | 'shipped' | 'delivered';

const FILTER_STATUSES: Record<Exclude<FilterStatus, 'all'>, string[]> = {
  new: ['pending'],
  in_progress: ['confirmed', 'packed'],
  shipped: ['shipped'],
  delivered: ['delivered'],
};

export default function BrandOrdersPage() {
  const { user } = useAuth();
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedOrder, setExpandedOrder] = useState<string | null>(null);
  const [trackingInput, setTrackingInput] = useState('');
  const [trackingUrlInput, setTrackingUrlInput] = useState('');
  const [updatingOrder, setUpdatingOrder] = useState<string | null>(null);
  const [filter, setFilter] = useState<FilterStatus>('all');
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
        tracking_number, created_at, consumer_user_id,
        order_items (id, product_name, size, color, quantity, unit_price_dkk),
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

  async function updateStatus(orderId: string, newStatus: string) {
    setUpdatingOrder(orderId);
    try {
      const body: Record<string, string> = { status: newStatus };
      if (newStatus === 'shipped' && trackingInput) {
        body.tracking_number = trackingInput;
        if (trackingUrlInput) body.tracking_url = trackingUrlInput;
      }

      const res = await fetch(`/api/orders/${orderId}/status`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      if (res.ok) {
        setTrackingInput('');
        setTrackingUrlInput('');
        setExpandedOrder(null);
        await loadOrders();
      }
    } finally {
      setUpdatingOrder(null);
    }
  }

  const filteredOrders = filter === 'all' ? orders : orders.filter((o) => FILTER_STATUSES[filter].includes(o.status));

  const counts = orders.reduce(
    (acc, o) => {
      acc[o.status] = (acc[o.status] || 0) + 1;
      return acc;
    },
    {} as Record<string, number>,
  );

  const header = (
    <div>
      <h1 className="font-brand text-heading-xl uppercase text-primary">Orders</h1>
      <p className="mt-1 text-body text-slate">Paid to Flaym. You ship by hand and mark each step.</p>
    </div>
  );

  if (loading) {
    return (
      <div className="space-y-6">
        {header}
        <Skeleton className="h-9 w-full max-w-xl" />
        <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_380px]">
          <ListSkeleton rows={5} />
          <Skeleton className="hidden h-96 w-full xl:block" />
        </div>
      </div>
    );
  }

  const count = (key: Exclude<FilterStatus, 'all'>) => orders.filter((o) => FILTER_STATUSES[key].includes(o.status)).length;
  const selected = orders.find((o) => o.id === expandedOrder) ?? null;
  const select = (id: string) => setExpandedOrder(id === expandedOrder ? null : id);
  const shortDate = (iso: string) => new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
  const creditLabel = (orderId: string) => {
    const c = credits.get(orderId);
    if (c?.store) return c.store;
    if (c?.peer) return 'Passed on by a friend';
    return '—';
  };

  // Order detail: ship to, items, the chain, history and the next step
  const detail = (order: Order) => {
    const nextAction = NEXT_STATUS[order.status];
    const isUpdating = updatingOrder === order.id;
    const credit = credits.get(order.id);
    return (
      <div className="flex flex-col gap-5 font-brand">
        <div className="flex items-center justify-between gap-3">
          <p className="text-heading-lg">#{order.order_number}</p>
          <StatusPill status={order.status} label={STATUS_LABEL[order.status]} />
        </div>

        <div>
          <p className="mb-1 text-label uppercase text-slate">Ship to</p>
          <p className="text-body-sm text-primary">{order.shipping_name}</p>
          {order.profiles?.name && order.profiles.name !== order.shipping_name && (
            <p className="text-caption text-slate">Ordered by {order.profiles.name}</p>
          )}
          <p className="mt-0.5 text-body-sm text-slate">
            {order.shipping_address}, {order.shipping_postal_code} {order.shipping_city}, {order.shipping_country}
          </p>
        </div>

        <ul className="divide-y divide-line border-y border-line">
          {order.order_items.map((item) => (
            <li key={item.id} className="flex items-start justify-between gap-3 py-3 text-body-sm">
              <div className="min-w-0">
                <p className="truncate text-primary">{item.product_name}</p>
                <p className="text-caption text-slate">
                  {[item.size && `Size ${item.size}`, item.color].filter(Boolean).join(' · ') || 'One size'} · ×{item.quantity}
                </p>
              </div>
              <span className="whitespace-nowrap tabular-nums text-primary">{formatDKK(item.unit_price_dkk * item.quantity)}</span>
            </li>
          ))}
          <li className="flex justify-between py-3 text-body-sm">
            <span className="text-label uppercase text-slate">Total</span>
            <span className="font-medium tabular-nums text-primary">{formatDKK(order.total_dkk)}</span>
          </li>
        </ul>

        <div>
          <p className="mb-1 text-label uppercase text-slate">The chain</p>
          {credit?.store && <p className="text-body-sm text-primary">Store: {credit.store}</p>}
          {credit?.peer && <p className="text-body-sm text-primary">Passed on by a friend</p>}
          {!credit && <p className="text-caption text-slate">Bought without a scan</p>}
        </div>

        {order.tracking_number && (
          <div>
            <p className="mb-1 text-label uppercase text-slate">Tracking</p>
            <p className="text-body-sm text-primary">{order.tracking_number}</p>
          </div>
        )}

        <div>
          <p className="mb-2 text-label uppercase text-slate">History</p>
          <ol className="space-y-1.5">
            {[...order.order_events]
              .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
              .map((event, i) => (
                <li key={event.id} className="flex items-center gap-2.5 text-body-sm">
                  <span className={cn('h-2 w-2 shrink-0', i === 0 ? 'bg-accent' : 'bg-line')} />
                  <span className="text-primary">{STATUS_LABEL[event.status] === 'New' ? 'Placed' : STATUS_LABEL[event.status] ?? event.status}</span>
                  <span className="text-caption text-slate">
                    {new Date(event.created_at).toLocaleDateString('en-GB', {
                      day: 'numeric',
                      month: 'short',
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                  </span>
                </li>
              ))}
          </ol>
        </div>

        {/* Next step */}
        {nextAction && (
          <div className="space-y-3 border-t border-line pt-5">
            {nextAction.needsTracking && (
              <>
                <Field label="Tracking number" htmlFor={`tracking-${order.id}`}>
                  <Input
                    id={`tracking-${order.id}`}
                    type="text"
                    placeholder="e.g. 00370712345678901"
                    value={trackingInput}
                    onChange={(e) => setTrackingInput(e.target.value)}
                  />
                </Field>
                <Field label="Tracking URL (optional)" htmlFor={`tracking-url-${order.id}`}>
                  <Input
                    id={`tracking-url-${order.id}`}
                    type="url"
                    placeholder="https://"
                    value={trackingUrlInput}
                    onChange={(e) => setTrackingUrlInput(e.target.value)}
                  />
                </Field>
              </>
            )}
            <Button
              fullWidth
              size="lg"
              onClick={() => updateStatus(order.id, nextAction.status)}
              disabled={isUpdating || (nextAction.needsTracking && !trackingInput)}
              loading={isUpdating}
            >
              {isUpdating ? 'Updating…' : nextAction.label}
            </Button>
            {order.status === 'pending' && (
              <Button fullWidth variant="secondary" onClick={() => updateStatus(order.id, 'cancelled')} disabled={isUpdating}>
                Cancel order
              </Button>
            )}
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="space-y-6">
      {header}

      <Tabs
        variant="underline"
        items={[
          { value: 'new', label: 'New', count: count('new') },
          { value: 'in_progress', label: 'In progress', count: count('in_progress') },
          { value: 'shipped', label: 'Shipped', count: count('shipped') },
          { value: 'delivered', label: 'Delivered', count: count('delivered') },
          { value: 'all', label: 'All', count: orders.length },
        ]}
        value={filter}
        onValueChange={(v) => setFilter(v as FilterStatus)}
        className="[scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
      />

      {filteredOrders.length === 0 ? (
        <EmptyState
          className="bg-surface"
          icon={<ShoppingBag className="h-5 w-5" />}
          title={orders.length === 0 ? 'No orders yet' : 'Nothing here'}
          description={
            orders.length === 0
              ? 'Orders will appear here when customers purchase through QR scans'
              : 'No orders with this status right now.'
          }
        />
      ) : (
        <div className="grid grid-cols-[minmax(0,1fr)] items-start gap-5 xl:grid-cols-[minmax(0,1fr)_380px]">
          {/* Mobile: list */}
          <ul className="divide-y divide-line border border-line bg-surface md:hidden">
            {filteredOrders.map((order) => (
              <li key={order.id}>
                <button type="button" onClick={() => select(order.id)} className="flex w-full items-center gap-3 p-4 text-left">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="text-body-sm font-medium text-primary">#{order.order_number}</span>
                      <StatusPill status={order.status} label={STATUS_LABEL[order.status]} />
                    </div>
                    <p className="mt-1 truncate text-caption text-slate">
                      {shortDate(order.created_at)} · {order.order_items.length} item{order.order_items.length !== 1 ? 's' : ''} · {creditLabel(order.id)}
                    </p>
                  </div>
                  <span className="whitespace-nowrap text-body-sm tabular-nums text-primary">{formatDKK(order.total_dkk)}</span>
                  <ChevronRight className="h-4 w-4 shrink-0 text-slate" />
                </button>
              </li>
            ))}
          </ul>

          {/* Desktop: table */}
          <div className="hidden overflow-x-auto border border-line bg-surface md:block">
            <table className="w-full border-collapse font-brand text-body-sm text-primary">
              <THead>
                <tr>
                  <TH className="px-5">Order</TH>
                  <TH>Date</TH>
                  <TH className="text-right">Items</TH>
                  <TH>Credited store</TH>
                  <TH className="text-right">Total</TH>
                  <TH className="px-5">Status</TH>
                </tr>
              </THead>
              <TBody>
                {filteredOrders.map((order) => (
                  <tr
                    key={order.id}
                    onClick={() => select(order.id)}
                    aria-selected={order.id === expandedOrder}
                    className={cn('cursor-pointer transition-colors', order.id === expandedOrder ? 'bg-canvas-warm' : 'hover:bg-surface-muted/40')}
                  >
                    <TD className="px-5">
                      <button type="button" onClick={(e) => { e.stopPropagation(); select(order.id); }} className="font-medium hover:underline">
                        #{order.order_number}
                      </button>
                    </TD>
                    <TD className="whitespace-nowrap">{shortDate(order.created_at)}</TD>
                    <TD className="text-right tabular-nums">{order.order_items.reduce((n, i) => n + i.quantity, 0)}</TD>
                    <TD className="max-w-[200px] truncate">{creditLabel(order.id)}</TD>
                    <TD className="whitespace-nowrap text-right tabular-nums">{formatDKK(order.total_dkk)}</TD>
                    <TD className="px-5">
                      <StatusPill status={order.status} label={STATUS_LABEL[order.status]} />
                    </TD>
                  </tr>
                ))}
              </TBody>
            </table>
          </div>

          {/* Detail panel (desktop) */}
          <aside className="sticky top-6 hidden border border-line bg-surface p-6 xl:block">
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
      )}

      {/* Detail sheet (mobile and tablet) */}
      <Modal open={!!selected && !wide} onClose={() => setExpandedOrder(null)} variant="sheet" className="sm:max-w-lg">
        {selected && detail(selected)}
      </Modal>
    </div>
  );
}
