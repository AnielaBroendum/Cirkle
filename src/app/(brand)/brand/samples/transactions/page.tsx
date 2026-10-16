'use client';

import { useEffect, useState } from 'react';
import { useAuth } from '@/components/providers/auth-provider';
import { createClient } from '@/lib/supabase';
import { formatDKK } from '@/lib/utils';
import { Receipt } from 'lucide-react';
import { EmptyState, ListSkeleton, StatusPill, Table, THead, TBody, TR, TH, TD, cn } from '@/components/ds';
import { StoresPageHeader } from '@/components/brand/stores-tabs';

type Transaction = {
  id: string;
  retailer_name: string;
  product_name: string;
  transaction_type: string;
  amount_dkk: number;
  note: string | null;
  created_at: string;
};

const TYPE_LABELS: Record<string, string> = {
  deposit_paid: 'Deposit received',
  deposit_refunded: 'Deposit refunded',
  deposit_forfeited: 'Deposit forfeited',
  swap_out: 'Swap out',
  swap_in: 'Swap in',
};

export default function BrandTransactionsPage() {
  const { user } = useAuth();
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    const supabase = createClient();

    supabase
      .from('brand_profiles')
      .select('id')
      .eq('user_id', user.id)
      .single()
      .then(async ({ data: bp }: { data: { id: string } | null }) => {
        if (!bp) { setLoading(false); return; }

        const { data: txns } = await supabase
          .from('sample_transactions')
          .select('*')
          .eq('brand_id', bp.id)
          .order('created_at', { ascending: false });

        if (!txns?.length) { setLoading(false); return; }

        const sampleIds = txns.map((t: { sample_id: string }) => t.sample_id);
        const retailerIds = Array.from(new Set(txns.map((t: { retailer_id: string }) => t.retailer_id)));

        const [samplesRes, retailersRes] = await Promise.all([
          supabase.from('samples').select('id, product_id').in('id', sampleIds),
          supabase.from('retailer_profiles').select('id, name').in('id', retailerIds),
        ]);

        const productIds = Array.from(new Set((samplesRes.data ?? []).map((s: { product_id: string }) => s.product_id)));
        const { data: products } = await supabase.from('products').select('id, name').in('id', productIds);

        const sampleProductMap = new Map(
          (samplesRes.data ?? []).map((s: { id: string; product_id: string }) => [s.id, s.product_id])
        );
        const productMap = new Map((products ?? []).map((p: { id: string; name: string }) => [p.id, p.name]));
        const retailerMap = new Map((retailersRes.data ?? []).map((r: { id: string; name: string }) => [r.id, r.name]));

        setTransactions(
          txns.map((t: Record<string, unknown>) => ({
            id: t.id as string,
            retailer_name: retailerMap.get(t.retailer_id as string) ?? 'Unknown',
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

  const header = <StoresPageHeader subtitle="Deposits stores have paid for samples, and what was refunded or forfeited." />;

  if (loading) {
    return (
      <div className="space-y-6">
        {header}
        <ListSkeleton rows={5} />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {header}

      {transactions.length === 0 ? (
        <EmptyState
          className="bg-surface"
          icon={<Receipt className="h-5 w-5" />}
          title="No transactions yet"
          description="Deposit activity will appear here"
        />
      ) : (
        <>
          {/* Mobile: list */}
          <ul className="divide-y divide-line border border-line bg-surface md:hidden">
            {transactions.map((t) => (
              <li key={t.id} className="flex items-start gap-3 p-4">
                <div className="min-w-0 flex-1">
                  <StatusPill status={t.transaction_type} label={TYPE_LABELS[t.transaction_type] ?? t.transaction_type} />
                  <p className="mt-1.5 truncate text-[13px] text-primary">{t.product_name}</p>
                  <p className="truncate text-caption text-muted">{t.retailer_name}</p>
                  {t.note && <p className="mt-0.5 truncate text-caption text-muted">{t.note}</p>}
                </div>
                <div className="text-right">
                  <Amount value={t.amount_dkk} />
                  <p className="text-caption text-muted">
                    {new Date(t.created_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}
                  </p>
                </div>
              </li>
            ))}
          </ul>

          {/* Desktop: table */}
          <div className="hidden md:block">
            <Table className="text-[13px]">
              <THead>
                <tr>
                  <TH className="px-5">Date</TH>
                  <TH>Type</TH>
                  <TH>Product</TH>
                  <TH>Store</TH>
                  <TH>Note</TH>
                  <TH className="px-5 text-right">Amount</TH>
                </tr>
              </THead>
              <TBody>
                {transactions.map((t) => (
                  <TR key={t.id}>
                    <TD className="whitespace-nowrap px-5 text-muted">
                      {new Date(t.created_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
                    </TD>
                    <TD>
                      <StatusPill status={t.transaction_type} label={TYPE_LABELS[t.transaction_type] ?? t.transaction_type} />
                    </TD>
                    <TD>{t.product_name}</TD>
                    <TD>{t.retailer_name}</TD>
                    <TD className="max-w-[220px] truncate text-muted">{t.note ?? '—'}</TD>
                    <TD className="px-5 text-right">
                      <Amount value={t.amount_dkk} />
                    </TD>
                  </TR>
                ))}
              </TBody>
            </Table>
          </div>
        </>
      )}
    </div>
  );
}

// Money in is "+", money out is "−" (Figma has no danger colour).
function Amount({ value }: { value: number }) {
  return (
    <span className={cn('whitespace-nowrap font-medium tabular-nums', value > 0 ? 'text-success' : value < 0 ? 'text-primary' : 'text-muted')}>
      {value > 0 ? '+' : value < 0 ? '−' : ''}
      {formatDKK(Math.abs(value))}
    </span>
  );
}
