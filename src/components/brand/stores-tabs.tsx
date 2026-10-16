'use client';

import { usePathname, useRouter } from 'next/navigation';
import { Tabs } from '@/components/ds';

// Sub-navigation under "Stores & QR tags": the pages that used to be separate
// sidebar items (samples, requests, swaps, deposits, partnerships).
const TABS = [
  { value: '/brand/samples', label: 'Products in stores' },
  { value: '/brand/samples/requests', label: 'Sample requests' },
  { value: '/brand/samples/swaps', label: 'Swaps' },
  { value: '/brand/samples/transactions', label: 'Deposits' },
  { value: '/brand/partnerships', label: 'Partnerships' },
];

export function StoresTabs({ className }: { className?: string }) {
  const pathname = usePathname() ?? '';
  const router = useRouter();
  const active = TABS.find((t) => t.value === pathname)?.value ?? '/brand/samples';
  return <Tabs variant="underline" items={TABS} value={active} onValueChange={(href) => router.push(href)} className={className} />;
}
