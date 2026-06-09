'use client';

import { useEffect, useState } from 'react';
import { useRouter, useParams } from 'next/navigation';
import Link from 'next/link';
import Image from 'next/image';
import { useAuth } from '@/components/providers/auth-provider';
import { createClient } from '@/lib/supabase';
import { formatCommission } from '@/lib/utils';
import { Check, Loader2 } from 'lucide-react';

type InvitationData = {
  id: string;
  brand_name: string;
  brand_logo: string | null;
  commission_direct: number;
  commission_deferred: number;
  commission_tier2: number;
  status: string;
};

export default function InvitePage() {
  const params = useParams();
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();
  const [invitation, setInvitation] = useState<InvitationData | null>(null);
  const [loading, setLoading] = useState(true);
  const [accepting, setAccepting] = useState(false);
  const [error, setError] = useState('');
  const [accepted, setAccepted] = useState(false);

  const token = params.token as string;

  useEffect(() => {
    const supabase = createClient();
    supabase
      .from('brand_retailer_partnerships')
      .select('id, brand_id, commission_direct, commission_deferred, commission_tier2, status')
      .eq('invitation_token', token)
      .single()
      .then(async ({ data, error: fetchError }: { data: Record<string, unknown> | null; error: { message: string } | null }) => {
        if (fetchError || !data) {
          setError('Invitation not found or expired.');
          setLoading(false);
          return;
        }

        const partnership = data as {
          id: string;
          brand_id: string;
          commission_direct: number;
          commission_deferred: number;
          commission_tier2: number;
          status: string;
        };

        const { data: brand } = await supabase
          .from('brand_profiles')
          .select('name, logo_url')
          .eq('id', partnership.brand_id)
          .single();

        const brandData = brand as { name: string; logo_url: string | null } | null;

        setInvitation({
          id: partnership.id,
          brand_name: brandData?.name ?? 'Unknown Brand',
          brand_logo: brandData?.logo_url ?? null,
          commission_direct: partnership.commission_direct,
          commission_deferred: partnership.commission_deferred,
          commission_tier2: partnership.commission_tier2,
          status: partnership.status,
        });
        setLoading(false);
      });
  }, [token]);

  async function handleAccept() {
    setAccepting(true);
    setError('');

    const res = await fetch('/api/partnerships/accept', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token }),
    });

    if (!res.ok) {
      const data = await res.json();
      setError(data.error ?? 'Something went wrong');
      setAccepting(false);
      return;
    }

    setAccepted(true);
    setTimeout(() => router.push('/retailer/onboarding'), 1500);
  }

  if (loading || authLoading) {
    return (
      <main className="min-h-screen flex items-center justify-center bg-gray-50">
        <Loader2 className="h-6 w-6 animate-spin text-gray-400" />
      </main>
    );
  }

  if (error && !invitation) {
    return (
      <main className="min-h-screen flex items-center justify-center px-4 bg-gray-50">
        <div className="text-center space-y-4">
          <p className="text-gray-500">{error}</p>
          <Link href="/" className="text-cirkle-600 hover:underline text-sm font-medium">
            Go to homepage
          </Link>
        </div>
      </main>
    );
  }

  if (!invitation) return null;

  if (invitation.status !== 'invited') {
    return (
      <main className="min-h-screen flex items-center justify-center px-4 bg-gray-50">
        <div className="text-center space-y-4">
          <p className="text-gray-500">This invitation has already been used.</p>
          <Link href="/" className="text-cirkle-600 hover:underline text-sm font-medium">
            Go to homepage
          </Link>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen flex items-center justify-center px-4 py-12 bg-gray-50">
      <div className="w-full max-w-md space-y-6">
        <div className="text-center">
          <Link href="/" className="text-3xl font-bold text-cirkle-950">
            Cirkle
          </Link>
        </div>

        <div className="bg-white rounded-2xl border border-gray-200 p-6 space-y-6">
          <div className="text-center space-y-3">
            {invitation.brand_logo ? (
              <div className="relative w-16 h-16 mx-auto rounded-xl overflow-hidden border border-gray-200">
                <Image
                  src={invitation.brand_logo}
                  alt={invitation.brand_name}
                  fill
                  className="object-cover"
                  sizes="64px"
                />
              </div>
            ) : (
              <div className="w-16 h-16 mx-auto rounded-xl bg-cirkle-50 flex items-center justify-center">
                <span className="text-2xl font-bold text-cirkle-600">
                  {invitation.brand_name.charAt(0)}
                </span>
              </div>
            )}
            <div>
              <h1 className="text-xl font-semibold text-gray-900">
                {invitation.brand_name} invites you
              </h1>
              <p className="text-sm text-gray-500 mt-1">
                Become a retail partner and earn commission on sales
              </p>
            </div>
          </div>

          <div className="bg-gray-50 rounded-xl p-4 space-y-2">
            <h2 className="text-sm font-medium text-gray-700">Commission rates</h2>
            <div className="space-y-1.5 text-sm">
              <div className="flex justify-between">
                <span className="text-gray-600">Direct sale</span>
                <span className="font-medium text-gray-900">
                  {formatCommission(invitation.commission_direct)}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">Deferred sale (90 days)</span>
                <span className="font-medium text-gray-900">
                  {formatCommission(invitation.commission_deferred)}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">Tier-2 (brand discovery)</span>
                <span className="font-medium text-gray-900">
                  {formatCommission(invitation.commission_tier2)}
                </span>
              </div>
            </div>
          </div>

          {accepted ? (
            <div className="flex items-center justify-center gap-2 text-green-600 py-3">
              <Check className="h-5 w-5" />
              <span className="font-medium">Invitation accepted!</span>
            </div>
          ) : user ? (
            <>
              {error && (
                <p className="text-sm text-red-600 bg-red-50 rounded-lg px-4 py-3">{error}</p>
              )}
              <button
                onClick={handleAccept}
                disabled={accepting}
                className="w-full rounded-lg bg-cirkle-600 px-4 py-3 text-white font-medium hover:bg-cirkle-700 transition disabled:opacity-50"
              >
                {accepting ? 'Accepting...' : 'Accept invitation'}
              </button>
            </>
          ) : (
            <div className="space-y-3">
              <Link
                href={`/auth/signup?role=retailer&redirect=/invite/${token}`}
                className="block w-full rounded-lg bg-cirkle-600 px-4 py-3 text-white font-medium text-center hover:bg-cirkle-700 transition"
              >
                Create retailer account
              </Link>
              <p className="text-center text-sm text-gray-500">
                Already have an account?{' '}
                <Link
                  href={`/auth/login?redirect=/invite/${token}`}
                  className="text-cirkle-600 hover:underline font-medium"
                >
                  Sign in
                </Link>
              </p>
            </div>
          )}
        </div>
      </div>
    </main>
  );
}
