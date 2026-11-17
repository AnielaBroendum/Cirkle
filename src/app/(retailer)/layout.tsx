'use client';

import { usePathname, useRouter } from 'next/navigation';
import { useAuth } from '@/components/providers/auth-provider';
import { createClient } from '@/lib/supabase';
// Transactions and Brands have no Figma icon (the Retail Portal v2 nav only has Dashboard, Products, Store profile).
import { Receipt, Store } from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';
import type { Database } from '@/lib/database.types';
import { formatDKK } from '@/lib/utils';
import {
  searchRetailerPortal,
  useRetailerNotifications,
  useRetailerPortalShell,
} from '@/components/retailer/portal-data';
import {
  DashboardIcon,
  Logo,
  LogOutIcon,
  NotificationsMenu,
  PortalShell,
  ProductsIcon,
  StoreProfileIcon,
  payoutPeriodInfo,
  type PortalNavGroup,
} from '@/components/ds';

type RetailerProfile = Database['public']['Tables']['retailer_profiles']['Row'];

/** Whole kroner, e.g. "1.071 kr" (the sidebar is an overview). */
const kr = (ore: number) => formatDKK(Math.round(ore / 100) * 100);

export default function RetailerLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const { user, profile, loading, signOut } = useAuth();
  const [retailerProfile, setRetailerProfile] = useState<RetailerProfile | null>(null);
  const [checkingOnboarding, setCheckingOnboarding] = useState(true);
  const ready = !!retailerProfile?.onboarding_complete;
  const shell = useRetailerPortalShell(ready);
  const notifications = useRetailerNotifications(ready ? retailerProfile!.id : null);

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

  const retailerId = retailerProfile?.id;
  const search = useCallback(
    (q: string) => (retailerId ? searchRetailerPortal(retailerId, q) : Promise.resolve([])),
    [retailerId]
  );

  if (loading || checkingOnboarding) {
    return (
      <div className="portal-dark flex min-h-screen flex-col items-center justify-center gap-4 bg-canvas-dark font-brand">
        <Logo height={24} framed />
        <p className="animate-pulse text-caption uppercase tracking-[0.7px] text-smoke">Loading…</p>
      </div>
    );
  }

  if (pathname.startsWith('/retailer/onboarding')) {
    return <div className="portal-dark min-h-screen bg-canvas-dark font-brand text-flare">{children}</div>;
  }

  const storeName = retailerProfile?.name || profile?.name || 'Store';

  // Figma "Retail Portal v2" sidebar: STORE + SETTINGS. Transactions (deposits) and Brands
  // (partnerships) aren't in the v2 design; kept in the sidebar (decided 17 Nov 2026).
  // Products = the samples placed in the store.
  const groups: PortalNavGroup[] = [
    {
      heading: 'Store',
      items: [
        { href: '/retailer/dashboard', label: 'Dashboard', icon: DashboardIcon },
        { href: '/retailer/samples', label: 'Products', icon: ProductsIcon, badge: shell?.products },
        { href: '/retailer/samples/transactions', label: 'Transactions', icon: Receipt },
        { href: '/retailer/brands', label: 'Brands', icon: Store },
      ],
    },
    {
      heading: 'Settings',
      items: [
        { href: '/retailer/profile', label: 'Store profile', icon: StoreProfileIcon },
        { label: 'Log out', icon: LogOutIcon, onClick: signOut },
      ],
    },
  ];

  // Next payout: every credited cut not paid out yet. The bar shows the Ready share.
  const payout = shell
    ? {
        date: payoutPeriodInfo(shell.period_start, shell.next_payout).date,
        amount: kr(shell.payout_amount),
        progress: shell.payout_amount > 0 ? shell.ready_amount / shell.payout_amount : 0,
        caption:
          shell.return_period_amount > 0
            ? `${kr(shell.return_period_amount)} still in return period`
            : 'All of it is ready to pay out',
      }
    : null;

  return (
    <PortalShell
      sidebar={{ name: storeName, portalLabel: 'Retail Portal', homeHref: '/retailer/dashboard', groups, payout }}
      topBar={{
        searchPlaceholder: 'Search products and brands',
        notifications: <NotificationsMenu items={notifications} storageKey="flaym:retail-notifications-seen" />,
        account: { name: storeName, role: 'Store manager' },
      }}
      search={search}
    >
      {children}
    </PortalShell>
  );
}
