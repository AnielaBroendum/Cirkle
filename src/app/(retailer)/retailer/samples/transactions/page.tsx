'use client';

import { useEffect, useState } from 'react';
import { useAuth } from '@/components/providers/auth-provider';
import { createClient } from '@/lib/supabase';
import { formatDKK } from '@/lib/utils';
import { Receipt } from 'lucide-react';
import { Card, EmptyState, ListSkeleton, Skeleton, StatusPill } from '@/components/ds';

type Transaction = {
  id: string;
  brand_name: string;
  product_name: string;
  transaction_type: string;
  amount_dkk: number;
  note: string | null;
  created_at: string;
};

const TYPE_LABELS: Record<string, string> = {
  deposit_paid: 'Deposit paid',
  deposit_refunded: 'Deposit refunded',
  deposit_forfeited: 'Deposit forfeited',
  swap_out: 'Swap out',
  swap_in: 'Swap in',
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
    return (
      <div className="space-y-7">
        <div className="space-y-2">
          <Skeleton className="h-10 w-56" />
          <Skeleton className="h-4 w-80 max-w-full" />
        </div>
        <ListSkeleton rows={5} />
      </div>
    );
  }

  return (
    <div className="space-y-7">
      <div>
        <h1 className="font-brand text-heading-xl uppercase text-primary">Transactions</h1>
        <p className="mt-1 text-body text-muted">Deposits paid for samples in your store, and what came back.</p>
      </div>

      {transactions.length === 0 ? (
        <EmptyState
          icon={<Receipt className="h-5 w-5" />}
          title="No transactions yet"
          description="Deposit payments and refunds will appear here."
        />
      ) : (
        <Card padding="none">
          {/* Column labels (sm and up) */}
          <div className="hidden grid-cols-[80px_1fr_150px_120px] gap-4 border-b border-line px-6 py-3 text-label uppercase text-muted sm:grid">
            <span>Date</span>
            <span>Product</span>
            <span>Type</span>
            <span className="text-right">Amount</span>
          </div>
          <ul className="divide-y divide-line">
            {transactions.map((t) => (
              <li
                key={t.id}
                className="grid grid-cols-[1fr_auto] items-center gap-x-4 gap-y-1.5 px-4 py-3.5 sm:grid-cols-[80px_1fr_150px_120px] sm:px-6"
              >
                <span className="order-3 text-caption text-muted sm:order-none">
                  {new Date(t.created_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}
                </span>
                <div className="order-1 min-w-0 sm:order-none">
                  <p className="truncate text-body text-primary">{t.product_name}</p>
                  <p className="mt-0.5 truncate text-caption text-muted">
                    {t.brand_name}
                    {t.note && ` · ${t.note}`}
                  </p>
                </div>
                <span className="order-4 justify-self-end sm:order-none sm:justify-self-start">
                  <StatusPill status={t.transaction_type} label={TYPE_LABELS[t.transaction_type] ?? t.transaction_type} />
                </span>
                <p
                  className={`order-2 text-right text-body font-medium sm:order-none ${
                    t.amount_dkk < 0 ? 'text-success' : t.amount_dkk > 0 ? 'text-primary' : 'text-muted'
                  }`}
                >
                  {t.amount_dkk > 0 ? '-' : '+'}{formatDKK(Math.abs(t.amount_dkk))}
                </p>
              </li>
            ))}
          </ul>
        </Card>
      )}
    </div>
  );
}
