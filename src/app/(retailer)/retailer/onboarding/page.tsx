'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/components/providers/auth-provider';
import { createClient } from '@/lib/supabase';
import { ImageUpload } from '@/components/brand/image-upload';
import { Check } from 'lucide-react';
import { Button, Field, Input, Logo, Select, Textarea } from '@/components/ds';

const STORE_TYPES = [
  { value: 'boutique', label: 'Boutique' },
  { value: 'cafe', label: 'Café' },
  { value: 'museum', label: 'Museum' },
  { value: 'flower_shop', label: 'Flower shop' },
  { value: 'salon', label: 'Salon' },
  { value: 'gallery', label: 'Gallery' },
  { value: 'other', label: 'Other' },
];

export default function RetailerOnboardingPage() {
  const router = useRouter();
  const { user } = useAuth();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const [storeName, setStoreName] = useState('');
  const [storeDescription, setStoreDescription] = useState('');
  const [storeType, setStoreType] = useState('');
  const [address, setAddress] = useState('');
  const [city, setCity] = useState('');
  const [postalCode, setPostalCode] = useState('');
  const [logo, setLogo] = useState<string[]>([]);
  const [photos, setPhotos] = useState<string[]>([]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!user || !storeName.trim()) return;

    setError('');
    setLoading(true);

    const supabase = createClient();

    const { data: existing } = await supabase
      .from('retailer_profiles')
      .select('id')
      .eq('user_id', user.id)
      .single();

    const profileData = {
      name: storeName.trim(),
      description: storeDescription.trim() || null,
      store_type: storeType || null,
      address: address.trim() || null,
      city: city.trim() || null,
      postal_code: postalCode.trim() || null,
      logo_url: logo[0] || null,
      store_photos: photos,
      onboarding_complete: true,
    };

    let err;
    if (existing) {
      const result = await supabase
        .from('retailer_profiles')
        .update(profileData)
        .eq('id', (existing as { id: string }).id);
      err = result.error;
    } else {
      const result = await supabase
        .from('retailer_profiles')
        .insert({ user_id: user.id, ...profileData });
      err = result.error;
    }

    if (err) {
      setError(err.message);
      setLoading(false);
      return;
    }

    router.replace('/retailer/dashboard');
  }

  return (
    <div className="flex min-h-screen flex-col bg-surface font-brand lg:flex-row">
      {/* Art panel (Figma Retail Portal 01) */}
      <div className="flex h-40 shrink-0 flex-col items-center justify-center gap-2 bg-flaym-gradient lg:sticky lg:top-0 lg:h-screen lg:w-1/2 lg:gap-5">
        <Logo height={40} className="lg:hidden" />
        <Logo height={106} className="hidden lg:inline-block" />
        <p className="text-caption italic tracking-[4px] text-on-primary lg:text-body">FORWARD</p>
      </div>

      {/* Form */}
      <div className="flex flex-1 justify-center px-4 py-10 sm:px-8 lg:items-center lg:py-16">
        <form onSubmit={handleSubmit} className="w-full max-w-[440px] space-y-5">
          <div>
            <p className="text-label uppercase text-muted">Retail Portal</p>
            <h1 className="mt-4 font-brand text-display uppercase text-primary">Set up your store</h1>
            <p className="mt-3 text-body leading-[1.6] text-muted">
              This is what people see when they scan a product in your store.
            </p>
          </div>

          <Field label="Store name *" htmlFor="store-name">
            <Input
              id="store-name"
              type="text"
              required
              value={storeName}
              onChange={(e) => setStoreName(e.target.value)}
              placeholder="My Store"
            />
          </Field>

          <Field label="Description" htmlFor="description">
            <Textarea
              id="description"
              rows={3}
              value={storeDescription}
              onChange={(e) => setStoreDescription(e.target.value)}
              className="resize-none"
              placeholder="Tell us about your store"
            />
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

          <Field label="Address" htmlFor="address">
            <Input id="address" type="text" value={address} onChange={(e) => setAddress(e.target.value)} placeholder="123 Main Street" />
          </Field>

          <div className="grid grid-cols-[2fr_1fr] gap-3">
            <Field label="City" htmlFor="city">
              <Input id="city" type="text" value={city} onChange={(e) => setCity(e.target.value)} placeholder="Copenhagen" />
            </Field>
            <Field label="Postal code" htmlFor="postal">
              <Input id="postal" type="text" value={postalCode} onChange={(e) => setPostalCode(e.target.value)} placeholder="2100" />
            </Field>
          </div>

          <Field label="Logo">
            <ImageUpload bucket="brand-assets" folder="retailer-logos" value={logo} onChange={setLogo} max={1} label="Upload logo" />
          </Field>

          <Field label="Store photos" hint="The first photo is your cover. Up to 5.">
            <ImageUpload bucket="brand-assets" folder="retailer-photos" value={photos} onChange={setPhotos} max={5} label="Upload photos" />
          </Field>

          {error && <p className="border border-accent bg-accent-subtle px-4 py-3 text-body text-accent-strong">{error}</p>}

          <Button
            type="submit"
            size="lg"
            fullWidth
            loading={loading}
            disabled={loading || !storeName.trim()}
            rightIcon={<Check className="h-4 w-4" />}
          >
            {loading ? 'Saving…' : 'Complete setup'}
          </Button>
        </form>
      </div>
    </div>
  );
}
