'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useAuth } from '@/components/providers/auth-provider';
import { createClient } from '@/lib/supabase';
import { useEffect, useState } from 'react';
import type { Database } from '@/lib/database.types';
import {
  AccountIcon,
  DashboardIcon,
  Logo,
  LogOutIcon,
  OrdersIcon,
  ProductsIcon,
  ReturnsIcon,
  SidebarNav,
  StoresQrIcon,
  cn,
  type NavItem,
} from '@/components/ds';

type BrandProfile = Database['public']['Tables']['brand_profiles']['Row'];

// Figma "Brand Portal" nav. Stores & QR tags covers samples, sample requests,
// swaps, deposits and partnerships (sub-tabs on those pages).
const NAV_ITEMS: NavItem[] = [
  { href: '/brand/dashboard', label: 'Dashboard', icon: DashboardIcon },
  { href: '/brand/products', label: 'Products', icon: ProductsIcon },
  { href: '/brand/samples', label: 'Stores & QR tags', icon: StoresQrIcon, match: ['/brand/partnerships'] },
  { href: '/brand/orders', label: 'Orders', icon: OrdersIcon },
  { href: '/brand/returns', label: 'Returns', icon: ReturnsIcon },
];

export default function BrandLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const { user, profile, loading, signOut } = useAuth();
  const [brandProfile, setBrandProfile] = useState<BrandProfile | null>(null);
  const [checkingOnboarding, setCheckingOnboarding] = useState(true);

  useEffect(() => {
    if (loading) return;
    if (!user) {
      setCheckingOnboarding(false);
      return;
    }

    const supabase = createClient();
    supabase
      .from('brand_profiles')
      .select('*')
      .eq('user_id', user.id)
      .single()
      .then(({ data }: { data: BrandProfile | null }) => {
        setBrandProfile(data as BrandProfile | null);
        setCheckingOnboarding(false);

        const isOnboardingPage = pathname.startsWith('/brand/onboarding');
        if (data?.onboarding_complete && isOnboardingPage) {
          router.replace('/brand/dashboard');
        } else if (!data?.onboarding_complete && !isOnboardingPage) {
          router.replace('/brand/onboarding');
        }
      });
  }, [loading, user, pathname, router]);

  if (loading || checkingOnboarding) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-canvas-warm font-brand">
        <Logo height={24} framed />
        <p className="animate-pulse text-caption uppercase tracking-[0.7px] text-slate">Loading…</p>
      </div>
    );
  }

  if (pathname.startsWith('/brand/onboarding')) {
    return <div className="min-h-screen bg-canvas-warm font-brand text-primary">{children}</div>;
  }

  const brandName = brandProfile?.name || profile?.name;
  const accountActive = pathname === '/brand/account' || pathname.startsWith('/brand/account/');
  const footerLink = 'flex w-full items-center gap-3 border-l-2 px-5 py-2.5 text-body transition-colors';

  return (
    <div className="min-h-screen bg-canvas-warm font-brand text-primary">
      <SidebarNav
        items={NAV_ITEMS}
        homeHref="/brand/dashboard"
        account={brandName ? { name: brandName, role: 'Brand Portal' } : undefined}
        footer={(close) => (
          <div className="-mx-3 -my-3 py-3">
            <Link
              href="/brand/account"
              onClick={close}
              aria-current={accountActive ? 'page' : undefined}
              className={cn(
                footerLink,
                accountActive
                  ? 'border-accent bg-on-primary/5 text-on-primary'
                  : 'border-transparent text-on-primary/60 hover:text-on-primary'
              )}
            >
              <AccountIcon className={cn('h-[18px] w-[18px] shrink-0', accountActive && 'text-accent')} />
              Account
            </Link>
            <button
              type="button"
              onClick={() => {
                close();
                signOut();
              }}
              className={cn(footerLink, 'border-transparent text-on-primary/60 hover:text-on-primary')}
            >
              <LogOutIcon className="h-[18px] w-[18px] shrink-0" />
              Log out
            </button>
          </div>
        )}
      />

      <main className="lg:pl-64">
        <div className="mx-auto max-w-[1144px] px-4 py-6 sm:px-6 lg:px-12 lg:py-9">{children}</div>
      </main>
    </div>
  );
}
