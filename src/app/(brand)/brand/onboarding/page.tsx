'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/components/providers/auth-provider';
import { createClient } from '@/lib/supabase';
import { ImageUpload } from '@/components/brand/image-upload';
import { Check } from 'lucide-react';
import { Button, Field, Input, Logo, Textarea } from '@/components/ds';

export default function BrandOnboardingPage() {
  const router = useRouter();
  const { user } = useAuth();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const [brandName, setBrandName] = useState('');
  const [brandDescription, setBrandDescription] = useState('');
  const [brandLogo, setBrandLogo] = useState<string[]>([]);
  const [brandWebsite, setBrandWebsite] = useState('');

  // Products are added later from the product library, not during signup.
  async function handleSubmit() {
    if (!user || !brandName.trim()) return;
    setError('');
    setLoading(true);

    const supabase = createClient();
    // Upsert on user_id so re-running onboarding updates the existing profile
    // instead of colliding with the unique brand_profiles_user_id constraint.
    const { error: insertError } = await supabase
      .from('brand_profiles')
      .upsert(
        {
          user_id: user.id,
          name: brandName.trim(),
          description: brandDescription.trim() || null,
          logo_url: brandLogo[0] || null,
          website: brandWebsite.trim() || null,
          onboarding_complete: true,
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
            <p className="text-label uppercase text-slate">Brand Portal</p>
            <h1 className="mt-3 font-brand text-heading-xl uppercase text-primary">Set up your brand</h1>
            <p className="mt-3 text-body text-slate">This is what people see when they scan your products in stores.</p>
          </div>

          <form
            onSubmit={(e) => {
              e.preventDefault();
              handleSubmit();
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
              rightIcon={<Check className="h-4 w-4" />}
            >
              {loading ? 'Saving…' : 'Complete setup'}
            </Button>
          </form>
        </div>
      </div>
    </div>
  );
}
