'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/components/providers/auth-provider';
import { createClient } from '@/lib/supabase';
import { ImageUpload } from '@/components/brand/image-upload';
import { parseDKKtoOre } from '@/lib/utils';
import { ArrowRight, ArrowLeft, Check } from 'lucide-react';

export default function BrandOnboardingPage() {
  const router = useRouter();
  const { user } = useAuth();
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const [brandName, setBrandName] = useState('');
  const [brandDescription, setBrandDescription] = useState('');
  const [brandLogo, setBrandLogo] = useState<string[]>([]);
  const [brandWebsite, setBrandWebsite] = useState('');

  const [productName, setProductName] = useState('');
  const [productDescription, setProductDescription] = useState('');
  const [productPriceKr, setProductPriceKr] = useState('');
  const [productImages, setProductImages] = useState<string[]>([]);
  const [productSizes, setProductSizes] = useState('');
  const [productColors, setProductColors] = useState('');
  const [productMaterials, setProductMaterials] = useState('');

  const [brandProfileId, setBrandProfileId] = useState<string | null>(null);

  async function handleStep1() {
    if (!user || !brandName.trim()) return;
    setError('');
    setLoading(true);

    const supabase = createClient();
    const { data, error: insertError } = await supabase
      .from('brand_profiles')
      .insert({
        user_id: user.id,
        name: brandName.trim(),
        description: brandDescription.trim() || null,
        logo_url: brandLogo[0] || null,
        website: brandWebsite.trim() || null,
      })
      .select('id')
      .single();

    if (insertError) {
      setError(insertError.message);
      setLoading(false);
      return;
    }

    setBrandProfileId((data as { id: string }).id);
    setLoading(false);
    setStep(2);
  }

  async function handleStep2() {
    if (!brandProfileId || !productName.trim() || !productPriceKr) return;
    setError('');
    setLoading(true);

    const supabase = createClient();
    const priceOre = parseDKKtoOre(parseFloat(productPriceKr));
    const sizes = productSizes
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);
    const colors = productColors
      .split(',')
      .map((c) => c.trim())
      .filter(Boolean);

    const { error: productError } = await supabase.from('products').insert({
      brand_id: brandProfileId,
      name: productName.trim(),
      description: productDescription.trim() || null,
      price_dkk: priceOre,
      images: productImages,
      sizes,
      colors,
      materials: productMaterials.trim() || null,
    });

    if (productError) {
      setError(productError.message);
      setLoading(false);
      return;
    }

    await supabase
      .from('brand_profiles')
      .update({ onboarding_complete: true })
      .eq('id', brandProfileId);

    router.replace('/brand/dashboard');
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-4 py-12">
      <div className="w-full max-w-lg space-y-8">
        <div className="text-center">
          <h1 className="text-3xl font-bold text-cirkle-950">Cirkle</h1>
          <p className="mt-2 text-gray-500">Set up your brand</p>
        </div>

        {/* Progress */}
        <div className="flex items-center gap-3">
          <div className={`flex-1 h-1.5 rounded-full ${step >= 1 ? 'bg-cirkle-500' : 'bg-gray-200'}`} />
          <div className={`flex-1 h-1.5 rounded-full ${step >= 2 ? 'bg-cirkle-500' : 'bg-gray-200'}`} />
        </div>

        {step === 1 && (
          <form
            onSubmit={(e) => {
              e.preventDefault();
              handleStep1();
            }}
            className="space-y-5"
          >
            <h2 className="text-xl font-semibold text-gray-900">Brand profile</h2>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Brand name *
              </label>
              <input
                type="text"
                required
                value={brandName}
                onChange={(e) => setBrandName(e.target.value)}
                className="w-full rounded-lg border border-gray-300 px-4 py-3 text-gray-900 focus:border-cirkle-500 focus:ring-cirkle-500 focus:outline-none"
                placeholder="Your brand name"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Description
              </label>
              <textarea
                rows={3}
                value={brandDescription}
                onChange={(e) => setBrandDescription(e.target.value)}
                className="w-full rounded-lg border border-gray-300 px-4 py-3 text-gray-900 focus:border-cirkle-500 focus:ring-cirkle-500 focus:outline-none resize-none"
                placeholder="Tell us about your brand"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Logo
              </label>
              <ImageUpload
                bucket="brand-assets"
                folder="logos"
                value={brandLogo}
                onChange={setBrandLogo}
                max={1}
                label="Upload logo"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Website
              </label>
              <input
                type="url"
                value={brandWebsite}
                onChange={(e) => setBrandWebsite(e.target.value)}
                className="w-full rounded-lg border border-gray-300 px-4 py-3 text-gray-900 focus:border-cirkle-500 focus:ring-cirkle-500 focus:outline-none"
                placeholder="https://yourbrand.com"
              />
            </div>

            {error && (
              <p className="text-sm text-red-600 bg-red-50 rounded-lg px-4 py-3">{error}</p>
            )}

            <button
              type="submit"
              disabled={loading || !brandName.trim()}
              className="w-full flex items-center justify-center gap-2 rounded-lg bg-cirkle-600 px-4 py-3 text-white font-medium hover:bg-cirkle-700 transition disabled:opacity-50"
            >
              {loading ? 'Saving...' : 'Next: Upload product'}
              {!loading && <ArrowRight className="h-4 w-4" />}
            </button>
          </form>
        )}

        {step === 2 && (
          <form
            onSubmit={(e) => {
              e.preventDefault();
              handleStep2();
            }}
            className="space-y-5"
          >
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-semibold text-gray-900">Your first product</h2>
              <button
                type="button"
                onClick={() => setStep(1)}
                className="text-sm text-gray-500 hover:text-gray-700 flex items-center gap-1"
              >
                <ArrowLeft className="h-3 w-3" /> Back
              </button>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Product name *
              </label>
              <input
                type="text"
                required
                value={productName}
                onChange={(e) => setProductName(e.target.value)}
                className="w-full rounded-lg border border-gray-300 px-4 py-3 text-gray-900 focus:border-cirkle-500 focus:ring-cirkle-500 focus:outline-none"
                placeholder="e.g. Classic T-Shirt"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Description
              </label>
              <textarea
                rows={3}
                value={productDescription}
                onChange={(e) => setProductDescription(e.target.value)}
                className="w-full rounded-lg border border-gray-300 px-4 py-3 text-gray-900 focus:border-cirkle-500 focus:ring-cirkle-500 focus:outline-none resize-none"
                placeholder="Describe the product"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Price (kr) *
              </label>
              <input
                type="number"
                required
                min="1"
                step="0.01"
                value={productPriceKr}
                onChange={(e) => setProductPriceKr(e.target.value)}
                className="w-full rounded-lg border border-gray-300 px-4 py-3 text-gray-900 focus:border-cirkle-500 focus:ring-cirkle-500 focus:outline-none"
                placeholder="299"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Product images
              </label>
              <ImageUpload
                bucket="brand-assets"
                folder="products"
                value={productImages}
                onChange={setProductImages}
                max={5}
                label="Upload images"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Sizes
                </label>
                <input
                  type="text"
                  value={productSizes}
                  onChange={(e) => setProductSizes(e.target.value)}
                  className="w-full rounded-lg border border-gray-300 px-4 py-3 text-gray-900 focus:border-cirkle-500 focus:ring-cirkle-500 focus:outline-none"
                  placeholder="S, M, L, XL"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Colors
                </label>
                <input
                  type="text"
                  value={productColors}
                  onChange={(e) => setProductColors(e.target.value)}
                  className="w-full rounded-lg border border-gray-300 px-4 py-3 text-gray-900 focus:border-cirkle-500 focus:ring-cirkle-500 focus:outline-none"
                  placeholder="Black, White, Navy"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Materials
              </label>
              <input
                type="text"
                value={productMaterials}
                onChange={(e) => setProductMaterials(e.target.value)}
                className="w-full rounded-lg border border-gray-300 px-4 py-3 text-gray-900 focus:border-cirkle-500 focus:ring-cirkle-500 focus:outline-none"
                placeholder="100% organic cotton"
              />
            </div>

            {error && (
              <p className="text-sm text-red-600 bg-red-50 rounded-lg px-4 py-3">{error}</p>
            )}

            <button
              type="submit"
              disabled={loading || !productName.trim() || !productPriceKr}
              className="w-full flex items-center justify-center gap-2 rounded-lg bg-cirkle-600 px-4 py-3 text-white font-medium hover:bg-cirkle-700 transition disabled:opacity-50"
            >
              {loading ? 'Saving...' : 'Complete setup'}
              {!loading && <Check className="h-4 w-4" />}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
