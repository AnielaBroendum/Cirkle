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
} from 'lucide-react';
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
            .select('commission_amount_dkk')
            .eq('source_retailer_id', retailerId)
            .gte('created_at', monthStart),
          // Active partnerships
          supabase
            .from('brand_retailer_partnerships')
            .select('id, brand_id, commission_direct, status')
            .eq('retailer_id', retailerId)
            .eq('status', 'active'),
        ]);

        // Calculate commission
        const commissionTotal = (
          (commissionRes.data ?? []) as { commission_amount_dkk: number | null }[]
        ).reduce((sum, a) => sum + (a.commission_amount_dkk ?? 0), 0);

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
              product_name: productMap.get(s.product_id) ?? 'Ukendt produkt',
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
                brand_name: brand?.name ?? 'Ukendt brand',
                brand_logo: brand?.logo_url ?? null,
                commission_direct: p.commission_direct,
                status: p.status,
              };
            })
          );
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
      label: 'Tilskrevne salg',
      value: kpis.salesAttributed,
      icon: ShoppingBag,
      color: 'text-amber-600 bg-amber-50',
    },
    {
      label: 'Kommission denne måned',
      value: formatDKK(kpis.commissionThisMonth),
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
          Velkommen, {storeName}
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

      <div className="grid lg:grid-cols-2 gap-6">
        {/* Recent scans feed */}
        <div>
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Seneste scanninger</h2>
          {recentScans.length === 0 ? (
            <div className="bg-white rounded-xl border border-gray-200 py-8 text-center">
              <Clock className="h-8 w-8 text-gray-300 mx-auto" />
              <p className="mt-2 text-sm text-gray-500">Ingen scanninger endnu</p>
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
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Aktive partnerskaber</h2>
          {partnerships.length === 0 ? (
            <div className="bg-white rounded-xl border border-gray-200 py-8 text-center">
              <Handshake className="h-8 w-8 text-gray-300 mx-auto" />
              <p className="mt-2 text-sm text-gray-500">Ingen aktive partnerskaber</p>
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
                      {formatCommission(p.commission_direct)} kommission
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
