import { NextRequest, NextResponse } from 'next/server';
import { createMiddlewareClient } from '@/lib/supabase-middleware';

// /api/scans answers signed-out calls itself (401), so it isn't redirected.
// /ds-preview is a development-only page (404 in production).
const PUBLIC_PATHS = ['/', '/auth', '/invite', '/api/scans', '/ds-preview'];

// QR landing pages: a store tag (/p/{sample}) or a pass-on link (/d/{product}?ref=).
// A scan must belong to a signed-in shopper, or the chain can't continue from
// them, so signed-out visitors log in (or sign up) first and come back to the
// same URL, query included (?ref= carries the giver).
const SCAN_PATHS = ['/p', '/d'];

// Each route section is locked to a single role.
const ROLE_SECTIONS: Record<string, 'brand' | 'retailer' | 'consumer'> = {
  '/brand': 'brand',
  '/retailer': 'retailer',
  '/consumer': 'consumer',
};

function isPublicPath(pathname: string): boolean {
  if (pathname === '/') return true;
  return PUBLIC_PATHS.some(
    (path) => path !== '/' && (pathname === path || pathname.startsWith(path + '/'))
  );
}

function sectionFor(pathname: string): 'brand' | 'retailer' | 'consumer' | null {
  for (const [prefix, role] of Object.entries(ROLE_SECTIONS)) {
    if (pathname === prefix || pathname.startsWith(prefix + '/')) return role;
  }
  return null;
}

export async function middleware(request: NextRequest) {
  const { supabase, response } = createMiddlewareClient(request);
  const { pathname } = request.nextUrl;

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user && SCAN_PATHS.some((path) => pathname === path || pathname.startsWith(path + '/'))) {
    const loginUrl = new URL('/auth/login', request.url);
    loginUrl.searchParams.set('redirect', pathname + request.nextUrl.search);
    loginUrl.searchParams.set('role', 'consumer');
    return NextResponse.redirect(loginUrl);
  }

  // Unauthenticated users can't reach private routes.
  if (!isPublicPath(pathname) && !user) {
    const loginUrl = new URL('/auth/login', request.url);
    loginUrl.searchParams.set('redirect', pathname);
    return NextResponse.redirect(loginUrl);
  }

  if (user) {
    // Source of truth for role: the profiles row (set at signup by trigger).
    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single();
    const role =
      ((profile as { role?: string } | null)?.role) ??
      (user.user_metadata?.role as string | undefined);

    // NOTE: we deliberately do NOT redirect logged-in users away from /auth/*.
    // The login & signup pages clear any stale session on load, so they always
    // work as a way to switch accounts/roles.

    // Role gating: block access to a section that isn't this user's role.
    const section = sectionFor(pathname);
    if (section && section !== role) {
      return NextResponse.redirect(new URL(getDashboardUrl(role), request.url));
    }
  }

  return response;
}

function getDashboardUrl(role: string | undefined): string {
  switch (role) {
    case 'brand':
      return '/brand/dashboard';
    case 'retailer':
      return '/retailer/dashboard';
    case 'consumer':
      return '/consumer/home';
    default:
      return '/';
  }
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|manifest.json|sw.js|icons/).*)'],
};
