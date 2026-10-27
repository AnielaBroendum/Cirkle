'use client';

import { useEffect, useState } from 'react';
import { useAuth } from '@/components/providers/auth-provider';
import { createClient } from '@/lib/supabase';
import { formatDKK, formatCommission } from '@/lib/utils';
import { nextPayoutDate, PAYOUT_STATUSES, PAYOUT_STATUS_LABEL, type PayoutStatus } from '@/lib/payouts';
import { ScanLine, Handshake, Coins, Wallet, BarChart3 } from 'lucide-react';
import {
  Avatar,
  Badge,
  Card,
  EmptyState,
  KPISkeleton,
  ListSkeleton,
  Skeleton,
  StatTile,
  StatusPill,
  Tabs,
  TBody,
  TD,
  TH,
  THead,
  TR,
} from '@/components/ds';
import type { Database } from '@/lib/database.types';

type Sample = Database['public']['Tables']['samples']['Row'];
type Scan = Database['public']['Tables']['scans']['Row'];
type Product = Database['public']['Tables']['products']['Row'];
type Partnership = Database['public']['Tables']['brand_retailer_partnerships']['Row'];
type BrandProfile = Database['public']['Tables']['brand_profiles']['Row'];

type KPIs = {
  scansThisWeek: number;
  salesAttributed: number;
  commissionThisMonth: number;
  activeSamples: number;
};

type ScanFeedItem = {
  id: string;
  product_name: string;
  scanned_at: string;
};

type PartnershipItem = {
  id: string;
  brand_name: string;
  brand_logo: string | null;
  commission_direct: number;
  status: string;
};

type Payout = Database['public']['Functions']['get_retailer_payouts']['Returns'][number];
type MostScanned = Database['public']['Functions']['get_retailer_most_scanned']['Returns'][number];

/** How many credited purchases the list shows; the totals cover all of them. */
const LATEST_PAYOUTS = 8;

type Period = 'week' | 'month' | 'year';

const PERIOD_LABEL: Record<Period, string> = { week: 'this week', month: 'this month', year: 'this year' };

// Week = last 7 days, Month = this calendar month, Year = this calendar year.
function periodStart(period: Period, now: Date): string {
  if (period === 'week') return new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString();
  if (period === 'month') return new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
  return new Date(now.getFullYear(), 0, 1).toISOString();
}

export default function RetailerDashboardPage() {
  const { user } = useAuth();
  const [kpis, setKpis] = useState<KPIs>({
    scansThisWeek: 0,
    salesAttributed: 0,
    commissionThisMonth: 0,
    activeSamples: 0,
  });
  const [recentScans, setRecentScans] = useState<ScanFeedItem[]>([]);
  const [partnerships, setPartnerships] = useState<PartnershipItem[]>([]);
  const [payouts, setPayouts] = useState<Payout[]>([]);
  const [mostScanned, setMostScanned] = useState<MostScanned[]>([]);
  const [depositTotal, setDepositTotal] = useState(0);
  const [depositByBrand, setDepositByBrand] = useState<{ brand_name: string; total: number }[]>([]);
  const [loading, setLoading] = useState(true);
  const [period, setPeriod] = useState<Period>('month');
  const [refreshing, setRefreshing] = useState(false);
  const [storeName, setStoreName] = useState('');

  useEffect(() => {
    if (!user) return;
    const supabase = createClient();
    // Ignore responses from a previous period if the toggle changes mid-load.
    let cancelled = false;
    setRefreshing(true);

    supabase
      .from('retailer_profiles')
      .select('id, name')
      .eq('user_id', user.id)
      .single()
      .then(async ({ data: rp }: { data: { id: string; name: string } | null }) => {
        if (cancelled) return;
        if (!rp) {
          setLoading(false);
          setRefreshing(false);
          return;
        }

        const retailer = rp as { id: string; name: string };
        setStoreName(retailer.name);
        const retailerId = retailer.id;

        const now = new Date();
        const since = periodStart(period, now);

        const [
          samplesRes,
          scansWeekRes,
          recentScansRes,
          payoutsRes,
          mostScannedRes,
          partnershipsRes,
        ] = await Promise.all([
          // Active samples count
          supabase
            .from('samples')
            .select('id', { count: 'exact', head: true })
            .eq('retailer_id', retailerId)
            .eq('status', 'active'),
          // Scans in the selected period, from the same events as Most scanned
          supabase
            .from('events')
            .select('id', { count: 'exact', head: true })
            .eq('retailer_id', retailerId)
            .eq('type', 'scan')
            .gte('occurred_at', since),
          // Recent scans for feed
          supabase
            .from('scans')
            .select('id, product_id, scanned_at')
            .eq('source_retailer_id', retailerId)
            .order('scanned_at', { ascending: false })
            .limit(10),
          // Every credited purchase with its payout status (returns and cancellations left out)
          supabase.rpc('get_retailer_payouts'),
          // Scans and purchases per product in the selected period
          supabase.rpc('get_retailer_most_scanned', { p_start: since, p_end: now.toISOString() }),
          // Active partnerships
          supabase
            .from('brand_retailer_partnerships')
            .select('id, brand_id, commission_direct, status')
            .eq('retailer_id', retailerId)
            .eq('status', 'active'),
        ]);

        if (cancelled) return;

        const payoutRows = (payoutsRes.data ?? []) as Payout[];
        const credited = payoutRows.filter((p) => p.ordered_at >= since);
        setPayouts(payoutRows);
        setMostScanned((mostScannedRes.data ?? []) as MostScanned[]);

        setKpis({
          scansThisWeek: scansWeekRes.count ?? 0,
          salesAttributed: credited.length,
          commissionThisMonth: credited.reduce((sum, p) => sum + p.amount_dkk, 0),
          activeSamples: samplesRes.count ?? 0,
        });

        // Enrich recent scans with product names
        const scansData = (recentScansRes.data ?? []) as Pick<Scan, 'id' | 'product_id' | 'scanned_at'>[];
        if (scansData.length > 0) {
          const productIds = Array.from(new Set(scansData.map((s) => s.product_id)));
          const { data: products } = await supabase
            .from('products')
            .select('id, name')
            .in('id', productIds);

          const productMap = new Map(
            ((products ?? []) as Pick<Product, 'id' | 'name'>[]).map((p) => [p.id, p.name])
          );

          setRecentScans(
            scansData.map((s) => ({
              id: s.id,
              product_name: productMap.get(s.product_id) ?? 'Unknown product',
              scanned_at: s.scanned_at,
            }))
          );
        }

        // Enrich partnerships with brand names
        const partnershipData = (partnershipsRes.data ?? []) as Pick<
          Partnership,
          'id' | 'brand_id' | 'commission_direct' | 'status'
        >[];
        if (partnershipData.length > 0) {
          const brandIds = partnershipData.map((p) => p.brand_id);
          const { data: brands } = await supabase
            .from('brand_profiles')
            .select('id, name, logo_url')
            .in('id', brandIds);

          const brandMap = new Map(
            ((brands ?? []) as Pick<BrandProfile, 'id' | 'name' | 'logo_url'>[]).map((b) => [
              b.id,
              b,
            ])
          );

          setPartnerships(
            partnershipData.map((p) => {
              const brand = brandMap.get(p.brand_id);
              return {
                id: p.id,
                brand_name: brand?.name ?? 'Unknown brand',
                brand_logo: brand?.logo_url ?? null,
                commission_direct: p.commission_direct,
                status: p.status,
              };
            })
          );
        }

        // Deposit data
        const { data: heldSamples } = await supabase
          .from('samples')
          .select('deposit_amount_dkk, brand_id')
          .eq('retailer_id', retailerId)
          .eq('deposit_status', 'held');

        if (heldSamples?.length) {
          const total = heldSamples.reduce((sum: number, s: { deposit_amount_dkk: number | null }) => sum + (s.deposit_amount_dkk ?? 0), 0);
          setDepositTotal(total);

          const byBrand = new Map<string, number>();
          for (const s of heldSamples as { deposit_amount_dkk: number | null; brand_id: string }[]) {
            byBrand.set(s.brand_id, (byBrand.get(s.brand_id) ?? 0) + (s.deposit_amount_dkk ?? 0));
          }

          const brandIdsForDeposits = Array.from(byBrand.keys());
          const { data: depositBrands } = await supabase.from('brand_profiles').select('id, name').in('id', brandIdsForDeposits);
          const depositBrandMap = new Map((depositBrands ?? []).map((b: { id: string; name: string }) => [b.id, b.name]));

          setDepositByBrand(
            Array.from(byBrand.entries()).map(([bid, t]) => ({
              brand_name: (depositBrandMap.get(bid) as string | undefined) ?? 'Unknown',
              total: t,
            })).sort((a, b) => b.total - a.total)
          );
        }

        if (cancelled) return;
        setLoading(false);
        setRefreshing(false);
      });

    return () => {
      cancelled = true;
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

  if (loading) {
    return (
      <div className="space-y-7">
        <div className="space-y-2">
          <Skeleton className="h-10 w-56" />
          <Skeleton className="h-4 w-80" />
        </div>
        <KPISkeleton />
        <div className="grid gap-4 lg:grid-cols-[3fr_2fr]">
          <ListSkeleton rows={4} />
          <ListSkeleton rows={4} />
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-7">
      {/* Header (Figma 02) */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="font-brand text-heading-xl uppercase text-primary">Dashboard</h1>
          <p className="mt-1 text-body text-slate">
            Activity and earnings from products in {storeName || 'your store'}
          </p>
        </div>
        <Tabs
          className="self-start sm:self-auto"
          value={period}
          onValueChange={(v) => setPeriod(v as Period)}
          items={[
            { value: 'week', label: 'Week' },
            { value: 'month', label: 'Month' },
            { value: 'year', label: 'Year' },
          ]}
        />
      </div>

      {/* KPI tiles: Figma's "Saves" slot shows Active samples, which the page already loads */}
      <div
        aria-busy={refreshing || undefined}
        className={`grid grid-cols-2 gap-3 transition-opacity lg:grid-cols-4 lg:gap-4 ${refreshing ? 'opacity-60' : ''}`}
      >
        <StatTile label="Scans in store" value={kpis.scansThisWeek} hint={capitalize(PERIOD_LABEL[period])} />
        <StatTile label="Active samples" value={kpis.activeSamples} hint="In your store now" />
        <StatTile label="Purchases credited" value={kpis.salesAttributed} hint={capitalize(PERIOD_LABEL[period])} />
        <StatTile
          tone="dark"
          label={`Earned ${PERIOD_LABEL[period]}`}
          value={<span className="text-accent">{formatDKK(kpis.commissionThisMonth)}</span>}
          hint={`Paid out ${shortDate(nextPayoutDate().toISOString())}`}
        />
      </div>

      <div className="grid items-start gap-4 lg:grid-cols-[3fr_2fr]">
        <div className="space-y-4">
          {/* Most scanned in your store (Figma 02) */}
          <Card
            padding="none"
            aria-busy={refreshing || undefined}
            className={`p-5 transition-opacity lg:p-6 ${refreshing ? 'opacity-60' : ''}`}
          >
            <SectionTitle title="Most scanned in your store" />
            <p className="-mt-2 mb-3 text-caption text-slate">See what catches people&apos;s eye on the rail</p>
            {mostScanned.length === 0 ? (
              <EmptyState
                className="border-none py-8"
                icon={<BarChart3 className="h-5 w-5" />}
                title={`No scans ${PERIOD_LABEL[period]}`}
                description="Products show up here once people scan their QR tags in your store."
              />
            ) : (
              <MostScannedTable rows={mostScanned} />
            )}
          </Card>

          {/* Recent scans */}
          <Card padding="none" className="p-5 lg:p-6">
            <SectionTitle title="Recent scans" />
            {recentScans.length === 0 ? (
              <EmptyState
                className="border-none py-8"
                icon={<ScanLine className="h-5 w-5" />}
                title="No scans yet"
                description="Place samples in visible spots to attract scans."
              />
            ) : (
              <ul className="divide-y divide-line">
                {recentScans.map((scan) => (
                  <li key={scan.id} className="flex items-center gap-3 py-3">
                    <span className="h-2 w-2 shrink-0 border-[1.5px] border-accent" aria-hidden />
                    <p className="min-w-0 flex-1 truncate text-body-sm text-primary">{scan.product_name}</p>
                    <span className="whitespace-nowrap text-caption text-slate">{timeAgo(scan.scanned_at)}</span>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </div>

        {/* Latest credited purchases with payout status (Figma 02) */}
        <Card padding="none" className="p-5 lg:p-6">
          <SectionTitle title="Latest credited purchases" />
          {payouts.length === 0 ? (
            <EmptyState
              className="border-none py-8"
              icon={<Coins className="h-5 w-5" />}
              title="Nothing credited yet"
              description="When someone buys after scanning a product in your store, your cut shows up here."
            />
          ) : (
            <>
              <PayoutTotals payouts={payouts} />
              <div className="-mx-1 overflow-x-auto">
                <table className="w-full border-collapse font-brand text-body text-primary">
                  <THead>
                    <tr>
                      <TH className="px-3 py-2 text-label font-medium">Product</TH>
                      <TH className="px-3 py-2 text-label font-medium">Status</TH>
                      <TH className="px-3 py-2 text-right text-label font-medium">Your cut</TH>
                    </tr>
                  </THead>
                  <TBody>
                    {payouts.slice(0, LATEST_PAYOUTS).map((p) => (
                      <TR key={p.id}>
                        <TD className="px-3 text-body-sm">
                          <p className="truncate">{p.product_name ?? 'Unknown product'}</p>
                          <p className="mt-0.5 text-caption text-slate">{payoutDateNote(p)}</p>
                        </TD>
                        <TD className="px-3">
                          <StatusPill status={p.payout_status} label={PAYOUT_STATUS_LABEL[p.payout_status]} />
                        </TD>
                        <TD className="whitespace-nowrap px-3 text-right text-body-sm">{formatDKK(p.amount_dkk)}</TD>
                      </TR>
                    ))}
                  </TBody>
                </table>
              </div>
            </>
          )}
          <p className="mt-4 text-caption text-slate">
            Return period: your cut is paid out once the brand&apos;s return period has ended. Ready: paid out on the
            next payout date, {shortDate(nextPayoutDate().toISOString())}.
          </p>
        </Card>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        {/* Active partnerships */}
        <Card padding="none" className="p-5 lg:p-6">
          <SectionTitle title="Active partnerships" />
          {partnerships.length === 0 ? (
            <EmptyState
              className="border-none py-8"
              icon={<Handshake className="h-5 w-5" />}
              title="No active partnerships"
              description="Accept brand invitations to get started."
            />
          ) : (
            <ul className="divide-y divide-line">
              {partnerships.map((p) => (
                <li key={p.id} className="flex items-center gap-3 py-3">
                  <Avatar src={p.brand_logo} name={p.brand_name} size="sm" />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-body text-primary">{p.brand_name}</p>
                    <p className="text-caption text-slate">{formatCommission(p.commission_direct)} commission</p>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </Card>

        {/* Deposit capital */}
        {depositTotal > 0 && (
          <Card padding="none" className="p-5 lg:p-6">
            <SectionTitle title="Deposit capital" aside={`${formatDKK(depositTotal)} held`} />
            <ul className="divide-y divide-line">
              {depositByBrand.map((b) => (
                <li key={b.brand_name} className="flex items-center gap-3 py-3">
                  <Wallet className="h-4 w-4 shrink-0 text-slate" />
                  <p className="min-w-0 flex-1 truncate text-body text-primary">{b.brand_name}</p>
                  <span className="text-body font-medium text-primary">{formatDKK(b.total)}</span>
                </li>
              ))}
            </ul>
          </Card>
        )}
      </div>
    </div>
  );
}

function shortDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
}

function payoutDateNote(p: Payout): string {
  if (p.payout_status === 'paid_out' && p.paid_out_at) return `Paid out ${shortDate(p.paid_out_at)}`;
  if (p.payout_status === 'ready') return `Payout on ${shortDate(nextPayoutDate().toISOString())}`;
  if (p.return_period_ends_at) return `Return period ends ${shortDate(p.return_period_ends_at)}`;
  return `Bought ${shortDate(p.ordered_at)} · not delivered yet`;
}

// Totals per payout status over every credited purchase.
function PayoutTotals({ payouts }: { payouts: Payout[] }) {
  const totals = PAYOUT_STATUSES.map((status) => {
    const rows = payouts.filter((p) => p.payout_status === status);
    return { status, count: rows.length, amount: rows.reduce((sum, p) => sum + p.amount_dkk, 0) };
  });
  return (
    <dl className="mb-4 grid grid-cols-3 gap-px border border-line bg-line">
      {totals.map((t: { status: PayoutStatus; count: number; amount: number }) => (
        <div key={t.status} className="bg-surface px-3 py-2.5">
          <dt className="text-label uppercase text-slate">{PAYOUT_STATUS_LABEL[t.status]}</dt>
          <dd className="mt-1 text-body font-medium text-primary">{formatDKK(t.amount)}</dd>
          <dd className="text-caption text-slate">
            {t.count} {t.count === 1 ? 'purchase' : 'purchases'}
          </dd>
        </div>
      ))}
    </dl>
  );
}

// Figma "Most scanned": product, brand, a bar scaled to the top row, scans and buys.
function MostScannedTable({ rows }: { rows: MostScanned[] }) {
  const max = Math.max(...rows.map((r) => r.scans), 1);
  return (
    <div className="-mx-1 overflow-x-auto">
      <table className="w-full border-collapse font-brand text-body text-primary">
        <THead>
          <tr>
            <TH className="px-3 py-2 text-label font-medium">Product</TH>
            <TH className="hidden px-3 py-2 text-label font-medium sm:table-cell">Brand</TH>
            <TH className="px-3 py-2 text-right text-label font-medium" colSpan={2}>
              Scans
            </TH>
            <TH className="px-3 py-2 text-right text-label font-medium">Buys</TH>
          </tr>
        </THead>
        <TBody>
          {rows.map((r) => (
            <TR key={r.product_id}>
              <TD className="max-w-[10rem] px-3 text-body-sm">
                <p className="truncate">{r.product_name}</p>
                <p className="truncate text-caption text-slate sm:hidden">{r.brand_name}</p>
              </TD>
              <TD className="hidden whitespace-nowrap px-3 text-body-sm text-slate sm:table-cell">{r.brand_name}</TD>
              <TD className="w-full px-3" aria-hidden>
                <div className="h-1.5 bg-accent" style={{ width: `${(r.scans / max) * 100}%` }} />
              </TD>
              <TD className="whitespace-nowrap px-3 text-right text-body-sm">{r.scans}</TD>
              <TD className="whitespace-nowrap px-3 text-right text-body-sm">{r.buys}</TD>
            </TR>
          ))}
        </TBody>
      </table>
    </div>
  );
}

function capitalize(text: string) {
  return text.charAt(0).toUpperCase() + text.slice(1);
}

// Figma card title: 14px uppercase, with an optional muted note on the right.
function SectionTitle({ title, aside }: { title: string; aside?: string }) {
  return (
    <div className="mb-3 flex items-baseline justify-between gap-3">
      <h2 className="font-brand text-body uppercase tracking-[0.3px] text-primary">{title}</h2>
      {aside && <span className="whitespace-nowrap text-caption text-slate">{aside}</span>}
    </div>
  );
}
