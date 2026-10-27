'use client';

import { Suspense, useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import AuthSwitchLink from '../switch-link';
import { createClient } from '@/lib/supabase';
import { Button, Field, Input, cn } from '@/components/ds';
import { AuthShell, AuthError } from '@/components/shared/auth-shell';

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

  // Drop any persisted session on arrival so a new account starts clean.
  useEffect(() => {
    createClient().auth.signOut();
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!role) {
      setError('Please select a role');
      return;
    }

    setError('');
    setLoading(true);

    const supabase = createClient();
    // Ensure no leftover session interferes with creating the new account.
    await supabase.auth.signOut();

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
    if (role === 'consumer') {
      // New shoppers choose their consents first (Figma 02), then carry on.
      const next = redirect && !redirect.startsWith('/auth') ? `?redirect=${encodeURIComponent(redirect)}` : '';
      router.push(`/consumer/consent${next}`);
    } else if (redirect && !redirect.startsWith('/auth')) {
      router.push(redirect);
    } else {
      switch (role) {
        case 'brand':
          router.push('/brand/dashboard');
          break;
        case 'retailer':
          router.push('/retailer/dashboard');
          break;
      }
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      <fieldset className="space-y-1.5">
        <legend className="mb-1.5 text-label uppercase text-slate">I am a</legend>
        <div className="grid grid-cols-3 gap-2">
          {(Object.entries(ROLE_CONFIG) as [Role, typeof ROLE_CONFIG[Role]][]).map(
            ([key, config]) => (
              <button
                key={key}
                type="button"
                aria-pressed={role === key}
                onClick={() => setRole(key)}
                className={cn(
                  'flex flex-col gap-1 rounded-control border p-3 text-left transition-colors',
                  role === key
                    ? 'border-primary bg-primary text-on-primary'
                    : 'border-line bg-surface text-primary hover:border-primary'
                )}
              >
                <span className="text-body font-medium">{config.label}</span>
                <span className={cn('text-label leading-[14px] tracking-normal', role === key ? 'text-ash' : 'text-slate')}>
                  {config.description}
                </span>
              </button>
            )
          )}
        </div>
      </fieldset>

      <Field label="Name" htmlFor="name">
        <Input
          id="name"
          type="text"
          required
          autoComplete="name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Your name"
        />
      </Field>

      <Field label="Email" htmlFor="email">
        <Input
          id="email"
          type="email"
          required
          autoComplete="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="you@example.com"
        />
      </Field>

      <Field label="Password" htmlFor="password">
        <Input
          id="password"
          type="password"
          required
          minLength={6}
          autoComplete="new-password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="At least 6 characters"
        />
      </Field>

      {error && <AuthError>{error}</AuthError>}

      <Button type="submit" fullWidth loading={loading} className="h-[52px]">
        {loading ? 'Creating account...' : 'Create account'}
      </Button>
    </form>
  );
}

export default function SignUpPage() {
  return (
    <AuthShell
      eyebrow="Flaym"
      title="Create account"
      intro="Scan it. Save it. Pass it on."
    >
      <Suspense>
        <SignUpForm />
      </Suspense>

      <p className="text-body-sm text-slate">
        Already have an account?{' '}
        <AuthSwitchLink to="/auth/login" className="text-primary underline">
          Log in
        </AuthSwitchLink>
      </p>
    </AuthShell>
  );
}
