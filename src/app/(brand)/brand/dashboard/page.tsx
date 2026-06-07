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
} from 'lucide-react';
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
            description: 'Nyt scan registreret',
            time: scan.scanned_at,
          });
        }

        for (const order of allOrders.slice(0, 5)) {
          items.push({
            id: order.id,
            type: 'order',
            description: `Ordre #${order.order_number ?? '—'} — ${formatDKK(order.total_dkk)}`,
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
              retailer_name: retailerMap.get(a.source_retailer_id!) ?? 'Ukendt',
              amount_dkk: a.commission_amount_dkk!,
              type: a.attribution_type,
              order_number: orderNumMap.get(a.order_id) ?? null,
              created_at: a.created_at,
            }));

          setCommissions(commissionItems);
          setTotalCommissionOwed(commissionItems.reduce((sum, c) => sum + c.amount_dkk, 0));
        }

        setLoading(false);
      });
  }, [user]);

  function timeAgo(dateStr: string): string {
    const diff = Date.now() - new Date(dateStr).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return 'Lige nu';
    if (mins < 60) return `${mins} min. siden`;
    const hours = Math.floor(mins / 60);
    if (hours < 24) return `${hours} t. siden`;
    const days = Math.floor(hours / 24);
    return `${days} d. siden`;
  }

  if (loading) {
    return <div className="animate-pulse text-gray-400">Henter data...</div>;
  }

  const KPI_CARDS = [
    {
      label: 'Scanninger denne uge',
      value: kpis.scansThisWeek,
      icon: ScanLine,
      color: 'text-blue-600 bg-blue-50',
    },
    {
      label: 'Afventende ordrer',
      value: kpis.pendingOrders,
      icon: ShoppingBag,
      color: 'text-amber-600 bg-amber-50',
    },
    {
      label: 'Omsætning denne måned',
      value: formatDKK(kpis.revenueThisMonth),
      icon: TrendingUp,
      color: 'text-green-600 bg-green-50',
    },
    {
      label: 'Aktive prøver',
      value: kpis.activeSamples,
      icon: QrCode,
      color: 'text-purple-600 bg-purple-50',
    },
  ];

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">
          Velkommen, {brandName}
        </h1>
        <p className="text-gray-500 mt-1">Her er dit overblik</p>
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
              Du har {kpis.pendingOrders} ordre{kpis.pendingOrders !== 1 ? 'r' : ''} der venter
              på behandling
            </span>
          </div>
          <ArrowRight className="h-4 w-4 text-amber-600 group-hover:translate-x-1 transition-transform" />
        </Link>
      )}

      {/* Commission owed */}
      {commissions.length > 0 && (
        <div>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-gray-900">Kommission denne maaned</h2>
            <span className="text-sm font-bold text-amber-700 bg-amber-50 px-3 py-1 rounded-full">
              {formatDKK(totalCommissionOwed)} skyldig
            </span>
          </div>
          <div className="bg-white rounded-xl border border-gray-200 divide-y divide-gray-100">
            {commissions.map((c) => {
              const typeLabel = c.type === 'direct' ? 'Direkte' : c.type === 'deferred' ? 'Udskudt' : 'Tier 2';
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
                      {c.order_number && <span className="text-xs text-gray-400">Ordre #{c.order_number}</span>}
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
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Seneste aktivitet</h2>
        {activity.length === 0 ? (
          <div className="bg-white rounded-xl border border-gray-200 py-8 text-center">
            <Clock className="h-8 w-8 text-gray-300 mx-auto" />
            <p className="mt-2 text-sm text-gray-500">Ingen aktivitet endnu</p>
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
