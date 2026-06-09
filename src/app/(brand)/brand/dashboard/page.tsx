'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useAuth } from '@/components/providers/auth-provider';
import { createClient } from '@/lib/supabase';
import { formatDKK, formatCommission } from '@/lib/utils';
import {
  ScanLine,
  ShoppingBag,
  TrendingUp,
  QrCode,
  ArrowRight,
  Clock,
  Coins,
  Wallet,
} from 'lucide-react';
import { KPISkeleton, ListSkeleton } from '@/components/ui/skeleton';
import type { Database } from '@/lib/database.types';

type Order = Database['public']['Tables']['orders']['Row'];
type Scan = Database['public']['Tables']['scans']['Row'];

type KPIs = {
  scansThisWeek: number;
  pendingOrders: number;
  revenueThisMonth: number;
  activeSamples: number;
};

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
  const [kpis, setKpis] = useState<KPIs>({
    scansThisWeek: 0,
    pendingOrders: 0,
    revenueThisMonth: 0,
    activeSamples: 0,
  });
  const [activity, setActivity] = useState<ActivityItem[]>([]);
  const [commissions, setCommissions] = useState<CommissionItem[]>([]);
  const [totalCommissionOwed, setTotalCommissionOwed] = useState(0);
  const [depositsHeld, setDepositsHeld] = useState(0);
  const [depositsByRetailer, setDepositsByRetailer] = useState<{ retailer_name: string; total: number }[]>([]);
  const [loading, setLoading] = useState(true);
  const [brandName, setBrandName] = useState('');

  useEffect(() => {
    if (!user) return;
    const supabase = createClient();

    supabase
      .from('brand_profiles')
      .select('id, name')
      .eq('user_id', user.id)
      .single()
      .then(async ({ data: bp }: { data: { id: string; name: string } | null }) => {
        if (!bp) {
          setLoading(false);
          return;
        }
        const brandProfile = bp;
        setBrandName(brandProfile.name);
        const brandId = brandProfile.id;

        const now = new Date();
        const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString();
        const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();

        const [samplesRes, scansRes, ordersRes, revenueRes, commissionsRes] = await Promise.all([
          supabase
            .from('samples')
            .select('id', { count: 'exact', head: true })
            .eq('brand_id', brandId)
            .eq('status', 'active'),
          supabase
            .from('scans')
            .select('id, scanned_at, product_id')
            .gte('scanned_at', weekAgo)
            .in(
              'product_id',
              (
                await supabase.from('products').select('id').eq('brand_id', brandId)
              ).data?.map((p: { id: string }) => p.id) ?? []
            )
            .order('scanned_at', { ascending: false })
            .limit(20),
          supabase
            .from('orders')
            .select('id, order_number, status, total_dkk, created_at')
            .eq('brand_id', brandId)
            .order('created_at', { ascending: false })
            .limit(20),
          supabase
            .from('orders')
            .select('total_dkk')
            .eq('brand_id', brandId)
            .gte('created_at', monthStart)
            .neq('status', 'cancelled'),
          supabase
            .from('attributions')
            .select('id, attribution_type, commission_amount_dkk, source_retailer_id, created_at, order_id')
            .in('order_id',
              (await supabase.from('orders').select('id').eq('brand_id', brandId)).data?.map((o: { id: string }) => o.id) ?? []
            )
            .not('source_retailer_id', 'is', null)
            .gte('created_at', monthStart)
            .order('created_at', { ascending: false }),
        ]);

        type OrderRow = { id: string; order_number: number; status: string; total_dkk: number; created_at: string };
        const allOrders = (ordersRes.data ?? []) as OrderRow[];
        const pendingOrders = allOrders.filter((o) => o.status === 'pending').length;
        const monthRevenue = ((revenueRes.data ?? []) as { total_dkk: number }[]).reduce(
          (sum, o) => sum + o.total_dkk,
          0
        );

        setKpis({
          scansThisWeek: scansRes.data?.length ?? 0,
          pendingOrders,
          revenueThisMonth: monthRevenue,
          activeSamples: samplesRes.count ?? 0,
        });

        const items: ActivityItem[] = [];

        for (const scan of (scansRes.data ?? []).slice(0, 5) as Pick<
          Scan,
          'id' | 'scanned_at'
        >[]) {
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
        if (attrData.length > 0) {
          const retailerIds = Array.from(new Set(attrData.map((a) => a.source_retailer_id).filter(Boolean))) as string[];
          const orderIds = Array.from(new Set(attrData.map((a) => a.order_id)));

          const [retailersRes, attrOrdersRes] = await Promise.all([
            supabase.from('retailer_profiles').select('id, name').in('id', retailerIds),
            supabase.from('orders').select('id, order_number').in('id', orderIds),
          ]);

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
        }

        // Deposit data
        const { data: heldSamples } = await supabase
          .from('samples')
          .select('deposit_amount_dkk, retailer_id')
          .eq('brand_id', brandId)
          .eq('deposit_status', 'held');

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

          setDepositsByRetailer(
            Array.from(byRetailer.entries()).map(([rid, t]) => ({
              retailer_name: (depRetailerMap.get(rid) as string | undefined) ?? 'Unknown',
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
        <ListSkeleton rows={4} />
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
      label: 'Pending orders',
      value: kpis.pendingOrders,
      icon: ShoppingBag,
      color: 'text-amber-600 bg-amber-50',
    },
    {
      label: 'Revenue this month',
      value: formatDKK(kpis.revenueThisMonth),
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
          Welcome, {brandName}
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

      {/* Quick action */}
      {kpis.pendingOrders > 0 && (
        <Link
          href="/brand/orders"
          className="flex items-center justify-between bg-amber-50 border border-amber-200 rounded-xl px-5 py-4 hover:bg-amber-100 transition group"
        >
          <div className="flex items-center gap-3">
            <ShoppingBag className="h-5 w-5 text-amber-600" />
            <span className="text-sm font-medium text-amber-800">
              You have {kpis.pendingOrders} order{kpis.pendingOrders !== 1 ? 's' : ''} awaiting
              fulfillment
            </span>
          </div>
          <ArrowRight className="h-4 w-4 text-amber-600 group-hover:translate-x-1 transition-transform" />
        </Link>
      )}

      {/* Deposits held */}
      {depositsHeld > 0 && (
        <div>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-gray-900">Deposits held</h2>
            <span className="text-sm font-bold text-emerald-700 bg-emerald-50 px-3 py-1 rounded-full">
              {formatDKK(depositsHeld)} total
            </span>
          </div>
          <div className="bg-white rounded-xl border border-gray-200 divide-y divide-gray-100">
            {depositsByRetailer.map((r) => (
              <div key={r.retailer_name} className="flex items-center gap-3 px-4 py-3">
                <div className="p-1.5 rounded-lg bg-emerald-50 text-emerald-600">
                  <Wallet className="h-4 w-4" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-gray-900">{r.retailer_name}</p>
                </div>
                <span className="text-sm font-bold text-gray-900">{formatDKK(r.total)}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Commission owed */}
      {commissions.length > 0 && (
        <div>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-gray-900">Commission this month</h2>
            <span className="text-sm font-bold text-amber-700 bg-amber-50 px-3 py-1 rounded-full">
              {formatDKK(totalCommissionOwed)} owed
            </span>
          </div>
          <div className="bg-white rounded-xl border border-gray-200 divide-y divide-gray-100">
            {commissions.map((c) => {
              const typeLabel = c.type === 'direct' ? 'Direct' : c.type === 'deferred' ? 'Deferred' : 'Tier 2';
              const typeColor = c.type === 'direct' ? 'bg-green-100 text-green-700' : c.type === 'deferred' ? 'bg-blue-100 text-blue-700' : 'bg-purple-100 text-purple-700';
              return (
                <div key={c.id} className="flex items-center gap-3 px-4 py-3">
                  <div className="p-1.5 rounded-lg bg-amber-50 text-amber-600">
                    <Coins className="h-4 w-4" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-gray-900">{c.retailer_name}</p>
                    <div className="flex items-center gap-2 mt-0.5">
                      <span className={`text-xs font-medium px-1.5 py-0.5 rounded ${typeColor}`}>{typeLabel}</span>
                      {c.order_number && <span className="text-xs text-gray-400">Order #{c.order_number}</span>}
                    </div>
                  </div>
                  <span className="text-sm font-bold text-gray-900">{formatDKK(c.amount_dkk)}</span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Activity feed */}
      <div>
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Recent activity</h2>
        {activity.length === 0 ? (
          <div className="bg-white rounded-xl border border-gray-200 py-8 text-center">
            <Clock className="h-8 w-8 text-gray-300 mx-auto" />
            <p className="mt-2 text-sm text-gray-500">No activity yet</p>
            <p className="text-xs text-gray-400 mt-1">Scans and orders will appear here</p>
          </div>
        ) : (
          <div className="bg-white rounded-xl border border-gray-200 divide-y divide-gray-100">
            {activity.map((item) => (
              <div key={item.id} className="flex items-center gap-3 px-4 py-3">
                <div
                  className={`p-1.5 rounded-lg ${
                    item.type === 'scan'
                      ? 'bg-blue-50 text-blue-600'
                      : 'bg-green-50 text-green-600'
                  }`}
                >
                  {item.type === 'scan' ? (
                    <ScanLine className="h-4 w-4" />
                  ) : (
                    <ShoppingBag className="h-4 w-4" />
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-gray-900 truncate">{item.description}</p>
                </div>
                <span className="text-xs text-gray-400 whitespace-nowrap">
                  {timeAgo(item.time)}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
