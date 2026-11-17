'use client';

import { usePathname, useRouter } from 'next/navigation';
import { useAuth } from '@/components/providers/auth-provider';
import { createClient } from '@/lib/supabase';
import { useCallback, useEffect, useState } from 'react';
import type { Database } from '@/lib/database.types';
import { formatDKK } from '@/lib/utils';
import { useBrandPortalShell } from '@/components/brand/nav-counts';
import { searchBrandPortal, useBrandNotifications } from '@/components/brand/portal-data';
import {
  AccountIcon,
  DashboardIcon,
  Logo,
  LogOutIcon,
  NotificationsMenu,
  OrdersIcon,
  PortalShell,
  ProductsIcon,
  ReturnsIcon,
  StoresQrIcon,
  payoutPeriodInfo,
  type PortalNavGroup,
} from '@/components/ds';

type BrandProfile = Database['public']['Tables']['brand_profiles']['Row'];

/** Whole kroner, e.g. "466 kr" (the sidebar is an overview). */
const kr = (ore: number) => formatDKK(Math.round(ore / 100) * 100);

export default function BrandLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const { user, profile, loading, signOut } = useAuth();
  const [brandProfile, setBrandProfile] = useState<BrandProfile | null>(null);
  const [checkingOnboarding, setCheckingOnboarding] = useState(true);
  const ready = !!brandProfile?.onboarding_complete;
  const shell = useBrandPortalShell(ready);
  const notifications = useBrandNotifications(
    ready ? brandProfile!.id : null,
    shell ? `${shell.orders}-${shell.returns}` : ''
  );

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

  const brandId = brandProfile?.id;
  const search = useCallback((q: string) => (brandId ? searchBrandPortal(brandId, q) : Promise.resolve([])), [brandId]);

  if (loading || checkingOnboarding) {
    return (
      <div className="portal-dark flex min-h-screen flex-col items-center justify-center gap-4 bg-canvas-dark font-brand">
        <Logo height={24} framed />
        <p className="animate-pulse text-caption uppercase tracking-[0.7px] text-smoke">Loading…</p>
      </div>
    );
  }

  if (pathname.startsWith('/brand/onboarding')) {
    return <div className="portal-dark min-h-screen bg-canvas-dark font-brand text-primary">{children}</div>;
  }

  const brandName = brandProfile?.name || profile?.name || 'Brand';

  // Figma "Brand Portal v2" sidebar: WORKSPACE + SETTINGS. Stores & tags covers samples,
  // sample requests, swaps, deposits and partnerships (sub-tabs on those pages).
  const groups: PortalNavGroup[] = [
    {
      heading: 'Workspace',
      items: [
        { href: '/brand/dashboard', label: 'Dashboard', icon: DashboardIcon },
        { href: '/brand/products', label: 'Products', icon: ProductsIcon, badge: shell?.products },
        { href: '/brand/samples', label: 'Stores & tags', icon: StoresQrIcon, match: ['/brand/partnerships'], badge: shell?.stores },
        { href: '/brand/orders', label: 'Orders', icon: OrdersIcon, badge: shell?.orders },
        { href: '/brand/returns', label: 'Returns', icon: ReturnsIcon, badge: shell?.returns },
      ],
    },
    {
      heading: 'Settings',
      items: [
        { href: '/brand/account', label: 'Account', icon: AccountIcon },
        { label: 'Log out', icon: LogOutIcon, onClick: signOut },
      ],
    },
  ];

  // Next payout: an estimate (sales via Flaym this period minus the store cut; no Flaym fee yet).
  const period = shell ? payoutPeriodInfo(shell.period_start, shell.next_payout) : null;
  const payout =
    shell && period
      ? {
          date: period.date,
          amount: kr(shell.payout_amount),
          progress: period.progress,
          caption:
            period.daysLeft === 0
              ? 'Payout day · estimate'
              : `${period.daysLeft} ${period.daysLeft === 1 ? 'day' : 'days'} left in the period · estimate`,
        }
      : null;

  return (
    <PortalShell
      sidebar={{ name: brandName, portalLabel: 'Brand Portal', homeHref: '/brand/dashboard', groups, payout }}
      topBar={{
        searchPlaceholder: 'Search products, stores, orders',
        action: { label: 'New product', href: '/brand/products/new' },
        notifications: <NotificationsMenu items={notifications} storageKey="flaym:brand-notifications-seen" />,
        account: { name: brandName, role: 'Brand admin' },
      }}
      search={search}
    >
      {children}
    </PortalShell>
  );
}
