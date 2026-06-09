'use client';

import { useEffect, useState } from 'react';
import { useAuth } from '@/components/providers/auth-provider';
import { createClient } from '@/lib/supabase';
import { formatDKK, formatCommission } from '@/lib/utils';
import {
  ScanLine,
  ShoppingBag,
  TrendingUp,
  QrCode,
  Clock,
  Handshake,
  Coins,
  Wallet,
} from 'lucide-react';
import { KPISkeleton, ListSkeleton } from '@/components/ui/skeleton';
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
      <div className="space-y-8">
        <div>
          <div className="animate-pulse bg-gray-200 rounded h-8 w-48" />
          <div className="animate-pulse bg-gray-100 rounded h-4 w-32 mt-2" />
        </div>
        <KPISkeleton />
        <div className="grid lg:grid-cols-2 gap-6">
          <ListSkeleton rows={4} />
          <ListSkeleton rows={3} />
        </div>
      </div>
    );
  }

  const KPI_CARDS = [
    {
      label: 'Scans this week',
      value: kpis.scansThisWeek,
      icon: ScanLine,
      color: 'text-blue-600 bg-blue-50',
    },
    {
      label: 'Attributed sales',
      value: kpis.salesAttributed,
      icon: ShoppingBag,
      color: 'text-amber-600 bg-amber-50',
    },
    {
      label: 'Commission this month',
      value: formatDKK(kpis.commissionThisMonth),
      icon: TrendingUp,
      color: 'text-green-600 bg-green-50',
    },
    {
      label: 'Active samples',
      value: kpis.activeSamples,
      icon: QrCode,
      color: 'text-purple-600 bg-purple-50',
    },
  ];

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">
          Welcome, {storeName}
        </h1>
        <p className="text-gray-500 mt-1">Here is your overview</p>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {KPI_CARDS.map((card) => (
          <div key={card.label} className="bg-white rounded-xl border border-gray-200 p-4">
            <div className="flex items-center justify-between mb-3">
              <div className={`p-2 rounded-lg ${card.color}`}>
                <card.icon className="h-5 w-5" />
              </div>
            </div>
            <p className="text-2xl font-bold text-gray-900">{card.value}</p>
            <p className="text-sm text-gray-500 mt-0.5">{card.label}</p>
          </div>
        ))}
      </div>

      <div className="grid lg:grid-cols-2 gap-6">
        {/* Recent scans feed */}
        <div>
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Recent scans</h2>
          {recentScans.length === 0 ? (
            <div className="bg-white rounded-xl border border-gray-200 py-8 text-center">
              <Clock className="h-8 w-8 text-gray-300 mx-auto" />
              <p className="mt-2 text-sm text-gray-500">No scans yet</p>
              <p className="text-xs text-gray-400 mt-1">Place samples in visible spots to attract scans</p>
            </div>
          ) : (
            <div className="bg-white rounded-xl border border-gray-200 divide-y divide-gray-100">
              {recentScans.map((scan) => (
                <div key={scan.id} className="flex items-center gap-3 px-4 py-3">
                  <div className="p-1.5 rounded-lg bg-blue-50 text-blue-600">
                    <ScanLine className="h-4 w-4" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-gray-900 truncate">{scan.product_name}</p>
                  </div>
                  <span className="text-xs text-gray-400 whitespace-nowrap">
                    {timeAgo(scan.scanned_at)}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Active partnerships */}
        <div>
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Active partnerships</h2>
          {partnerships.length === 0 ? (
            <div className="bg-white rounded-xl border border-gray-200 py-8 text-center">
              <Handshake className="h-8 w-8 text-gray-300 mx-auto" />
              <p className="mt-2 text-sm text-gray-500">No active partnerships</p>
              <p className="text-xs text-gray-400 mt-1">Accept brand invitations to get started</p>
            </div>
          ) : (
            <div className="bg-white rounded-xl border border-gray-200 divide-y divide-gray-100">
              {partnerships.map((p) => (
                <div key={p.id} className="flex items-center gap-3 px-4 py-3">
                  {p.brand_logo ? (
                    <div className="relative w-8 h-8 rounded-lg overflow-hidden border border-gray-200 flex-shrink-0">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={p.brand_logo}
                        alt=""
                        className="w-full h-full object-cover"
                      />
                    </div>
                  ) : (
                    <div className="w-8 h-8 rounded-lg bg-cirkle-50 flex items-center justify-center flex-shrink-0">
                      <span className="text-xs font-bold text-cirkle-600">
                        {p.brand_name.charAt(0)}
                      </span>
                    </div>
                  )}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-900 truncate">
                      {p.brand_name}
                    </p>
                    <p className="text-xs text-gray-400">
                      {formatCommission(p.commission_direct)} commission
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
      {/* Deposit capital */}
      {depositTotal > 0 && (
        <div>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-gray-900">Deposit capital</h2>
            <span className="text-sm font-bold text-amber-700 bg-amber-50 px-3 py-1 rounded-full">
              {formatDKK(depositTotal)} held
            </span>
          </div>
          <div className="bg-white rounded-xl border border-gray-200 divide-y divide-gray-100">
            {depositByBrand.map((b) => (
              <div key={b.brand_name} className="flex items-center gap-3 px-4 py-3">
                <div className="p-1.5 rounded-lg bg-amber-50 text-amber-600">
                  <Wallet className="h-4 w-4" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-gray-900">{b.brand_name}</p>
                </div>
                <span className="text-sm font-bold text-gray-900">{formatDKK(b.total)}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Earned commission details */}
      {commissionDetails.length > 0 && (
        <div>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-gray-900">Commission earned this month</h2>
            <span className="text-sm font-bold text-green-700 bg-green-50 px-3 py-1 rounded-full">
              {formatDKK(kpis.commissionThisMonth)} total
            </span>
          </div>
          <div className="bg-white rounded-xl border border-gray-200 divide-y divide-gray-100">
            {commissionDetails.map((c) => {
              const typeLabel = c.type === 'direct' ? 'Direct' : c.type === 'deferred' ? 'Deferred' : 'Tier 2';
              const typeColor = c.type === 'direct' ? 'bg-green-100 text-green-700' : c.type === 'deferred' ? 'bg-blue-100 text-blue-700' : 'bg-purple-100 text-purple-700';
              return (
                <div key={c.id} className="flex items-center gap-3 px-4 py-3">
                  <div className="p-1.5 rounded-lg bg-green-50 text-green-600">
                    <Coins className="h-4 w-4" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-gray-900 truncate">{c.product_name}</p>
                    <div className="flex items-center gap-2 mt-0.5">
                      <span className={`text-xs font-medium px-1.5 py-0.5 rounded ${typeColor}`}>{typeLabel}</span>
                      <span className="text-xs text-gray-400">
                        {new Date(c.created_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}
                      </span>
                    </div>
                  </div>
                  <span className="text-sm font-bold text-gray-900">{formatDKK(c.amount_dkk)}</span>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
