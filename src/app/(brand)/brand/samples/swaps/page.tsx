'use client';

import { useEffect, useState } from 'react';
import { useAuth } from '@/components/providers/auth-provider';
import { createClient } from '@/lib/supabase';
import { formatDKK } from '@/lib/utils';
import { ArrowLeftRight, Check, X, Truck, ArrowRight, Package } from 'lucide-react';
import { Button, Card, EmptyState, Input, ListSkeleton, StatusPill } from '@/components/ds';
import { StoresPageHeader } from '@/components/brand/stores-tabs';

type SwapRequest = {
  id: string;
  retailer_name: string;
  return_product_name: string;
  return_size: string | null;
  return_color: string | null;
  return_deposit: number;
  new_product_name: string;
  new_size: string;
  new_color: string;
  new_deposit: number;
  status: string;
  reason: string | null;
  inspection_note: string | null;
  return_tracking_number: string | null;
  new_tracking_number: string | null;
  created_at: string;
};

const STATUS_LABELS: Record<string, string> = {
  requested: 'Requested',
  approved: 'Approved',
  return_shipped: 'Return shipped',
  return_received: 'Return received',
  inspected_ok: 'Inspected — OK',
  inspected_damaged: 'Inspected — Damaged',
  new_shipped: 'New shipped',
  completed: 'Completed',
  cancelled: 'Cancelled',
};


export default function BrandSwapsPage() {
  const { user } = useAuth();
  const [swaps, setSwaps] = useState<SwapRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [trackingInput, setTrackingInput] = useState('');
  const [trackingFor, setTrackingFor] = useState<{ id: string; type: 'new_shipped' } | null>(null);
  const [inspectionNote, setInspectionNote] = useState('');

  useEffect(() => {
    if (!user) return;
    loadSwaps();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  async function loadSwaps() {
    const supabase = createClient();
    const { data: bp } = await supabase.from('brand_profiles').select('id').eq('user_id', user!.id).single();
    if (!bp) { setLoading(false); return; }

    const { data: swapData } = await supabase
      .from('swap_requests')
      .select('*')
      .eq('brand_id', (bp as { id: string }).id)
      .order('created_at', { ascending: false });

    if (!swapData?.length) { setLoading(false); return; }

    const sampleIds = swapData.map((s: { return_sample_id: string }) => s.return_sample_id);
    const productIds = Array.from(new Set([
      ...swapData.map((s: { new_product_id: string }) => s.new_product_id),
    ]));
    const retailerIds = Array.from(new Set(swapData.map((s: { retailer_id: string }) => s.retailer_id)));

    const [samplesRes, productsRes, retailersRes] = await Promise.all([
      supabase.from('samples').select('id, product_id, deposit_amount_dkk, size, color').in('id', sampleIds),
      supabase.from('products').select('id, name, deposit_amount_dkk').in('id', productIds),
      supabase.from('retailer_profiles').select('id, name').in('id', retailerIds),
    ]);

    const sampleMap = new Map((samplesRes.data ?? []).map((s: Record<string, unknown>) => [s.id as string, s]));
    type ProductRow = { id: string; name: string; deposit_amount_dkk: number | null };
    const productMap = new Map<string, ProductRow>((productsRes.data ?? []).map((p: ProductRow) => [p.id, p]));
    const retailerMap = new Map((retailersRes.data ?? []).map((r: { id: string; name: string }) => [r.id, r.name]));

    // Get product names for the returned samples too
    const returnProductIds = (samplesRes.data ?? []).map((s: { product_id: string }) => s.product_id);
    const { data: returnProducts } = await supabase.from('products').select('id, name').in('id', returnProductIds);
    const returnProductMap = new Map((returnProducts ?? []).map((p: { id: string; name: string }) => [p.id, p.name]));

    const enriched: SwapRequest[] = swapData.map((sw: Record<string, unknown>) => {
      const returnSample = sampleMap.get(sw.return_sample_id as string) as Record<string, unknown> | undefined;
      const newProduct = productMap.get(sw.new_product_id as string);
      return {
        id: sw.id as string,
        retailer_name: retailerMap.get(sw.retailer_id as string) ?? 'Unknown',
        return_product_name: returnSample ? (returnProductMap.get(returnSample.product_id as string) ?? 'Unknown') : 'Unknown',
        return_size: returnSample?.size as string | null,
        return_color: returnSample?.color as string | null,
        return_deposit: (returnSample?.deposit_amount_dkk as number) ?? 0,
        new_product_name: newProduct?.name ?? 'Unknown',
        new_size: sw.new_size as string,
        new_color: sw.new_color as string,
        new_deposit: newProduct?.deposit_amount_dkk ?? 0,
        status: sw.status as string,
        reason: sw.reason as string | null,
        inspection_note: sw.inspection_note as string | null,
        return_tracking_number: sw.return_tracking_number as string | null,
        new_tracking_number: sw.new_tracking_number as string | null,
        created_at: sw.created_at as string,
      };
    });

    setSwaps(enriched);
    setLoading(false);
  }

  async function updateStatus(swapId: string, status: string, extra: Record<string, string> = {}) {
    setActionLoading(swapId);
    await fetch(`/api/swap-requests/${swapId}/status`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status, ...extra }),
    });
    setTrackingFor(null);
    setTrackingInput('');
    setInspectionNote('');
    await loadSwaps();
    setActionLoading(null);
  }

  const header = <StoresPageHeader subtitle="Stores swap a sample that isn't selling. Deposits are refunded or forfeited after inspection." />;

  if (loading) {
    return (
      <div className="space-y-6">
        {header}
        <ListSkeleton rows={3} />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {header}

      {swaps.length === 0 ? (
        <EmptyState
          className="bg-surface"
          icon={<ArrowLeftRight className="h-5 w-5" />}
          title="No swap requests yet"
          description="When a store asks to swap a sample, it shows up here."
        />
      ) : (
        <div className="space-y-4">
          {swaps.map((sw) => (
            <Card key={sw.id} padding="none" className="space-y-4 rounded-none p-5 lg:p-6">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="font-brand text-body uppercase tracking-[0.3px] text-primary">{sw.retailer_name}</p>
                  <p className="mt-0.5 text-caption text-muted">
                    {new Date(sw.created_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
                  </p>
                </div>
                <StatusPill status={sw.status} label={STATUS_LABELS[sw.status] ?? sw.status} />
              </div>

              <div className="grid items-center gap-3 sm:grid-cols-[1fr_auto_1fr]">
                <div className="border border-line p-3.5">
                  <p className="mb-1 text-label uppercase text-muted">Returning</p>
                  <p className="text-[13px] text-primary">{sw.return_product_name}</p>
                  <p className="text-caption text-muted">{sw.return_size} / {sw.return_color}</p>
                  <p className="mt-1 text-caption text-muted">Deposit: {formatDKK(sw.return_deposit)}</p>
                </div>
                <ArrowRight className="mx-auto hidden h-4 w-4 text-muted sm:block" aria-hidden />
                <div className="border border-line bg-canvas-warm p-3.5">
                  <p className="mb-1 text-label uppercase text-accent-strong">Requesting</p>
                  <p className="text-[13px] text-primary">{sw.new_product_name}</p>
                  <p className="text-caption text-muted">{sw.new_size} / {sw.new_color}</p>
                  <p className="mt-1 text-caption text-muted">Deposit: {formatDKK(sw.new_deposit)}</p>
                </div>
              </div>

              {(sw.reason || sw.return_tracking_number || sw.inspection_note || sw.new_tracking_number) && (
                <dl className="grid gap-x-6 gap-y-1.5 text-body sm:grid-cols-2">
                  {sw.reason && <Detail label="Reason" value={sw.reason} />}
                  {sw.return_tracking_number && <Detail label="Return tracking" value={sw.return_tracking_number} />}
                  {sw.inspection_note && <Detail label="Inspection" value={sw.inspection_note} />}
                  {sw.new_tracking_number && <Detail label="New tracking" value={sw.new_tracking_number} />}
                </dl>
              )}

              {/* Actions based on status */}
              <div className="flex flex-wrap items-center gap-2">
                {sw.status === 'requested' && (
                  <>
                    <Button onClick={() => updateStatus(sw.id, 'approved')} disabled={actionLoading === sw.id} leftIcon={<Check className="h-4 w-4" />}>
                      Approve
                    </Button>
                    <Button variant="secondary" onClick={() => updateStatus(sw.id, 'cancelled')} disabled={actionLoading === sw.id} leftIcon={<X className="h-4 w-4" />}>
                      Cancel
                    </Button>
                  </>
                )}

                {sw.status === 'return_received' && (
                  <>
                    <Input
                      type="text"
                      value={inspectionNote}
                      onChange={(e) => setInspectionNote(e.target.value)}
                      placeholder="Inspection note (optional)"
                      aria-label="Inspection note"
                      className="w-full sm:w-auto sm:min-w-[240px] sm:flex-1"
                    />
                    <Button
                      onClick={() => updateStatus(sw.id, 'inspected_ok', { inspection_note: inspectionNote })}
                      disabled={actionLoading === sw.id}
                      leftIcon={<Check className="h-4 w-4" />}
                    >
                      Condition OK
                    </Button>
                    <Button
                      variant="secondary"
                      onClick={() => updateStatus(sw.id, 'inspected_damaged', { inspection_note: inspectionNote })}
                      disabled={actionLoading === sw.id}
                      leftIcon={<X className="h-4 w-4" />}
                    >
                      Damaged
                    </Button>
                  </>
                )}

                {(sw.status === 'inspected_ok' || sw.status === 'inspected_damaged') && (
                  <>
                    {trackingFor?.id === sw.id ? (
                      <div className="flex w-full flex-wrap items-center gap-2">
                        <Input
                          type="text"
                          value={trackingInput}
                          onChange={(e) => setTrackingInput(e.target.value)}
                          placeholder="Tracking number"
                          aria-label="Tracking number"
                          className="min-w-[180px] flex-1"
                        />
                        <Button
                          onClick={() => updateStatus(sw.id, 'new_shipped', { tracking_number: trackingInput })}
                          loading={actionLoading === sw.id}
                        >
                          Ship new sample
                        </Button>
                      </div>
                    ) : (
                      <Button onClick={() => setTrackingFor({ id: sw.id, type: 'new_shipped' })} leftIcon={<Truck className="h-4 w-4" />}>
                        Ship replacement
                      </Button>
                    )}
                  </>
                )}

                {sw.status === 'new_shipped' && (
                  <Button onClick={() => updateStatus(sw.id, 'completed')} disabled={actionLoading === sw.id} leftIcon={<Check className="h-4 w-4" />}>
                    Mark completed
                  </Button>
                )}

                {sw.status === 'approved' && <p className="text-caption text-muted">Waiting for the store to ship the sample back.</p>}
                {sw.status === 'return_shipped' && (
                  <>
                    <p className="w-full text-caption text-muted">On its way back. The store marked it shipped.</p>
                    <Button onClick={() => updateStatus(sw.id, 'return_received')} disabled={actionLoading === sw.id} leftIcon={<Package className="h-4 w-4" />}>
                      Mark received
                    </Button>
                  </>
                )}
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

function Detail({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex gap-2">
      <dt className="shrink-0 text-muted">{label}:</dt>
      <dd className="min-w-0 break-words text-primary">{value}</dd>
    </div>
  );
}
