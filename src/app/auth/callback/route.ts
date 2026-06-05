import { NextRequest, NextResponse } from 'next/server';
import { createMiddlewareClient } from '@/lib/supabase-middleware';

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const code = searchParams.get('code');
  const redirectTo = searchParams.get('redirect') || '/';

  if (code) {
    const { supabase, response } = createMiddlewareClient(request);
    const { data, error } = await supabase.auth.exchangeCodeForSession(code);

    if (!error && data.user) {
      const role = data.user.user_metadata?.role as string | undefined;
      let destination = redirectTo;

      if (redirectTo === '/' || redirectTo.startsWith('/auth')) {
        switch (role) {
          case 'brand':
            destination = '/brand/dashboard';
            break;
          case 'retailer':
            destination = '/retailer/dashboard';
            break;
          case 'consumer':
            destination = '/consumer/profile';
            break;
        }
      }

      const url = new URL(destination, request.url);
      return NextResponse.redirect(url, { headers: response.headers });
    }
  }

  return NextResponse.redirect(new URL('/auth/login', request.url));
}
