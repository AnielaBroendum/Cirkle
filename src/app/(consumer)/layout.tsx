'use client';

import { usePathname } from 'next/navigation';
import { BottomNav } from '@/components/ds';
import { consumerTabs } from '@/components/consumer/tab-items';
import InstallPrompt from '@/components/pwa/install-prompt';
import PageTransition from '@/components/pwa/page-transition';

const TAB_ITEMS = consumerTabs();

// Checkout has its own bottom action (Figma 06), so the tab bar is hidden there,
// and the consent screen (Figma 02) comes before the app.
const HIDE_NAV_PREFIXES = ['/consumer/checkout', '/consumer/basket', '/consumer/consent'];

export default function ConsumerLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname() ?? '';
  // Return requests (Figma 11) also end in their own bottom action.
  const showNav = !HIDE_NAV_PREFIXES.some((p) => pathname.startsWith(p)) && !pathname.endsWith('/return');

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
