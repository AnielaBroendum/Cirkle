'use client';

import { Suspense, useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import AuthSwitchLink from '../switch-link';
import { createClient } from '@/lib/supabase';
import { Button, Field, Input } from '@/components/ds';
import { AuthError } from '@/components/shared/auth-shell';
import { LoginShell } from '@/components/shared/login-shell';
import type { Database } from '@/lib/database.types';

type Profile = Database['public']['Tables']['profiles']['Row'];

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const redirectTo = searchParams.get('redirect');

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  // Clear any persisted session so this page always starts clean — lets you
  // sign in as a different account/role without being bounced to a dashboard.
  useEffect(() => {
    createClient().auth.signOut();
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setLoading(true);

    const supabase = createClient();

    const { data: authData, error: signInError } =
      await supabase.auth.signInWithPassword({ email, password });

    if (signInError) {
      setError(
        signInError.message === 'Invalid login credentials'
          ? 'Invalid email or password'
          : signInError.message
      );
      setLoading(false);
      return;
    }

    if (redirectTo && !redirectTo.startsWith('/auth')) {
      router.push(redirectTo);
      return;
    }

    const { data } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', authData.user.id)
      .single();

    const profile = data as Profile | null;
    const role = profile?.role ?? (authData.user.user_metadata?.role as string | undefined);

    switch (role) {
      case 'brand':
        router.push('/brand/dashboard');
        break;
      case 'retailer':
        router.push('/retailer/dashboard');
        break;
      case 'consumer':
        router.push('/consumer/profile');
        break;
      default:
        router.push('/');
    }
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-[18px]">
      <Field label="Email" htmlFor="email">
        <Input
          id="email"
          type="email"
          required
          autoComplete="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="you@example.com"
          className="h-12 border-line-dark-subtle bg-canvas-dark text-body-sm text-flare"
        />
      </Field>

      <Field label="Password" htmlFor="password">
        <div className="relative">
          <Input
            id="password"
            type={showPassword ? 'text' : 'password'}
            required
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Your password"
            className="h-12 border-line-dark-subtle bg-canvas-dark pr-16 text-body-sm text-flare"
          />
          <button
            type="button"
            onClick={() => setShowPassword((s) => !s)}
            aria-pressed={showPassword}
            className="absolute inset-y-0 right-0 px-4 text-caption text-smoke hover:text-flare"
          >
            {showPassword ? 'Hide' : 'Show'}
          </button>
        </div>
      </Field>

      {error && <AuthError>{error}</AuthError>}

      <Button type="submit" variant="flame" fullWidth loading={loading} className="h-12">
        {loading ? 'Logging in...' : 'Log in'}
      </Button>
    </form>
  );
}

export default function LoginPage() {
  return (
    <LoginShell eyebrow="Flaym" title="Log in" intro="Brands, stores and shoppers all log in here.">
      <Suspense>
        <LoginForm />
      </Suspense>

      <div className="space-y-2 text-caption text-smoke">
        <p>
          No account yet?{' '}
          <AuthSwitchLink to="/auth/signup" className="font-medium text-accent-bright hover:underline">
            Create one
          </AuthSwitchLink>
        </p>
        <p>Store invited by a brand? Use the link in your invitation email.</p>
        <p>
          Need help?{' '}
          <a href="mailto:hello@flaym.app" className="text-ash underline">
            hello@flaym.app
          </a>
        </p>
      </div>
    </LoginShell>
  );
}
