'use client';

import { BottomNav } from '@/components/ds';
import { useAuth } from '@/components/providers/auth-provider';
import { consumerTabs } from '@/components/consumer/tab-items';

// Figma v2 "12 About (DPP)" has the app's tab bar, with Scan active (the page is
// reached from a scanned product). Like the product page, only signed-in shoppers
// see it; a visitor who scanned a tag has no app to navigate yet.
export function AboutTabBar() {
  const { user } = useAuth();
  if (!user) return null;
  return <BottomNav items={consumerTabs({ scanMatch: ['/d'] })} />;
}
