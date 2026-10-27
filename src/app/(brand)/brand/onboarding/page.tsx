'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/components/providers/auth-provider';
import { createClient } from '@/lib/supabase';
import { ImageUpload } from '@/components/brand/image-upload';
import { ProductImagesUpload } from '@/components/brand/product-images-upload';
import { parseDKKtoOre } from '@/lib/utils';
import { ArrowRight, ArrowLeft, Check } from 'lucide-react';
import { Button, Field, Input, Logo, Textarea, cn } from '@/components/ds';

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
    // Upsert on user_id so re-running onboarding updates the existing profile
    // instead of colliding with the unique brand_profiles_user_id constraint.
    const { data, error: insertError } = await supabase
      .from('brand_profiles')
      .upsert(
        {
          user_id: user.id,
          name: brandName.trim(),
          description: brandDescription.trim() || null,
          logo_url: brandLogo[0] || null,
          website: brandWebsite.trim() || null,
        },
        { onConflict: 'user_id' }
      )
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

  const errorBox = error && (
    <p role="alert" className="border border-accent bg-accent-subtle px-4 py-3 text-body text-accent-strong">
      {error}
    </p>
  );

  return (
    <div className="flex min-h-screen flex-col bg-surface font-brand lg:flex-row">
      {/* Art panel (Figma Brand Portal 01) */}
      <div className="flex h-40 shrink-0 flex-col items-center justify-center gap-2 bg-flaym-gradient lg:sticky lg:top-0 lg:h-screen lg:w-1/2 lg:gap-5">
        <Logo height={40} className="lg:hidden" />
        <Logo height={106} className="hidden lg:inline-block" />
        <p className="text-caption italic tracking-[4px] text-on-primary lg:text-body">FORWARD</p>
      </div>

      <div className="flex flex-1 justify-center px-4 py-10 sm:px-6 lg:items-center lg:px-12 lg:py-16">
        <div className="w-full max-w-[420px] space-y-7">
          <div>
            <p className="text-label uppercase text-slate">Brand Portal · Step {step} of 2</p>
            <h1 className="mt-3 font-brand text-heading-xl uppercase text-primary">
              {step === 1 ? 'Set up your brand' : 'Your first product'}
            </h1>
            <p className="mt-3 text-body text-slate">
              {step === 1
                ? 'This is what people see when they scan your products in stores.'
                : 'Add one product now. You can add the rest from the product library.'}
            </p>
            {/* Progress */}
            <div className="mt-5 flex gap-2" aria-hidden>
              <span className={cn('h-1 flex-1', step >= 1 ? 'bg-accent' : 'bg-surface-muted')} />
              <span className={cn('h-1 flex-1', step >= 2 ? 'bg-accent' : 'bg-surface-muted')} />
            </div>
          </div>

          {step === 1 && (
            <form
              onSubmit={(e) => {
                e.preventDefault();
                handleStep1();
              }}
              className="space-y-4"
            >
              <Field label="Brand name *" htmlFor="ob-name">
                <Input
                  id="ob-name"
                  type="text"
                  required
                  value={brandName}
                  onChange={(e) => setBrandName(e.target.value)}
                  placeholder="Your brand name"
                />
              </Field>

              <Field label="About the brand" htmlFor="ob-description">
                <Textarea
                  id="ob-description"
                  rows={3}
                  value={brandDescription}
                  onChange={(e) => setBrandDescription(e.target.value)}
                  placeholder="Tell us about your brand"
                />
              </Field>

              <Field label="Logo">
                <ImageUpload
                  bucket="brand-assets"
                  folder="logos"
                  value={brandLogo}
                  onChange={setBrandLogo}
                  max={1}
                  label="Upload logo"
                  appearance="flaym"
                />
              </Field>

              <Field label="Webshop" htmlFor="ob-website">
                <Input
                  id="ob-website"
                  type="url"
                  value={brandWebsite}
                  onChange={(e) => setBrandWebsite(e.target.value)}
                  placeholder="https://yourbrand.com"
                />
              </Field>

              {errorBox}

              <Button
                type="submit"
                fullWidth
                disabled={loading || !brandName.trim()}
                loading={loading}
                rightIcon={<ArrowRight className="h-4 w-4" />}
              >
                {loading ? 'Saving…' : 'Next: Add a product'}
              </Button>
            </form>
          )}

          {step === 2 && (
            <form
              onSubmit={(e) => {
                e.preventDefault();
                handleStep2();
              }}
              className="space-y-4"
            >
              <Field label="Product name *" htmlFor="ob-product">
                <Input
                  id="ob-product"
                  type="text"
                  required
                  value={productName}
                  onChange={(e) => setProductName(e.target.value)}
                  placeholder="e.g. Classic T-Shirt"
                />
              </Field>

              <Field label="About (shown on the product page)" htmlFor="ob-product-description">
                <Textarea
                  id="ob-product-description"
                  rows={3}
                  value={productDescription}
                  onChange={(e) => setProductDescription(e.target.value)}
                  placeholder="Describe the product"
                />
              </Field>

              <Field label="Price (kr) *" htmlFor="ob-price">
                <Input
                  id="ob-price"
                  type="number"
                  required
                  min="1"
                  step="0.01"
                  value={productPriceKr}
                  onChange={(e) => setProductPriceKr(e.target.value)}
                  placeholder="299"
                />
              </Field>

              <Field label="Images">
                {brandProfileId && (
                  <ProductImagesUpload brandId={brandProfileId} value={productImages} onChange={setProductImages} />
                )}
              </Field>

              <div className="grid grid-cols-2 gap-3">
                <Field label="Sizes" htmlFor="ob-sizes" hint="Separate with commas">
                  <Input
                    id="ob-sizes"
                    type="text"
                    value={productSizes}
                    onChange={(e) => setProductSizes(e.target.value)}
                    placeholder="S, M, L, XL"
                  />
                </Field>
                <Field label="Colours" htmlFor="ob-colors" hint="Separate with commas">
                  <Input
                    id="ob-colors"
                    type="text"
                    value={productColors}
                    onChange={(e) => setProductColors(e.target.value)}
                    placeholder="Black, White, Navy"
                  />
                </Field>
              </div>

              <Field label="Materials and care" htmlFor="ob-materials">
                <Input
                  id="ob-materials"
                  type="text"
                  value={productMaterials}
                  onChange={(e) => setProductMaterials(e.target.value)}
                  placeholder="100% organic cotton"
                />
              </Field>

              {errorBox}

              <div className="flex gap-3">
                <Button variant="secondary" onClick={() => setStep(1)} leftIcon={<ArrowLeft className="h-4 w-4" />}>
                  Back
                </Button>
                <Button
                  type="submit"
                  className="flex-1"
                  disabled={loading || !productName.trim() || !productPriceKr}
                  loading={loading}
                  rightIcon={<Check className="h-4 w-4" />}
                >
                  {loading ? 'Saving…' : 'Complete setup'}
                </Button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
