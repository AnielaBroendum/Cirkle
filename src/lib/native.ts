'use client';

import { useEffect, useState } from 'react';
import { Capacitor } from '@capacitor/core';

/**
 * True only inside the iPhone app (the Capacitor shell that loads the live
 * site). In a normal browser, and on the server, it's false, so the web app
 * behaves exactly as before. All native-only code goes behind this.
 */
export function isNativeApp(): boolean {
  if (typeof window === 'undefined') return false;
  try {
    return Capacitor.isNativePlatform();
  } catch {
    return false;
  }
}

/**
 * React version of isNativeApp(). False on the server and on the first render,
 * then the real value, so server and client HTML match.
 */
export function useIsNativeApp(): boolean {
  const [native, setNative] = useState(false);
  useEffect(() => {
    setNative(isNativeApp());
  }, []);
  return native;
}

/** Shown where Buy would be in the app: no payments in the TestFlight round. */
export const NATIVE_BUY_SOON = 'Coming soon';
