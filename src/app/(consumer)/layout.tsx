'use client';

import { usePathname } from 'next/navigation';
import { Flame, ScanLine, User } from 'lucide-react';
import { BottomNav, type NavItem } from '@/components/ds';
import InstallPrompt from '@/components/pwa/install-prompt';
import PageTransition from '@/components/pwa/page-transition';

// Figma "Tab bar": Scan · Flayms · Profile. Saved, owned items (QR) and orders
// live under Profile, so they keep the Profile tab active.
const TAB_ITEMS: NavItem[] = [
  { href: '/consumer/home', label: 'Scan', icon: ScanLine },
  { href: '/consumer/flayms', label: 'Flayms', icon: Flame },
  {
    href: '/consumer/profile',
    label: 'Profile',
    icon: User,
    match: ['/consumer/saved', '/consumer/qr', '/consumer/orders', '/consumer/history'],
  },
];

// Checkout has its own bottom action (Figma 06), so the tab bar is hidden there.
const HIDE_NAV_PREFIXES = ['/consumer/checkout', '/consumer/basket'];

export default function ConsumerLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname() ?? '';
  const showNav = !HIDE_NAV_PREFIXES.some((p) => pathname.startsWith(p));

  return (
    <div className={`min-h-screen bg-canvas-dark font-brand text-on-primary ${showNav ? 'pb-16' : ''}`}>
      {/* Page content: each screen renders its own header, as in Figma. */}
      <main className="mx-auto max-w-lg">
        <PageTransition>{children}</PageTransition>
      </main>

      {/* PWA install prompt */}
      <InstallPrompt />

      {showNav && <BottomNav items={TAB_ITEMS} />}
    </div>
  );
}
