'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  Home,
  Heart,
  ShoppingBag,
  User,
} from 'lucide-react';
import InstallPrompt from '@/components/pwa/install-prompt';
import PageTransition from '@/components/pwa/page-transition';

const TAB_ITEMS = [
  { href: '/consumer/home', label: 'Hjem', icon: Home },
  { href: '/consumer/saved', label: 'Gemt', icon: Heart },
  { href: '/consumer/orders', label: 'Ordrer', icon: ShoppingBag },
  { href: '/consumer/profile', label: 'Profil', icon: User },
];

export default function ConsumerLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  return (
    <div className="min-h-screen bg-white pb-16 sm:pb-20">
      {/* Header */}
      <header className="sticky top-0 z-40 bg-white border-b border-gray-100 px-4 h-14 flex items-center justify-center">
        <span className="font-bold text-lg text-cirkle-950">Cirkle</span>
      </header>

      {/* Page content */}
      <main className="max-w-lg mx-auto px-4 py-4">
        <PageTransition>{children}</PageTransition>
      </main>

      {/* PWA install prompt */}
      <InstallPrompt />

      {/* Bottom tab bar */}
      <nav className="fixed bottom-0 left-0 right-0 z-40 bg-white border-t border-gray-200 safe-area-bottom">
        <div className="max-w-lg mx-auto flex items-center justify-around h-16 sm:h-20">
          {TAB_ITEMS.map((item) => {
            const isActive = pathname === item.href || pathname.startsWith(item.href + '/');
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`flex flex-col items-center gap-1 px-3 py-2 min-w-0 transition-colors ${
                  isActive ? 'text-cirkle-600' : 'text-gray-400 hover:text-gray-600'
                }`}
              >
                <item.icon className="h-5 w-5" />
                <span className="text-[11px] font-medium">{item.label}</span>
              </Link>
            );
          })}
        </div>
      </nav>
    </div>
  );
}
