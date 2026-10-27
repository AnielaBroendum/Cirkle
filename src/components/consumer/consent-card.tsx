'use client';

import { Toggle } from '@/components/ds';
import { CONSENT_COPY, OPTIONAL_CONSENTS, type ConsentKind, type OptionalConsent } from '@/lib/consents';

// Figma "App / 02 Consent" card: Data for the chain (always on) and the two
// optional consents as switches. Used by the consent screen and the profile.
export function ConsentCard({
  values,
  onChange,
  disabled,
}: {
  values: Record<OptionalConsent, boolean>;
  onChange: (kind: OptionalConsent, granted: boolean) => void;
  disabled?: boolean;
}) {
  return (
    <ul className="divide-y divide-line-dark bg-surface-dark px-4">
      <ConsentRow kind="chain" aside={<span className="text-caption text-smoke">Always on</span>} />
      {OPTIONAL_CONSENTS.map((kind) => (
        <ConsentRow
          key={kind}
          kind={kind}
          aside={
            <Toggle
              tone="dark"
              checked={values[kind]}
              onCheckedChange={(granted) => onChange(kind, granted)}
              disabled={disabled}
              aria-label={CONSENT_COPY[kind].title}
            />
          }
        />
      ))}
    </ul>
  );
}

function ConsentRow({ kind, aside }: { kind: ConsentKind; aside: React.ReactNode }) {
  const copy = CONSENT_COPY[kind];
  return (
    <li className="flex items-center justify-between gap-4 py-4">
      <div className="min-w-0">
        <p className="text-body text-on-primary">{copy.title}</p>
        <p className="mt-0.5 text-caption text-smoke">{copy.hint}</p>
      </div>
      {aside}
    </li>
  );
}
