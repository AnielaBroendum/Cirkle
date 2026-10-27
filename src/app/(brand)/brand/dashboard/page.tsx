'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useAuth } from '@/components/providers/auth-provider';
import { createClient } from '@/lib/supabase';
import { formatDKK } from '@/lib/utils';
import { ScanLine, ShoppingBag, ArrowRight, Clock, Coins, Wallet } from 'lucide-react';
import {
  Badge,
  Card,
  EmptyState,
  KPISkeleton,
  ListSkeleton,
  Skeleton,
  StatTile,
  Tabs,
  THead,
  TBody,
  TR,
  TH,
  TD,
  cn,
} from '@/components/ds';
import type { Database } from '@/lib/database.types';

type Scan = Database['public']['Tables']['scans']['Row'];

type Period = 'day' | 'week' | 'month' | 'year';

const PERIOD_LABEL: Record<Period, string> = { day: 'today', week: 'this week', month: 'this month', year: 'this year' };
const PREV_LABEL: Record<Period, string> = { day: 'yesterday', week: 'last week', month: 'last month', year: 'last year' };

const DAY = 24 * 60 * 60 * 1000;

// Start of the selected period and of the period before it (for "vs. last …").
function periodRange(period: Period, now: Date): { start: Date; prevStart: Date } {
  if (period === 'day') {
    const start = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    return { start, prevStart: new Date(start.getTime() - DAY) };
  }
  if (period === 'week') {
    const start = new Date(now.getTime() - 7 * DAY);
    return { start, prevStart: new Date(start.getTime() - 7 * DAY) };
  }
  if (period === 'month') {
    return {
      start: new Date(now.getFullYear(), now.getMonth(), 1),
      prevStart: new Date(now.getFullYear(), now.getMonth() - 1, 1),
    };
  }
  return { start: new Date(now.getFullYear(), 0, 1), prevStart: new Date(now.getFullYear() - 1, 0, 1) };
}

// Chart buckets: 2-hour blocks today, days this week / month, months this year.
function buckets(period: Period, start: Date, now: Date): { label: string; from: number; to: number }[] {
  const out: { label: string; from: number; to: number }[] = [];
  if (period === 'day') {
    for (let h = 0; h < 24; h += 2) {
      const from = start.getTime() + h * 60 * 60 * 1000;
      out.push({ label: String(h).padStart(2, '0'), from, to: from + 2 * 60 * 60 * 1000 });
    }
  } else if (period === 'week') {
    for (let i = 0; i < 7; i++) {
      const d = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 6 + i);
      out.push({
        label: d.toLocaleDateString('en-GB', { weekday: 'short' }),
        from: d.getTime(),
        to: d.getTime() + DAY,
      });
    }
  } else if (period === 'month') {
    for (let day = 1; day <= now.getDate(); day++) {
      const d = new Date(now.getFullYear(), now.getMonth(), day);
      out.push({ label: String(day), from: d.getTime(), to: d.getTime() + DAY });
    }
  } else {
    for (let m = 0; m <= now.getMonth(); m++) {
      const d = new Date(now.getFullYear(), m, 1);
      out.push({
        label: d.toLocaleDateString('en-GB', { month: 'short' }),
        from: d.getTime(),
        to: new Date(now.getFullYear(), m + 1, 1).getTime(),
      });
    }
  }
  return out;
}

type KPIs = {
  scans: number;
  prevScans: number;
  saves: number | null;
  prevSaves: number | null;
  purchases: number;
  prevPurchases: number;
  sales: number;
  pendingOrders: number;
  activeSamples: number;
};

type ChartBar = { label: string; scans: number; saves: number; purchases: number };
type StoreRow = { id: string; name: string; scans: number; buys: number; cut: number };
type ProductRow = { id: string; name: string; scans: number; buys: number };

type ActivityItem = {
  id: string;
  type: 'scan' | 'order';
  description: string;
  time: string;
};

type CommissionItem = {
  id: string;
  retailer_name: string;
  amount_dkk: number;
  type: string;
  order_number: number | null;
  created_at: string;
};

export default function BrandDashboardPage() {
  const { user } = useAuth();
  const [period, setPeriod] = useState<Period>('month');
  const [kpis, setKpis] = useState<KPIs>({
    scans: 0,
    prevScans: 0,
    saves: null,
    prevSaves: null,
    purchases: 0,
    prevPurchases: 0,
    sales: 0,
    pendingOrders: 0,
    activeSamples: 0,
  });
  const [chart, setChart] = useState<ChartBar[]>([]);
  const [byStore, setByStore] = useState<StoreRow[]>([]);
  const [topProducts, setTopProducts] = useState<ProductRow[]>([]);
  const [activity, setActivity] = useState<ActivityItem[]>([]);
  const [commissions, setCommissions] = useState<CommissionItem[]>([]);
  const [totalCommissionOwed, setTotalCommissionOwed] = useState(0);
  const [depositsHeld, setDepositsHeld] = useState(0);
  const [depositsByRetailer, setDepositsByRetailer] = useState<{ retailer_name: string; total: number }[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    if (!user) return;
    // Ignore responses from a previous period if the toggle changes mid-load.
    let stale = false;
    setRefreshing(true);
    const supabase = createClient();

    supabase
      .from('brand_profiles')
      .select('id, name')
      .eq('user_id', user.id)
      .single()
      .then(async ({ data: bp }: { data: { id: string; name: string } | null }) => {
        if (!bp) {
          setLoading(false);
          setRefreshing(false);
          return;
        }
        const brandId = bp.id;

        const now = new Date();
        const { start, prevStart } = periodRange(period, now);
        const since = start.toISOString();
        const prevSince = prevStart.toISOString();

        const [productsRes, brandOrdersRes] = await Promise.all([
          supabase.from('products').select('id, name').eq('brand_id', brandId),
          supabase.from('orders').select('id').eq('brand_id', brandId),
        ]);
        const products = (productsRes.data ?? []) as { id: string; name: string }[];
        const productIds = products.map((p) => p.id);
        const brandOrderIds = ((brandOrdersRes.data ?? []) as { id: string }[]).map((o) => o.id);

        const [samplesRes, scansRes, ordersRes, periodOrdersRes, commissionsRes, savesRes] = await Promise.all([
          supabase
            .from('samples')
            .select('id', { count: 'exact', head: true })
            .eq('brand_id', brandId)
            .eq('status', 'active'),
          // Scans in this period and the one before (for the delta)
          supabase
            .from('scans')
            .select('id, scanned_at, product_id, source_retailer_id')
            .gte('scanned_at', prevSince)
            .in('product_id', productIds)
            .order('scanned_at', { ascending: false }),
          supabase
            .from('orders')
            .select('id, order_number, status, total_dkk, created_at')
            .eq('brand_id', brandId)
            .order('created_at', { ascending: false })
            .limit(20),
          // Purchases and sales in this period and the one before
          supabase
            .from('orders')
            .select('id, total_dkk, created_at')
            .eq('brand_id', brandId)
            .gte('created_at', prevSince)
            .neq('status', 'cancelled'),
          supabase
            .from('attributions')
            .select('id, attribution_type, commission_amount_dkk, source_retailer_id, created_at, order_id')
            .in('order_id', brandOrderIds)
            .not('source_retailer_id', 'is', null)
            .gte('created_at', since)
            .order('created_at', { ascending: false }),
          // Saves per day on the brand's products (counts only; migration 006)
          supabase.rpc('get_brand_save_counts', { p_since: prevSince }),
        ]);

        if (stale) return;

        const inPeriod = (iso: string) => iso >= since;

        type ScanRow = Pick<Scan, 'id' | 'scanned_at' | 'product_id' | 'source_retailer_id'>;
        const allScans = (scansRes.data ?? []) as ScanRow[];
        const scans = allScans.filter((s) => inPeriod(s.scanned_at));

        type PeriodOrder = { id: string; total_dkk: number; created_at: string };
        const allPeriodOrders = (periodOrdersRes.data ?? []) as PeriodOrder[];
        const periodOrders = allPeriodOrders.filter((o) => inPeriod(o.created_at));

        // If migration 006 isn't applied yet, Saves shows "–".
        const saveRows = savesRes.error ? null : ((savesRes.data ?? []) as { day: string; saves: number }[]);
        const saveDays = saveRows?.map((r) => ({ t: new Date(r.day).getTime(), n: Number(r.saves) })) ?? [];
        const savesIn = (from: number, to: number) =>
          saveDays.filter((r) => r.t >= from && r.t < to).reduce((sum, r) => sum + r.n, 0);

        type OrderRow = { id: string; order_number: number; status: string; total_dkk: number; created_at: string };
        const allOrders = (ordersRes.data ?? []) as OrderRow[];
        const pendingOrders = allOrders.filter((o) => o.status === 'pending').length;

        setKpis({
          scans: scans.length,
          prevScans: allScans.length - scans.length,
          saves: saveRows ? savesIn(start.getTime(), Infinity) : null,
          prevSaves: saveRows ? savesIn(prevStart.getTime(), start.getTime()) : null,
          purchases: periodOrders.length,
          prevPurchases: allPeriodOrders.length - periodOrders.length,
          sales: periodOrders.reduce((sum, o) => sum + o.total_dkk, 0),
          pendingOrders,
          activeSamples: samplesRes.count ?? 0,
        });

        // Activity over time
        setChart(
          buckets(period, start, now).map((b) => {
            const within = (iso: string) => {
              const t = new Date(iso).getTime();
              return t >= b.from && t < b.to;
            };
            return {
              label: b.label,
              scans: scans.filter((s) => within(s.scanned_at)).length,
              saves: savesIn(b.from, b.to),
              purchases: periodOrders.filter((o) => within(o.created_at)).length,
            };
          })
        );

        const items: ActivityItem[] = [];

        for (const scan of scans.slice(0, 5)) {
          items.push({
            id: scan.id,
            type: 'scan',
            description: 'New scan recorded',
            time: scan.scanned_at,
          });
        }

        for (const order of allOrders.slice(0, 5)) {
          items.push({
            id: order.id,
            type: 'order',
            description: `Order #${order.order_number ?? '—'} — ${formatDKK(order.total_dkk)}`,
            time: order.created_at,
          });
        }

        items.sort((a, b) => new Date(b.time).getTime() - new Date(a.time).getTime());
        setActivity(items.slice(0, 8));

        // Commission data
        type AttrRow = { id: string; attribution_type: string; commission_amount_dkk: number | null; source_retailer_id: string | null; created_at: string; order_id: string };
        const attrData = (commissionsRes.data ?? []) as AttrRow[];
        const storeScanIds = scans.map((s) => s.source_retailer_id).filter(Boolean) as string[];
        const retailerIds = Array.from(
          new Set([...attrData.map((a) => a.source_retailer_id).filter(Boolean), ...storeScanIds])
        ) as string[];
        const orderIds = Array.from(new Set(attrData.map((a) => a.order_id)));

        const [retailersRes, attrOrdersRes, itemsRes] = await Promise.all([
          retailerIds.length
            ? supabase.from('retailer_profiles').select('id, name').in('id', retailerIds)
            : Promise.resolve({ data: [] }),
          orderIds.length
            ? supabase.from('orders').select('id, order_number').in('id', orderIds)
            : Promise.resolve({ data: [] }),
          // Buys per product in this period
          periodOrders.length
            ? supabase.from('order_items').select('product_id, quantity').in('order_id', periodOrders.map((o) => o.id))
            : Promise.resolve({ data: [] }),
        ]);

        if (stale) return;

        const retailerMap = new Map(
          ((retailersRes.data ?? []) as { id: string; name: string }[]).map((r) => [r.id, r.name])
        );
        const orderNumMap = new Map(
          ((attrOrdersRes.data ?? []) as { id: string; order_number: number }[]).map((o) => [o.id, o.order_number])
        );

        const commissionItems: CommissionItem[] = attrData
          .filter((a) => a.commission_amount_dkk && a.source_retailer_id)
          .map((a) => ({
            id: a.id,
            retailer_name: retailerMap.get(a.source_retailer_id!) ?? 'Unknown',
            amount_dkk: a.commission_amount_dkk!,
            type: a.attribution_type,
            order_number: orderNumMap.get(a.order_id) ?? null,
            created_at: a.created_at,
          }));

        setCommissions(commissionItems);
        setTotalCommissionOwed(commissionItems.reduce((sum, c) => sum + c.amount_dkk, 0));

        // By store: scans in the store, purchases credited to it, its cut
        const stores = new Map<string, StoreRow>();
        const store = (id: string) => {
          if (!stores.has(id)) stores.set(id, { id, name: retailerMap.get(id) ?? 'Unknown', scans: 0, buys: 0, cut: 0 });
          return stores.get(id)!;
        };
        for (const id of storeScanIds) store(id).scans += 1;
        for (const a of attrData) {
          if (!a.source_retailer_id) continue;
          const row = store(a.source_retailer_id);
          row.buys += 1;
          row.cut += a.commission_amount_dkk ?? 0;
        }
        setByStore(Array.from(stores.values()).sort((a, b) => b.scans - a.scans || b.buys - a.buys).slice(0, 5));

        // Top products: scans and units bought
        const productName = new Map(products.map((p) => [p.id, p.name]));
        const productRows = new Map<string, ProductRow>();
        const productRow = (id: string) => {
          if (!productRows.has(id)) productRows.set(id, { id, name: productName.get(id) ?? 'Unknown product', scans: 0, buys: 0 });
          return productRows.get(id)!;
        };
        for (const s of scans) if (s.product_id) productRow(s.product_id).scans += 1;
        for (const it of (itemsRes.data ?? []) as { product_id: string | null; quantity: number }[]) {
          if (it.product_id) productRow(it.product_id).buys += it.quantity;
        }
        setTopProducts(
          Array.from(productRows.values()).sort((a, b) => b.scans - a.scans || b.buys - a.buys).slice(0, 5)
        );

        // Deposit data
        const { data: heldSamples } = await supabase
          .from('samples')
          .select('deposit_amount_dkk, retailer_id')
          .eq('brand_id', brandId)
          .eq('deposit_status', 'held');

        if (stale) return;

        if (heldSamples?.length) {
          const total = heldSamples.reduce((sum: number, s: { deposit_amount_dkk: number | null }) => sum + (s.deposit_amount_dkk ?? 0), 0);
          setDepositsHeld(total);

          const byRetailer = new Map<string, number>();
          for (const s of heldSamples as { deposit_amount_dkk: number | null; retailer_id: string }[]) {
            byRetailer.set(s.retailer_id, (byRetailer.get(s.retailer_id) ?? 0) + (s.deposit_amount_dkk ?? 0));
          }

          const rIds = Array.from(byRetailer.keys());
          const { data: depRetailers } = await supabase.from('retailer_profiles').select('id, name').in('id', rIds);
          const depRetailerMap = new Map((depRetailers ?? []).map((r: { id: string; name: string }) => [r.id, r.name]));

          if (stale) return;

          setDepositsByRetailer(
            Array.from(byRetailer.entries()).map(([rid, t]) => ({
              retailer_name: (depRetailerMap.get(rid) as string | undefined) ?? 'Unknown',
              total: t,
            })).sort((a, b) => b.total - a.total)
          );
        }

        setLoading(false);
        setRefreshing(false);
      });

    return () => {
      stale = true;
    };
  }, [user, period]);

  function timeAgo(dateStr: string): string {
    const diff = Date.now() - new Date(dateStr).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return 'Just now';
    if (mins < 60) return `${mins}m ago`;
    const hours = Math.floor(mins / 60);
    if (hours < 24) return `${hours}h ago`;
    const days = Math.floor(hours / 24);
    return `${days}d ago`;
  }

  // "+18%" vs. the previous period; hidden when there's nothing to compare with.
  function delta(current: number | null, previous: number | null): string | undefined {
    if (current === null || previous === null || previous === 0) return undefined;
    const pct = Math.round(((current - previous) / previous) * 100);
    return `${pct >= 0 ? '+' : ''}${pct}%`;
  }

  const header = (
    <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
      <div>
        <h1 className="font-brand text-heading-xl uppercase text-primary">Dashboard</h1>
        <p className="mt-1 text-body text-slate">Demand, orders and settlement in one place</p>
      </div>
      <Tabs
        items={[
          { value: 'day', label: 'Day' },
          { value: 'week', label: 'Week' },
          { value: 'month', label: 'Month' },
          { value: 'year', label: 'Year' },
        ]}
        value={period}
        onValueChange={(v) => setPeriod(v as Period)}
        className="self-start sm:self-auto [&>button]:h-[42px]"
      />
    </div>
  );

  if (loading) {
    return (
      <div className="space-y-7">
        {header}
        <KPISkeleton />
        <div className="grid gap-4 lg:grid-cols-[3fr_2fr]">
          <Skeleton className="h-72 w-full" />
          <ListSkeleton rows={4} />
        </div>
      </div>
    );
  }

  const vs = `vs. ${PREV_LABEL[period]}`;
  const chartMax = Math.max(1, ...chart.map((b) => b.scans + b.saves + b.purchases));
  const labelEvery = chart.length > 16 ? 3 : 1;

  return (
    <div className={cn('space-y-7 transition-opacity', refreshing && 'opacity-60')}>
      {header}

      {/* KPI tiles */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4 lg:gap-4">
        <StatTile label="Scans" value={kpis.scans.toLocaleString('en-GB')} delta={delta(kpis.scans, kpis.prevScans)} hint={vs} />
        <StatTile
          label="Saves"
          value={kpis.saves === null ? '–' : kpis.saves.toLocaleString('en-GB')}
          delta={delta(kpis.saves, kpis.prevSaves)}
          hint={kpis.saves === null ? 'Not available yet' : vs}
        />
        <StatTile
          label="Purchases"
          value={kpis.purchases.toLocaleString('en-GB')}
          delta={delta(kpis.purchases, kpis.prevPurchases)}
          hint={vs}
        />
        <StatTile
          label="Sales via Flaym"
          value={formatDKK(kpis.sales)}
          hint={<span className="text-success">Store cut: {formatDKK(totalCommissionOwed)}</span>}
        />
      </div>

      {/* Orders waiting */}
      {kpis.pendingOrders > 0 && (
        <Link
          href="/brand/orders"
          className="group flex items-center justify-between gap-3 border border-line bg-surface px-5 py-4 transition-colors hover:border-primary"
        >
          <span className="flex items-center gap-3 text-body text-primary">
            <Badge tone="accent">New</Badge>
            {kpis.pendingOrders} order{kpis.pendingOrders !== 1 ? 's' : ''} waiting to be shipped
          </span>
          <ArrowRight className="h-4 w-4 text-slate transition-transform group-hover:translate-x-1" />
        </Link>
      )}

      <div className="grid gap-4 lg:grid-cols-[3fr_2fr]">
        {/* Activity over time */}
        <Card padding="none" className="rounded-none p-5 lg:p-6">
          <div className="mb-6 flex flex-wrap items-baseline justify-between gap-3">
            <SectionTitle title="Activity over time" />
            <div className="flex flex-wrap gap-4 text-caption text-slate">
              <Legend className="bg-line" label="Scans" />
              <Legend className="bg-accent/50" label="Saves" />
              <Legend className="bg-accent" label="Purchases" />
            </div>
          </div>
          {chart.every((b) => b.scans + b.saves + b.purchases === 0) ? (
            <EmptyState
              className="border-none py-12"
              icon={<ScanLine className="h-5 w-5" />}
              title={`No activity ${PERIOD_LABEL[period]}`}
              description="Scans, saves and purchases show up here as people find your products in stores."
            />
          ) : (
            <div>
              <div className="flex h-48 items-end gap-[3px] sm:h-56 sm:gap-1.5" role="img" aria-label="Scans, saves and purchases per period">
                {chart.map((b) => (
                  <div key={b.label} className="flex h-full flex-1 flex-col justify-end gap-px" title={`${b.label}: ${b.scans} scans, ${b.saves} saves, ${b.purchases} purchases`}>
                    <div className="bg-line" style={{ height: `${(b.scans / chartMax) * 100}%` }} />
                    <div className="bg-accent/50" style={{ height: `${(b.saves / chartMax) * 100}%` }} />
                    <div className="bg-accent" style={{ height: `${(b.purchases / chartMax) * 100}%` }} />
                  </div>
                ))}
              </div>
              <div className="mt-2 flex gap-[3px] sm:gap-1.5">
                {chart.map((b, i) => (
                  <span key={b.label} className="flex-1 text-center text-caption text-slate">
                    {i % labelEvery === 0 ? b.label : ''}
                  </span>
                ))}
              </div>
            </div>
          )}
        </Card>

        {/* By store + top products */}
        <Card padding="none" className="rounded-none p-5 lg:p-6">
          <SectionTitle title="By store" />
          {byStore.length === 0 ? (
            <p className="mb-6 mt-3 text-caption text-slate">No store scans or purchases {PERIOD_LABEL[period]}.</p>
          ) : (
            <div className="-mx-1 mb-6 mt-3 overflow-x-auto">
              <table className="w-full border-collapse font-brand text-body-sm text-primary">
                <THead>
                  <tr>
                    <TH className="px-3 py-2 text-label font-medium">Store</TH>
                    <TH className="px-3 py-2 text-right text-label font-medium">Scans</TH>
                    <TH className="px-3 py-2 text-right text-label font-medium">Buys</TH>
                    <TH className="px-3 py-2 text-right text-label font-medium">Cut</TH>
                  </tr>
                </THead>
                <TBody>
                  {byStore.map((s) => (
                    <TR key={s.id}>
                      <TD className="px-3">{s.name}</TD>
                      <TD className="px-3 text-right tabular-nums">{s.scans}</TD>
                      <TD className="px-3 text-right tabular-nums">{s.buys}</TD>
                      <TD className="whitespace-nowrap px-3 text-right tabular-nums">{formatDKK(s.cut)}</TD>
                    </TR>
                  ))}
                </TBody>
              </table>
            </div>
          )}

          <SectionTitle title="Top products" />
          {topProducts.length === 0 ? (
            <p className="mt-3 text-caption text-slate">No product scans or purchases {PERIOD_LABEL[period]}.</p>
          ) : (
            <div className="-mx-1 mt-3 overflow-x-auto">
              <table className="w-full border-collapse font-brand text-body-sm text-primary">
                <THead>
                  <tr>
                    <TH className="px-3 py-2 text-label font-medium">Product</TH>
                    <TH className="px-3 py-2 text-right text-label font-medium">Scans</TH>
                    <TH className="px-3 py-2 text-right text-label font-medium">Buys</TH>
                  </tr>
                </THead>
                <TBody>
                  {topProducts.map((p) => (
                    <TR key={p.id}>
                      <TD className="px-3">{p.name}</TD>
                      <TD className="px-3 text-right tabular-nums">{p.scans}</TD>
                      <TD className="px-3 text-right tabular-nums">{p.buys}</TD>
                    </TR>
                  ))}
                </TBody>
              </table>
            </div>
          )}
        </Card>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        {/* Commission owed */}
        <Card padding="none" className="rounded-none p-5 lg:p-6">
          <SectionTitle
            title={`Commission ${PERIOD_LABEL[period]}`}
            aside={commissions.length > 0 ? `${formatDKK(totalCommissionOwed)} owed` : undefined}
          />
          {commissions.length === 0 ? (
            <EmptyState
              className="border-none py-8"
              icon={<Coins className="h-5 w-5" />}
              title="No commission owed"
              description="When a store's scan leads to a purchase, the store's cut shows up here."
            />
          ) : (
            <ul className="mt-2 divide-y divide-line">
              {commissions.map((c) => {
                const typeLabel = c.type === 'direct' ? 'Direct' : c.type === 'deferred' ? 'Deferred' : 'Tier 2';
                const typeTone = c.type === 'direct' ? 'accent' : c.type === 'deferred' ? 'neutral' : 'outline';
                return (
                  <li key={c.id} className="flex items-center gap-3 py-3">
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-body-sm text-primary">{c.retailer_name}</p>
                      <div className="mt-1 flex items-center gap-2">
                        <Badge tone={typeTone}>{typeLabel}</Badge>
                        {c.order_number && <span className="text-caption text-slate">Order #{c.order_number}</span>}
                      </div>
                    </div>
                    <span className="whitespace-nowrap text-body-sm font-medium tabular-nums text-primary">{formatDKK(c.amount_dkk)}</span>
                  </li>
                );
              })}
            </ul>
          )}
        </Card>

        {/* Deposits held */}
        <Card padding="none" className="rounded-none p-5 lg:p-6">
          <SectionTitle
            title="Deposits held"
            aside={depositsHeld > 0 ? `${formatDKK(depositsHeld)} total` : undefined}
          />
          <p className="text-caption text-slate">
            {kpis.activeSamples} active sample{kpis.activeSamples !== 1 ? 's' : ''} in stores
          </p>
          {depositsByRetailer.length === 0 ? (
            <EmptyState
              className="border-none py-8"
              icon={<Wallet className="h-5 w-5" />}
              title="No deposits held"
              description="Stores pay a deposit when they receive a sample."
            />
          ) : (
            <ul className="mt-2 divide-y divide-line">
              {depositsByRetailer.map((r) => (
                <li key={r.retailer_name} className="flex items-center justify-between gap-3 py-3 text-body-sm">
                  <span className="truncate text-primary">{r.retailer_name}</span>
                  <span className="whitespace-nowrap font-medium tabular-nums text-primary">{formatDKK(r.total)}</span>
                </li>
              ))}
            </ul>
          )}
        </Card>

        {/* Activity feed */}
        <Card padding="none" className="rounded-none p-5 lg:p-6">
          <SectionTitle title="Recent activity" />
          {activity.length === 0 ? (
            <EmptyState
              className="border-none py-8"
              icon={<Clock className="h-5 w-5" />}
              title="No activity yet"
              description="Scans and orders will appear here"
            />
          ) : (
            <ul className="mt-2 divide-y divide-line">
              {activity.map((item) => (
                <li key={item.id} className="flex items-center gap-3 py-3">
                  <span className={cn('shrink-0', item.type === 'scan' ? 'text-slate' : 'text-accent')}>
                    {item.type === 'scan' ? <ScanLine className="h-4 w-4" /> : <ShoppingBag className="h-4 w-4" />}
                  </span>
                  <p className="min-w-0 flex-1 truncate text-body-sm text-primary">{item.description}</p>
                  <span className="whitespace-nowrap text-caption text-slate">{timeAgo(item.time)}</span>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>
    </div>
  );
}

// Figma card title: 14px uppercase, with an optional muted note on the right.
function SectionTitle({ title, aside }: { title: string; aside?: string }) {
  return (
    <div className="flex items-baseline justify-between gap-3">
      <h2 className="font-brand text-body uppercase tracking-[0.3px] text-primary">{title}</h2>
      {aside && <span className="whitespace-nowrap text-caption text-slate">{aside}</span>}
    </div>
  );
}

function Legend({ className, label }: { className: string; label: string }) {
  return (
    <span className="flex items-center gap-1.5">
      <span className={cn('h-2.5 w-2.5', className)} />
      {label}
    </span>
  );
}
