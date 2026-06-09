'use client';

import { useEffect, useState } from 'react';
import { useAuth } from '@/components/providers/auth-provider';
import { createClient } from '@/lib/supabase';
import { formatDKK } from '@/lib/utils';
import { Receipt, ArrowDownCircle, ArrowUpCircle, XCircle } from 'lucide-react';

type Transaction = {
  id: string;
  brand_name: string;
  product_name: string;
  transaction_type: string;
  amount_dkk: number;
  note: string | null;
  created_at: string;
};

const TYPE_CONFIG: Record<string, { label: string; icon: typeof ArrowDownCircle; color: string }> = {
  deposit_paid: { label: 'Deposit paid', icon: ArrowUpCircle, color: 'text-red-500' },
  deposit_refunded: { label: 'Deposit refunded', icon: ArrowDownCircle, color: 'text-green-500' },
  deposit_forfeited: { label: 'Deposit forfeited', icon: XCircle, color: 'text-amber-500' },
  swap_out: { label: 'Swap out', icon: ArrowUpCircle, color: 'text-purple-500' },
  swap_in: { label: 'Swap in', icon: ArrowDownCircle, color: 'text-blue-500' },
};

export default function RetailerTransactionsPage() {
  const { user } = useAuth();
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    const supabase = createClient();

    supabase
      .from('retailer_profiles')
      .select('id')
      .eq('user_id', user.id)
      .single()
      .then(async ({ data: rp }: { data: { id: string } | null }) => {
        if (!rp) { setLoading(false); return; }

        const { data: txns } = await supabase
          .from('sample_transactions')
          .select('*')
          .eq('retailer_id', rp.id)
          .order('created_at', { ascending: false });

        if (!txns?.length) { setLoading(false); return; }

        const sampleIds = txns.map((t: { sample_id: string }) => t.sample_id);
        const brandIds = Array.from(new Set(txns.map((t: { brand_id: string }) => t.brand_id)));

        const [samplesRes, brandsRes] = await Promise.all([
          supabase.from('samples').select('id, product_id').in('id', sampleIds),
          supabase.from('brand_profiles').select('id, name').in('id', brandIds),
        ]);

        const productIds = Array.from(new Set((samplesRes.data ?? []).map((s: { product_id: string }) => s.product_id)));
        const { data: products } = await supabase.from('products').select('id, name').in('id', productIds);

        const sampleProductMap = new Map(
          (samplesRes.data ?? []).map((s: { id: string; product_id: string }) => [s.id, s.product_id])
        );
        const productMap = new Map((products ?? []).map((p: { id: string; name: string }) => [p.id, p.name]));
        const brandMap = new Map((brandsRes.data ?? []).map((b: { id: string; name: string }) => [b.id, b.name]));

        setTransactions(
          txns.map((t: Record<string, unknown>) => ({
            id: t.id as string,
            brand_name: brandMap.get(t.brand_id as string) ?? 'Unknown',
            product_name: productMap.get(sampleProductMap.get(t.sample_id as string) ?? '') ?? 'Unknown',
            transaction_type: t.transaction_type as string,
            amount_dkk: t.amount_dkk as number,
            note: t.note as string | null,
            created_at: t.created_at as string,
          }))
        );
        setLoading(false);
      });
  }, [user]);

  if (loading) {
    return <div className="space-y-4"><div className="animate-pulse bg-gray-200 rounded h-8 w-48" /><div className="animate-pulse bg-gray-100 rounded-xl h-48" /></div>;
  }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-gray-900">Deposit transactions</h1>

      {transactions.length === 0 ? (
        <div className="text-center py-12 bg-white rounded-xl border border-gray-200">
          <Receipt className="h-12 w-12 text-gray-300 mx-auto" />
          <p className="mt-3 text-gray-500">No transactions yet</p>
          <p className="mt-1 text-sm text-gray-400">Deposit payments and refunds will appear here</p>
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-gray-200 divide-y divide-gray-100">
          {transactions.map((t) => {
            const config = TYPE_CONFIG[t.transaction_type] ?? { label: t.transaction_type, icon: Receipt, color: 'text-gray-500' };
            const Icon = config.icon;
            return (
              <div key={t.id} className="flex items-center gap-3 px-4 py-3">
                <div className={`p-1.5 rounded-lg bg-gray-50 ${config.color}`}>
                  <Icon className="h-4 w-4" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-900">{config.label}</p>
                  <p className="text-xs text-gray-500 truncate">{t.product_name} — {t.brand_name}</p>
                  {t.note && <p className="text-xs text-gray-400 truncate mt-0.5">{t.note}</p>}
                </div>
                <div className="text-right">
                  <p className={`text-sm font-bold ${t.amount_dkk > 0 ? 'text-red-600' : t.amount_dkk < 0 ? 'text-green-600' : 'text-gray-500'}`}>
                    {t.amount_dkk > 0 ? '-' : '+'}{formatDKK(Math.abs(t.amount_dkk))}
                  </p>
                  <p className="text-xs text-gray-400">
                    {new Date(t.created_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}
                  </p>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
