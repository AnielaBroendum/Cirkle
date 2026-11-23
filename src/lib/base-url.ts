import type { NextRequest } from 'next/server';

/**
 * The app's public address (https://app.flaymforward.com in production).
 *
 * One variable: NEXT_PUBLIC_APP_URL. NEXT_PUBLIC_QR_BASE_URL is only a local
 * override (e.g. http://my-mac.local:3000 so a phone can scan dev tags); it's
 * used when NEXT_PUBLIC_APP_URL is unset or points at localhost. Localhost
 * values are ignored, since links built from them can't be opened on a phone.
 * Works in server and client code (NEXT_PUBLIC_ values are inlined at build).
 */
function configuredAppUrl(): string | null {
  for (const value of [process.env.NEXT_PUBLIC_APP_URL, process.env.NEXT_PUBLIC_QR_BASE_URL]) {
    if (value && !value.includes('localhost') && !value.includes('127.0.0.1')) {
      return value.replace(/\/+$/, '');
    }
  }
  return null;
}

/**
 * The app's address for code without a request (client components, emails).
 * Falls back to the browser's own origin, or to `fallback` on the server.
 */
export function getAppUrl(fallback = ''): string {
  const configured = configuredAppUrl();
  if (configured) return configured;
  if (typeof window !== 'undefined') return window.location.origin;
  return fallback.replace(/\/+$/, '');
}

/**
 * Resolve the public base URL for building scannable links (QR codes, invites)
 * in route handlers: the configured app URL, else the request's own origin
 * (the live deployment domain).
 */
export function getBaseUrl(request: NextRequest): string {
  return configuredAppUrl() ?? request.nextUrl.origin;
}

/**
 * Hosts the app used to live on (NEXT_PUBLIC_LEGACY_HOSTS, comma-separated,
 * e.g. "flaym-abc.vercel.app"). Tags printed with them redirect permanently to
 * the app URL (next.config.js), and the in-app scanner still accepts them.
 */
export function getLegacyHosts(): string[] {
  return (process.env.NEXT_PUBLIC_LEGACY_HOSTS ?? '')
    .split(',')
    .map((h) => h.trim().toLowerCase())
    .filter(Boolean);
}
