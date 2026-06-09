'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useAuth } from '@/components/providers/auth-provider';
import { createClient } from '@/lib/supabase';
import {
  LayoutDashboard,
  Package,
  QrCode,
  Handshake,
  ShoppingBag,
  LogOut,
  Menu,
  X,
  Inbox,
  ArrowLeftRight,
  Receipt,
} from 'lucide-react';
import { useEffect, useState } from 'react';
import type { Database } from '@/lib/database.types';

type BrandProfile = Database['public']['Tables']['brand_profiles']['Row'];

const NAV_ITEMS = [
  { href: '/brand/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/brand/products', label: 'Products', icon: Package },
  { href: '/brand/samples', label: 'Samples', icon: QrCode },
  { href: '/brand/samples/requests', label: 'Sample requests', icon: Inbox },
  { href: '/brand/samples/swaps', label: 'Swap requests', icon: ArrowLeftRight },
  { href: '/brand/samples/transactions', label: 'Transactions', icon: Receipt },
  { href: '/brand/partnerships', label: 'Partnerships', icon: Handshake },
  { href: '/brand/orders', label: 'Orders', icon: ShoppingBag },
];

export default function BrandLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const { user, profile, loading, signOut } = useAuth();
  const [sidebarOpen, setSidebarOpen] = useState(false);
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
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="animate-pulse text-gray-400">Loading...</div>
      </div>
    );
  }

  if (pathname.startsWith('/brand/onboarding')) {
    return <div className="min-h-screen bg-gray-50">{children}</div>;
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="lg:hidden sticky top-0 z-40 flex items-center justify-between bg-white border-b border-gray-200 px-4 h-14">
        <button
          onClick={() => setSidebarOpen(true)}
          className="p-2 -ml-2 text-gray-600 hover:text-gray-900"
        >
          <Menu className="h-5 w-5" />
        </button>
        <span className="font-bold text-cirkle-950">Cirkle</span>
        <div className="w-9" />
      </header>

      {sidebarOpen && (
        <div
          className="lg:hidden fixed inset-0 z-50 bg-black/50"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      <aside
        className={`fixed top-0 left-0 z-50 h-full w-64 bg-white border-r border-gray-200 flex flex-col transition-transform duration-200 lg:translate-x-0 ${
          sidebarOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        <div className="flex items-center justify-between h-14 px-4 border-b border-gray-200">
          <Link href="/brand/dashboard" className="font-bold text-lg text-cirkle-950">
            Cirkle
          </Link>
          <button
            onClick={() => setSidebarOpen(false)}
            className="lg:hidden p-1 text-gray-400 hover:text-gray-600"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {(brandProfile || profile) && (
          <div className="px-4 py-3 border-b border-gray-100">
            <p className="text-sm font-medium text-gray-900 truncate">
              {brandProfile?.name || profile?.name}
            </p>
            <p className="text-xs text-gray-500">Brand</p>
          </div>
        )}

        <nav className="flex-1 px-3 py-4 space-y-1">
          {NAV_ITEMS.map((item) => {
            const isActive = pathname === item.href || pathname.startsWith(item.href + '/');
            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={() => setSidebarOpen(false)}
                className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                  isActive
                    ? 'bg-cirkle-50 text-cirkle-700'
                    : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'
                }`}
              >
                <item.icon className="h-5 w-5 flex-shrink-0" />
                {item.label}
              </Link>
            );
          })}
        </nav>

        <div className="p-3 border-t border-gray-200">
          <button
            onClick={signOut}
            className="flex items-center gap-3 w-full px-3 py-2.5 rounded-lg text-sm font-medium text-gray-600 hover:bg-gray-100 hover:text-gray-900 transition-colors"
          >
            <LogOut className="h-5 w-5" />
            Sign out
          </button>
        </div>
      </aside>

      <main className="lg:pl-64">
        <div className="p-4 sm:p-6 lg:p-8">{children}</div>
      </main>
    </div>
  );
}
