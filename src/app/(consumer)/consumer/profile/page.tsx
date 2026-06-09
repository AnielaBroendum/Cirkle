'use client';

import { useEffect, useState } from 'react';
import { useAuth } from '@/components/providers/auth-provider';
import { createClient } from '@/lib/supabase';
import { Coins, TrendingUp, TrendingDown, LogOut, ChevronRight } from 'lucide-react';

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

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-gray-900">My profile</h1>

      {/* Points card */}
      <div className="bg-gradient-to-br from-cirkle-600 to-cirkle-700 rounded-2xl p-5 text-white">
        <div className="flex items-center gap-2 mb-1">
          <Coins className="h-4 w-4 opacity-80" />
          <span className="text-sm font-medium opacity-80">Cirkle Points</span>
        </div>
        <p className="text-4xl font-bold">{pointsBalance}</p>
        <p className="text-xs opacity-70 mt-1">1 point = 1 kr discount</p>
      </div>

      {/* Points history */}
      <div>
        <h2 className="text-sm font-semibold text-gray-900 mb-3">Points history</h2>
        {pointsHistory.length === 0 ? (
          <p className="text-sm text-gray-400 text-center py-6">No points yet</p>
        ) : (
          <div className="space-y-2">
            {pointsHistory.map((entry) => (
              <div key={entry.id} className="flex items-center justify-between py-3 px-4 bg-gray-50 rounded-xl">
                <div className="flex items-center gap-3">
                  {entry.amount > 0 ? (
                    <div className="w-8 h-8 rounded-full bg-green-100 flex items-center justify-center">
                      <TrendingUp className="h-4 w-4 text-green-600" />
                    </div>
                  ) : (
                    <div className="w-8 h-8 rounded-full bg-orange-100 flex items-center justify-center">
                      <TrendingDown className="h-4 w-4 text-orange-600" />
                    </div>
                  )}
                  <div>
                    <p className="text-sm font-medium text-gray-900">
                      {REASON_LABELS[entry.reason] || entry.reason}
                    </p>
                    <p className="text-xs text-gray-400">
                      {new Date(entry.created_at).toLocaleDateString('da-DK')}
                    </p>
                  </div>
                </div>
                <span className={`text-sm font-semibold ${entry.amount > 0 ? 'text-green-600' : 'text-orange-600'}`}>
                  {entry.amount > 0 ? '+' : ''}{entry.amount}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Account settings */}
      <div>
        <button
          onClick={() => setShowSettings(!showSettings)}
          className="w-full flex items-center justify-between py-3 px-4 bg-gray-50 rounded-xl hover:bg-gray-100 transition"
        >
          <span className="text-sm font-medium text-gray-900">Account settings</span>
          <ChevronRight className={`h-4 w-4 text-gray-400 transition-transform ${showSettings ? 'rotate-90' : ''}`} />
        </button>

        {showSettings && (
          <form onSubmit={handleSaveSettings} className="mt-3 space-y-3 px-1">
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">Name</label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full rounded-xl border border-gray-300 px-4 py-3 text-sm text-gray-900 focus:border-cirkle-500 focus:ring-cirkle-500 focus:outline-none"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">Email</label>
              <input
                type="email"
                value={email}
                disabled
                className="w-full rounded-xl border border-gray-200 px-4 py-3 text-sm text-gray-400 bg-gray-50"
              />
            </div>
            <button
              type="submit"
              disabled={saving}
              className="w-full bg-cirkle-600 text-white text-sm font-medium py-3 rounded-xl hover:bg-cirkle-700 transition disabled:opacity-50"
            >
              {saving ? 'Saving...' : 'Save changes'}
            </button>
          </form>
        )}
      </div>

      {/* Sign out */}
      <button
        onClick={signOut}
        className="w-full flex items-center justify-center gap-2 rounded-xl border border-gray-300 px-4 py-3 text-sm font-medium text-gray-700 hover:bg-gray-50 transition"
      >
        <LogOut className="h-4 w-4" />
        Sign out
      </button>
    </div>
  );
}
