'use client';

import { Suspense, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { createClient } from '@/lib/supabase';
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
          ? 'Forkert e-mail eller adgangskode'
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
    <form onSubmit={handleSubmit} className="space-y-6">
      <div>
        <label htmlFor="email" className="block text-sm font-medium text-gray-700">
          E-mail
        </label>
        <input
          id="email"
          type="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="mt-1 block w-full rounded-lg border border-gray-300 px-4 py-3 text-gray-900 placeholder-gray-400 focus:border-cirkle-500 focus:ring-cirkle-500 focus:outline-none"
          placeholder="dig@eksempel.dk"
        />
      </div>

      <div>
        <label htmlFor="password" className="block text-sm font-medium text-gray-700">
          Adgangskode
        </label>
        <input
          id="password"
          type="password"
          required
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="mt-1 block w-full rounded-lg border border-gray-300 px-4 py-3 text-gray-900 placeholder-gray-400 focus:border-cirkle-500 focus:ring-cirkle-500 focus:outline-none"
          placeholder="Din adgangskode"
        />
      </div>

      {error && (
        <p className="text-sm text-red-600 bg-red-50 rounded-lg px-4 py-3">
          {error}
        </p>
      )}

      <button
        type="submit"
        disabled={loading}
        className="w-full rounded-lg bg-cirkle-600 px-4 py-3 text-white font-medium hover:bg-cirkle-700 transition disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {loading ? 'Logger ind...' : 'Log ind'}
      </button>
    </form>
  );
}

export default function LoginPage() {
  return (
    <main className="min-h-screen flex items-center justify-center px-4 py-12 bg-gray-50">
      <div className="w-full max-w-md space-y-8">
        <div className="text-center">
          <Link href="/" className="text-3xl font-bold text-cirkle-950">
            Cirkle
          </Link>
          <h1 className="mt-4 text-2xl font-semibold text-gray-900">
            Log ind
          </h1>
          <p className="mt-2 text-sm text-gray-500">
            Velkommen tilbage
          </p>
        </div>

        <Suspense>
          <LoginForm />
        </Suspense>

        <p className="text-center text-sm text-gray-500">
          Har du ikke en konto?{' '}
          <Link href="/auth/signup" className="text-cirkle-600 hover:underline font-medium">
            Opret konto
          </Link>
        </p>
      </div>
    </main>
  );
}
