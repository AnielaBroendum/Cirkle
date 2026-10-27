// Shopper consents (Figma "App / 02 Consent"). Stored as an append-only log in
// consumer_consents (migration 014); the newest row per consent wins and no
// row means off, so optional consents start off (GDPR).

/** Optional consents the shopper can switch. "Data for the chain" is always on. */
export const OPTIONAL_CONSENTS = ['share_with_brands', 'news_from_brands'] as const;
export type OptionalConsent = (typeof OPTIONAL_CONSENTS)[number];
export type ConsentKind = 'chain' | OptionalConsent;
export type ConsentSource = 'consent_screen' | 'profile';

export const CONSENT_COPY: Record<ConsentKind, { title: string; hint: string }> = {
  chain: { title: 'Data for the chain', hint: 'Required to use Flaym' },
  share_with_brands: { title: 'Share my data with brands', hint: 'So they can make what people want' },
  news_from_brands: { title: 'News from brands', hint: 'Max one email a week' },
};

export type ConsentState = {
  /** When the shopper acknowledged the chain data, or null if they never saw the screen. */
  chainAcknowledgedAt: string | null;
} & Record<OptionalConsent, { granted: boolean; at: string | null }>;

/** Folds the log (any order) into the current choices. */
export function currentConsents(rows: { consent: string; granted: boolean; created_at: string }[]): ConsentState {
  const latest = new Map<string, { granted: boolean; created_at: string }>();
  for (const row of rows) {
    const seen = latest.get(row.consent);
    if (!seen || row.created_at > seen.created_at) latest.set(row.consent, row);
  }
  const optional = (kind: OptionalConsent) => {
    const row = latest.get(kind);
    return { granted: row?.granted ?? false, at: row?.created_at ?? null };
  };
  return {
    chainAcknowledgedAt: latest.get('chain')?.created_at ?? null,
    share_with_brands: optional('share_with_brands'),
    news_from_brands: optional('news_from_brands'),
  };
}
