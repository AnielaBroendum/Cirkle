'use client';

import { useEffect, useState } from 'react';
import { useAuth } from '@/components/providers/auth-provider';
import { createClient } from '@/lib/supabase';
import { formatDKK } from '@/lib/utils';
import { ArrowLeftRight, Check, X, Truck, Eye } from 'lucide-react';

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

const STATUS_COLORS: Record<string, string> = {
  requested: 'bg-amber-50 text-amber-700',
  approved: 'bg-blue-50 text-blue-700',
  return_shipped: 'bg-purple-50 text-purple-700',
  return_received: 'bg-indigo-50 text-indigo-700',
  inspected_ok: 'bg-green-50 text-green-700',
  inspected_damaged: 'bg-red-50 text-red-600',
  new_shipped: 'bg-cyan-50 text-cyan-700',
  completed: 'bg-green-50 text-green-700',
  cancelled: 'bg-gray-100 text-gray-500',
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

  if (loading) {
    return <div className="space-y-4"><div className="animate-pulse bg-gray-200 rounded h-8 w-40" /><div className="animate-pulse bg-gray-100 rounded-xl h-48" /></div>;
  }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-gray-900">Swap requests</h1>

      {swaps.length === 0 ? (
        <div className="text-center py-12 bg-white rounded-xl border border-gray-200">
          <ArrowLeftRight className="h-12 w-12 text-gray-300 mx-auto" />
          <p className="mt-3 text-gray-500">No swap requests yet</p>
        </div>
      ) : (
        <div className="space-y-4">
          {swaps.map((sw) => (
            <div key={sw.id} className="bg-white rounded-xl border border-gray-200 p-5 space-y-4">
              <div className="flex items-start justify-between">
                <div>
                  <p className="font-semibold text-gray-900">{sw.retailer_name}</p>
                  <p className="text-xs text-gray-400 mt-0.5">
                    {new Date(sw.created_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
                  </p>
                </div>
                <span className={`text-xs font-medium px-2.5 py-1 rounded-full ${STATUS_COLORS[sw.status] ?? 'bg-gray-100 text-gray-600'}`}>
                  {STATUS_LABELS[sw.status] ?? sw.status}
                </span>
              </div>

              <div className="grid sm:grid-cols-2 gap-4">
                <div className="bg-red-50/50 rounded-lg p-3">
                  <p className="text-xs font-medium text-red-600 mb-1">Returning</p>
                  <p className="text-sm font-medium text-gray-900">{sw.return_product_name}</p>
                  <p className="text-xs text-gray-500">{sw.return_size} / {sw.return_color}</p>
                  <p className="text-xs text-gray-500 mt-1">Deposit: {formatDKK(sw.return_deposit)}</p>
                </div>
                <div className="bg-green-50/50 rounded-lg p-3">
                  <p className="text-xs font-medium text-green-600 mb-1">Requesting</p>
                  <p className="text-sm font-medium text-gray-900">{sw.new_product_name}</p>
                  <p className="text-xs text-gray-500">{sw.new_size} / {sw.new_color}</p>
                  <p className="text-xs text-gray-500 mt-1">Deposit: {formatDKK(sw.new_deposit)}</p>
                </div>
              </div>

              {sw.reason && <p className="text-sm text-gray-500">Reason: {sw.reason}</p>}
              {sw.return_tracking_number && <p className="text-sm text-gray-500">Return tracking: {sw.return_tracking_number}</p>}
              {sw.inspection_note && <p className="text-sm text-gray-500">Inspection: {sw.inspection_note}</p>}
              {sw.new_tracking_number && <p className="text-sm text-gray-500">New tracking: {sw.new_tracking_number}</p>}

              {/* Actions based on status */}
              <div className="flex flex-wrap items-center gap-2">
                {sw.status === 'requested' && (
                  <>
                    <button
                      onClick={() => updateStatus(sw.id, 'approved')}
                      disabled={actionLoading === sw.id}
                      className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-green-50 text-green-700 text-sm font-medium hover:bg-green-100 disabled:opacity-50"
                    >
                      <Check className="h-4 w-4" /> Approve
                    </button>
                    <button
                      onClick={() => updateStatus(sw.id, 'cancelled')}
                      disabled={actionLoading === sw.id}
                      className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-red-50 text-red-600 text-sm font-medium hover:bg-red-100 disabled:opacity-50"
                    >
                      <X className="h-4 w-4" /> Cancel
                    </button>
                  </>
                )}

                {sw.status === 'return_received' && (
                  <>
                    <button
                      onClick={() => updateStatus(sw.id, 'inspected_ok', { inspection_note: inspectionNote })}
                      disabled={actionLoading === sw.id}
                      className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-green-50 text-green-700 text-sm font-medium hover:bg-green-100 disabled:opacity-50"
                    >
                      <Check className="h-4 w-4" /> Condition OK
                    </button>
                    <button
                      onClick={() => updateStatus(sw.id, 'inspected_damaged', { inspection_note: inspectionNote })}
                      disabled={actionLoading === sw.id}
                      className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-red-50 text-red-600 text-sm font-medium hover:bg-red-100 disabled:opacity-50"
                    >
                      <X className="h-4 w-4" /> Damaged
                    </button>
                    <input
                      type="text"
                      value={inspectionNote}
                      onChange={(e) => setInspectionNote(e.target.value)}
                      placeholder="Inspection note (optional)"
                      className="flex-1 min-w-[200px] rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-cirkle-500 focus:outline-none"
                    />
                  </>
                )}

                {(sw.status === 'inspected_ok' || sw.status === 'inspected_damaged') && (
                  <>
                    {trackingFor?.id === sw.id ? (
                      <div className="flex items-center gap-2 w-full">
                        <input
                          type="text"
                          value={trackingInput}
                          onChange={(e) => setTrackingInput(e.target.value)}
                          placeholder="Tracking number"
                          className="flex-1 rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-cirkle-500 focus:outline-none"
                        />
                        <button
                          onClick={() => updateStatus(sw.id, 'new_shipped', { tracking_number: trackingInput })}
                          disabled={actionLoading === sw.id}
                          className="px-4 py-2 rounded-lg bg-cirkle-600 text-white text-sm font-medium hover:bg-cirkle-700 disabled:opacity-50"
                        >
                          Ship new sample
                        </button>
                      </div>
                    ) : (
                      <button
                        onClick={() => setTrackingFor({ id: sw.id, type: 'new_shipped' })}
                        className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-purple-50 text-purple-700 text-sm font-medium hover:bg-purple-100"
                      >
                        <Truck className="h-4 w-4" /> Ship replacement
                      </button>
                    )}
                  </>
                )}

                {sw.status === 'new_shipped' && (
                  <button
                    onClick={() => updateStatus(sw.id, 'completed')}
                    disabled={actionLoading === sw.id}
                    className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-green-50 text-green-700 text-sm font-medium hover:bg-green-100 disabled:opacity-50"
                  >
                    <Check className="h-4 w-4" /> Mark completed
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
