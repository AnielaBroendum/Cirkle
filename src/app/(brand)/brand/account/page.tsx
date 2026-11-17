'use client';

import { useEffect, useState } from 'react';
import { Check } from 'lucide-react';
import { useAuth } from '@/components/providers/auth-provider';
import { createClient } from '@/lib/supabase';
import { ImageUpload } from '@/components/brand/image-upload';
import { BrandStories } from '@/components/brand/brand-stories';
import { Button, Field, Input, PageHeader, Panel, PanelHeader, Skeleton, Textarea } from '@/components/ds';
import type { Database } from '@/lib/database.types';

// Figma "Brand Portal v2 / 08 Account and payouts" (367:651). Brand details live on
// brand_profiles; payout details in brand_payout_details (owner-only RLS, migration 007).
// Order emails go to the account email (profiles.email). Save logic is unchanged.
// Left out (no data): the Verified badge and the Brand agreement card.

/**
 * The store's share of a sale credited to a store, as checkout writes it today: a fixed 15%
 * for every store sale, whatever the partnership's rates (src/app/api/checkout/route.ts).
 * Sales passed on by a friend give the store nothing (the friend earns Cirkle Points).
 * The app has no Flaym fee. Change this together with checkout.
 */
const STORE_CUT_PERCENT = 15;

type BrandProfile = Database['public']['Tables']['brand_profiles']['Row'];
type PayoutDetails = Database['public']['Tables']['brand_payout_details']['Row'];

export default function BrandAccountPage() {
  const { user, profile } = useAuth();
  const [brandId, setBrandId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState('');
  // Until migration 007 is applied, the return policy link and payouts can't be stored.
  const [accountTablesReady, setAccountTablesReady] = useState(true);

  const [name, setName] = useState('');
  const [website, setWebsite] = useState('');
  const [returnPolicyUrl, setReturnPolicyUrl] = useState('');
  const [description, setDescription] = useState('');
  const [logo, setLogo] = useState<string[]>([]);

  const [regNo, setRegNo] = useState('');
  const [accountNo, setAccountNo] = useState('');
  const [cvr, setCvr] = useState('');
  const [editingAccount, setEditingAccount] = useState(false);

  useEffect(() => {
    if (!user) return;
    const supabase = createClient();

    (async () => {
      const { data } = await supabase.from('brand_profiles').select('*').eq('user_id', user.id).single();
      const bp = data as BrandProfile | null;
      if (!bp) {
        setLoading(false);
        return;
      }
      setBrandId(bp.id);
      setName(bp.name ?? '');
      setWebsite(bp.website ?? '');
      setDescription(bp.description ?? '');
      setLogo(bp.logo_url ? [bp.logo_url] : []);
      setReturnPolicyUrl(bp.return_policy_url ?? '');

      const payoutRes = await supabase.from('brand_payout_details').select('*').eq('brand_id', bp.id).maybeSingle();
      if (payoutRes.error || !('return_policy_url' in bp)) {
        setAccountTablesReady(false);
      } else {
        const payout = payoutRes.data as PayoutDetails | null;
        if (payout) {
          setRegNo(payout.reg_no ?? '');
          setAccountNo(payout.account_no ?? '');
          setCvr(payout.cvr ?? '');
        }
      }
      setLoading(false);
    })();
  }, [user]);

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    if (!brandId || !name.trim()) return;

    setError('');
    setSaved(false);
    setSaving(true);
    const supabase = createClient();

    const { error: profileError } = await supabase
      .from('brand_profiles')
      .update({
        name: name.trim(),
        website: website.trim() || null,
        description: description.trim() || null,
        logo_url: logo[0] || null,
        ...(accountTablesReady ? { return_policy_url: returnPolicyUrl.trim() || null } : {}),
      })
      .eq('id', brandId);

    const { error: payoutError } =
      profileError || !accountTablesReady
        ? { error: null }
        : await supabase.from('brand_payout_details').upsert({
            brand_id: brandId,
            reg_no: regNo.trim() || null,
            account_no: accountNo.trim() || null,
            cvr: cvr.trim() || null,
          });

    setSaving(false);
    const err = profileError ?? payoutError;
    if (err) {
      setError(err.message);
      return;
    }
    setSaved(true);
  }

  const header = (action?: React.ReactNode) => (
    <PageHeader title="Account" subtitle="Brand profile and payout details." actions={action} />
  );

  if (loading) {
    return (
      <div className="space-y-6">
        {header()}
        <div className="grid gap-4 lg:grid-cols-[minmax(0,590fr)_minmax(0,350fr)]">
          <Skeleton className="h-[420px] w-full" />
          <Skeleton className="h-[320px] w-full" />
        </div>
      </div>
    );
  }

  // "•••• 4821" until the field is focused.
  const maskedAccount = accountNo.length > 4 ? `•••• ${accountNo.slice(-4)}` : accountNo;
  const set = <T,>(fn: (v: T) => void) => (v: T) => {
    fn(v);
    setSaved(false);
  };

  return (
    <form onSubmit={handleSave} className="space-y-6">
      {header(
        <div className="flex items-center gap-3">
          {saved && (
            <span role="status" className="inline-flex items-center gap-1.5 text-caption text-success">
              <Check className="h-3.5 w-3.5" /> Saved
            </span>
          )}
          <Button type="submit" variant="flame" loading={saving} disabled={saving || !name.trim()} className="h-[43px]">
            {saving ? 'Saving…' : 'Save changes'}
          </Button>
        </div>
      )}

      {error && (
        <p role="alert" className="border border-accent bg-accent-subtle px-4 py-3 text-body text-accent-strong">
          {error}
        </p>
      )}

      <div className="grid items-start gap-4 lg:grid-cols-[minmax(0,590fr)_minmax(0,350fr)]">
        <div className="flex min-w-0 flex-col gap-4">
          <Panel>
            <PanelHeader title="Brand" subtitle="Shown on your products in the app" />
            <div className="mt-5 grid gap-4 sm:grid-cols-2">
              <Field label="Brand name *" htmlFor="acc-name">
                <Input id="acc-name" required value={name} onChange={(e) => set(setName)(e.target.value)} />
              </Field>
              <Field label="Webshop" htmlFor="acc-website">
                <Input id="acc-website" type="url" value={website} onChange={(e) => set(setWebsite)(e.target.value)} placeholder="https://yourbrand.com" />
              </Field>
              <Field
                label="Return policy link"
                htmlFor="acc-returns"
                hint={accountTablesReady ? 'Customers see this when they ask to return an item.' : 'Available once the database update for accounts is applied.'}
              >
                <Input
                  id="acc-returns"
                  type="url"
                  value={returnPolicyUrl}
                  disabled={!accountTablesReady}
                  onChange={(e) => set(setReturnPolicyUrl)(e.target.value)}
                  placeholder="https://yourbrand.com/returns"
                />
              </Field>
              <Field label="Order emails go to" htmlFor="acc-email" hint="Your login email. New orders are sent here.">
                <Input id="acc-email" value={profile?.email ?? user?.email ?? ''} readOnly disabled />
              </Field>
              <Field label="About the brand" htmlFor="acc-description" className="sm:col-span-2">
                <Textarea
                  id="acc-description"
                  rows={3}
                  value={description}
                  onChange={(e) => set(setDescription)(e.target.value)}
                  placeholder="A few lines about your brand"
                />
              </Field>
              <div className="flex flex-col gap-1.5 sm:col-span-2">
                <span className="text-label uppercase text-smoke">Logo</span>
                <ImageUpload bucket="brand-assets" folder="logos" value={logo} onChange={set(setLogo)} max={1} label="Upload logo" appearance="flaym" />
              </div>
            </div>
          </Panel>

          <Panel>
            <PanelHeader title="Payouts" subtitle="Paid monthly after settlement" />
            <div className="mt-5 grid gap-4 sm:grid-cols-3">
              <Field label="Reg. no." htmlFor="acc-reg">
                <Input id="acc-reg" inputMode="numeric" value={regNo} disabled={!accountTablesReady} onChange={(e) => set(setRegNo)(e.target.value)} />
              </Field>
              <Field label="Account no." htmlFor="acc-account">
                <Input
                  id="acc-account"
                  inputMode="numeric"
                  value={editingAccount ? accountNo : maskedAccount}
                  disabled={!accountTablesReady}
                  onFocus={() => setEditingAccount(true)}
                  onBlur={() => setEditingAccount(false)}
                  onChange={(e) => editingAccount && set(setAccountNo)(e.target.value)}
                />
              </Field>
              <Field label="CVR" htmlFor="acc-cvr">
                <Input id="acc-cvr" inputMode="numeric" value={cvr} disabled={!accountTablesReady} onChange={(e) => set(setCvr)(e.target.value)} />
              </Field>
            </div>

            <div className="mt-5 bg-canvas-dark p-4">
              <p className="text-label uppercase text-smoke">How a sale is split</p>
              <div className="mt-3 flex h-[34px] gap-1 text-caption font-medium" role="img" aria-label={`Your share ${100 - STORE_CUT_PERCENT}%, store's cut ${STORE_CUT_PERCENT}%`}>
                <span className="flex items-center justify-center bg-flaym-tile text-flare" style={{ flexGrow: 100 - STORE_CUT_PERCENT, flexBasis: 0 }}>
                  Your share {100 - STORE_CUT_PERCENT}%
                </span>
                <span className="flex min-w-[118px] items-center justify-center bg-primary text-on-primary" style={{ flexGrow: STORE_CUT_PERCENT, flexBasis: 0 }}>
                  Store&apos;s cut {STORE_CUT_PERCENT}%
                </span>
              </div>
              <p className="mt-3 text-caption text-smoke">
                On a sale credited to a store. Every store sale uses {STORE_CUT_PERCENT}% today. A sale passed on by a friend is all yours: the friend earns
                Cirkle Points. There is no Flaym fee.
              </p>
            </div>

            <p className="mt-4 text-caption text-smoke">
              {accountTablesReady
                ? "Flaym pays out your share monthly after settlement, minus the store's cut. Only you can see these details."
                : 'Payout details can be saved once the database update for accounts is applied.'}
            </p>
          </Panel>
        </div>

        <div className="min-w-0">{brandId && <BrandStories brandId={brandId} />}</div>
      </div>
    </form>
  );
}
