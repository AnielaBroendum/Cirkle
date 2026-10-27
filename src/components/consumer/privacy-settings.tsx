'use client';

import { useEffect, useState } from 'react';
import { ConsentCard } from './consent-card';
import type { ConsentState, OptionalConsent } from '@/lib/consents';

// Profile → Privacy and data: the Figma 02 switches again. Each change is
// logged as a new consent row with its time; Data for the chain stays on.
export function PrivacySettings() {
  const [state, setState] = useState<ConsentState | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    fetch('/api/consents')
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then(setState)
      .catch(() => setError('Could not load your choices.'));
  }, []);

  async function change(kind: OptionalConsent, granted: boolean) {
    if (!state) return;
    const before = state;
    setState({ ...state, [kind]: { granted, at: new Date().toISOString() } });
    setError('');
    const res = await fetch('/api/consents', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ source: 'profile', choices: { [kind]: granted } }),
    }).catch(() => null);
    if (res?.ok) {
      setState(await res.json());
    } else {
      setState(before);
      setError('Could not save. Try again.');
    }
  }

  if (!state) {
    return error ? <p className="mt-4 text-caption text-accent">{error}</p> : <div className="mt-4 h-[206px] animate-pulse bg-surface-dark" />;
  }

  const lastChange = [state.share_with_brands.at, state.news_from_brands.at].filter((at): at is string => !!at).sort().pop();

  return (
    <div className="mt-4">
      <ConsentCard
        values={{ share_with_brands: state.share_with_brands.granted, news_from_brands: state.news_from_brands.granted }}
        onChange={change}
      />
      {error && <p className="mt-3 text-caption text-accent">{error}</p>}
      <p className="mt-3 text-caption text-smoke">
        {lastChange
          ? `Last changed ${new Date(lastChange).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}.`
          : 'Both are off until you switch them on.'}{' '}
        You can change this any time.
      </p>
    </div>
  );
}
