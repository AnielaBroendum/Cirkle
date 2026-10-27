'use client';

import { useEffect, useState } from 'react';
import { useRouter, useParams } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/components/providers/auth-provider';
import { createClient } from '@/lib/supabase';
import { formatCommission } from '@/lib/utils';
import { Check, Loader2 } from 'lucide-react';
import { Avatar, Button, List, ListRow, buttonClasses } from '@/components/ds';
import { AuthShell, AuthError } from '@/components/shared/auth-shell';

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
      <main className="flex min-h-screen items-center justify-center bg-canvas" aria-busy>
        <Loader2 className="h-6 w-6 animate-spin text-slate" aria-label="Loading invitation" />
      </main>
    );
  }

  if (error && !invitation) {
    return (
      <AuthShell eyebrow="Retail Portal · Invitation" title="Not found" intro={error}>
        <Link href="/" className={buttonClasses({ variant: 'secondary', fullWidth: true })}>
          Go to homepage
        </Link>
      </AuthShell>
    );
  }

  if (!invitation) return null;

  if (invitation.status !== 'invited') {
    return (
      <AuthShell eyebrow="Retail Portal · Invitation" title="Already used" intro="This invitation has already been used.">
        <Link href="/" className={buttonClasses({ variant: 'secondary', fullWidth: true })}>
          Go to homepage
        </Link>
      </AuthShell>
    );
  }

  return (
    <AuthShell
      eyebrow="Retail Portal · Invitation"
      title={`${invitation.brand_name} invites you`}
      intro="Show their products in your store and earn commission on what sells."
    >
      <div className="flex items-center gap-3">
        <Avatar name={invitation.brand_name} src={invitation.brand_logo} size="lg" />
        <p className="text-body text-primary">{invitation.brand_name}</p>
      </div>

      <div>
        <p className="mb-1.5 text-label uppercase text-slate">Commission rates</p>
        <List>
          <ListRow title="Direct sale" trailing={<span className="text-body font-medium text-primary">{formatCommission(invitation.commission_direct)}</span>} />
          <ListRow title="Deferred sale (90 days)" trailing={<span className="text-body font-medium text-primary">{formatCommission(invitation.commission_deferred)}</span>} />
          <ListRow title="Tier-2 (brand discovery)" trailing={<span className="text-body font-medium text-primary">{formatCommission(invitation.commission_tier2)}</span>} />
        </List>
      </div>

      {accepted ? (
        <p role="status" className="flex items-center gap-2 border border-success bg-success-subtle px-4 py-3 text-body text-success">
          <Check className="h-4 w-4" />
          Invitation accepted!
        </p>
      ) : user ? (
        <>
          {error && <AuthError>{error}</AuthError>}
          <Button onClick={handleAccept} loading={accepting} fullWidth className="h-[52px]">
            {accepting ? 'Accepting...' : 'Accept invitation'}
          </Button>
        </>
      ) : (
        <div className="space-y-3">
          <Link
            href={`/auth/signup?role=retailer&redirect=/invite/${token}`}
            className={buttonClasses({ fullWidth: true, className: 'h-[52px]' })}
          >
            Create retailer account
          </Link>
          <p className="text-body-sm text-slate">
            Already have an account?{' '}
            <Link href={`/auth/login?redirect=/invite/${token}`} className="text-primary underline">
              Log in
            </Link>
          </p>
        </div>
      )}
    </AuthShell>
  );
}
