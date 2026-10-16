'use client';

import { useEffect, useState } from 'react';
import { useAuth } from '@/components/providers/auth-provider';
import { createClient } from '@/lib/supabase';
import { formatDKK, formatCommission } from '@/lib/utils';
import { ScanLine, Handshake, Coins, Wallet } from 'lucide-react';
import {
  Avatar,
  Badge,
  Card,
  EmptyState,
  KPISkeleton,
  ListSkeleton,
  Skeleton,
  StatTile,
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
type Attribution = Database['public']['Tables']['attributions']['Row'];
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

type CommissionDetail = {
  id: string;
  product_name: string;
  type: string;
  amount_dkk: number;
  created_at: string;
};

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
  const [commissionDetails, setCommissionDetails] = useState<CommissionDetail[]>([]);
  const [depositTotal, setDepositTotal] = useState(0);
  const [depositByBrand, setDepositByBrand] = useState<{ brand_name: string; total: number }[]>([]);
  const [loading, setLoading] = useState(true);
  const [storeName, setStoreName] = useState('');

  useEffect(() => {
    if (!user) return;
    const supabase = createClient();

    supabase
      .from('retailer_profiles')
      .select('id, name')
      .eq('user_id', user.id)
      .single()
      .then(async ({ data: rp }: { data: { id: string; name: string } | null }) => {
        if (!rp) {
          setLoading(false);
          return;
        }

        const retailer = rp as { id: string; name: string };
        setStoreName(retailer.name);
        const retailerId = retailer.id;

        const now = new Date();
        const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString();
        const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();

        const [
          samplesRes,
          scansWeekRes,
          recentScansRes,
          attributionsRes,
          commissionRes,
          partnershipsRes,
        ] = await Promise.all([
          // Active samples count
          supabase
            .from('samples')
            .select('id', { count: 'exact', head: true })
            .eq('retailer_id', retailerId)
            .eq('status', 'active'),
          // Scans this week
          supabase
            .from('scans')
            .select('id', { count: 'exact', head: true })
            .eq('source_retailer_id', retailerId)
            .gte('scanned_at', weekAgo),
          // Recent scans for feed
          supabase
            .from('scans')
            .select('id, product_id, scanned_at')
            .eq('source_retailer_id', retailerId)
            .order('scanned_at', { ascending: false })
            .limit(10),
          // Total attributed sales
          supabase
            .from('attributions')
            .select('id', { count: 'exact', head: true })
            .eq('source_retailer_id', retailerId),
          // Commission this month
          supabase
            .from('attributions')
            .select('id, commission_amount_dkk, attribution_type, created_at, order_id')
            .eq('source_retailer_id', retailerId)
            .gte('created_at', monthStart)
            .order('created_at', { ascending: false }),
          // Active partnerships
          supabase
            .from('brand_retailer_partnerships')
            .select('id, brand_id, commission_direct, status')
            .eq('retailer_id', retailerId)
            .eq('status', 'active'),
        ]);

        // Calculate commission and build detail list
        type CommissionRow = { id: string; commission_amount_dkk: number | null; attribution_type: string; created_at: string; order_id: string };
        const commissionRows = (commissionRes.data ?? []) as CommissionRow[];
        const commissionTotal = commissionRows.reduce((sum, a) => sum + (a.commission_amount_dkk ?? 0), 0);

        if (commissionRows.length > 0) {
          const orderIds = Array.from(new Set(commissionRows.map((a) => a.order_id)));
          const { data: orderItemsData } = await supabase
            .from('order_items')
            .select('order_id, product_name')
            .in('order_id', orderIds);

          const orderProductMap = new Map(
            ((orderItemsData ?? []) as { order_id: string; product_name: string }[]).map((oi) => [oi.order_id, oi.product_name])
          );

          setCommissionDetails(
            commissionRows
              .filter((a) => a.commission_amount_dkk)
              .map((a) => ({
                id: a.id,
                product_name: orderProductMap.get(a.order_id) ?? 'Unknown product',
                type: a.attribution_type,
                amount_dkk: a.commission_amount_dkk!,
                created_at: a.created_at,
              }))
          );
        }

        setKpis({
          scansThisWeek: scansWeekRes.count ?? 0,
          salesAttributed: attributionsRes.count ?? 0,
          commissionThisMonth: commissionTotal,
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

        setLoading(false);
      });
  }, [user]);

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
      <div>
        <h1 className="font-brand text-heading-xl uppercase text-primary">Dashboard</h1>
        <p className="mt-1 text-body text-muted">
          Activity and earnings from products in {storeName || 'your store'}
        </p>
      </div>

      {/* KPI tiles: Figma's "Saves" slot shows Active samples, which the page already loads */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4 lg:gap-4">
        <StatTile label="Scans in store" value={kpis.scansThisWeek} hint="This week" />
        <StatTile label="Active samples" value={kpis.activeSamples} hint="In your store now" />
        <StatTile label="Purchases credited" value={kpis.salesAttributed} hint="All time" />
        <StatTile
          tone="dark"
          label="Earned this month"
          value={<span className="text-accent">{formatDKK(kpis.commissionThisMonth)}</span>}
          hint="Your commission"
        />
      </div>

      <div className="grid gap-4 lg:grid-cols-[3fr_2fr]">
        {/* Latest credited purchases */}
        <Card padding="none" className="p-5 lg:p-6">
          <SectionTitle
            title="Credited this month"
            aside={commissionDetails.length > 0 ? `${formatDKK(kpis.commissionThisMonth)} total` : undefined}
          />
          {commissionDetails.length === 0 ? (
            <EmptyState
              className="border-none py-8"
              icon={<Coins className="h-5 w-5" />}
              title="Nothing credited this month"
              description="When someone buys after scanning a product in your store, your cut shows up here."
            />
          ) : (
            <div className="-mx-1 overflow-x-auto">
              <table className="w-full border-collapse font-brand text-body text-primary">
                <THead>
                  <tr>
                    <TH className="px-3 py-2 text-label font-medium">Product</TH>
                    <TH className="px-3 py-2 text-label font-medium">Type</TH>
                    <TH className="px-3 py-2 text-right text-label font-medium">Your cut</TH>
                  </tr>
                </THead>
                <TBody>
                  {commissionDetails.map((c) => {
                    const typeLabel = c.type === 'direct' ? 'Direct' : c.type === 'deferred' ? 'Deferred' : 'Tier 2';
                    const typeTone = c.type === 'direct' ? 'accent' : c.type === 'deferred' ? 'neutral' : 'outline';
                    return (
                      <TR key={c.id}>
                        <TD className="px-3 text-[13px]">
                          <p className="truncate">{c.product_name}</p>
                          <p className="mt-0.5 text-caption text-muted">
                            {new Date(c.created_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}
                          </p>
                        </TD>
                        <TD className="px-3">
                          <Badge tone={typeTone}>{typeLabel}</Badge>
                        </TD>
                        <TD className="whitespace-nowrap px-3 text-right text-[13px]">{formatDKK(c.amount_dkk)}</TD>
                      </TR>
                    );
                  })}
                </TBody>
              </table>
            </div>
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
                  <p className="min-w-0 flex-1 truncate text-[13px] text-primary">{scan.product_name}</p>
                  <span className="whitespace-nowrap text-caption text-muted">{timeAgo(scan.scanned_at)}</span>
                </li>
              ))}
            </ul>
          )}
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
                    <p className="text-caption text-muted">{formatCommission(p.commission_direct)} commission</p>
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
                  <Wallet className="h-4 w-4 shrink-0 text-muted" />
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

// Figma card title: 14px uppercase, with an optional muted note on the right.
function SectionTitle({ title, aside }: { title: string; aside?: string }) {
  return (
    <div className="mb-3 flex items-baseline justify-between gap-3">
      <h2 className="font-brand text-body uppercase tracking-[0.3px] text-primary">{title}</h2>
      {aside && <span className="whitespace-nowrap text-caption text-muted">{aside}</span>}
    </div>
  );
}
