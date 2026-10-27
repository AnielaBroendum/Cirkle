'use client';

import { useEffect, useState } from 'react';
import { Check } from 'lucide-react';
import { useAuth } from '@/components/providers/auth-provider';
import { createClient } from '@/lib/supabase';
import { ImageUpload } from '@/components/brand/image-upload';
import { Button, Card, Field, Input, Skeleton, Textarea } from '@/components/ds';
import type { Database } from '@/lib/database.types';

// Figma "Brand Portal / 08 Account and payouts". Brand details live on
// brand_profiles; payout details in brand_payout_details (owner-only RLS,
// migration 007). Order emails go to the account email (profiles.email).

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
    <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
      <div>
        <h1 className="font-brand text-heading-xl uppercase text-primary">Account</h1>
        <p className="mt-1 text-body text-slate">Brand profile and payout details</p>
      </div>
      {action}
    </div>
  );

  if (loading) {
    return (
      <div className="space-y-6">
        {header()}
        <div className="grid gap-4 lg:grid-cols-[561fr_511fr] lg:gap-5">
          <Skeleton className="h-[420px] w-full" />
          <Skeleton className="h-[280px] w-full" />
        </div>
      </div>
    );
  }

  return (
    <form onSubmit={handleSave} className="space-y-6">
      {header(
        <div className="flex items-center gap-3 self-start sm:self-auto">
          {saved && (
            <span role="status" className="inline-flex items-center gap-1.5 text-caption text-success">
              <Check className="h-3.5 w-3.5" /> Saved
            </span>
          )}
          <Button type="submit" loading={saving} disabled={saving || !name.trim()}>
            {saving ? 'Saving…' : 'Save'}
          </Button>
        </div>
      )}

      {error && (
        <p role="alert" className="border border-accent bg-accent-subtle px-4 py-3 text-body text-accent-strong">
          {error}
        </p>
      )}

      <div className="grid items-start gap-4 lg:grid-cols-[561fr_511fr] lg:gap-5">
        <Card padding="none" className="space-y-4 rounded-none p-5 lg:p-6">
          <h2 className="font-brand text-body uppercase tracking-[0.3px] text-primary">Brand</h2>
          <Field label="Brand name *" htmlFor="acc-name">
            <Input id="acc-name" required value={name} onChange={(e) => { setName(e.target.value); setSaved(false); }} />
          </Field>
          <Field label="Webshop" htmlFor="acc-website">
            <Input
              id="acc-website"
              type="url"
              value={website}
              onChange={(e) => { setWebsite(e.target.value); setSaved(false); }}
              placeholder="https://yourbrand.com"
            />
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
              onChange={(e) => { setReturnPolicyUrl(e.target.value); setSaved(false); }}
              placeholder="https://yourbrand.com/returns"
            />
          </Field>
          <Field label="Order emails go to" htmlFor="acc-email" hint="Your login email. New orders are sent here.">
            <Input id="acc-email" value={profile?.email ?? user?.email ?? ''} readOnly disabled />
          </Field>
          <Field label="About the brand" htmlFor="acc-description">
            <Textarea
              id="acc-description"
              rows={3}
              value={description}
              onChange={(e) => { setDescription(e.target.value); setSaved(false); }}
              placeholder="A few lines about your brand"
            />
          </Field>
          <div className="flex flex-col gap-1.5">
            <span className="text-label uppercase text-slate">Logo</span>
            <ImageUpload
              bucket="brand-assets"
              folder="logos"
              value={logo}
              onChange={(urls) => { setLogo(urls); setSaved(false); }}
              max={1}
              label="Upload logo"
              appearance="flaym"
            />
          </div>
        </Card>

        <Card padding="none" className="space-y-4 rounded-none p-5 lg:p-6">
          <h2 className="font-brand text-body uppercase tracking-[0.3px] text-primary">Payouts</h2>
          <div className="grid grid-cols-[2fr_3fr] gap-3">
            <Field label="Reg. no." htmlFor="acc-reg">
              <Input
                id="acc-reg"
                inputMode="numeric"
                value={regNo}
                disabled={!accountTablesReady}
                onChange={(e) => { setRegNo(e.target.value); setSaved(false); }}
              />
            </Field>
            <Field label="Account no." htmlFor="acc-account">
              <Input
                id="acc-account"
                inputMode="numeric"
                value={accountNo}
                disabled={!accountTablesReady}
                onChange={(e) => { setAccountNo(e.target.value); setSaved(false); }}
              />
            </Field>
          </div>
          <Field label="CVR" htmlFor="acc-cvr">
            <Input
              id="acc-cvr"
              inputMode="numeric"
              value={cvr}
              disabled={!accountTablesReady}
              onChange={(e) => { setCvr(e.target.value); setSaved(false); }}
            />
          </Field>
          <p className="text-caption text-slate">
            {accountTablesReady
              ? "Flaym pays out your share monthly after settlement, minus the store's cut and Flaym's fee. Only you can see these details."
              : 'Payout details can be saved once the database update for accounts is applied.'}
          </p>
        </Card>
      </div>
    </form>
  );
}
