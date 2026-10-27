'use client';

import { Suspense, useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Button } from '@/components/ds';
import { ConsentCard } from '@/components/consumer/consent-card';
import type { ConsentState, OptionalConsent } from '@/lib/consents';

// Figma "App / 02 Consent", shown once after signup. Optional consents start
// off (GDPR); "Start scanning" logs every choice with its time, then goes on
// to where the shopper was heading (?redirect=) or the Scan screen.

function safeRedirect(target: string | null): string {
  if (!target || !target.startsWith('/') || target.startsWith('//') || target.startsWith('/auth')) {
    return '/consumer/home';
  }
  return target;
}

function ConsentScreen() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [values, setValues] = useState<Record<OptionalConsent, boolean>>({
    share_with_brands: false,
    news_from_brands: false,
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  // Coming back to the screen shows the choices already made.
  useEffect(() => {
    fetch('/api/consents')
      .then((r) => (r.ok ? r.json() : null))
      .then((state: ConsentState | null) => {
        if (state?.chainAcknowledgedAt) {
          setValues({
            share_with_brands: state.share_with_brands.granted,
            news_from_brands: state.news_from_brands.granted,
          });
        }
      })
      .catch(() => {});
  }, []);

  async function start() {
    setSaving(true);
    setError('');
    const res = await fetch('/api/consents', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ source: 'consent_screen', choices: values }),
    }).catch(() => null);
    if (!res?.ok) {
      setError('Could not save your choices. Try again.');
      setSaving(false);
      return;
    }
    router.replace(safeRedirect(searchParams.get('redirect')));
  }

  return (
    <div className="flex min-h-screen flex-col px-5 pb-11 pt-[70px]">
      <h1 className="max-w-[12ch] font-brand text-[24px] font-normal uppercase leading-[30px] tracking-[0.5px] text-on-primary">
        Before you scan
      </h1>
      <p className="mt-6 text-body leading-[1.6] text-ash">
        Flaym saves what you scan, save and pass on, so the right store and the right person get credit.
      </p>

      <div className="mt-9">
        <ConsentCard values={values} onChange={(kind, granted) => setValues((v) => ({ ...v, [kind]: granted }))} />
      </div>

      {error && <p className="mt-4 text-caption text-accent">{error}</p>}

      <Button variant="accent" size="lg" fullWidth loading={saving} onClick={start} className="mt-auto h-[52px]">
        Start scanning
      </Button>
    </div>
  );
}

export default function ConsentPage() {
  return (
    <Suspense>
      <ConsentScreen />
    </Suspense>
  );
}
