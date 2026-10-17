'use client';

import { Suspense } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';

// Link between /auth/login and /auth/signup that keeps ?redirect= (and ?role=),
// so a shopper who switches forms still ends up back where they started.
function SwitchLinkInner({ to, className, children }: { to: '/auth/login' | '/auth/signup'; className?: string; children: React.ReactNode }) {
  const searchParams = useSearchParams();
  const params = new URLSearchParams();
  const redirect = searchParams.get('redirect');
  const role = searchParams.get('role');
  if (redirect) params.set('redirect', redirect);
  if (role && to === '/auth/signup') params.set('role', role);
  const query = params.toString();
  return (
    <Link href={query ? `${to}?${query}` : to} className={className}>
      {children}
    </Link>
  );
}

export default function AuthSwitchLink(props: { to: '/auth/login' | '/auth/signup'; className?: string; children: React.ReactNode }) {
  return (
    <Suspense
      fallback={
        <Link href={props.to} className={props.className}>
          {props.children}
        </Link>
      }
    >
      <SwitchLinkInner {...props} />
    </Suspense>
  );
}
