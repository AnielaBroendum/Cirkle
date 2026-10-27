'use client';

import { useEffect, useState } from 'react';
import { useAuth } from '@/components/providers/auth-provider';
import { createClient } from '@/lib/supabase';
import { formatCommission } from '@/lib/utils';
import { Handshake, Check, X, Copy, Store, MapPin, Plus } from 'lucide-react';
import { Badge, Button, Card, EmptyState, Field, Input, ListSkeleton, StatusPill } from '@/components/ds';
import { StoresPageHeader } from '@/components/brand/stores-tabs';
import { InviteStoreModal } from '@/components/brand/invite-store-modal';
import type { Database } from '@/lib/database.types';

type Partnership = Database['public']['Tables']['brand_retailer_partnerships']['Row'];
type RetailerProfile = Database['public']['Tables']['retailer_profiles']['Row'];

type PartnershipWithRetailer = Partnership & {
  retailer_name: string | null;
};

type AvailableRetailer = Pick<
  RetailerProfile,
  'id' | 'name' | 'description' | 'city' | 'store_type' | 'logo_url'
>;

export default function BrandPartnershipsPage() {
  const { user } = useAuth();
  const [brandProfileId, setBrandProfileId] = useState<string | null>(null);
  const [partnerships, setPartnerships] = useState<PartnershipWithRetailer[]>([]);
  const [availableRetailers, setAvailableRetailers] = useState<AvailableRetailer[]>([]);
  const [requestingId, setRequestingId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const [commDirect, setCommDirect] = useState(25);
  const [commDeferred, setCommDeferred] = useState(15);
  const [commTier2, setCommTier2] = useState(10);
  const [copiedUrl, setCopiedUrl] = useState<string | null>(null);
  const [inviteOpen, setInviteOpen] = useState(false);

  useEffect(() => {
    if (!user) return;
    loadPartnerships();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  async function loadPartnerships() {
    const supabase = createClient();
    const { data: bp } = await supabase
      .from('brand_profiles')
      .select('id')
      .eq('user_id', user!.id)
      .single();

    if (!bp) {
      setLoading(false);
      return;
    }

    const brandId = (bp as { id: string }).id;
    setBrandProfileId(brandId);

    const { data: partnershipData } = await supabase
      .from('brand_retailer_partnerships')
      .select('*')
      .eq('brand_id', brandId)
      .order('created_at', { ascending: false });

    const typed = (partnershipData ?? []) as Partnership[];

    const retailerIds = typed
      .map((p) => p.retailer_id)
      .filter((id): id is string => id !== null);

    let retailerMap = new Map<string, string>();
    if (retailerIds.length > 0) {
      const { data: retailers } = await supabase
        .from('retailer_profiles')
        .select('id, name')
        .in('id', retailerIds);

      retailerMap = new Map(
        ((retailers ?? []) as Pick<RetailerProfile, 'id' | 'name'>[]).map((r) => [
          r.id,
          r.name,
        ])
      );
    }

    setPartnerships(
      typed.map((p) => ({
        ...p,
        retailer_name: p.retailer_id ? (retailerMap.get(p.retailer_id) ?? null) : null,
      }))
    );

    // Retailers available to partner with (onboarded, not already connected).
    const partneredIds = new Set(
      typed.map((p) => p.retailer_id).filter((id): id is string => id !== null)
    );
    const { data: retailers } = await supabase
      .from('retailer_profiles')
      .select('id, name, description, city, store_type, logo_url')
      .eq('onboarding_complete', true)
      .order('name');
    setAvailableRetailers(
      ((retailers ?? []) as AvailableRetailer[]).filter((r) => !partneredIds.has(r.id))
    );

    setLoading(false);
  }

  async function handleRequestRetailer(retailerId: string) {
    setRequestingId(retailerId);
    await fetch('/api/partnerships/request-retailer', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        retailer_id: retailerId,
        commission_direct: commDirect * 100,
        commission_deferred: commDeferred * 100,
        commission_tier2: commTier2 * 100,
      }),
    });
    setRequestingId(null);
    loadPartnerships();
  }

  async function handleUpdateStatus(
    partnershipId: string,
    status: 'active' | 'declined'
  ) {
    const supabase = createClient();
    await supabase
      .from('brand_retailer_partnerships')
      .update({
        status,
        ...(status === 'active' ? { accepted_at: new Date().toISOString() } : {}),
      })
      .eq('id', partnershipId);
    loadPartnerships();
  }

  function copyUrl(url: string) {
    navigator.clipboard.writeText(url);
    setCopiedUrl(url);
    setTimeout(() => setCopiedUrl(null), 2000);
  }

  const header = (
    <StoresPageHeader
      subtitle="Every store you work with, invitations you've sent and stores asking to partner"
      action={
        <Button onClick={() => setInviteOpen(true)} leftIcon={<Plus className="h-4 w-4" />} className="self-start sm:self-auto">
          Invite store
        </Button>
      }
    />
  );

  if (loading) {
    return (
      <div className="space-y-6">
        {header}
        <ListSkeleton rows={4} />
      </div>
    );
  }

  // Brand-initiated: status='invited' with a token. Retailer-initiated: status='invited' without a token.
  const invited = partnerships.filter((p) => p.status === 'invited' && p.invitation_token);
  const requested = partnerships.filter((p) => p.status === 'invited' && !p.invitation_token);
  const active = partnerships.filter((p) => p.status === 'active');
  const other = partnerships.filter((p) =>
    ['paused', 'declined'].includes(p.status)
  );

  const commission = (p: Partnership) =>
    `${formatCommission(p.commission_direct)} / ${formatCommission(p.commission_deferred)} / ${formatCommission(p.commission_tier2)}`;

  return (
    <div className="space-y-8">
      {header}

      {/* Incoming requests from retailers */}
      {requested.length > 0 && (
        <Section title="Incoming requests" note="Stores asking to partner with you">
          {requested.map((p) => (
            <Row
              key={p.id}
              title={p.retailer_name ?? 'Store'}
              subtitle={`Wants to partner · ${commission(p)}`}
              trailing={
                <div className="flex gap-2">
                  <Button size="sm" onClick={() => handleUpdateStatus(p.id, 'active')} leftIcon={<Check className="h-3.5 w-3.5" />}>
                    Accept
                  </Button>
                  <Button size="sm" variant="secondary" onClick={() => handleUpdateStatus(p.id, 'declined')} leftIcon={<X className="h-3.5 w-3.5" />}>
                    Decline
                  </Button>
                </div>
              }
            />
          ))}
        </Section>
      )}

      {/* Pending invitations */}
      {invited.length > 0 && (
        <Section title="Pending invitations" note="Waiting for the store to accept">
          {invited.map((p) => {
            const url = p.invitation_token ? `${window.location.origin}/invite/${p.invitation_token}` : null;
            return (
              <Row
                key={p.id}
                title={p.retailer_name ?? p.invitation_email ?? 'Unknown'}
                subtitle={`Awaiting response · ${commission(p)}`}
                badge={<Badge tone="warning">Pending</Badge>}
                trailing={
                  url && (
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => copyUrl(url)}
                      leftIcon={copiedUrl === url ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
                    >
                      {copiedUrl === url ? 'Copied' : 'Copy link'}
                    </Button>
                  )
                }
              />
            );
          })}
        </Section>
      )}

      {/* Active partnerships */}
      <Section title="Active partnerships" note="Commission: direct / deferred / tier 2">
        {active.length === 0 ? (
          <EmptyState
            className="border-none py-10"
            icon={<Handshake className="h-5 w-5" />}
            title="No active partnerships yet"
            description="Invite a store or request one of the stores below to get started."
          />
        ) : (
          active.map((p) => (
            <Row
              key={p.id}
              title={p.retailer_name ?? p.invitation_email ?? 'Store'}
              subtitle={commission(p)}
              badge={<StatusPill status="active" />}
            />
          ))
        )}
      </Section>

      {/* Discover retailers */}
      <div className="space-y-3">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <h2 className="font-brand text-body uppercase tracking-[0.3px] text-primary">Available stores</h2>
            <p className="mt-1 text-caption text-slate">Browse stores on Flaym and request a partnership directly.</p>
          </div>
          <div className="grid grid-cols-3 gap-2 sm:w-[340px]">
            <Field label="Direct %" htmlFor="p-direct">
              <Input id="p-direct" type="number" min={0} max={100} value={commDirect} onChange={(e) => setCommDirect(Number(e.target.value))} className="h-9" />
            </Field>
            <Field label="Deferred %" htmlFor="p-deferred">
              <Input id="p-deferred" type="number" min={0} max={100} value={commDeferred} onChange={(e) => setCommDeferred(Number(e.target.value))} className="h-9" />
            </Field>
            <Field label="Tier-2 %" htmlFor="p-tier2">
              <Input id="p-tier2" type="number" min={0} max={100} value={commTier2} onChange={(e) => setCommTier2(Number(e.target.value))} className="h-9" />
            </Field>
          </div>
        </div>
        {availableRetailers.length === 0 ? (
          <EmptyState
            className="bg-surface py-10"
            icon={<Store className="h-5 w-5" />}
            title={partnerships.length > 0 ? 'All caught up' : 'No stores yet'}
            description={
              partnerships.length > 0
                ? "You've connected with every retailer on the platform"
                : 'No retailers on the platform yet'
            }
          />
        ) : (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {availableRetailers.map((r) => (
              <Card key={r.id} padding="none" className="flex flex-col rounded-none p-4">
                <div className="flex items-center gap-3">
                  {r.logo_url ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={r.logo_url} alt="" className="h-11 w-11 shrink-0 border border-line object-cover" />
                  ) : (
                    <span className="flex h-11 w-11 shrink-0 items-center justify-center bg-surface-muted text-heading-lg uppercase text-primary">
                      {r.name.charAt(0)}
                    </span>
                  )}
                  <div className="min-w-0">
                    <p className="truncate text-body text-primary">{r.name}</p>
                    <p className="mt-0.5 flex items-center gap-1.5 text-caption text-slate">
                      {r.store_type && <span>{r.store_type.charAt(0).toUpperCase() + r.store_type.slice(1).replace(/_/g, ' ')}</span>}
                      {r.city && (
                        <>
                          <MapPin className="h-3 w-3" />
                          <span>{r.city}</span>
                        </>
                      )}
                    </p>
                  </div>
                </div>
                {r.description && <p className="mt-3 line-clamp-2 flex-1 text-caption text-slate">{r.description}</p>}
                <Button
                  variant="secondary"
                  className="mt-4"
                  onClick={() => handleRequestRetailer(r.id)}
                  loading={requestingId === r.id}
                  leftIcon={<Handshake className="h-4 w-4" />}
                >
                  Request partnership
                </Button>
              </Card>
            ))}
          </div>
        )}
      </div>

      {/* Declined / Paused */}
      {other.length > 0 && (
        <Section title="Inactive">
          {other.map((p) => (
            <Row
              key={p.id}
              muted
              title={p.retailer_name ?? p.invitation_email ?? 'Store'}
              subtitle={commission(p)}
              badge={<StatusPill status={p.status} />}
            />
          ))}
        </Section>
      )}

      <InviteStoreModal open={inviteOpen} onClose={() => setInviteOpen(false)} onInvited={loadPartnerships} />
    </div>
  );
}

function Section({ title, note, children }: { title: string; note?: string; children: React.ReactNode }) {
  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="font-brand text-body uppercase tracking-[0.3px] text-primary">{title}</h2>
        {note && <span className="text-caption text-slate">{note}</span>}
      </div>
      <div className="divide-y divide-line border border-line bg-surface">{children}</div>
    </div>
  );
}

function Row({
  title,
  subtitle,
  badge,
  trailing,
  muted,
}: {
  title: string;
  subtitle: string;
  badge?: React.ReactNode;
  trailing?: React.ReactNode;
  muted?: boolean;
}) {
  return (
    <div className="flex flex-col gap-3 px-4 py-3.5 sm:flex-row sm:items-center sm:justify-between">
      <div className="min-w-0">
        <div className="flex items-center gap-2">
          <p className={muted ? 'truncate text-body text-slate' : 'truncate text-body text-primary'}>{title}</p>
          {badge}
        </div>
        <p className="mt-0.5 text-caption text-slate">{subtitle}</p>
      </div>
      {trailing}
    </div>
  );
}
