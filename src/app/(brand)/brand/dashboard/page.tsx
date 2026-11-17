'use client';

import { Suspense, useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { useAuth } from '@/components/providers/auth-provider';
import { createClient } from '@/lib/supabase';
import { formatDKK } from '@/lib/utils';
import type { Database } from '@/lib/database.types';
import {
  ArrowLink,
  Chip,
  KPISkeleton,
  OrdersIcon,
  PageHeader,
  Panel,
  PanelHeader,
  ProductsIcon,
  ReturnsIcon,
  Segmented,
  Select,
  Skeleton,
  StoresQrIcon,
  Thumb,
  buttonClasses,
  cn,
} from '@/components/ds';

/*
 * Brand dashboard, Portals v2 (Figma "Brand Portal v2 / 02 Dashboard", 358:161).
 * Numbers: get_brand_dashboard (009) for the period KPIs and top stores, get_brand_overview (017)
 * for "Where things stand", saves by size (with the range before it) and the buy rate.
 * The filter row (period, product, store, size) applies to every block; "Where things stand" is
 * live, so the period doesn't narrow it, and "Saves by size" has its own range switch.
 */

type Period = 'day' | 'week' | 'month' | 'year';
const PERIODS: Period[] = ['day', 'week', 'month', 'year'];
const PERIOD_LABEL: Record<Period, string> = { day: 'today', week: 'this week', month: 'this month', year: 'this year' };

type SavesRange = '7d' | '4w' | '6m';
const SAVES_RANGES: { value: SavesRange; label: string; days: number; span: string }[] = [
  { value: '7d', label: '7 days', days: 7, span: 'the last 7 days' },
  { value: '4w', label: '4 weeks', days: 28, span: 'the last 4 weeks' },
  { value: '6m', label: '6 months', days: 182, span: 'the last 6 months' },
];

const DAY = 24 * 60 * 60 * 1000;

// Start of the selected period and of the one before it (009 wants both).
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
    return { start: new Date(now.getFullYear(), now.getMonth(), 1), prevStart: new Date(now.getFullYear(), now.getMonth() - 1, 1) };
  }
  return { start: new Date(now.getFullYear(), 0, 1), prevStart: new Date(now.getFullYear() - 1, 0, 1) };
}

type Dashboard = {
  kpis: { scans: number; saves: number; purchases: number; sales: number; store_cut: number };
  by_store: { id: string; name: string; scans: number; buys: number; cut: number }[];
  pending_orders: number;
};
type Overview = NonNullable<Database['public']['Functions']['get_brand_overview']['Returns']>;
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

const count = (n: number) => n.toLocaleString('en-GB');
const plural = (n: number, one: string, many = `${one}s`) => `${count(n)} ${n === 1 ? one : many}`;

function greeting(now: Date) {
  const h = Number(new Intl.DateTimeFormat('en-GB', { hour: 'numeric', hourCycle: 'h23', timeZone: 'Europe/Copenhagen' }).format(now));
  return h < 5 ? 'Good evening' : h < 12 ? 'Good morning' : h < 18 ? 'Good afternoon' : 'Good evening';
}

/**
 * The one-line insight under Saves by size, from the data: the size whose saves changed most
 * against the range before it (sizes with at least 3 saves across both ranges), plus the most
 * saved size. Null when there are no saves.
 */
function savesInsight(rows: Overview['saves_by_size'], span: string): { chip: string; tone: 'up' | 'down' | 'flat'; text: string } | null {
  const named = rows.filter((r) => r.saves > 0 || r.prev > 0);
  if (named.every((r) => r.saves === 0)) return null;
  const label = (s: string | null) => s ?? 'No size';
  const top = [...named].sort((a, b) => b.saves - a.saves || bySize(a.size, b.size))[0];
  const changes = named
    .filter((r) => r.prev > 0 && r.saves + r.prev >= 3)
    .map((r) => ({ ...r, pct: Math.round(((r.saves - r.prev) / r.prev) * 100) }))
    .sort((a, b) => Math.abs(b.pct) - Math.abs(a.pct) || b.saves - a.saves);
  const biggest = changes[0];
  const topText = `Size ${label(top.size)} is saved most in ${span}.`;
  if (!biggest || biggest.pct === 0) {
    return { chip: `${label(top.size)} saved most`, tone: 'flat', text: `${topText} No change in saves against the period before.` };
  }
  const up = biggest.pct > 0;
  const advice =
    up && biggest.size === top.size
      ? ' Consider a bigger batch.'
      : up
        ? ` ${label(biggest.size)} is catching up.`
        : ` Saves of ${label(biggest.size)} have slowed against the period before.`;
  return { chip: `${label(biggest.size)} is ${up ? 'up' : 'down'} ${Math.abs(biggest.pct)}%`, tone: up ? 'up' : 'down', text: topText + advice };
}

export default function BrandDashboardPage() {
  return (
    <Suspense fallback={<KPISkeleton />}>
      <DashboardView />
    </Suspense>
  );
}

function DashboardView() {
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
  const savesParam = searchParams.get('saves');
  const savesRange = SAVES_RANGES.find((r) => r.value === savesParam) ?? SAVES_RANGES[1];

  const setFilter = useCallback(
    (key: 'period' | 'product' | 'store' | 'size' | 'saves', value: string | null) => {
      const next = new URLSearchParams(searchParams.toString());
      if (value) next.set(key, value);
      else next.delete(key);
      // A size the newly chosen product doesn't come in would match nothing.
      if (key === 'product') next.delete('size');
      const qs = next.toString();
      router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
    },
    [router, pathname, searchParams]
  );

  const [brandName, setBrandName] = useState('');
  const [products, setProducts] = useState<ProductOption[]>([]);
  const [stores, setStores] = useState<StoreOption[]>([]);
  const [data, setData] = useState<Dashboard | null>(null);
  const [overview, setOverview] = useState<Overview | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');

  // Brand name and filter options
  useEffect(() => {
    if (!user) return;
    const supabase = createClient();
    (async () => {
      const { data: bp } = await supabase.from('brand_profiles').select('id, name').eq('user_id', user.id).single();
      if (!bp) return;
      setBrandName(bp.name ?? '');
      const [productsRes, storesRes] = await Promise.all([
        supabase.from('products').select('id, name, sizes').eq('brand_id', bp.id).order('name'),
        supabase.rpc('get_brand_dashboard_stores'),
      ]);
      setProducts(((productsRes.data ?? []) as ProductOption[]).map((p) => ({ ...p, sizes: p.sizes ?? [] })));
      setStores((storesRes.data ?? []) as StoreOption[]);
    })();
  }, [user]);

  // Every number on the page, counted in the database.
  useEffect(() => {
    if (!user) return;
    let stale = false; // ignore answers to earlier filters
    setRefreshing(true);
    const now = new Date();
    const { start, prevStart } = periodRange(period, now);
    const supabase = createClient();
    Promise.all([
      supabase.rpc('get_brand_dashboard', {
        p_start: start.toISOString(),
        p_prev_start: prevStart.toISOString(),
        p_end: now.toISOString(),
        p_product: productId,
        p_retailer: storeId,
        p_size: size,
        p_bucket: 'day',
        p_tz: Intl.DateTimeFormat().resolvedOptions().timeZone,
      }),
      supabase.rpc('get_brand_overview', {
        p_start: start.toISOString(),
        p_end: now.toISOString(),
        p_saves_days: savesRange.days,
        p_product: productId,
        p_retailer: storeId,
        p_size: size,
      }),
    ]).then(([dash, over]) => {
      if (stale) return;
      setError(dash.error || over.error ? 'Could not load the dashboard. Try again in a moment.' : '');
      if (dash.data) setData(dash.data as unknown as Dashboard);
      if (over.data) setOverview(over.data as Overview);
      setRefreshing(false);
    });
    return () => {
      stale = true;
    };
  }, [user, period, productId, storeId, size, savesRange.days]);

  const sizeOptions = useMemo(() => {
    const source = productId ? products.filter((p) => p.id === productId) : products;
    return Array.from(new Set(source.flatMap((p) => p.sizes))).sort(bySize);
  }, [products, productId]);

  const storeName = stores.find((s) => s.id === storeId)?.name;
  const productName = products.find((p) => p.id === productId)?.name;
  const scope = [storeName ?? 'all stores', productName, size ? `size ${size}` : null].filter(Boolean).join(', ');
  const periodText = PERIOD_LABEL[period];

  const filters = (
    <div className="flex flex-col gap-2.5 md:flex-row md:flex-wrap md:items-center">
      <Segmented
        label="Period"
        items={[
          { value: 'day', label: 'Day' },
          { value: 'week', label: 'Week' },
          { value: 'month', label: 'Month' },
          { value: 'year', label: 'Year' },
        ]}
        value={period}
        onValueChange={(v) => setFilter('period', v === 'month' ? null : v)}
        className="self-start"
      />
      <Select aria-label="Product" value={productId ?? ''} onChange={(e) => setFilter('product', e.target.value || null)} className="h-[38px] md:w-56">
        <option value="">All products</option>
        {products.map((p) => (
          <option key={p.id} value={p.id}>
            {p.name}
          </option>
        ))}
      </Select>
      <Select aria-label="Store" value={storeId ?? ''} onChange={(e) => setFilter('store', e.target.value || null)} className="h-[38px] md:w-52">
        <option value="">All stores</option>
        {stores.map((s) => (
          <option key={s.id} value={s.id}>
            {s.name}
          </option>
        ))}
      </Select>
      <Select aria-label="Size" value={size ?? ''} onChange={(e) => setFilter('size', e.target.value || null)} className="h-[38px] md:w-40">
        <option value="">All sizes</option>
        {sizeOptions.map((s) => (
          <option key={s} value={s}>
            Size {s}
          </option>
        ))}
      </Select>
    </div>
  );

  const header = (
    <PageHeader
      title={`${greeting(new Date())}${brandName ? `, ${brandName}` : ''}`}
      subtitle={
        data
          ? `${plural(data.kpis.scans, 'scan')} ${periodText}, ${plural(data.kpis.purchases, 'piece')} sold and ${plural(
              data.pending_orders,
              'order'
            )} waiting to ship.`
          : ' '
      }
      actions={
        <Link href="/brand/products/new" className={buttonClasses({ variant: 'flame', className: 'h-[43px]' })}>
          + New product
        </Link>
      }
    />
  );

  if (!data || !overview) {
    return (
      <div className="space-y-6">
        {header}
        {filters}
        {error ? (
          <p className="text-body text-accent-strong">{error}</p>
        ) : (
          <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_380px]">
            <Skeleton className="h-[374px] w-full" />
            <Skeleton className="h-[259px] w-full" />
          </div>
        )}
      </div>
    );
  }

  const { kpis } = data;
  const payout = kpis.sales - kpis.store_cut;
  const savesRows = [...overview.saves_by_size].filter((r) => r.saves > 0 || r.prev > 0).sort((a, b) => bySize(a.size, b.size));
  const savesMax = Math.max(1, ...savesRows.map((r) => r.saves));
  const insight = savesInsight(overview.saves_by_size, savesRange.span);
  const { stand } = overview;

  return (
    <div className={cn('space-y-6 transition-opacity', refreshing && 'opacity-60')}>
      {header}
      {filters}
      {error && <p className="text-body text-accent-strong">{error}</p>}

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_380px]">
        <div className="flex min-w-0 flex-col gap-4">
          {/* Where things stand */}
          <Panel aria-labelledby="stand-title">
            <PanelHeader
              title={<span id="stand-title">Where things stand</span>}
              subtitle={`Products, stores, orders and returns, live${storeName || productName || size ? ` · ${scope}` : ''}`}
              action={
                <div className="flex items-center gap-3.5 text-caption text-ash">
                  <LegendDot className="bg-primary" label="Done" />
                  <LegendDot className="bg-accent" label="Moving" />
                  <LegendDot className="bg-surface-dark" label="Waiting" />
                </div>
              }
            />
            <div className="mt-1 divide-y divide-flare/[0.04]">
              <StandRow icon={ProductsIcon} label="Products" href="/brand/products" row={stand.products} caption={`${count(stand.products.done)} live in stores`} />
              <StandRow
                icon={StoresQrIcon}
                label="Stores"
                href="/brand/samples"
                row={stand.stores}
                caption={`${count(stand.stores.done + stand.stores.moving)} active`}
              />
              <StandRow icon={OrdersIcon} label="Orders" href="/brand/orders" row={stand.orders} caption={`${count(stand.orders.done)} delivered`} />
              <StandRow icon={ReturnsIcon} label="Returns" href="/brand/returns" row={stand.returns} caption={`${count(stand.returns.done)} resolved`} />
            </div>
          </Panel>

          {/* Saves by size */}
          <Panel aria-labelledby="saves-title" className="flex flex-col gap-5">
            <PanelHeader
              title={<span id="saves-title">Saves by size</span>}
              subtitle="What people want, so you know what to make next"
              action={
                <Segmented
                  label="Saves range"
                  items={SAVES_RANGES.map((r) => ({ value: r.value, label: r.label }))}
                  value={savesRange.value}
                  onValueChange={(v) => setFilter('saves', v === '4w' ? null : v)}
                />
              }
            />
            {savesRows.every((r) => r.saves === 0) ? (
              <p className="py-10 text-center text-caption text-smoke">No saves in {savesRange.span}.</p>
            ) : (
              <div className="flex h-[180px] items-end gap-2 sm:gap-[18px]" role="img" aria-label={`Saves per size in ${savesRange.span}`}>
                {savesRows.map((r) => {
                  const top = r.saves === savesMax;
                  const share = r.saves / savesMax;
                  return (
                    <div key={r.size ?? 'none'} className="flex min-w-0 flex-1 flex-col items-center gap-2">
                      <span className={cn('text-caption font-medium tabular-nums', top ? 'text-flare' : 'text-ash')}>{count(r.saves)}</span>
                      <div
                        className={cn('w-full', top ? 'bg-flaym-tile' : share >= 0.5 ? 'bg-slate/40' : 'bg-surface-dark')}
                        style={{ height: `${Math.max(r.saves > 0 ? 6 : 2, share * 115)}px` }}
                      />
                      <span className="max-w-full truncate text-caption text-smoke">{r.size ?? 'No size'}</span>
                    </div>
                  );
                })}
              </div>
            )}
            {insight && (
              <div className="flex flex-wrap items-center gap-2">
                <Chip>
                  <span
                    className={cn('h-2 w-2 rounded-pill', insight.tone === 'up' ? 'bg-accent' : insight.tone === 'down' ? 'bg-smoke' : 'bg-primary')}
                    aria-hidden
                  />
                  {insight.chip}
                </Chip>
                <p className="min-w-0 flex-1 text-caption text-smoke">{insight.text}</p>
              </div>
            )}
          </Panel>
        </div>

        <div className="grid min-w-0 gap-4 md:grid-cols-2 xl:flex xl:flex-col">
          {/* Sales via Flaym */}
          <section className="flex flex-col gap-3.5 bg-flame-gradient p-[22px] font-brand text-flare" aria-labelledby="sales-title">
            <div className="flex items-center">
              <h2 id="sales-title" className="flex-1 text-body-sm font-medium">
                Sales via Flaym
              </h2>
              <ArrowLink href="/brand/orders" label="Open orders" className="bg-flare/20 text-flare hover:text-flare" />
            </div>
            <p className="text-display font-medium tabular-nums tracking-[-0.76px]">{formatDKK(kpis.sales)}</p>
            <div className="grid grid-cols-2 gap-2.5">
              <div className="bg-flare/20 px-3.5 py-3">
                <p className="text-caption">Store cut</p>
                <p className="mt-0.5 text-body-lg font-semibold tabular-nums">{formatDKK(kpis.store_cut)}</p>
              </div>
              <div className="bg-flare/20 px-3.5 py-3">
                <p className="text-caption">Your payout</p>
                <p className="mt-0.5 text-body-lg font-semibold tabular-nums">{formatDKK(payout)}</p>
              </div>
            </div>
            <p className="text-caption">
              {periodText[0].toUpperCase() + periodText.slice(1)}
              {storeName || productName || size ? `, ${scope}` : ''}. Payout = sales minus the store cut.
            </p>
            {data.pending_orders > 0 && (
              <Link href="/brand/orders" className="self-start whitespace-pre bg-obsidian px-3 py-[7px] text-caption font-medium text-flare hover:bg-canvas-dark">
                {`⚑  ${plural(data.pending_orders, 'order')} to ship today`}
              </Link>
            )}
          </section>

          {/* From scan to purchase + top stores */}
          <Panel aria-labelledby="funnel-title" className="flex flex-col gap-[18px]">
            <PanelHeader
              title={<span id="funnel-title">From scan to purchase</span>}
              subtitle={`${periodText[0].toUpperCase() + periodText.slice(1)}, ${scope}`}
              action={<span className="text-caption font-medium text-accent-bright">Funnel</span>}
            />
            <div className="flex items-center gap-[18px]">
              <Donut scans={kpis.scans} saves={kpis.saves} buys={kpis.purchases} rate={overview.buy_rate} />
              <div className="flex min-w-0 flex-1 flex-col gap-2">
                <FunnelRow dot="bg-char" label="Scanned" value={kpis.scans} />
                <FunnelRow dot="bg-primary" label="Saved" value={kpis.saves} />
                <FunnelRow dot="bg-accent" label="Bought" value={kpis.purchases} />
              </div>
            </div>
            {size && <p className="text-caption text-smoke">Scans count every size: people scan before they pick one.</p>}

            <p className="pt-1 text-label uppercase text-smoke">Top stores</p>
            {data.by_store.length === 0 ? (
              <p className="text-caption text-smoke">No store scans or purchases {periodText}.</p>
            ) : (
              <ul className="flex flex-col gap-[18px]">
                {data.by_store.slice(0, 3).map((s) => (
                  <li key={s.id} className="flex items-center gap-2.5">
                    <Thumb />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-body-sm font-medium text-flare">{s.name}</p>
                      <p className="text-caption text-smoke">{plural(s.scans, 'scan')}</p>
                    </div>
                    <Chip className="tabular-nums">{count(s.buys)} sold</Chip>
                  </li>
                ))}
              </ul>
            )}
          </Panel>
        </div>
      </div>
    </div>
  );
}

function LegendDot({ className, label }: { className: string; label: string }) {
  return (
    <span className="flex items-center gap-1.5">
      <span className={cn('h-2 w-2 rounded-pill', className)} aria-hidden />
      {label}
    </span>
  );
}

type StandCounts = { total: number; done: number; moving: number; waiting: number };

function StandRow({
  icon: Icon,
  label,
  href,
  row,
  caption,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  href: string;
  row: StandCounts;
  caption: string;
}) {
  const parts = [
    { key: 'done', n: row.done, className: 'bg-primary text-on-primary', name: 'done' },
    { key: 'moving', n: row.moving, className: 'bg-flaym-progress text-flare', name: 'moving' },
    { key: 'waiting', n: row.waiting, className: 'bg-surface-dark text-ash', name: 'waiting' },
  ].filter((p) => p.n > 0);
  return (
    <Link href={href} className="group flex flex-wrap items-center gap-x-4 gap-y-2 py-3 sm:flex-nowrap">
      <span className="flex h-9 w-9 shrink-0 items-center justify-center bg-surface-dark text-ash">
        <Icon className="h-[18px] w-[18px]" />
      </span>
      <span className="w-[72px] shrink-0 text-body font-medium text-flare sm:w-[110px]">{label}</span>
      <span className="flex w-[110px] shrink-0 flex-col sm:w-[140px]">
        <span className="text-heading-lg font-medium tabular-nums text-flare">{count(row.total)}</span>
        <span className="text-caption text-smoke">{caption}</span>
      </span>
      <span
        className="order-last flex h-9 min-w-0 basis-full gap-1.5 sm:order-none sm:basis-auto sm:flex-1"
        aria-label={`${row.done} done, ${row.moving} moving, ${row.waiting} waiting`}
      >
        {parts.length === 0 ? (
          <span className="flex flex-1 items-center bg-surface-dark px-3.5 text-caption text-smoke">None yet</span>
        ) : (
          parts.map((p) => (
            <span
              key={p.key}
              title={`${p.n} ${p.name}`}
              className={cn('flex min-w-[50px] items-center justify-end px-3.5 text-caption font-medium tabular-nums', p.className)}
              style={{ flexGrow: p.n, flexBasis: 0 }}
            >
              {count(p.n)}
            </span>
          ))
        )}
      </span>
      <span className="ml-auto flex h-9 w-9 shrink-0 items-center justify-center rounded-pill border border-flare/10 text-body text-ash transition-colors group-hover:border-flare/30 group-hover:text-flare sm:ml-0">
        ↗
      </span>
    </Link>
  );
}

function FunnelRow({ dot, label, value }: { dot: string; label: string; value: number }) {
  return (
    <div className="flex items-center gap-2 bg-surface-dark/60 px-3 py-[9px]">
      <span className={cn('h-2 w-2 shrink-0 rounded-pill', dot)} aria-hidden />
      <span className="flex-1 text-caption text-ash">{label}</span>
      <span className="text-caption font-medium tabular-nums text-flare">{count(value)}</span>
    </div>
  );
}

/** Scans as the full ring; the light arc is the saved share, the orange arc the bought share. */
function Donut({ scans, saves, buys, rate }: { scans: number; saves: number; buys: number; rate: number | null }) {
  const r = 60;
  const c = 2 * Math.PI * r;
  const savedShare = scans > 0 ? Math.min(1, saves / scans) : 0;
  const boughtShare = scans > 0 ? Math.min(1, buys / scans) : 0;
  return (
    <div className="relative h-[140px] w-[140px] shrink-0">
      <svg viewBox="0 0 140 140" className="h-full w-full -rotate-90" aria-hidden>
        <circle cx="70" cy="70" r={r} fill="none" strokeWidth="14" className="stroke-surface-dark" />
        {savedShare > 0 && (
          <circle cx="70" cy="70" r={r} fill="none" strokeWidth="14" className="stroke-primary" strokeDasharray={`${savedShare * c} ${c}`} />
        )}
        {boughtShare > 0 && (
          <circle
            cx="70"
            cy="70"
            r={r}
            fill="none"
            strokeWidth="14"
            className="stroke-accent"
            strokeDasharray={`${Math.max(2, boughtShare * c)} ${c}`}
            strokeDashoffset={-savedShare * c}
          />
        )}
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-heading-lg font-medium tabular-nums text-flare">{rate === null ? '–' : `${rate}%`}</span>
        <span className="text-caption text-smoke">buy rate</span>
      </div>
    </div>
  );
}
