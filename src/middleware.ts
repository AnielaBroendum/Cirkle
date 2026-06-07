import { NextRequest, NextResponse } from 'next/server';
import { createMiddlewareClient } from '@/lib/supabase-middleware';

const PUBLIC_PATHS = ['/', '/auth', '/p', '/d', '/invite'];

function isPublicPath(pathname: string): boolean {
  if (pathname === '/') return true;
  return PUBLIC_PATHS.some(
    (path) => path !== '/' && (pathname === path || pathname.startsWith(path + '/'))
  );
}

export async function middleware(request: NextRequest) {
  const { supabase, response } = createMiddlewareClient(request);
  const { pathname } = request.nextUrl;

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!isPublicPath(pathname) && !user) {
    const loginUrl = new URL('/auth/login', request.url);
    loginUrl.searchParams.set('redirect', pathname);
    return NextResponse.redirect(loginUrl);
  }

  if (user && pathname.startsWith('/auth/') && pathname !== '/auth/callback') {
    const role = user.user_metadata?.role as string | undefined;
    const dashboardUrl = getDashboardUrl(role);
    return NextResponse.redirect(new URL(dashboardUrl, request.url));
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
      return '/consumer/profile';
    default:
      return '/';
  }
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|manifest.json|sw.js|icons/).*)'],
};
