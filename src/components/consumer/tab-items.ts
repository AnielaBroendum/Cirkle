import { Flame, ScanLine, User } from 'lucide-react';
import type { NavItem } from '@/components/ds';

/** Figma "Tab bar": Scan · Flayms · Profile. */
export function consumerTabs({ scanMatch = [], profileMatch = [] }: { scanMatch?: string[]; profileMatch?: string[] } = {}): NavItem[] {
  return [
    { href: '/consumer/home', label: 'Scan', icon: ScanLine, match: scanMatch },
    { href: '/consumer/flayms', label: 'Flayms', icon: Flame },
    {
      href: '/consumer/profile',
      label: 'Profile',
      icon: User,
      // Saved, owned items (QR), orders and history live under Profile.
      match: ['/consumer/saved', '/consumer/qr', '/consumer/orders', '/consumer/history', ...profileMatch],
    },
  ];
}
