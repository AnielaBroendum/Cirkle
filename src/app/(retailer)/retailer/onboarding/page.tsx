'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/components/providers/auth-provider';
import { createClient } from '@/lib/supabase';
import { ImageUpload } from '@/components/brand/image-upload';
import { Check } from 'lucide-react';

const STORE_TYPES = [
  { value: 'boutique', label: 'Boutique' },
  { value: 'cafe', label: 'Café' },
  { value: 'museum', label: 'Museum' },
  { value: 'flower_shop', label: 'Blomsterbutik' },
  { value: 'salon', label: 'Salon' },
  { value: 'gallery', label: 'Galleri' },
  { value: 'other', label: 'Andet' },
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
    <div className="min-h-screen flex items-center justify-center px-4 py-12">
      <div className="w-full max-w-lg space-y-8">
        <div className="text-center">
          <h1 className="text-3xl font-bold text-cirkle-950">Cirkle</h1>
          <p className="mt-2 text-gray-500">Set din butik op</p>
        </div>

        <div className="h-1.5 rounded-full bg-cirkle-500" />

        <form onSubmit={handleSubmit} className="space-y-5">
          <h2 className="text-xl font-semibold text-gray-900">Butiksprofil</h2>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Butiksnavn *
            </label>
            <input
              type="text"
              required
              value={storeName}
              onChange={(e) => setStoreName(e.target.value)}
              className="w-full rounded-lg border border-gray-300 px-4 py-3 text-gray-900 focus:border-cirkle-500 focus:ring-cirkle-500 focus:outline-none"
              placeholder="Min Butik"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Beskrivelse
            </label>
            <textarea
              rows={3}
              value={storeDescription}
              onChange={(e) => setStoreDescription(e.target.value)}
              className="w-full rounded-lg border border-gray-300 px-4 py-3 text-gray-900 focus:border-cirkle-500 focus:ring-cirkle-500 focus:outline-none resize-none"
              placeholder="Fortæl om din butik"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Butikstype
            </label>
            <select
              value={storeType}
              onChange={(e) => setStoreType(e.target.value)}
              className="w-full rounded-lg border border-gray-300 px-4 py-3 text-gray-900 focus:border-cirkle-500 focus:ring-cirkle-500 focus:outline-none bg-white"
            >
              <option value="">Vælg type</option>
              {STORE_TYPES.map((t) => (
                <option key={t.value} value={t.value}>
                  {t.label}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Adresse
            </label>
            <input
              type="text"
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              className="w-full rounded-lg border border-gray-300 px-4 py-3 text-gray-900 focus:border-cirkle-500 focus:ring-cirkle-500 focus:outline-none"
              placeholder="Gadegade 12"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                By
              </label>
              <input
                type="text"
                value={city}
                onChange={(e) => setCity(e.target.value)}
                className="w-full rounded-lg border border-gray-300 px-4 py-3 text-gray-900 focus:border-cirkle-500 focus:ring-cirkle-500 focus:outline-none"
                placeholder="København"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Postnummer
              </label>
              <input
                type="text"
                value={postalCode}
                onChange={(e) => setPostalCode(e.target.value)}
                className="w-full rounded-lg border border-gray-300 px-4 py-3 text-gray-900 focus:border-cirkle-500 focus:ring-cirkle-500 focus:outline-none"
                placeholder="2100"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Logo</label>
            <ImageUpload
              bucket="brand-assets"
              folder="retailer-logos"
              value={logo}
              onChange={setLogo}
              max={1}
              label="Upload logo"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Butiksbilleder
            </label>
            <ImageUpload
              bucket="brand-assets"
              folder="retailer-photos"
              value={photos}
              onChange={setPhotos}
              max={5}
              label="Upload billeder"
            />
          </div>

          {error && (
            <p className="text-sm text-red-600 bg-red-50 rounded-lg px-4 py-3">{error}</p>
          )}

          <button
            type="submit"
            disabled={loading || !storeName.trim()}
            className="w-full flex items-center justify-center gap-2 rounded-lg bg-cirkle-600 px-4 py-3 text-white font-medium hover:bg-cirkle-700 transition disabled:opacity-50"
          >
            {loading ? 'Gemmer...' : 'Fuldfør opsætning'}
            {!loading && <Check className="h-4 w-4" />}
          </button>
        </form>
      </div>
    </div>
  );
}
