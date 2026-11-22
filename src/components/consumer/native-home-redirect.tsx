'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { isNativeApp } from '@/lib/native';

/**
 * In the iPhone app the welcome screen (/) is skipped: the app opens on Scan,
 * and the middleware sends signed-out shoppers to login first. In a browser
 * nothing happens, so brands and stores still see the welcome screen.
 */
export function NativeHomeRedirect() {
  const router = useRouter();
  useEffect(() => {
    if (isNativeApp()) router.replace('/consumer/home');
  }, [router]);
  return null;
}
