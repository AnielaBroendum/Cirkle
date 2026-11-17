'use client';

import { useEffect, useState } from 'react';
import { Printer } from 'lucide-react';
import { useAuth } from '@/components/providers/auth-provider';
import { createClient } from '@/lib/supabase';
import { formatDKK } from '@/lib/utils';
import { PAYOUT_DAY_OF_MONTH, PAYOUT_STATUS_LABEL } from '@/lib/payouts';
import type { Database } from '@/lib/database.types';
import {
  ArrowLink,
  Button,
  KPISkeleton,
  PageHeader,
  Panel,
  PanelHeader,
  Segmented,
  Skeleton,
  StatusPill,
  Thumb,
  cn,
} from '@/components/ds';

/*
 * Retail dashboard, Portals v2 (Figma "Retail Portal v2 / 02 Dashboard", 359:204).
 * Numbers: get_retailer_overview (023) for the tiles, Earned this month, Earnings per month,
 * Latest credited and the tags never printed; get_retailer_most_scanned (013) for Most scanned.
 * Months are calendar months in Copenhagen; % change compares this month so far with last month.
 * "+ Add products" is left out (MISSING): stores don't add products, brands place them.
 */

type Overview = NonNullable<Database['public']['Functions']['get_retailer_overview']['Returns']>;
type MostScanned = Database['public']['Functions']['get_retailer_most_scanned']['Returns'][number];

type Bucket = 'week' | 'month' | 'year';
const LATEST_ROWS = 5;
const MOST_SCANNED_ROWS = 3;

const count = (n: number) => n.toLocaleString('en-GB');
/** Whole kroner, e.g. "4.180 kr". */
const kr = (ore: number) => formatDKK(Math.round(ore / 100) * 100);
const shortDate = (iso: string) =>
  new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', timeZone: 'Europe/Copenhagen' });

/** Short amount for chart labels: 4.180 kr → "4.2k", 640 kr → "640". */
function compactKr(ore: number) {
  const k = ore / 100;
  if (k >= 1000) return `${(k / 1000).toLocaleString('en-GB', { maximumFractionDigits: 1 })}k`;
  return Math.round(k).toLocaleString('en-GB');
}

function greeting(now: Date) {
  const h = Number(new Intl.DateTimeFormat('en-GB', { hour: 'numeric', hourCycle: 'h23', timeZone: 'Europe/Copenhagen' }).format(now));
  return h < 5 ? 'Good evening' : h < 12 ? 'Good morning' : h < 18 ? 'Good afternoon' : 'Good evening';
}

function change(now: number, prev: number): string | null {
  if (prev === 0) return null;
  const pct = Math.round(((now - prev) / prev) * 100);
  return `${pct > 0 ? '+' : ''}${pct}%`;
}

function bucketLabel(bucket: Bucket, start: string) {
  const d = new Date(`${start}T12:00:00`);
  if (bucket === 'year') return String(d.getFullYear());
  if (bucket === 'month') return d.toLocaleDateString('en-GB', { month: 'short' });
  return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
}

function payoutNote(p: Overview['latest'][number], nextPayout: string) {
  if (p.payout_status === 'paid_out' && p.paid_out_at) return `Paid out ${shortDate(p.paid_out_at)}`;
  if (p.payout_status === 'ready') return `Payout ${shortDate(nextPayout)}`;
  if (p.return_period_ends_at) return `Return period ends ${shortDate(p.return_period_ends_at)}`;
  return 'Not delivered yet';
}

export default function RetailerDashboardPage() {
  const { user } = useAuth();
  const [storeName, setStoreName] = useState('');
  const [data, setData] = useState<Overview | null>(null);
  const [mostScanned, setMostScanned] = useState<MostScanned[]>([]);
  const [loading, setLoading] = useState(true);
  const [bucket, setBucket] = useState<Bucket>('month');
  const [showAll, setShowAll] = useState(false);

  useEffect(() => {
    if (!user) return;
    const supabase = createClient();
    let alive = true;
    (async () => {
      const now = new Date();
      const monthStart = new Date(
        new Intl.DateTimeFormat('en-CA', { year: 'numeric', month: '2-digit', timeZone: 'Europe/Copenhagen' }).format(now) + '-01T00:00:00'
      );
      const [rp, overview, most] = await Promise.all([
        supabase.from('retailer_profiles').select('name').eq('user_id', user.id).maybeSingle(),
        supabase.rpc('get_retailer_overview', { p_payout_day: PAYOUT_DAY_OF_MONTH }),
        supabase.rpc('get_retailer_most_scanned', {
          p_start: monthStart.toISOString(),
          p_end: now.toISOString(),
          p_limit: MOST_SCANNED_ROWS,
        }),
      ]);
      if (!alive) return;
      setStoreName((rp.data as { name: string } | null)?.name ?? '');
      setData((overview.data as Overview | null) ?? null);
      setMostScanned((most.data ?? []) as MostScanned[]);
      setLoading(false);
    })();
    return () => {
      alive = false;
    };
  }, [user]);

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="space-y-2">
          <Skeleton className="h-4 w-40" />
          <Skeleton className="h-10 w-80 max-w-full" />
        </div>
        <KPISkeleton />
        <Skeleton className="h-[420px]" />
      </div>
    );
  }

  if (!data) {
    return <PageHeader title="Dashboard" subtitle="Your store profile could not be loaded." />;
  }

  const missing = data.missing_tags;
  const earnings = bucket === 'week' ? data.earnings_week : bucket === 'year' ? data.earnings_year : data.earnings_month;
  const maxEarned = Math.max(...earnings.map((e) => e.amount), 1);
  const latest = showAll ? data.latest : data.latest.slice(0, LATEST_ROWS);
  const maxScans = Math.max(...mostScanned.map((m) => m.scans), 1);

  function printMissing() {
    if (missing.length) window.open(`/print/tags?portal=retail&ids=${missing.join(',')}`, '_blank');
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title={`${greeting(new Date())}${storeName ? `, ${storeName}` : ''}`}
        subtitle={`${count(data.scans.month)} ${data.scans.month === 1 ? 'scan' : 'scans'} in your store this month and ${count(
          data.purchases.month
        )} ${data.purchases.month === 1 ? 'purchase' : 'purchases'} credited to you.`}
        actions={
          <Button
            variant="secondary"
            onClick={printMissing}
            disabled={missing.length === 0}
            title={missing.length === 0 ? 'Every tag in your store has been printed' : undefined}
            className="h-[43px] border-line-dark-subtle bg-obsidian text-flare hover:border-flare/30"
          >
            <Printer className="h-4 w-4" /> Print missing tags{missing.length > 0 ? ` (${missing.length})` : ''}
          </Button>
        }
      />

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_370px]">
        {/* Left: tiles + earnings */}
        <div className="flex min-w-0 flex-col gap-4">
          <div className="grid gap-4 sm:grid-cols-3">
            <TrendTile label="Scans in store" stat={data.scans} />
            <TrendTile label="Saves" stat={data.saves} />
            <TrendTile label="Purchases credited" stat={data.purchases} />
          </div>

          <Panel className="flex flex-1 flex-col gap-5" aria-labelledby="earnings-title">
            <PanelHeader
              title={<span id="earnings-title">Earnings per {bucket}</span>}
              subtitle="Your cut of every sale your store sparked"
              action={
                <Segmented
                  label="Earnings range"
                  value={bucket}
                  onValueChange={(v) => setBucket(v as Bucket)}
                  items={[
                    { value: 'week', label: 'Week' },
                    { value: 'month', label: 'Month' },
                    { value: 'year', label: 'Year' },
                  ]}
                />
              }
            />
            <div className="flex min-h-[240px] flex-1 items-end gap-2 sm:gap-3" role="img" aria-label={`Earnings per ${bucket}`}>
              {earnings.map((e, i) => {
                const last = i === earnings.length - 1;
                // Bars use up to 85% of the height so the label above the tallest one fits.
                const h = e.amount > 0 ? Math.max(2, (e.amount / maxEarned) * 85) : 0;
                return (
                  <div key={e.start} className="flex h-full min-w-0 flex-1 flex-col items-center gap-2">
                    <div className="relative w-full flex-1">
                      {e.amount > 0 && (
                        <span
                          className="absolute inset-x-0 text-center text-caption font-medium tabular-nums text-flare"
                          style={{ bottom: `calc(${h}% + 6px)` }}
                        >
                          {compactKr(e.amount)}
                        </span>
                      )}
                      <div
                        className={cn('absolute inset-x-0 bottom-0', last ? 'bg-flame-gradient' : 'bg-surface-dark')}
                        style={{ height: e.amount > 0 ? `${h}%` : 1 }}
                      />
                    </div>
                    <span className="truncate text-caption text-smoke">{bucketLabel(bucket, e.start)}</span>
                  </div>
                );
              })}
            </div>
          </Panel>
        </div>

        {/* Right: earned this month, latest credited, most scanned */}
        <div className="grid min-w-0 items-start gap-4 md:grid-cols-2 xl:flex xl:flex-col">
          <section className="flex flex-col gap-3.5 bg-flame-gradient p-[22px] font-brand text-flare" aria-labelledby="earned-title">
            <div className="flex items-center">
              <h2 id="earned-title" className="flex-1 text-body-sm font-medium">
                Earned this month
              </h2>
              <ArrowLink href="/retailer/profile" label="Open store profile" className="bg-flare/20 text-flare hover:text-flare" />
            </div>
            <p className="text-display font-medium tabular-nums tracking-[-0.76px]">{kr(data.earned_month)}</p>
            <div className="grid grid-cols-2 gap-2.5">
              <div className="bg-flare/20 px-3.5 py-3">
                <p className="text-caption">Ready to pay out</p>
                <p className="mt-0.5 text-body-lg font-semibold tabular-nums">{kr(data.earned_ready)}</p>
              </div>
              <div className="bg-flare/20 px-3.5 py-3">
                <p className="text-caption">In return period</p>
                <p className="mt-0.5 text-body-lg font-semibold tabular-nums">{kr(data.earned_return_period)}</p>
              </div>
            </div>
            <p className="self-start whitespace-pre bg-obsidian px-3 py-[7px] text-caption font-medium text-flare">
              {`●  ${data.last_paid_out_at ? `Paid out ${shortDate(data.last_paid_out_at)} · ` : ''}next ${shortDate(data.next_payout)}`}
            </p>
          </section>

          <Panel className="flex flex-col gap-4" aria-labelledby="latest-title">
            <PanelHeader
              title={<span id="latest-title">Latest credited</span>}
              subtitle="Purchases your store sparked"
              action={
                data.latest.length > LATEST_ROWS && (
                  <button
                    type="button"
                    onClick={() => setShowAll((v) => !v)}
                    className="text-caption font-medium text-accent-bright hover:text-flare"
                  >
                    {showAll ? 'Less' : 'All'}
                  </button>
                )
              }
            />
            {latest.length === 0 ? (
              <p className="text-caption text-smoke">When someone buys after scanning a product in your store, your cut shows up here.</p>
            ) : (
              <ul className="flex flex-col gap-3">
                {latest.map((p) => (
                  <li key={p.id} className="flex items-center gap-3">
                    <Thumb src={p.image} size={32} />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-body-sm font-medium text-flare">{p.product_name ?? 'Unknown product'}</p>
                      <p className="truncate text-caption text-smoke" title={payoutNote(p, data.next_payout)}>
                        {p.brand_name} · {kr(p.amount)}
                      </p>
                    </div>
                    <StatusPill status={p.payout_status} label={PAYOUT_STATUS_LABEL[p.payout_status]} />
                  </li>
                ))}
              </ul>
            )}

            <p className="pt-1 text-label uppercase text-smoke">Most scanned in your store</p>
            {mostScanned.length === 0 ? (
              <p className="text-caption text-smoke">No scans this month yet.</p>
            ) : (
              <ul className="flex flex-col gap-3.5">
                {mostScanned.map((m) => (
                  <li key={m.product_id}>
                    <div className="flex items-baseline gap-3">
                      <p className="min-w-0 flex-1 truncate text-caption text-ash">
                        {m.product_name} · {m.brand_name}
                      </p>
                      <span className="whitespace-nowrap text-caption font-medium tabular-nums text-flare">
                        {count(m.scans)} {m.scans === 1 ? 'scan' : 'scans'}
                      </span>
                    </div>
                    <div className="mt-1.5 h-1.5 bg-surface-dark">
                      <div className="h-1.5 bg-flaym-progress" style={{ width: `${Math.max(3, (m.scans / maxScans) * 100)}%` }} />
                    </div>
                  </li>
                ))}
              </ul>
            )}
            <p className="text-caption text-smoke">This month</p>
          </Panel>
        </div>
      </div>
    </div>
  );
}

/** Tile with this month's count, % vs last month and 7 weekly bars (this week in flame). */
function TrendTile({ label, stat }: { label: string; stat: { month: number; prev_month: number; weeks: number[] } }) {
  const pct = change(stat.month, stat.prev_month);
  const max = Math.max(...stat.weeks, 1);
  const down = pct?.startsWith('-');
  return (
    <div className="flex min-w-0 flex-col gap-3 border border-line-dark-subtle bg-obsidian p-5 font-brand">
      <div className="flex items-center justify-between gap-2">
        <p className="truncate text-caption text-smoke">{label}</p>
        {pct && (
          <span
            className={cn('px-1.5 py-0.5 text-caption font-medium', down ? 'bg-accent-tint text-accent-bright' : 'bg-success-subtle text-success')}
            title="This month so far vs. last month"
          >
            {pct}
          </span>
        )}
      </div>
      <p className="text-heading-xl font-medium tabular-nums text-flare">{count(stat.month)}</p>
      <div className="flex h-9 items-end gap-1.5" aria-label="Last 7 weeks" role="img">
        {stat.weeks.map((w, i) => (
          <div
            key={i}
            className={cn('flex-1', i === stat.weeks.length - 1 ? 'bg-accent' : 'bg-surface-dark')}
            style={{ height: `${Math.max(6, (w / max) * 100)}%` }}
            title={`${w}`}
          />
        ))}
      </div>
    </div>
  );
}
