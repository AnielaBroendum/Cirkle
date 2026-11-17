'use client';

import { useEffect, useState } from 'react';
import { Check, ExternalLink } from 'lucide-react';
import { useAuth } from '@/components/providers/auth-provider';
import { createClient } from '@/lib/supabase';
import { formatDKK } from '@/lib/utils';
import { ImageUpload } from '@/components/brand/image-upload';
import type { Database } from '@/lib/database.types';
import { Button, Field, Input, PageHeader, Panel, PanelHeader, Select, Skeleton, Textarea, Thumb } from '@/components/ds';

/*
 * Store profile, Portals v2 (Figma "Retail Portal v2 / 04 Store profile", 368:822).
 * Save logic unchanged: retailer_profiles + retailer_payout_details. Numbers from
 * get_retailer_profile_stats (025): earned since joining, brands and their share of this
 * month's scans in the store. City, postal code, store type, description and logo aren't in
 * Figma but are still saved, so they sit under "More details". Left out: the Verified badge
 * (no verification state).
 */

type RetailerProfile = Database['public']['Tables']['retailer_profiles']['Row'];
type PayoutDetails = Database['public']['Tables']['retailer_payout_details']['Row'];
type Stats = NonNullable<Database['public']['Functions']['get_retailer_profile_stats']['Returns']>;

// Same options as onboarding.
const STORE_TYPES = [
  { value: 'boutique', label: 'Boutique' },
  { value: 'cafe', label: 'Café' },
  { value: 'museum', label: 'Museum' },
  { value: 'flower_shop', label: 'Flower shop' },
  { value: 'salon', label: 'Salon' },
  { value: 'gallery', label: 'Gallery' },
  { value: 'other', label: 'Other' },
];

/** Whole kroner, e.g. "16.680 kr". */
const kr = (ore: number) => formatDKK(Math.round(ore / 100) * 100);
const monthYear = (iso: string) => new Date(iso).toLocaleDateString('en-GB', { month: 'short', year: 'numeric' });

export default function RetailerProfilePage() {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [saved, setSaved] = useState(false);
  const [retailerId, setRetailerId] = useState<string | null>(null);

  const [storeName, setStoreName] = useState('');
  const [storeDescription, setStoreDescription] = useState('');
  const [storeType, setStoreType] = useState('');
  const [address, setAddress] = useState('');
  const [city, setCity] = useState('');
  const [postalCode, setPostalCode] = useState('');
  const [openingHours, setOpeningHours] = useState('');
  const [logo, setLogo] = useState<string[]>([]);
  const [photos, setPhotos] = useState<string[]>([]);

  const [regNo, setRegNo] = useState('');
  const [accountNo, setAccountNo] = useState('');
  const [cvr, setCvr] = useState('');
  const [editingAccount, setEditingAccount] = useState(false);

  const [stats, setStats] = useState<Stats | null>(null);

  useEffect(() => {
    if (!user) return;
    const supabase = createClient();

    (async () => {
      const { data } = await supabase.from('retailer_profiles').select('*').eq('user_id', user.id).single();
      const rp = data as RetailerProfile | null;
      if (!rp) {
        setLoading(false);
        return;
      }

      setRetailerId(rp.id);
      setStoreName(rp.name ?? '');
      setStoreDescription(rp.description ?? '');
      setStoreType(rp.store_type ?? '');
      setAddress(rp.address ?? '');
      setCity(rp.city ?? '');
      setPostalCode(rp.postal_code ?? '');
      setOpeningHours(rp.opening_hours ?? '');
      setLogo(rp.logo_url ? [rp.logo_url] : []);
      setPhotos(rp.store_photos ?? []);

      const [payoutRes, statsRes] = await Promise.all([
        supabase.from('retailer_payout_details').select('*').eq('retailer_id', rp.id).maybeSingle(),
        supabase.rpc('get_retailer_profile_stats'),
      ]);

      const payout = payoutRes.data as PayoutDetails | null;
      if (payout) {
        setRegNo(payout.reg_no ?? '');
        setAccountNo(payout.account_no ?? '');
        setCvr(payout.cvr ?? '');
      }
      setStats((statsRes.data as Stats | null) ?? null);

      setLoading(false);
    })();
  }, [user]);

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    if (!retailerId || !storeName.trim()) return;

    setError('');
    setSaved(false);
    setSaving(true);
    const supabase = createClient();

    const { error: profileError } = await supabase
      .from('retailer_profiles')
      .update({
        name: storeName.trim(),
        description: storeDescription.trim() || null,
        store_type: storeType || null,
        address: address.trim() || null,
        city: city.trim() || null,
        postal_code: postalCode.trim() || null,
        opening_hours: openingHours.trim() || null,
        logo_url: logo[0] || null,
        store_photos: photos,
      })
      .eq('id', retailerId);

    const { error: payoutError } = profileError
      ? { error: null }
      : await supabase.from('retailer_payout_details').upsert({
          retailer_id: retailerId,
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
  if (loading) {
    return (
      <div className="space-y-6">
        <div className="space-y-2">
          <Skeleton className="h-4 w-40" />
          <Skeleton className="h-10 w-64" />
        </div>
        <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_390px]">
          <Skeleton className="h-[504px]" />
          <div className="space-y-4">
            <Skeleton className="h-[134px]" />
            <Skeleton className="h-[268px]" />
          </div>
        </div>
      </div>
    );
  }

  // "•••• 7719" until the field is focused.
  const maskedAccount = accountNo.length > 4 ? `•••• ${accountNo.slice(-4)}` : accountNo;
  const brandCount = stats?.brand_count ?? 0;

  return (
    <form onSubmit={handleSave} className="space-y-6">
      <PageHeader
        title="Store profile"
        subtitle="Shown to people who scan in your store."
        actions={
          <div className="flex items-center gap-3">
            {saved && (
              <span role="status" className="inline-flex items-center gap-1.5 text-caption text-success">
                <Check className="h-3.5 w-3.5" /> Saved
              </span>
            )}
            <Button type="submit" variant="flame" loading={saving} disabled={saving || !storeName.trim()} className="h-[43px]">
              {saving ? 'Saving…' : 'Save changes'}
            </Button>
          </div>
        }
      />

      {error && (
        <p role="alert" className="border border-accent bg-accent-subtle px-4 py-3 text-body text-accent-strong">
          {error}
        </p>
      )}

      <div className="grid items-start gap-4 xl:grid-cols-[minmax(0,1fr)_390px]">
        <div className="flex min-w-0 flex-col gap-4">
          {/* Store */}
          <Panel className="flex flex-col gap-5">
            <PanelHeader
              title="Store"
              subtitle="Name, address and opening hours"
              action={
                stats?.preview_sample && (
                  <a
                    href={`/p/${stats.preview_sample}`}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex h-9 items-center gap-2 border border-line-dark-subtle px-3.5 text-caption font-medium text-flare transition-colors hover:border-flare/30"
                  >
                    Preview in app <ExternalLink className="h-3.5 w-3.5" />
                  </a>
                )
              }
            />
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Store name *" htmlFor="store-name">
                <Input id="store-name" required value={storeName} onChange={(e) => setStoreName(e.target.value)} placeholder="My Store" />
              </Field>
              <Field label="Opening hours" htmlFor="hours">
                <Input id="hours" value={openingHours} onChange={(e) => setOpeningHours(e.target.value)} placeholder="Mon–Fri 11–18 · Sat 10–16" />
              </Field>
              <Field label="Address" htmlFor="address" className="sm:col-span-2">
                <Input id="address" value={address} onChange={(e) => setAddress(e.target.value)} placeholder="Jægersborggade 21" />
              </Field>
              <Field label="Cover image" hint="The first photo is your cover. Up to 5." className="sm:col-span-2">
                <ImageUpload bucket="brand-assets" folder="retailer-photos" value={photos} onChange={setPhotos} max={5} label="Upload new" appearance="flaym" cover />
              </Field>
            </div>

            <details className="group border-t border-line-dark-subtle pt-4">
              <summary className="cursor-pointer list-none text-caption font-medium text-ash hover:text-flare">
                <span className="group-open:hidden">+ More details</span>
                <span className="hidden group-open:inline">− Fewer details</span>
                <span className="ml-2 text-smoke">City, postal code, store type, description, logo</span>
              </summary>
              <div className="mt-4 grid gap-4 sm:grid-cols-2">
                <Field label="City" htmlFor="city">
                  <Input id="city" value={city} onChange={(e) => setCity(e.target.value)} placeholder="Copenhagen" />
                </Field>
                <Field label="Postal code" htmlFor="postal">
                  <Input id="postal" value={postalCode} onChange={(e) => setPostalCode(e.target.value)} placeholder="2200" />
                </Field>
                <Field label="Store type" htmlFor="store-type">
                  <Select id="store-type" value={storeType} onChange={(e) => setStoreType(e.target.value)}>
                    <option value="">Select type</option>
                    {STORE_TYPES.map((t) => (
                      <option key={t.value} value={t.value}>
                        {t.label}
                      </option>
                    ))}
                  </Select>
                </Field>
                <Field label="Description" htmlFor="description" className="sm:col-span-2">
                  <Textarea id="description" rows={3} value={storeDescription} onChange={(e) => setStoreDescription(e.target.value)} placeholder="Tell us about your store" />
                </Field>
                <Field label="Logo">
                  <ImageUpload bucket="brand-assets" folder="retailer-logos" value={logo} onChange={setLogo} max={1} label="Upload logo" appearance="flaym" />
                </Field>
              </div>
            </details>
          </Panel>

          {/* Payouts */}
          <Panel className="flex flex-col gap-5">
            <PanelHeader title="Payouts" subtitle="Your cut, paid monthly after settlement with each brand" />
            <div className="grid gap-4 sm:grid-cols-3">
              <Field label="Reg. no." htmlFor="reg-no">
                <Input id="reg-no" inputMode="numeric" autoComplete="off" value={regNo} onChange={(e) => setRegNo(e.target.value)} />
              </Field>
              <Field label="Account no." htmlFor="account-no">
                <Input
                  id="account-no"
                  inputMode="numeric"
                  autoComplete="off"
                  value={editingAccount ? accountNo : maskedAccount}
                  onFocus={() => setEditingAccount(true)}
                  onBlur={() => setEditingAccount(false)}
                  onChange={(e) => editingAccount && setAccountNo(e.target.value)}
                />
              </Field>
              <Field label="CVR" htmlFor="cvr">
                <Input id="cvr" inputMode="numeric" autoComplete="off" value={cvr} onChange={(e) => setCvr(e.target.value)} />
              </Field>
            </div>
            <p className="text-caption text-smoke">Only you can see these details.</p>
          </Panel>
        </div>

        <div className="grid min-w-0 items-start gap-4 md:grid-cols-2 xl:flex xl:flex-col">
          {/* Earned since joining */}
          <section className="flex flex-col gap-2 bg-flame-gradient p-[22px] font-brand text-flare" aria-labelledby="earned-title">
            <h2 id="earned-title" className="text-body-sm font-medium">
              Earned since joining
            </h2>
            <p className="text-display font-medium tabular-nums tracking-[-0.76px]">{kr(stats?.earned_total ?? 0)}</p>
            <p className="text-caption">
              From {brandCount} {brandCount === 1 ? 'brand' : 'brands'}
              {stats?.since ? ` · since ${monthYear(stats.since)}` : ''}
            </p>
          </section>

          {/* Brands in your store */}
          <Panel className="flex flex-col gap-4">
            <PanelHeader title="Brands in your store" subtitle="Placed by the brands themselves" />
            {!stats || stats.brands.length === 0 ? (
              <p className="text-caption text-smoke">Brands you partner with show up here.</p>
            ) : (
              <ul className="flex flex-col gap-4">
                {stats.brands.map((b) => (
                  <li key={b.id}>
                    <div className="flex items-center gap-3">
                      <Thumb src={b.logo_url} size={36} />
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-body-sm font-semibold text-flare">{b.name}</p>
                        <p className="truncate text-caption text-smoke">
                          {b.products} {b.products === 1 ? 'product' : 'products'} · since {monthYear(b.since)}
                        </p>
                      </div>
                      <span className="text-caption font-medium tabular-nums text-flare">{b.share === null ? '–' : `${b.share}%`}</span>
                    </div>
                    <div className="mt-2 h-1 bg-surface-dark">
                      <div className="h-1 bg-flaym-progress" style={{ width: `${b.share ?? 0}%` }} />
                    </div>
                  </li>
                ))}
              </ul>
            )}
            <p className="text-caption text-smoke">
              Share of scans in your store this month
              {stats ? ` (${stats.scans_month.toLocaleString('en-GB')} ${stats.scans_month === 1 ? 'scan' : 'scans'})` : ''}
            </p>
          </Panel>
        </div>
      </div>
    </form>
  );
}
