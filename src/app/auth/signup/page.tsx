'use client';

import { Suspense, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { createClient } from '@/lib/supabase';
import { Loader2 } from 'lucide-react';

type Role = 'brand' | 'retailer' | 'consumer';

const ROLE_CONFIG: Record<Role, { label: string; description: string }> = {
  brand: {
    label: 'Brand',
    description: 'I sell products and want to reach new customers',
  },
  retailer: {
    label: 'Retailer',
    description: 'I want to display samples and earn commission',
  },
  consumer: {
    label: 'Shopper',
    description: 'I want to discover and buy fashion',
  },
};

function SignUpForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const initialRole = (searchParams.get('role') as Role) || null;

  const [role, setRole] = useState<Role | null>(initialRole);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!role) {
      setError('Please select a role');
      return;
    }

    setError('');
    setLoading(true);

    const supabase = createClient();

    const { error: signUpError } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          role,
          name,
        },
      },
    });

    if (signUpError) {
      setError(signUpError.message);
      setLoading(false);
      return;
    }

    const redirect = searchParams.get('redirect');
    if (redirect && !redirect.startsWith('/auth')) {
      router.push(redirect);
    } else {
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
      }
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div className="space-y-3">
        <label className="block text-sm font-medium text-gray-700">
          I am a...
        </label>
        <div className="grid grid-cols-3 gap-3">
          {(Object.entries(ROLE_CONFIG) as [Role, typeof ROLE_CONFIG[Role]][]).map(
            ([key, config]) => (
              <button
                key={key}
                type="button"
                onClick={() => setRole(key)}
                className={`flex flex-col items-center p-4 rounded-xl border-2 transition-all ${
                  role === key
                    ? 'border-cirkle-500 bg-cirkle-50 text-cirkle-700'
                    : 'border-gray-200 bg-white text-gray-600 hover:border-gray-300'
                }`}
              >
                <span className="text-sm font-semibold">{config.label}</span>
                <span className="text-xs mt-1 text-center leading-tight">
                  {config.description}
                </span>
              </button>
            )
          )}
        </div>
      </div>

      <div>
        <label htmlFor="name" className="block text-sm font-medium text-gray-700">
          Name
        </label>
        <input
          id="name"
          type="text"
          required
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="mt-1 block w-full rounded-lg border border-gray-300 px-4 py-3 text-gray-900 placeholder-gray-400 focus:border-cirkle-500 focus:ring-cirkle-500 focus:outline-none"
          placeholder="Your name"
        />
      </div>

      <div>
        <label htmlFor="email" className="block text-sm font-medium text-gray-700">
          Email
        </label>
        <input
          id="email"
          type="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="mt-1 block w-full rounded-lg border border-gray-300 px-4 py-3 text-gray-900 placeholder-gray-400 focus:border-cirkle-500 focus:ring-cirkle-500 focus:outline-none"
          placeholder="you@example.com"
        />
      </div>

      <div>
        <label htmlFor="password" className="block text-sm font-medium text-gray-700">
          Password
        </label>
        <input
          id="password"
          type="password"
          required
          minLength={6}
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="mt-1 block w-full rounded-lg border border-gray-300 px-4 py-3 text-gray-900 placeholder-gray-400 focus:border-cirkle-500 focus:ring-cirkle-500 focus:outline-none"
          placeholder="At least 6 characters"
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
        className="w-full rounded-lg bg-cirkle-600 px-4 py-3 text-white font-medium hover:bg-cirkle-700 transition disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
      >
        {loading ? (
          <>
            <Loader2 className="h-4 w-4 animate-spin" />
            Creating account...
          </>
        ) : (
          'Create account'
        )}
      </button>
    </form>
  );
}

export default function SignUpPage() {
  return (
    <main className="min-h-screen flex items-center justify-center px-4 py-12 bg-gray-50">
      <div className="w-full max-w-md space-y-8">
        <div className="text-center">
          <Link href="/" className="text-3xl font-bold text-cirkle-950">
            Cirkle
          </Link>
          <h1 className="mt-4 text-2xl font-semibold text-gray-900">
            Create account
          </h1>
          <p className="mt-2 text-sm text-gray-500">
            Get started with Cirkle
          </p>
        </div>

        <Suspense>
          <SignUpForm />
        </Suspense>

        <p className="text-center text-sm text-gray-500">
          Already have an account?{' '}
          <Link href="/auth/login" className="text-cirkle-600 hover:underline font-medium">
            Sign in
          </Link>
        </p>
      </div>
    </main>
  );
}
