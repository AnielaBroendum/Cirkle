'use client';

import { useEffect, useState } from 'react';
import { useAuth } from '@/components/providers/auth-provider';
import { createClient } from '@/lib/supabase';
import { formatCommission } from '@/lib/utils';
import { Store, Check, Handshake, X } from 'lucide-react';
import { Avatar, Badge, Button, Card, CardSkeleton, EmptyState, Skeleton } from '@/components/ds';
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

  async function respondToInvite(partnershipId: string, status: 'active' | 'declined') {
    const supabase = createClient();
    await supabase
      .from('brand_retailer_partnerships')
      .update({
        status,
        ...(status === 'active' ? { accepted_at: new Date().toISOString() } : {}),
      })
      .eq('id', partnershipId);
    loadData();
  }

  if (loading) {
    return (
      <div className="space-y-7">
        <div className="space-y-2">
          <Skeleton className="h-10 w-48" />
          <Skeleton className="h-4 w-72 max-w-full" />
        </div>
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {[...Array(3)].map((_, i) => (
            <CardSkeleton key={i} />
          ))}
        </div>
      </div>
    );
  }

  const activePartnerships = partnerships.filter((p) => p.status === 'active');
  const pendingPartnerships = partnerships.filter((p) => p.status === 'invited');

  return (
    <div className="space-y-8">
      <div>
        <h1 className="font-brand text-heading-xl uppercase text-primary">Brands</h1>
        <p className="mt-1 text-body text-muted">Your partnerships and available brands</p>
      </div>

      {error && <p className="border border-accent bg-accent-subtle px-4 py-3 text-body text-accent-strong">{error}</p>}

      {/* Pending (shown first: these may need an answer) */}
      {pendingPartnerships.length > 0 && (
        <section>
          <SectionTitle count={pendingPartnerships.length}>Pending</SectionTitle>
          <div className="grid gap-3 sm:grid-cols-2">
            {pendingPartnerships.map((p) => {
              // Brand-initiated requests carry a token → the retailer can accept.
              const brandInvited = !!p.invitation_token;
              return (
                <Card key={p.id} padding="none" className="flex items-center gap-4 p-4">
                  <Avatar src={p.brand_logo} name={p.brand_name} size="lg" />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-body text-primary">{p.brand_name}</p>
                    <Badge tone={brandInvited ? 'accent' : 'warning'} className="mt-1.5">
                      {brandInvited ? 'Wants to partner with you' : 'Request sent'}
                    </Badge>
                  </div>
                  {brandInvited && (
                    <div className="flex shrink-0 items-center gap-2">
                      <Button size="sm" onClick={() => respondToInvite(p.id, 'active')} leftIcon={<Check className="h-3.5 w-3.5" />}>
                        Accept
                      </Button>
                      <Button
                        size="sm"
                        variant="secondary"
                        onClick={() => respondToInvite(p.id, 'declined')}
                        aria-label="Decline"
                        title="Decline"
                        className="w-8 px-0"
                      >
                        <X className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  )}
                </Card>
              );
            })}
          </div>
        </section>
      )}

      {/* Active partnerships */}
      {activePartnerships.length > 0 && (
        <section>
          <SectionTitle count={activePartnerships.length}>Active partnerships</SectionTitle>
          <div className="grid gap-3 sm:grid-cols-2">
            {activePartnerships.map((p) => (
              <Card key={p.id} padding="none" className="flex items-center gap-4 p-4">
                <Avatar src={p.brand_logo} name={p.brand_name} size="lg" />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-body text-primary">{p.brand_name}</p>
                  <p className="mt-1 text-caption text-muted">{formatCommission(p.commission_direct)} direct commission</p>
                </div>
                <Badge tone="success">Active</Badge>
              </Card>
            ))}
          </div>
        </section>
      )}

      {/* Available brands catalog */}
      <section>
        <SectionTitle>Available brands</SectionTitle>
        {availableBrands.length === 0 ? (
          <EmptyState
            icon={<Handshake className="h-5 w-5" />}
            title={partnerships.length > 0 ? 'All brands added' : 'No brands yet'}
            description={
              partnerships.length > 0
                ? 'You have partnerships with all brands on the platform.'
                : 'No brands on the platform yet.'
            }
          />
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {availableBrands.map((brand) => (
              <Card key={brand.id} padding="none" className="flex flex-col gap-3 p-5">
                <div className="flex items-center gap-3">
                  <Avatar src={brand.logo_url} name={brand.name} size="lg" />
                  <div className="min-w-0">
                    <p className="truncate text-body text-primary">{brand.name}</p>
                    {brand.website && <p className="truncate text-caption text-muted">{brand.website}</p>}
                  </div>
                </div>

                {brand.description && <p className="line-clamp-2 text-caption text-muted">{brand.description}</p>}

                <Button
                  className="mt-auto"
                  variant="secondary"
                  fullWidth
                  onClick={() => handleRequest(brand.id)}
                  loading={requesting === brand.id}
                  disabled={requesting === brand.id}
                  leftIcon={<Store className="h-4 w-4" />}
                >
                  {requesting === brand.id ? 'Sending…' : 'Request partnership'}
                </Button>
              </Card>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

// Figma section title: 14px uppercase, optional muted count.
function SectionTitle({ children, count }: { children: React.ReactNode; count?: number }) {
  return (
    <h2 className="mb-3 font-brand text-body uppercase tracking-[0.3px] text-primary">
      {children}
      {count !== undefined && <span className="ml-2 text-muted">{count}</span>}
    </h2>
  );
}
