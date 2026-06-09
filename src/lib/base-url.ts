import type { NextRequest } from 'next/server';

/**
 * Resolve the public base URL for building scannable links (QR codes, invites).
 *
 * Prefers an explicitly configured production URL, but ignores localhost values
 * (which would make QR codes unscannable from a phone) and falls back to the
 * actual origin of the incoming request — i.e. the live deployment domain.
 */
export function getBaseUrl(request: NextRequest): string {
  const configured =
    process.env.NEXT_PUBLIC_QR_BASE_URL || process.env.NEXT_PUBLIC_APP_URL;

  if (configured && !configured.includes('localhost') && !configured.includes('127.0.0.1')) {
    return configured.replace(/\/+$/, '');
  }

  return request.nextUrl.origin;
}
