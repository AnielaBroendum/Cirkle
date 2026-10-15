'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useAuth } from '@/components/providers/auth-provider';
import { createClient } from '@/lib/supabase';
import { Logo, cn } from '@/components/ds';
import { FlameIcon, Thumb } from '@/components/consumer/checkout-parts';
import { timeAgo } from '@/components/consumer/time-ago';
import type { FlaymsStats } from '@/components/consumer/use-flayms';
import { useFlayms } from '@/components/consumer/use-flayms';

type PointsEntry = { id: string; amount: number; reason: string; created_at: string };

const REASON_LABELS: Record<string, string> = {
  welcome_bonus: 'Welcome bonus',
  peer_referral: 'A flame was lit',
  redeemed: 'Used on a purchase',
};

function LatestRow({ item }: { item: FlaymsStats['latest'][number] }) {
  const who = item.friend ?? 'a friend';
  return (
    <Link href={`/d/${item.productId}`} className="flex items-center gap-3.5 py-4">
      <Thumb src={item.image} alt={item.productName} className="h-[60px] w-12" />
      <div className="min-w-0 flex-1">
        <p className="truncate text-body text-on-primary">{item.productName}</p>
        <p className="truncate text-caption text-muted">
          {item.type === 'lit' ? `Lit by ${who}` : `Passed on to ${who}`} · {timeAgo(item.at)}
        </p>
      </div>
      <span className={cn('text-[16px]', item.type === 'lit' ? 'text-accent' : 'text-muted')} aria-label={item.type === 'lit' ? 'Lit' : 'Passed on'}>
        {item.type === 'lit' ? '●' : '○'}
      </span>
    </Link>
  );
}

export default function FlaymsPage() {
  const { user } = useAuth();
  const { stats, error } = useFlayms();
  const [history, setHistory] = useState<PointsEntry[] | null>(null);
  const [copied, setCopied] = useState(false);

  // Points history (moved here from Profile): same query as before.
  useEffect(() => {
    if (!user) return;
    createClient()
      .from('points_ledger')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(20)
      .then(({ data }: { data: PointsEntry[] | null }) => setHistory(data ?? []));
  }, [user]);

  async function copyInvite() {
    const url = window.location.origin;
    try {
      if (typeof navigator.share === 'function') {
        await navigator.share({ title: 'Flaym', text: 'Find things in real shops with Flaym', url });
        return;
      }
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      /* cancelled */
    }
  }

  return (
    <div className="px-5 pb-6">
      <header className="flex h-[52px] items-end justify-between pb-1">
        <h1 className="font-brand text-[18px] font-normal uppercase leading-none tracking-[0.4px] text-on-primary">Your Flayms</h1>
        <Logo height={20} />
      </header>

      {/* Passed on · Lit */}
      <div className="mt-4 grid grid-cols-2 gap-3">
        <div className="h-[104px] bg-surface-dark p-4">
          <p className="text-[40px] font-medium leading-none text-on-primary">{stats ? stats.passedOn : '–'}</p>
          <p className="mt-4 text-label uppercase text-muted">Passed on</p>
        </div>
        <div className="h-[104px] bg-accent p-4 text-on-primary">
          <p className="text-[40px] font-medium leading-none">{stats ? stats.lit : '–'}</p>
          <p className="mt-4 text-label uppercase">Lit</p>
        </div>
      </div>
      <p className="mt-4 text-caption text-line">A flame is lit when someone buys something you passed on.</p>

      {/* Spendable balance (points) */}
      {stats && (
        <div className="mt-3 flex items-start gap-2">
          <FlameIcon className="mt-0.5 h-3 w-auto" />
          <p className="text-caption text-on-primary">
            {stats.balance} Flayms to spend
            <span className="block text-muted">1 Flaym = 1 kr off at checkout</span>
          </p>
        </div>
      )}

      {/* Latest */}
      <p className="mt-6 text-label uppercase text-muted">Latest</p>
      {error ? (
        <p className="mt-3 text-caption text-line">We couldn&rsquo;t load your flames. Try again in a moment.</p>
      ) : !stats ? (
        <div className="mt-3 space-y-3" aria-busy>
          {[0, 1, 2].map((i) => (
            <div key={i} className="flex items-center gap-3.5">
              <div className="h-[60px] w-12 animate-pulse bg-surface-dark" />
              <div className="h-4 w-40 animate-pulse bg-surface-dark" />
            </div>
          ))}
        </div>
      ) : stats.latest.length === 0 ? (
        <div className="mt-3 bg-surface-dark p-4">
          <p className="text-body text-on-primary">Nothing passed on yet</p>
          <p className="mt-1 text-caption text-muted">
            When something you own arrives, let a friend scan its code from{' '}
            <Link href="/consumer/profile" className="text-accent">
              Profile → Owned
            </Link>
            .
          </p>
        </div>
      ) : (
        <ul className="divide-y divide-line-dark">
          {stats.latest.slice(0, 10).map((item, i) => (
            <li key={`${item.type}-${item.at}-${i}`}>
              <LatestRow item={item} />
            </li>
          ))}
        </ul>
      )}

      {/* Earned & spent */}
      {history && history.length > 0 && (
        <>
          <p className="mt-6 text-label uppercase text-muted">Earned &amp; spent</p>
          <ul className="mt-1 divide-y divide-line-dark">
            {history.map((entry) => (
              <li key={entry.id} className="flex items-center justify-between py-3">
                <div>
                  <p className="text-body text-on-primary">{REASON_LABELS[entry.reason] || entry.reason}</p>
                  <p className="text-caption text-muted">{new Date(entry.created_at).toLocaleDateString('en-GB')}</p>
                </div>
                <span className={cn('text-body', entry.amount > 0 ? 'text-accent' : 'text-muted')}>
                  {entry.amount > 0 ? '+' : ''}
                  {entry.amount}
                </span>
              </li>
            ))}
          </ul>
        </>
      )}

      <button
        type="button"
        onClick={copyInvite}
        className="mt-8 flex h-[52px] w-full items-center justify-center border border-muted text-[15px] font-medium text-on-primary hover:border-on-primary"
      >
        {copied ? 'Link copied' : 'Invite a friend · copy link'}
      </button>
    </div>
  );
}
