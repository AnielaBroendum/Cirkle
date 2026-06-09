'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useAuth } from '@/components/providers/auth-provider';
import { createClient } from '@/lib/supabase';
import { Coins, TrendingUp, TrendingDown, LogOut, ChevronRight, ShoppingBag, Heart, QrCode } from 'lucide-react';

const MENU = [
  { href: '/consumer/orders', label: 'My orders', icon: ShoppingBag },
  { href: '/consumer/saved', label: 'Saved pieces', icon: Heart },
  { href: '/consumer/qr', label: 'My QR codes', icon: QrCode },
];

type PointsEntry = {
  id: string;
  amount: number;
  reason: string;
  created_at: string;
};

const REASON_LABELS: Record<string, string> = {
  welcome_bonus: 'Welcome bonus',
  peer_referral: 'Friend referral',
  redeemed: 'Redeemed on purchase',
};

const REWARD_STEP = 250; // points per reward tier

export default function ConsumerProfilePage() {
  const { user, profile, signOut } = useAuth();
  const [pointsBalance, setPointsBalance] = useState(0);
  const [pointsHistory, setPointsHistory] = useState<PointsEntry[]>([]);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [saving, setSaving] = useState(false);
  const [showSettings, setShowSettings] = useState(false);

  useEffect(() => {
    if (!user) return;
    const supabase = createClient();

    supabase
      .rpc('get_points_balance', { p_user_id: user.id })
      .then(({ data }: { data: number | null }) => setPointsBalance(data ?? 0));

    supabase
      .from('points_ledger')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(20)
      .then(({ data }: { data: PointsEntry[] | null }) => setPointsHistory(data ?? []));
  }, [user]);

  useEffect(() => {
    if (profile) {
      setName(profile.name);
      setEmail(profile.email);
    }
  }, [profile]);

  async function handleSaveSettings(e: React.FormEvent) {
    e.preventDefault();
    if (!user) return;
    setSaving(true);
    const supabase = createClient();
    await supabase.from('profiles').update({ name }).eq('id', user.id);
    setSaving(false);
    setShowSettings(false);
  }

  const initial = (profile?.name ?? 'C').trim().charAt(0).toUpperCase();
  const toNext = REWARD_STEP - (pointsBalance % REWARD_STEP);
  const pct = ((pointsBalance % REWARD_STEP) / REWARD_STEP) * 100;

  return (
    <div className="space-y-6">
      {/* Identity */}
      <div className="flex items-center gap-4 pt-1">
        <span
          className="grid h-16 w-16 flex-none place-items-center rounded-[20px] font-display text-2xl italic text-white"
          style={{ background: 'linear-gradient(135deg,#E0915C,#8b4f1f)' }}
        >
          {initial}
        </span>
        <div className="min-w-0">
          <h1 className="font-display text-[22px] italic leading-tight text-espresso-cream">
            {profile?.name || 'My profile'}
          </h1>
          <p className="mt-0.5 truncate text-[12.5px] text-espresso-muted">
            {profile?.email}
          </p>
        </div>
      </div>

      {/* Points card — dark espresso with gold glow */}
      <div
        className="relative overflow-hidden rounded-2xl border border-espresso-line p-5"
        style={{ background: 'linear-gradient(120deg,#3a2417,#1f120a)' }}
      >
        <span
          className="pointer-events-none absolute -right-8 -top-10 h-40 w-40 rounded-full"
          style={{ background: 'radial-gradient(circle,rgba(216,160,58,0.4),transparent 70%)' }}
        />
        <div className="relative">
          <div className="flex items-center gap-2 text-terracotta">
            <Coins className="h-4 w-4" />
            <span className="text-[11px] font-semibold uppercase tracking-[1.4px]">Cirkle Points</span>
          </div>
          <p className="mt-1 font-display text-[40px] italic leading-none text-espresso-cream">
            {pointsBalance}
            <span className="ml-1 text-base not-italic text-gold">pts</span>
          </p>

          {/* Progress to next reward */}
          <div className="mt-4 h-2 overflow-hidden rounded-full bg-white/10">
            <div
              className="h-full rounded-full transition-all duration-700"
              style={{ width: `${pct}%`, background: 'linear-gradient(90deg,#E0915C,#D8A03A)' }}
            />
          </div>
          <p className="mt-2 text-[11.5px] text-espresso-muted">
            {toNext} points until your next{' '}
            <span className="text-espresso-cream">{REWARD_STEP} kr reward</span>
          </p>
        </div>
      </div>

      {/* Points history */}
      <div>
        <h2 className="mb-3 font-display text-base text-espresso-cream">Points history</h2>
        {pointsHistory.length === 0 ? (
          <p className="py-6 text-center text-sm text-espresso-muted">No points yet</p>
        ) : (
          <div className="space-y-2">
            {pointsHistory.map((entry) => (
              <div
                key={entry.id}
                className="flex items-center justify-between rounded-2xl border border-espresso-line bg-espresso-surface px-4 py-3"
              >
                <div className="flex items-center gap-3">
                  <span
                    className={`grid h-9 w-9 place-items-center rounded-full ${
                      entry.amount > 0 ? 'bg-sage/20 text-sage' : 'bg-terracotta/15 text-terracotta'
                    }`}
                  >
                    {entry.amount > 0 ? (
                      <TrendingUp className="h-4 w-4" />
                    ) : (
                      <TrendingDown className="h-4 w-4" />
                    )}
                  </span>
                  <div>
                    <p className="text-sm font-semibold text-espresso-cream">
                      {REASON_LABELS[entry.reason] || entry.reason}
                    </p>
                    <p className="text-xs text-espresso-muted-2">
                      {new Date(entry.created_at).toLocaleDateString('en-GB')}
                    </p>
                  </div>
                </div>
                <span className={`text-sm font-bold ${entry.amount > 0 ? 'text-sage' : 'text-terracotta'}`}>
                  {entry.amount > 0 ? '+' : ''}
                  {entry.amount}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Menu */}
      <div className="overflow-hidden rounded-2xl border border-espresso-line bg-espresso-surface">
        {MENU.map(({ href, label, icon: Icon }, i) => (
          <Link
            key={label}
            href={href}
            className={`flex items-center gap-3.5 px-4 py-3.5 transition hover:bg-espresso-surface-2 ${
              i > 0 ? 'border-t border-espresso-line' : ''
            }`}
          >
            <Icon className="h-[18px] w-[18px] text-terracotta" />
            <span className="flex-1 text-sm font-medium text-espresso-cream">{label}</span>
            <ChevronRight className="h-4 w-4 text-espresso-muted-2" />
          </Link>
        ))}
      </div>

      {/* Account settings */}
      <div>
        <button
          onClick={() => setShowSettings(!showSettings)}
          className="flex w-full items-center justify-between rounded-2xl border border-espresso-line bg-espresso-surface px-4 py-3.5 transition hover:bg-espresso-surface-2"
        >
          <span className="text-sm font-semibold text-espresso-cream">Account settings</span>
          <ChevronRight
            className={`h-4 w-4 text-espresso-muted transition-transform ${showSettings ? 'rotate-90' : ''}`}
          />
        </button>

        {showSettings && (
          <form onSubmit={handleSaveSettings} className="mt-3 space-y-3 px-1">
            <div>
              <label className="mb-1 block text-xs font-medium text-espresso-muted">Name</label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full rounded-xl border border-espresso-line bg-espresso-surface px-4 py-3 text-sm text-espresso-cream focus:border-terracotta focus:outline-none"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-espresso-muted">Email</label>
              <input
                type="email"
                value={email}
                disabled
                className="w-full rounded-xl border border-espresso-line bg-espresso-surface px-4 py-3 text-sm text-espresso-muted-2"
              />
            </div>
            <button
              type="submit"
              disabled={saving}
              className="w-full rounded-xl bg-terracotta py-3 text-sm font-bold text-espresso-bg transition active:scale-[0.98] disabled:opacity-50"
            >
              {saving ? 'Saving…' : 'Save changes'}
            </button>
          </form>
        )}
      </div>

      {/* Sign out */}
      <button
        onClick={signOut}
        className="flex w-full items-center justify-center gap-2 rounded-2xl border border-espresso-line px-4 py-3.5 text-sm font-semibold text-espresso-cream transition hover:bg-espresso-surface"
      >
        <LogOut className="h-4 w-4" />
        Sign out
      </button>
    </div>
  );
}
