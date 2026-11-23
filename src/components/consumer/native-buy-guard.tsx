'use client';

import Link from 'next/link';
import { buttonClasses } from '@/components/ds';
import { useIsNativeApp } from '@/lib/native';

/**
 * Basket and checkout in the iPhone app: there are no payments in the TestFlight
 * round, so the app shows "Coming soon" instead. In a browser the page renders
 * exactly as before.
 */
export function NativeBuyGuard({ children }: { children: React.ReactNode }) {
  const native = useIsNativeApp();
  if (!native) return <>{children}</>;
  return (
    <div className="flex min-h-[70vh] flex-col items-center justify-center px-8 text-center">
      <p className="text-label uppercase text-accent-bright">Coming soon</p>
      <h1 className="mt-3 font-brand text-title uppercase text-on-primary">Buying in the app</h1>
      <p className="mt-3 max-w-xs text-body-sm text-ash">
        You can&rsquo;t buy in the app yet. Save what you like and it&rsquo;ll be waiting for you.
      </p>
      <Link href="/consumer/saved" className={buttonClasses({ variant: 'flame', className: 'mt-8 w-full max-w-xs' })}>
        Go to saved
      </Link>
    </div>
  );
}
