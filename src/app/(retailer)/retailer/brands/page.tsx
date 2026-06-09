'use client';

import { useEffect, useState } from 'react';
import Image from 'next/image';
import { useAuth } from '@/components/providers/auth-provider';
import { createClient } from '@/lib/supabase';
import { formatCommission } from '@/lib/utils';
import { Store, Check, Clock, Handshake } from 'lucide-react';
import type { Database } from '@/lib/database.types';

type BrandProfile = Database['public']['Tables']['brand_profiles']['Row'];
type Partnership = Database['public']['Tables']['brand_retailer_partnerships']['Row'];

type BrandItem = {
  id: string;
  name: string;
  description: string | null;
  logo_url: string | null;
  website: string | null;
};

type PartnershipItem = Partnership & {
  brand_name: string;
  brand_logo: string | null;
};

export default function RetailerBrandsPage() {
  const { user } = useAuth();
  const [retailerId, setRetailerId] = useState<string | null>(null);
  const [availableBrands, setAvailableBrands] = useState<BrandItem[]>([]);
  const [partnerships, setPartnerships] = useState<PartnershipItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [requesting, setRequesting] = useState<string | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!user) return;
    loadData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  async function loadData() {
    const supabase = createClient();

    const { data: rp } = await supabase
      .from('retailer_profiles')
      .select('id')
      .eq('user_id', user!.id)
      .single();

    if (!rp) {
      setLoading(false);
      return;
    }

    const rId = (rp as { id: string }).id;
    setRetailerId(rId);

    // Get all partnerships for this retailer
    const { data: partnershipData } = await supabase
      .from('brand_retailer_partnerships')
      .select('*')
      .eq('retailer_id', rId)
      .order('created_at', { ascending: false });

    const typedPartnerships = (partnershipData ?? []) as Partnership[];
    const partnerBrandIds = new Set(typedPartnerships.map((p) => p.brand_id));

    // Get all brands
    const { data: allBrands } = await supabase
      .from('brand_profiles')
      .select('id, name, description, logo_url, website')
      .eq('onboarding_complete', true)
      .order('name');

    const typedBrands = (allBrands ?? []) as BrandItem[];

    // Split into available (no partnership) and existing
    setAvailableBrands(typedBrands.filter((b) => !partnerBrandIds.has(b.id)));

    // Enrich partnerships with brand info
    const brandMap = new Map(typedBrands.map((b) => [b.id, b]));

    // Also fetch any brands that are in partnerships but might not be in the onboarding_complete list
    const missingBrandIds = typedPartnerships
      .map((p) => p.brand_id)
      .filter((id) => !brandMap.has(id));

    if (missingBrandIds.length > 0) {
      const { data: extraBrands } = await supabase
        .from('brand_profiles')
        .select('id, name, description, logo_url, website')
        .in('id', missingBrandIds);

      for (const b of (extraBrands ?? []) as BrandItem[]) {
        brandMap.set(b.id, b);
      }
    }

    setPartnerships(
      typedPartnerships.map((p) => ({
        ...p,
        brand_name: brandMap.get(p.brand_id)?.name ?? 'Unknown brand',
        brand_logo: brandMap.get(p.brand_id)?.logo_url ?? null,
      }))
    );

    setLoading(false);
  }

  async function handleRequest(brandId: string) {
    setRequesting(brandId);
    setError('');

    const res = await fetch('/api/partnerships/request', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ brand_id: brandId }),
    });

    if (!res.ok) {
      const data = await res.json();
      setError(data.error ?? 'Something went wrong');
      setRequesting(null);
      return;
    }

    setRequesting(null);
    loadData();
  }

  if (loading) {
    return <div className="space-y-4"><div className="animate-pulse bg-gray-200 rounded h-6 w-32" /><div className="animate-pulse bg-gray-100 rounded-xl h-48 w-full" /></div>;
  }

  const activePartnerships = partnerships.filter((p) => p.status === 'active');
  const pendingPartnerships = partnerships.filter((p) => p.status === 'invited');

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Brands</h1>
        <p className="mt-1 text-gray-500">
          Your partnerships and available brands
        </p>
      </div>

      {/* Active partnerships */}
      {activePartnerships.length > 0 && (
        <div>
          <h2 className="text-lg font-semibold text-gray-900 mb-3">
            Active partnerships
          </h2>
          <div className="grid gap-3 sm:grid-cols-2">
            {activePartnerships.map((p) => (
              <div
                key={p.id}
                className="bg-white rounded-xl border border-gray-200 p-4 flex items-center gap-4"
              >
                {p.brand_logo ? (
                  <div className="relative w-12 h-12 rounded-xl overflow-hidden border border-gray-200 flex-shrink-0">
                    <Image
                      src={p.brand_logo}
                      alt=""
                      fill
                      className="object-cover"
                      sizes="48px"
                    />
                  </div>
                ) : (
                  <div className="w-12 h-12 rounded-xl bg-cirkle-50 flex items-center justify-center flex-shrink-0">
                    <span className="text-lg font-bold text-cirkle-600">
                      {p.brand_name.charAt(0)}
                    </span>
                  </div>
                )}
                <div className="min-w-0 flex-1">
                  <p className="font-medium text-gray-900 truncate">{p.brand_name}</p>
                  <div className="flex items-center gap-2 mt-0.5">
                    <Check className="h-3.5 w-3.5 text-green-500" />
                    <span className="text-xs text-green-600">Active</span>
                    <span className="text-xs text-gray-400 ml-1">
                      {formatCommission(p.commission_direct)} direkte
                    </span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Pending */}
      {pendingPartnerships.length > 0 && (
        <div>
          <h2 className="text-lg font-semibold text-gray-900 mb-3">Pending</h2>
          <div className="grid gap-3 sm:grid-cols-2">
            {pendingPartnerships.map((p) => (
              <div
                key={p.id}
                className="bg-white rounded-xl border border-gray-200 p-4 flex items-center gap-4 opacity-75"
              >
                {p.brand_logo ? (
                  <div className="relative w-12 h-12 rounded-xl overflow-hidden border border-gray-200 flex-shrink-0">
                    <Image
                      src={p.brand_logo}
                      alt=""
                      fill
                      className="object-cover"
                      sizes="48px"
                    />
                  </div>
                ) : (
                  <div className="w-12 h-12 rounded-xl bg-gray-100 flex items-center justify-center flex-shrink-0">
                    <span className="text-lg font-bold text-gray-400">
                      {p.brand_name.charAt(0)}
                    </span>
                  </div>
                )}
                <div className="min-w-0 flex-1">
                  <p className="font-medium text-gray-900 truncate">{p.brand_name}</p>
                  <div className="flex items-center gap-2 mt-0.5">
                    <Clock className="h-3.5 w-3.5 text-amber-500" />
                    <span className="text-xs text-amber-600">
                      {p.invitation_token ? 'Invitation modtaget' : 'Anmodning sendt'}
                    </span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Available brands catalog */}
      <div>
        <h2 className="text-lg font-semibold text-gray-900 mb-3">
          Tilgængelige brands
        </h2>
        {availableBrands.length === 0 ? (
          <div className="text-center py-8 bg-white rounded-xl border border-gray-200">
            <Handshake className="h-10 w-10 text-gray-300 mx-auto" />
            <p className="mt-2 text-sm text-gray-500">
              {partnerships.length > 0
                ? 'You have partnerships with all brands on the platform'
                : 'No brands on the platform yet'}
            </p>
          </div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {availableBrands.map((brand) => (
              <div
                key={brand.id}
                className="bg-white rounded-xl border border-gray-200 p-4 space-y-3"
              >
                <div className="flex items-center gap-3">
                  {brand.logo_url ? (
                    <div className="relative w-12 h-12 rounded-xl overflow-hidden border border-gray-200 flex-shrink-0">
                      <Image
                        src={brand.logo_url}
                        alt=""
                        fill
                        className="object-cover"
                        sizes="48px"
                      />
                    </div>
                  ) : (
                    <div className="w-12 h-12 rounded-xl bg-cirkle-50 flex items-center justify-center flex-shrink-0">
                      <span className="text-lg font-bold text-cirkle-600">
                        {brand.name.charAt(0)}
                      </span>
                    </div>
                  )}
                  <div className="min-w-0">
                    <p className="font-medium text-gray-900 truncate">{brand.name}</p>
                    {brand.website && (
                      <p className="text-xs text-gray-400 truncate">{brand.website}</p>
                    )}
                  </div>
                </div>

                {brand.description && (
                  <p className="text-sm text-gray-500 line-clamp-2">{brand.description}</p>
                )}

                <button
                  onClick={() => handleRequest(brand.id)}
                  disabled={requesting === brand.id}
                  className="w-full flex items-center justify-center gap-2 rounded-lg bg-cirkle-600 px-3 py-2 text-sm text-white font-medium hover:bg-cirkle-700 transition disabled:opacity-50"
                >
                  <Store className="h-4 w-4" />
                  {requesting === brand.id ? 'Sending...' : 'Request partnership'}
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {error && (
        <p className="text-sm text-red-600 bg-red-50 rounded-lg px-4 py-3">{error}</p>
      )}
    </div>
  );
}
