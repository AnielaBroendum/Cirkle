import { FlaymsIcon, ProfileIcon, ScanIcon, type NavItem } from '@/components/ds';

/** Figma "Tab bar": Scan · Flayms · Profile. */
export function consumerTabs({ scanMatch = [], profileMatch = [] }: { scanMatch?: string[]; profileMatch?: string[] } = {}): NavItem[] {
  return [
    { href: '/consumer/home', label: 'Scan', icon: ScanIcon, match: scanMatch },
    { href: '/consumer/flayms', label: 'Flayms', icon: FlaymsIcon },
    {
      href: '/consumer/profile',
      label: 'Profile',
      icon: ProfileIcon,
      // Saved, owned items (QR), orders and history live under Profile.
      match: ['/consumer/saved', '/consumer/qr', '/consumer/orders', '/consumer/history', '/consumer/owned', ...profileMatch],
    },
  ];
}
