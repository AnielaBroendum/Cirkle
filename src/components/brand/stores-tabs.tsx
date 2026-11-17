'use client';

import { useEffect, useRef } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { PageHeader, Tabs, cn } from '@/components/ds';

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
  const ref = useRef<HTMLDivElement>(null);

  // On narrow screens the tab row scrolls; keep the current tab in view.
  useEffect(() => {
    ref.current?.querySelector<HTMLElement>('[aria-selected="true"]')?.scrollIntoView({ block: 'nearest', inline: 'center' });
  }, [active]);

  return (
    <div ref={ref}>
      <Tabs
        variant="underline"
        items={TABS}
        value={active}
        onValueChange={(href) => router.push(href)}
        className={cn('[scrollbar-width:none] [&::-webkit-scrollbar]:hidden', className)}
      />
    </div>
  );
}

/** Page header shared by the Stores & QR tags sub-pages, with the sub-tabs below. */
export function StoresPageHeader({ subtitle, action }: { subtitle: string; action?: React.ReactNode }) {
  return (
    <div className="space-y-5">
      <PageHeader title="Stores & QR tags" subtitle={subtitle} actions={action} />
      <StoresTabs />
    </div>
  );
}
