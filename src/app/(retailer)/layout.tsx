'use client';

import { usePathname, useRouter } from 'next/navigation';
import { useAuth } from '@/components/providers/auth-provider';
import { createClient } from '@/lib/supabase';
// Transactions and Brands have no Figma icon (the Retail Portal nav only has Dashboard, Products, Store profile).
import { Receipt, Store } from 'lucide-react';
import { useEffect, useState } from 'react';
import type { Database } from '@/lib/database.types';
import { DashboardIcon, Logo, LogOutIcon, ProductsIcon, SidebarNav, StoreProfileIcon, type NavItem } from '@/components/ds';

type RetailerProfile = Database['public']['Tables']['retailer_profiles']['Row'];

// Figma "Retail Portal" nav. Products = the samples placed in the store.
const NAV_ITEMS: NavItem[] = [
  { href: '/retailer/dashboard', label: 'Dashboard', icon: DashboardIcon },
  { href: '/retailer/samples', label: 'Products', icon: ProductsIcon },
  { href: '/retailer/samples/transactions', label: 'Transactions', icon: Receipt },
  { href: '/retailer/brands', label: 'Brands', icon: Store },
  { href: '/retailer/profile', label: 'Store profile', icon: StoreProfileIcon },
];

export default function RetailerLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const { user, profile, loading, signOut } = useAuth();
  const [retailerProfile, setRetailerProfile] = useState<RetailerProfile | null>(null);
  const [checkingOnboarding, setCheckingOnboarding] = useState(true);

  useEffect(() => {
    if (loading) return;
    if (!user) {
      setCheckingOnboarding(false);
      return;
    }

    const supabase = createClient();
    supabase
      .from('retailer_profiles')
      .select('*')
      .eq('user_id', user.id)
      .single()
      .then(({ data }: { data: RetailerProfile | null }) => {
        setRetailerProfile(data as RetailerProfile | null);
        setCheckingOnboarding(false);

        const isOnboardingPage = pathname.startsWith('/retailer/onboarding');
        if (data?.onboarding_complete && isOnboardingPage) {
          router.replace('/retailer/dashboard');
        } else if (!data?.onboarding_complete && !isOnboardingPage) {
          router.replace('/retailer/onboarding');
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

  if (pathname.startsWith('/retailer/onboarding')) {
    return <div className="min-h-screen bg-canvas-warm font-brand text-primary">{children}</div>;
  }

  const storeName = retailerProfile?.name || profile?.name;

  return (
    <div className="min-h-screen bg-canvas-warm font-brand text-primary">
      <SidebarNav
        items={NAV_ITEMS}
        homeHref="/retailer/dashboard"
        account={storeName ? { name: storeName, role: 'Retail Portal' } : undefined}
        footer={(close) => (
          <button
            type="button"
            onClick={() => {
              close();
              signOut();
            }}
            className="flex w-full items-center gap-3 px-2 py-2.5 text-body text-on-primary/60 transition-colors hover:text-on-primary"
          >
            <LogOutIcon className="h-[18px] w-[18px]" />
            Log out
          </button>
        )}
      />

      <main className="lg:pl-64">
        <div className="mx-auto max-w-[1144px] px-4 py-6 sm:px-6 lg:px-12 lg:py-9">{children}</div>
      </main>
    </div>
  );
}
