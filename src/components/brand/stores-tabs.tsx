'use client';

import { usePathname, useRouter } from 'next/navigation';
import { Tabs, cn } from '@/components/ds';

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
  return (
    <Tabs
      variant="underline"
      items={TABS}
      value={active}
      onValueChange={(href) => router.push(href)}
      className={cn('[scrollbar-width:none] [&::-webkit-scrollbar]:hidden', className)}
    />
  );
}

/** Page header shared by the Stores & QR tags sub-pages, with the sub-tabs below. */
export function StoresPageHeader({ subtitle, action }: { subtitle: string; action?: React.ReactNode }) {
  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="font-brand text-heading-xl uppercase text-primary">Stores and QR tags</h1>
          <p className="mt-1 text-body text-muted">{subtitle}</p>
        </div>
        {action}
      </div>
      <StoresTabs />
    </div>
  );
}
