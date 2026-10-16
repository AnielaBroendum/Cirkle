'use client';

import { useEffect, useState } from 'react';
import { useAuth } from '@/components/providers/auth-provider';
import { createClient } from '@/lib/supabase';
import { ImageUpload } from '@/components/brand/image-upload';
import { Store } from 'lucide-react';
import type { Database } from '@/lib/database.types';
import { Button, Card, EmptyState, Field, Input, Select, Skeleton, Textarea } from '@/components/ds';

type RetailerProfile = Database['public']['Tables']['retailer_profiles']['Row'];
type PayoutDetails = Database['public']['Tables']['retailer_payout_details']['Row'];

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

type BrandInStore = { id: string; name: string; products: number; since: string };

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

  const [brands, setBrands] = useState<BrandInStore[]>([]);

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

      const [payoutRes, partnershipRes, samplesRes] = await Promise.all([
        supabase.from('retailer_payout_details').select('*').eq('retailer_id', rp.id).maybeSingle(),
        supabase
          .from('brand_retailer_partnerships')
          .select('brand_id, accepted_at, created_at')
          .eq('retailer_id', rp.id)
          .eq('status', 'active'),
        supabase.from('samples').select('brand_id').eq('retailer_id', rp.id).eq('status', 'active'),
      ]);

      const payout = payoutRes.data as PayoutDetails | null;
      if (payout) {
        setRegNo(payout.reg_no ?? '');
        setAccountNo(payout.account_no ?? '');
        setCvr(payout.cvr ?? '');
      }

      const partnerships = (partnershipRes.data ?? []) as { brand_id: string; accepted_at: string | null; created_at: string }[];
      if (partnerships.length > 0) {
        const productCounts = new Map<string, number>();
        for (const s of (samplesRes.data ?? []) as { brand_id: string }[]) {
          productCounts.set(s.brand_id, (productCounts.get(s.brand_id) ?? 0) + 1);
        }
        const { data: brandRows } = await supabase
          .from('brand_profiles')
          .select('id, name')
          .in('id', partnerships.map((p) => p.brand_id));
        const names = new Map(((brandRows ?? []) as { id: string; name: string }[]).map((b) => [b.id, b.name]));
        setBrands(
          partnerships.map((p) => ({
            id: p.brand_id,
            name: names.get(p.brand_id) ?? 'Unknown brand',
            products: productCounts.get(p.brand_id) ?? 0,
            since: p.accepted_at ?? p.created_at,
          }))
        );
      }

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
      <div className="space-y-7">
        <div className="space-y-2">
          <Skeleton className="h-10 w-64" />
          <Skeleton className="h-4 w-80 max-w-full" />
        </div>
        <div className="grid gap-4 lg:grid-cols-[561fr_511fr]">
          <Skeleton className="h-[504px]" />
          <div className="space-y-4">
            <Skeleton className="h-[268px]" />
            <Skeleton className="h-[212px]" />
          </div>
        </div>
      </div>
    );
  }

  return (
    <form onSubmit={handleSave} className="space-y-7">
      {/* Header (Figma 04) */}
      <div className="flex items-end justify-between gap-4">
        <div className="min-w-0">
          <h1 className="font-brand text-heading-xl uppercase text-primary">Store profile</h1>
          <p className="mt-1 text-body text-muted">Shown to people who scan in your store</p>
        </div>
        <div className="flex shrink-0 items-center gap-3">
          {saved && <span className="text-caption text-success">Saved</span>}
          <Button type="submit" loading={saving} disabled={saving || !storeName.trim()}>
            Save
          </Button>
        </div>
      </div>

      {error && <p className="border border-accent bg-accent-subtle px-4 py-3 text-body text-accent-strong">{error}</p>}

      <div className="grid items-start gap-4 lg:grid-cols-[561fr_511fr]">
        {/* Store */}
        <Card padding="none" className="space-y-4 p-5 lg:p-6">
          <SectionTitle>Store</SectionTitle>
          <Field label="Store name *" htmlFor="store-name">
            <Input id="store-name" required value={storeName} onChange={(e) => setStoreName(e.target.value)} placeholder="My Store" />
          </Field>
          <Field label="Address" htmlFor="address">
            <Input id="address" value={address} onChange={(e) => setAddress(e.target.value)} placeholder="123 Main Street" />
          </Field>
          <div className="grid grid-cols-[2fr_1fr] gap-3">
            <Field label="City" htmlFor="city">
              <Input id="city" value={city} onChange={(e) => setCity(e.target.value)} placeholder="Copenhagen" />
            </Field>
            <Field label="Postal code" htmlFor="postal">
              <Input id="postal" value={postalCode} onChange={(e) => setPostalCode(e.target.value)} placeholder="2100" />
            </Field>
          </div>
          <Field label="Opening hours" htmlFor="hours">
            <Textarea
              id="hours"
              rows={2}
              className="min-h-[72px]"
              value={openingHours}
              onChange={(e) => setOpeningHours(e.target.value)}
              placeholder="Mon–Fri 11–18 · Sat 10–16"
            />
          </Field>
          <div className="grid gap-3 sm:grid-cols-2">
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
          </div>
          <Field label="Description" htmlFor="description">
            <Textarea
              id="description"
              rows={3}
              value={storeDescription}
              onChange={(e) => setStoreDescription(e.target.value)}
              placeholder="Tell us about your store"
            />
          </Field>
          <Field label="Cover image" hint="The first photo is your cover. Up to 5.">
            <ImageUpload bucket="brand-assets" folder="retailer-photos" value={photos} onChange={setPhotos} max={5} label="Upload" />
          </Field>
          <Field label="Logo">
            <ImageUpload bucket="brand-assets" folder="retailer-logos" value={logo} onChange={setLogo} max={1} label="Upload logo" />
          </Field>
        </Card>

        <div className="space-y-4">
          {/* Payouts */}
          <Card padding="none" className="space-y-4 p-5 lg:p-6">
            <SectionTitle>Payouts</SectionTitle>
            <div className="grid grid-cols-[1fr_2fr] gap-3">
              <Field label="Reg. no." htmlFor="reg-no">
                <Input id="reg-no" inputMode="numeric" autoComplete="off" value={regNo} onChange={(e) => setRegNo(e.target.value)} />
              </Field>
              <Field label="Account no." htmlFor="account-no">
                <Input id="account-no" inputMode="numeric" autoComplete="off" value={accountNo} onChange={(e) => setAccountNo(e.target.value)} />
              </Field>
            </div>
            <Field label="CVR" htmlFor="cvr">
              <Input id="cvr" inputMode="numeric" autoComplete="off" value={cvr} onChange={(e) => setCvr(e.target.value)} />
            </Field>
            <p className="text-caption text-muted">Flaym pays your cut monthly, after settlement with each brand. Only you can see these details.</p>
          </Card>

          {/* Brands in your store */}
          <Card padding="none" className="p-5 lg:p-6">
            <SectionTitle>Brands in your store</SectionTitle>
            {brands.length === 0 ? (
              <EmptyState
                className="mt-3 border-none py-6"
                icon={<Store className="h-5 w-5" />}
                title="No brands yet"
                description="Brands you partner with show up here."
              />
            ) : (
              <ul className="mt-3 space-y-3">
                {brands.map((b) => (
                  <li key={b.id}>
                    <p className="text-body text-primary">{b.name}</p>
                    <p className="mt-0.5 text-caption text-muted">
                      {b.products} {b.products === 1 ? 'product' : 'products'} · since{' '}
                      {new Date(b.since).toLocaleDateString('en-GB', { month: 'short', year: 'numeric' })}
                    </p>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </div>
      </div>
    </form>
  );
}

// Figma card title: 14px uppercase.
function SectionTitle({ children }: { children: React.ReactNode }) {
  return <h2 className="font-brand text-body uppercase tracking-[0.3px] text-primary">{children}</h2>;
}
