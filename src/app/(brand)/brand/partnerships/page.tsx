'use client';

import { useEffect, useState } from 'react';
import { useAuth } from '@/components/providers/auth-provider';
import { createClient } from '@/lib/supabase';
import { formatCommission } from '@/lib/utils';
import {
  Handshake,
  Send,
  Check,
  X,
  Clock,
  Copy,
  ExternalLink,
} from 'lucide-react';
import type { Database } from '@/lib/database.types';

type Partnership = Database['public']['Tables']['brand_retailer_partnerships']['Row'];
type RetailerProfile = Database['public']['Tables']['retailer_profiles']['Row'];

type PartnershipWithRetailer = Partnership & {
  retailer_name: string | null;
};

export default function BrandPartnershipsPage() {
  const { user } = useAuth();
  const [brandProfileId, setBrandProfileId] = useState<string | null>(null);
  const [partnerships, setPartnerships] = useState<PartnershipWithRetailer[]>([]);
  const [loading, setLoading] = useState(true);

  const [email, setEmail] = useState('');
  const [commDirect, setCommDirect] = useState(25);
  const [commDeferred, setCommDeferred] = useState(15);
  const [commTier2, setCommTier2] = useState(10);
  const [inviting, setInviting] = useState(false);
  const [inviteError, setInviteError] = useState('');
  const [inviteSuccess, setInviteSuccess] = useState<string | null>(null);
  const [copiedUrl, setCopiedUrl] = useState(false);

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
    setLoading(false);
  }

  async function handleInvite(e: React.FormEvent) {
    e.preventDefault();
    if (!email.trim()) return;

    setInviteError('');
    setInviteSuccess(null);
    setInviting(true);

    const res = await fetch('/api/partnerships/invite', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: email.trim(),
        commission_direct: commDirect * 100,
        commission_deferred: commDeferred * 100,
        commission_tier2: commTier2 * 100,
      }),
    });

    const data = await res.json();

    if (!res.ok) {
      setInviteError(data.error ?? 'Noget gik galt');
      setInviting(false);
      return;
    }

    setInviteSuccess(data.invitation_url);
    setEmail('');
    setInviting(false);
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
    setCopiedUrl(true);
    setTimeout(() => setCopiedUrl(false), 2000);
  }

  if (loading) {
    return <div className="animate-pulse text-gray-400">Henter partnerskaber...</div>;
  }

  // Brand-initiated: status='invited' with a token. Retailer-initiated: status='invited' without a token.
  const invited = partnerships.filter((p) => p.status === 'invited' && p.invitation_token);
  const requested = partnerships.filter((p) => p.status === 'invited' && !p.invitation_token);
  const active = partnerships.filter((p) => p.status === 'active');
  const other = partnerships.filter((p) =>
    ['paused', 'declined'].includes(p.status)
  );

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Partnerskaber</h1>
        <p className="mt-1 text-gray-500">Inviter butikker og administrer partnerskaber</p>
      </div>

      {/* Invite form */}
      <div className="bg-white rounded-xl border border-gray-200 p-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Inviter butik</h2>
        <form onSubmit={handleInvite} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              E-mail adresse *
            </label>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full rounded-lg border border-gray-300 px-4 py-3 text-gray-900 focus:border-cirkle-500 focus:ring-cirkle-500 focus:outline-none"
              placeholder="butik@eksempel.dk"
            />
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Direkte (%)
              </label>
              <input
                type="number"
                min={0}
                max={100}
                value={commDirect}
                onChange={(e) => setCommDirect(Number(e.target.value))}
                className="w-full rounded-lg border border-gray-300 px-3 py-2.5 text-gray-900 focus:border-cirkle-500 focus:ring-cirkle-500 focus:outline-none text-sm"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Udskudt (%)
              </label>
              <input
                type="number"
                min={0}
                max={100}
                value={commDeferred}
                onChange={(e) => setCommDeferred(Number(e.target.value))}
                className="w-full rounded-lg border border-gray-300 px-3 py-2.5 text-gray-900 focus:border-cirkle-500 focus:ring-cirkle-500 focus:outline-none text-sm"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Tier-2 (%)
              </label>
              <input
                type="number"
                min={0}
                max={100}
                value={commTier2}
                onChange={(e) => setCommTier2(Number(e.target.value))}
                className="w-full rounded-lg border border-gray-300 px-3 py-2.5 text-gray-900 focus:border-cirkle-500 focus:ring-cirkle-500 focus:outline-none text-sm"
              />
            </div>
          </div>

          {inviteError && (
            <p className="text-sm text-red-600 bg-red-50 rounded-lg px-4 py-3">
              {inviteError}
            </p>
          )}

          {inviteSuccess && (
            <div className="bg-green-50 border border-green-200 rounded-lg px-4 py-3 space-y-2">
              <p className="text-sm text-green-700 font-medium">Invitation sendt!</p>
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  readOnly
                  value={inviteSuccess}
                  className="flex-1 text-xs bg-white border border-green-200 rounded px-2 py-1.5 text-gray-600"
                />
                <button
                  type="button"
                  onClick={() => copyUrl(inviteSuccess)}
                  className="p-1.5 text-green-600 hover:text-green-700 rounded hover:bg-green-100"
                  title="Kopier link"
                >
                  {copiedUrl ? (
                    <Check className="h-4 w-4" />
                  ) : (
                    <Copy className="h-4 w-4" />
                  )}
                </button>
              </div>
            </div>
          )}

          <button
            type="submit"
            disabled={inviting || !email.trim()}
            className="flex items-center gap-2 rounded-lg bg-cirkle-600 px-4 py-2.5 text-sm text-white font-medium hover:bg-cirkle-700 transition disabled:opacity-50"
          >
            <Send className="h-4 w-4" />
            {inviting ? 'Sender...' : 'Send invitation'}
          </button>
        </form>
      </div>

      {/* Incoming requests from retailers */}
      {requested.length > 0 && (
        <div>
          <h2 className="text-lg font-semibold text-gray-900 mb-3">
            Indkommende anmodninger
          </h2>
          <div className="space-y-3">
            {requested.map((p) => (
              <div
                key={p.id}
                className="bg-white rounded-xl border border-amber-200 p-4 flex items-center justify-between"
              >
                <div>
                  <p className="font-medium text-gray-900">
                    {p.retailer_name ?? 'Butik'}
                  </p>
                  <p className="text-sm text-gray-500">Ønsker partnerskab</p>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => handleUpdateStatus(p.id, 'active')}
                    className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-green-50 text-green-700 text-sm font-medium hover:bg-green-100 transition"
                  >
                    <Check className="h-3.5 w-3.5" /> Godkend
                  </button>
                  <button
                    onClick={() => handleUpdateStatus(p.id, 'declined')}
                    className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-red-50 text-red-600 text-sm font-medium hover:bg-red-100 transition"
                  >
                    <X className="h-3.5 w-3.5" /> Afvis
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Pending invitations */}
      {invited.length > 0 && (
        <div>
          <h2 className="text-lg font-semibold text-gray-900 mb-3">
            Afventende invitationer
          </h2>
          <div className="space-y-3">
            {invited.map((p) => (
              <div
                key={p.id}
                className="bg-white rounded-xl border border-gray-200 p-4 flex items-center justify-between"
              >
                <div>
                  <p className="font-medium text-gray-900">
                    {p.invitation_email ?? 'Ukendt'}
                  </p>
                  <div className="flex items-center gap-2 mt-0.5">
                    <Clock className="h-3.5 w-3.5 text-amber-500" />
                    <span className="text-xs text-amber-600">Afventer svar</span>
                  </div>
                </div>
                <div className="flex items-center gap-3 text-xs text-gray-400">
                  <span>
                    {formatCommission(p.commission_direct)} / {formatCommission(p.commission_deferred)} / {formatCommission(p.commission_tier2)}
                  </span>
                  {p.invitation_token && (
                    <button
                      onClick={() =>
                        copyUrl(
                          `${window.location.origin}/invite/${p.invitation_token}`
                        )
                      }
                      className="p-1 text-gray-400 hover:text-gray-600 rounded hover:bg-gray-100"
                      title="Kopier invitationslink"
                    >
                      <ExternalLink className="h-3.5 w-3.5" />
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Active partnerships */}
      <div>
        <h2 className="text-lg font-semibold text-gray-900 mb-3">
          Aktive partnerskaber
        </h2>
        {active.length === 0 ? (
          <div className="text-center py-8 bg-white rounded-xl border border-gray-200">
            <Handshake className="h-10 w-10 text-gray-300 mx-auto" />
            <p className="mt-2 text-sm text-gray-500">Ingen aktive partnerskaber endnu</p>
          </div>
        ) : (
          <div className="space-y-3">
            {active.map((p) => (
              <div
                key={p.id}
                className="bg-white rounded-xl border border-gray-200 p-4 flex items-center justify-between"
              >
                <div>
                  <p className="font-medium text-gray-900">
                    {p.retailer_name ?? p.invitation_email ?? 'Butik'}
                  </p>
                  <div className="flex items-center gap-2 mt-0.5">
                    <Check className="h-3.5 w-3.5 text-green-500" />
                    <span className="text-xs text-green-600">Aktiv</span>
                  </div>
                </div>
                <span className="text-xs text-gray-400">
                  {formatCommission(p.commission_direct)} / {formatCommission(p.commission_deferred)} / {formatCommission(p.commission_tier2)}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Declined / Paused */}
      {other.length > 0 && (
        <div>
          <h2 className="text-lg font-semibold text-gray-900 mb-3">Inaktive</h2>
          <div className="space-y-3">
            {other.map((p) => (
              <div
                key={p.id}
                className="bg-white rounded-xl border border-gray-200 p-4 flex items-center justify-between opacity-60"
              >
                <div>
                  <p className="font-medium text-gray-900">
                    {p.retailer_name ?? p.invitation_email ?? 'Butik'}
                  </p>
                  <span className="text-xs text-gray-500 capitalize">{p.status}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
