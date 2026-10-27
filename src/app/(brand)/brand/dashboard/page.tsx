'use client';

import { Suspense, useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { useAuth } from '@/components/providers/auth-provider';
import { createClient } from '@/lib/supabase';
import { formatDKK } from '@/lib/utils';
import { ScanLine, ShoppingBag, ArrowRight, Bookmark, Clock, Coins, Wallet } from 'lucide-react';
import {
  Badge,
  Card,
  EmptyState,
  KPISkeleton,
  ListSkeleton,
  Select,
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
type Period = 'day' | 'week' | 'month' | 'year';

const PERIODS: Period[] = ['day', 'week', 'month', 'year'];
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

// Everything below is counted in the database (get_brand_dashboard, migration 009).
type Dashboard = {
  kpis: {
    scans: number;
    saves: number;
    purchases: number;
    sales: number;
    store_cut: number;
    prev_scans: number;
    prev_saves: number;
    prev_purchases: number;
  };
  saves_by_size: { size: string | null; saves: number }[];
  chart: { t: string; scans: number; saves: number; purchases: number }[];
  by_store: { id: string; name: string; scans: number; buys: number; cut: number }[];
  top_products: { id: string; name: string; scans: number; buys: number }[];
  commissions: {
    id: string;
    retailer_name: string;
    amount_dkk: number;
    type: string;
    order_number: number | null;
    created_at: string;
  }[];
  recent: { id: string; type: 'scan' | 'save' | 'purchase'; product: string; store: string | null; size: string | null; time: string }[];
  deposits: { retailer_name: string; total: number }[];
  active_samples: number;
  pending_orders: number;
};

type ProductOption = { id: string; name: string; sizes: string[] };
type StoreOption = { id: string; name: string };

// Clothing sizes in wearing order; numeric sizes by value; anything else after.
const SIZE_ORDER = ['XXS', 'XS', 'S', 'M', 'L', 'XL', 'XXL', 'XXXL'];
function sizeRank(size: string | null): number {
  if (size === null) return 10_000;
  const i = SIZE_ORDER.indexOf(size.toUpperCase());
  if (i >= 0) return i;
  const n = Number(size);
  return Number.isFinite(n) ? 100 + n : 1_000;
}
const bySize = (a: string | null, b: string | null) => sizeRank(a) - sizeRank(b) || String(a).localeCompare(String(b));

// "32%" or "4.9%"; "–" when there is nothing to divide by.
function ratio(part: number, whole: number): string {
  if (whole === 0) return '–';
  const pct = (part / whole) * 100;
  return `${pct < 10 ? pct.toFixed(1) : Math.round(pct)}%`;
}

const CHART_BUCKET: Record<Period, 'hour' | 'day' | 'month'> = { day: 'hour', week: 'day', month: 'day', year: 'month' };

export default function BrandDashboardPage() {
  return (
    <Suspense fallback={<KPISkeleton />}>
      <Dashboard />
    </Suspense>
  );
}

function Dashboard() {
  const { user } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  // Filters live in the URL, so a reload or a shared link shows the same view.
  const periodParam = searchParams.get('period') as Period | null;
  const period: Period = periodParam && PERIODS.includes(periodParam) ? periodParam : 'month';
  const productId = searchParams.get('product');
  const storeId = searchParams.get('store');
  const size = searchParams.get('size');

  const setFilter = useCallback(
    (key: 'period' | 'product' | 'store' | 'size', value: string | null) => {
      const next = new URLSearchParams(searchParams.toString());
      if (value) next.set(key, value);
      else next.delete(key);
      // A size that the newly chosen product doesn't come in would match nothing.
      if (key === 'product') next.delete('size');
      const qs = next.toString();
      router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
    },
    [router, pathname, searchParams]
  );

  const [products, setProducts] = useState<ProductOption[]>([]);
  const [stores, setStores] = useState<StoreOption[]>([]);
  const [data, setData] = useState<Dashboard | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');

  // Filter options
  useEffect(() => {
    if (!user) return;
    const supabase = createClient();
    (async () => {
      const { data: bp } = await supabase.from('brand_profiles').select('id').eq('user_id', user.id).single();
      if (!bp) return;
      const [productsRes, storesRes] = await Promise.all([
        supabase.from('products').select('id, name, sizes').eq('brand_id', bp.id).order('name'),
        supabase.rpc('get_brand_dashboard_stores'),
      ]);
      setProducts(((productsRes.data ?? []) as ProductOption[]).map((p) => ({ ...p, sizes: p.sizes ?? [] })));
      setStores((storesRes.data ?? []) as StoreOption[]);
    })();
  }, [user]);

  // Dashboard numbers
  useEffect(() => {
    if (!user) return;
    // Ignore responses from earlier filters if they change mid-load.
    let stale = false;
    setRefreshing(true);
    const now = new Date();
    const { start, prevStart } = periodRange(period, now);
    createClient()
      .rpc('get_brand_dashboard', {
        p_start: start.toISOString(),
        p_prev_start: prevStart.toISOString(),
        p_end: now.toISOString(),
        p_product: productId,
        p_retailer: storeId,
        p_size: size,
        p_bucket: CHART_BUCKET[period],
        p_tz: Intl.DateTimeFormat().resolvedOptions().timeZone,
      })
      .then(({ data: result, error: rpcError }: { data: Dashboard | null; error: { message: string } | null }) => {
        if (stale) return;
        setError(rpcError ? 'Could not load the dashboard. Try again in a moment.' : '');
        if (result) setData(result);
        setLoading(false);
        setRefreshing(false);
      });
    return () => {
      stale = true;
    };
  }, [user, period, productId, storeId, size]);

  const sizeOptions = useMemo(() => {
    const source = productId ? products.filter((p) => p.id === productId) : products;
    return Array.from(new Set(source.flatMap((p) => p.sizes))).sort(bySize);
  }, [products, productId]);

  const chart = useMemo(() => {
    if (!data) return [];
    const now = new Date();
    const { start } = periodRange(period, now);
    // Rows come back per hour / day / month in the browser's time zone.
    const rows = data.chart.map((r) => ({ ...r, ms: new Date(r.t).getTime() }));
    return buckets(period, start, now).map((b) => {
      const inside = rows.filter((r) => r.ms >= b.from && r.ms < b.to);
      return {
        label: b.label,
        scans: inside.reduce((n, r) => n + r.scans, 0),
        saves: inside.reduce((n, r) => n + r.saves, 0),
        purchases: inside.reduce((n, r) => n + r.purchases, 0),
      };
    });
  }, [data, period]);

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
  function delta(current: number, previous: number): string | undefined {
    if (previous === 0) return undefined;
    const pct = Math.round(((current - previous) / previous) * 100);
    return `${pct >= 0 ? '+' : ''}${pct}%`;
  }

  const header = (
    <div className="space-y-4">
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
          onValueChange={(v) => setFilter('period', v === 'month' ? null : v)}
          className="self-start sm:self-auto [&>button]:h-[42px]"
        />
      </div>
      <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap">
        <Select
          aria-label="Product"
          value={productId ?? ''}
          onChange={(e) => setFilter('product', e.target.value || null)}
          className="sm:w-64"
        >
          <option value="">Product: All products</option>
          {products.map((p) => (
            <option key={p.id} value={p.id}>
              Product: {p.name}
            </option>
          ))}
        </Select>
        <Select
          aria-label="Store"
          value={storeId ?? ''}
          onChange={(e) => setFilter('store', e.target.value || null)}
          className="sm:w-56"
        >
          <option value="">Store: All stores</option>
          {stores.map((s) => (
            <option key={s.id} value={s.id}>
              Store: {s.name}
            </option>
          ))}
        </Select>
        <Select
          aria-label="Size"
          value={size ?? ''}
          onChange={(e) => setFilter('size', e.target.value || null)}
          className="sm:w-48"
        >
          <option value="">Size: All sizes</option>
          {sizeOptions.map((s) => (
            <option key={s} value={s}>
              Size: {s}
            </option>
          ))}
        </Select>
      </div>
    </div>
  );

  if (loading || !data) {
    return (
      <div className="space-y-7">
        {header}
        {error ? (
          <p className="text-body text-accent-strong">{error}</p>
        ) : (
          <>
            <KPISkeleton />
            <div className="grid gap-4 lg:grid-cols-[3fr_2fr]">
              <Skeleton className="h-72 w-full" />
              <ListSkeleton rows={4} />
            </div>
          </>
        )}
      </div>
    );
  }

  const { kpis } = data;
  const vs = `vs. ${PREV_LABEL[period]}`;
  const chartMax = Math.max(1, ...chart.map((b) => b.scans + b.saves + b.purchases));
  const labelEvery = chart.length > 16 ? 3 : 1;
  const savesBySize = [...data.saves_by_size].sort((a, b) => bySize(a.size, b.size));
  const sizeMax = Math.max(1, ...savesBySize.map((s) => s.saves));
  const funnelMax = Math.max(1, kpis.scans);
  const totalCommission = data.commissions.reduce((n, c) => n + c.amount_dkk, 0);
  const depositsHeld = data.deposits.reduce((n, d) => n + d.total, 0);

  return (
    <div className={cn('space-y-7 transition-opacity', refreshing && 'opacity-60')}>
      {header}
      {error && <p className="text-body text-accent-strong">{error}</p>}

      {/* KPI tiles */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4 lg:gap-4">
        <StatTile label="Scans" value={kpis.scans.toLocaleString('en-GB')} delta={delta(kpis.scans, kpis.prev_scans)} hint={vs} />
        <StatTile label="Saves" value={kpis.saves.toLocaleString('en-GB')} delta={delta(kpis.saves, kpis.prev_saves)} hint={vs} />
        <StatTile
          label="Purchases"
          value={kpis.purchases.toLocaleString('en-GB')}
          delta={delta(kpis.purchases, kpis.prev_purchases)}
          hint={vs}
        />
        <StatTile
          label="Sales via Flaym"
          value={formatDKK(kpis.sales)}
          hint={<span className="text-success">Store cut: {formatDKK(kpis.store_cut)}</span>}
        />
      </div>

      {/* Orders waiting */}
      {data.pending_orders > 0 && (
        <Link
          href="/brand/orders"
          className="group flex items-center justify-between gap-3 border border-line bg-surface px-5 py-4 transition-colors hover:border-primary"
        >
          <span className="flex items-center gap-3 text-body text-primary">
            <Badge tone="accent">New</Badge>
            {data.pending_orders} order{data.pending_orders !== 1 ? 's' : ''} waiting to be shipped
          </span>
          <ArrowRight className="h-4 w-4 text-slate transition-transform group-hover:translate-x-1" />
        </Link>
      )}

      <div className="grid gap-4 lg:grid-cols-[3fr_2fr]">
        {/* Funnel + saves by size (Figma 02, left card) */}
        <Card padding="none" className="rounded-none p-5 lg:p-6">
          <SectionTitle title="From scan to purchase" />
          <p className="mt-1 text-caption text-slate">{`${PERIOD_LABEL[period][0].toUpperCase()}${PERIOD_LABEL[period].slice(1)}, filtered as above`}</p>

          <div className="mt-6 space-y-2">
            <FunnelBar label="Scans" value={kpis.scans} max={funnelMax} className="bg-ash" />
            <p className="pb-2 text-caption text-cinder">↓ {ratio(kpis.saves, kpis.scans)} of scans were saved</p>
            <FunnelBar label="Saves" value={kpis.saves} max={funnelMax} className="bg-accent/50" />
            <p className="pb-2 text-caption text-cinder">
              ↓ {ratio(kpis.purchases, kpis.saves)} of saves were bought · {ratio(kpis.purchases, kpis.scans)} of scans
            </p>
            <FunnelBar label="Purchases" value={kpis.purchases} max={funnelMax} className="bg-accent" />
          </div>
          {size && (
            <p className="mt-4 border-l-2 border-accent pl-3 text-caption text-slate">
              Size {size}: saves and purchases are size {size} only. Scans count every size, because people scan before
              they pick a size.
            </p>
          )}

          <div className="mt-10">
            <SectionTitle title="Saves by size" />
            <p className="mt-1 text-caption text-slate">Shows which sizes to produce more of</p>
            {savesBySize.length === 0 ? (
              <p className="mt-6 text-caption text-slate">No saves {PERIOD_LABEL[period]}.</p>
            ) : (
              <div className="mt-6 flex items-end gap-3 sm:gap-6">
                {savesBySize.map((s) => (
                  <div key={s.size ?? 'none'} className="flex min-w-0 max-w-16 flex-1 flex-col">
                    <div className="flex h-32 items-end">
                      <div
                        className={cn('w-full', s.saves === sizeMax ? 'bg-accent' : 'bg-accent/50')}
                        style={{ height: `${Math.max(4, (s.saves / sizeMax) * 100)}%` }}
                        title={`${s.size ?? 'No size'}: ${s.saves} saves`}
                      />
                    </div>
                    <p className="mt-2 flex flex-wrap gap-x-2 text-caption">
                      <span className="font-medium text-primary">{s.size ?? 'No size'}</span>
                      <span className="tabular-nums text-slate">{s.saves}</span>
                    </p>
                  </div>
                ))}
              </div>
            )}
          </div>
        </Card>

        {/* By store + top products */}
        <Card padding="none" className="rounded-none p-5 lg:p-6">
          <SectionTitle title="By store" />
          {data.by_store.length === 0 ? (
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
                  {data.by_store.map((s) => (
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
          {data.top_products.length === 0 ? (
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
                  {data.top_products.map((p) => (
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

      <div className="grid gap-4 lg:grid-cols-3">
        {/* Commission owed */}
        <Card padding="none" className="rounded-none p-5 lg:p-6">
          <SectionTitle
            title={`Commission ${PERIOD_LABEL[period]}`}
            aside={data.commissions.length > 0 ? `${formatDKK(totalCommission)} owed` : undefined}
          />
          {data.commissions.length === 0 ? (
            <EmptyState
              className="border-none py-8"
              icon={<Coins className="h-5 w-5" />}
              title="No commission owed"
              description="When a store's scan leads to a purchase, the store's cut shows up here."
            />
          ) : (
            <ul className="mt-2 divide-y divide-line">
              {data.commissions.map((c) => {
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
          <SectionTitle title="Deposits held" aside={depositsHeld > 0 ? `${formatDKK(depositsHeld)} total` : undefined} />
          <p className="text-caption text-slate">
            {data.active_samples} active sample{data.active_samples !== 1 ? 's' : ''} in stores
          </p>
          {data.deposits.length === 0 || depositsHeld === 0 ? (
            <EmptyState
              className="border-none py-8"
              icon={<Wallet className="h-5 w-5" />}
              title="No deposits held"
              description="Stores pay a deposit when they receive a sample."
            />
          ) : (
            <ul className="mt-2 divide-y divide-line">
              {data.deposits.map((r) => (
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
          {data.recent.length === 0 ? (
            <EmptyState
              className="border-none py-8"
              icon={<Clock className="h-5 w-5" />}
              title="No activity yet"
              description="Scans, saves and purchases will appear here"
            />
          ) : (
            <ul className="mt-2 divide-y divide-line">
              {data.recent.map((item) => (
                <li key={item.id} className="flex items-center gap-3 py-3">
                  <span className={cn('shrink-0', item.type === 'purchase' ? 'text-accent' : 'text-slate')}>
                    {item.type === 'scan' ? (
                      <ScanLine className="h-4 w-4" />
                    ) : item.type === 'save' ? (
                      <Bookmark className="h-4 w-4" />
                    ) : (
                      <ShoppingBag className="h-4 w-4" />
                    )}
                  </span>
                  <p className="min-w-0 flex-1 truncate text-body-sm text-primary">
                    {item.type === 'scan' ? 'Scan' : item.type === 'save' ? 'Save' : 'Purchase'} · {item.product}
                    {item.size ? ` · ${item.size}` : ''}
                    {item.store ? ` · ${item.store}` : ''}
                  </p>
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

function FunnelBar({ label, value, max, className }: { label: string; value: number; max: number; className: string }) {
  return (
    <div>
      <div className="mb-2 flex items-baseline justify-between">
        <span className="text-label uppercase text-slate">{label}</span>
        <span className="text-title tabular-nums text-primary">{value.toLocaleString('en-GB')}</span>
      </div>
      <div className="h-8 w-full">
        <div className={cn('h-full', className)} style={{ width: `${Math.max(value > 0 ? 2 : 0, (value / max) * 100)}%` }} />
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
