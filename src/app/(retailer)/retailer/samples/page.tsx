'use client';

import { useEffect, useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { useAuth } from '@/components/providers/auth-provider';
import { createClient } from '@/lib/supabase';
import { formatDKK } from '@/lib/utils';
import { QrCode, Plus, ArrowLeftRight, Truck, Package } from 'lucide-react';
import type { Database } from '@/lib/database.types';

type Sample = Database['public']['Tables']['samples']['Row'];
type Product = Database['public']['Tables']['products']['Row'];
type BrandProfile = Database['public']['Tables']['brand_profiles']['Row'];

type SampleWithDetails = Sample & {
  product_name: string;
  product_image: string | null;
  product_sizes: string[];
  product_colors: string[];
  brand_name: string;
  scan_count: number;
  last_scanned: string | null;
};

type SwapRequestRow = {
  id: string;
  return_sample_id: string;
  return_product_name: string;
  new_product_name: string;
  new_size: string;
  new_color: string;
  status: string;
  reason: string | null;
  return_tracking_number: string | null;
  created_at: string;
};

const SWAP_STATUS_LABELS: Record<string, string> = {
  requested: 'Pending',
  approved: 'Approved',
  return_shipped: 'Return shipped',
  return_received: 'Return received',
  inspected_ok: 'Inspected OK',
  inspected_damaged: 'Damaged',
  new_shipped: 'New shipped',
  completed: 'Completed',
  cancelled: 'Cancelled',
};

export default function RetailerSamplesPage() {
  const { user } = useAuth();
  const [samples, setSamples] = useState<SampleWithDetails[]>([]);
  const [swapRequests, setSwapRequests] = useState<SwapRequestRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<'samples' | 'swaps'>('samples');
  const [retailerId, setRetailerId] = useState<string | null>(null);

  // Swap modal state
  const [swapSample, setSwapSample] = useState<SampleWithDetails | null>(null);
  const [swapProductId, setSwapProductId] = useState('');
  const [swapSize, setSwapSize] = useState('');
  const [swapColor, setSwapColor] = useState('');
  const [swapReason, setSwapReason] = useState('');
  const [swapSubmitting, setSwapSubmitting] = useState(false);
  const [brandProducts, setBrandProducts] = useState<Pick<Product, 'id' | 'name' | 'sizes' | 'colors' | 'deposit_amount_dkk'>[]>([]);

  // Return tracking state
  const [trackingSwapId, setTrackingSwapId] = useState<string | null>(null);
  const [trackingNumber, setTrackingNumber] = useState('');

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
        setRetailerId(rp.id);

        const [samplesData, swapsData] = await Promise.all([
          supabase.from('samples').select('*').eq('retailer_id', rp.id).order('created_at', { ascending: false }),
          supabase.from('swap_requests').select('*').eq('retailer_id', rp.id).order('created_at', { ascending: false }),
        ]);

        // Enrich samples
        const typed = (samplesData.data ?? []) as Sample[];
        if (typed.length > 0) {
          const productIds = Array.from(new Set(typed.map((s) => s.product_id)));
          const brandIds = Array.from(new Set(typed.map((s) => s.brand_id)));
          const sampleIds = typed.map((s) => s.id);

          const [productsRes, brandsRes, scansRes] = await Promise.all([
            supabase.from('products').select('id, name, images, sizes, colors, deposit_amount_dkk').in('id', productIds),
            supabase.from('brand_profiles').select('id, name').in('id', brandIds),
            supabase.from('scans').select('sample_id, scanned_at').in('sample_id', sampleIds).order('scanned_at', { ascending: false }),
          ]);

          const productMap = new Map((productsRes.data ?? []).map((p: Record<string, unknown>) => [p.id as string, p]));
          const brandMap = new Map<string, string>((brandsRes.data ?? []).map((b: { id: string; name: string }) => [b.id, b.name]));

          const scanCounts = new Map<string, number>();
          const lastScanned = new Map<string, string>();
          for (const scan of (scansRes.data ?? []) as { sample_id: string | null; scanned_at: string }[]) {
            if (scan.sample_id) {
              scanCounts.set(scan.sample_id, (scanCounts.get(scan.sample_id) ?? 0) + 1);
              if (!lastScanned.has(scan.sample_id)) lastScanned.set(scan.sample_id, scan.scanned_at);
            }
          }

          setSamples(typed.map((s) => {
            const product = productMap.get(s.product_id) as Record<string, unknown> | undefined;
            return {
              ...s,
              product_name: (product?.name as string) ?? 'Unknown product',
              product_image: (product?.images as string[])?.[0] ?? null,
              product_sizes: (product?.sizes as string[]) ?? [],
              product_colors: (product?.colors as string[]) ?? [],
              brand_name: brandMap.get(s.brand_id) ?? 'Unknown brand',
              scan_count: scanCounts.get(s.id) ?? 0,
              last_scanned: lastScanned.get(s.id) ?? null,
            };
          }));
        }

        // Enrich swap requests
        const swaps = (swapsData.data ?? []) as Record<string, unknown>[];
        if (swaps.length > 0) {
          const returnSampleIds = swaps.map((s) => s.return_sample_id as string);
          const newProductIds = swaps.map((s) => s.new_product_id as string);

          const [returnSamplesRes, newProductsRes] = await Promise.all([
            supabase.from('samples').select('id, product_id').in('id', returnSampleIds),
            supabase.from('products').select('id, name').in('id', newProductIds),
          ]);

          const returnSampleProductIds = (returnSamplesRes.data ?? []).map((s: { product_id: string }) => s.product_id);
          const { data: returnProducts } = await supabase.from('products').select('id, name').in('id', returnSampleProductIds);

          const returnSampleMap = new Map<string, string>((returnSamplesRes.data ?? []).map((s: { id: string; product_id: string }) => [s.id, s.product_id]));
          const returnProductMap = new Map<string, string>((returnProducts ?? []).map((p: { id: string; name: string }) => [p.id, p.name]));
          const newProductMap = new Map<string, string>((newProductsRes.data ?? []).map((p: { id: string; name: string }) => [p.id, p.name]));

          setSwapRequests(swaps.map((sw) => ({
            id: sw.id as string,
            return_sample_id: sw.return_sample_id as string,
            return_product_name: returnProductMap.get(returnSampleMap.get(sw.return_sample_id as string) ?? '') ?? 'Unknown',
            new_product_name: newProductMap.get(sw.new_product_id as string) ?? 'Unknown',
            new_size: sw.new_size as string,
            new_color: sw.new_color as string,
            status: sw.status as string,
            reason: sw.reason as string | null,
            return_tracking_number: sw.return_tracking_number as string | null,
            created_at: sw.created_at as string,
          })));
        }

        setLoading(false);
      });
  }, [user]);

  async function openSwapModal(sample: SampleWithDetails) {
    setSwapSample(sample);
    setSwapProductId('');
    setSwapSize('');
    setSwapColor('');
    setSwapReason('');

    const supabase = createClient();
    const { data } = await supabase
      .from('products')
      .select('id, name, sizes, colors, deposit_amount_dkk')
      .eq('brand_id', sample.brand_id)
      .eq('is_active', true)
      .order('name');
    setBrandProducts((data ?? []) as typeof brandProducts);
  }

  async function submitSwap() {
    if (!swapSample || !swapProductId || !swapSize || !swapColor) return;
    setSwapSubmitting(true);

    const res = await fetch('/api/swap-requests', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        return_sample_id: swapSample.id,
        new_product_id: swapProductId,
        new_size: swapSize,
        new_color: swapColor,
        reason: swapReason || null,
      }),
    });

    setSwapSubmitting(false);
    if (res.ok) {
      setSwapSample(null);
      window.location.reload();
    }
  }

  async function submitReturnTracking(swapId: string) {
    if (!trackingNumber) return;
    await fetch(`/api/swap-requests/${swapId}/status`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: 'return_shipped', tracking_number: trackingNumber }),
    });
    setTrackingSwapId(null);
    setTrackingNumber('');
    window.location.reload();
  }

  async function confirmReceived(requestId: string) {
    await fetch(`/api/sample-requests/${requestId}/status`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: 'received' }),
    });
    window.location.reload();
  }

  function formatDate(dateStr: string): string {
    return new Date(dateStr).toLocaleDateString('da-DK', { day: 'numeric', month: 'short' });
  }

  const selectedSwapProduct = brandProducts.find((p) => p.id === swapProductId);
  const pendingSwaps = swapRequests.filter((s) => !['completed', 'cancelled'].includes(s.status));

  if (loading) {
    return <div className="space-y-4"><div className="animate-pulse bg-gray-200 rounded h-6 w-32" /><div className="animate-pulse bg-gray-100 rounded-xl h-48 w-full" /></div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">Samples</h1>
        <Link
          href="/retailer/samples/request"
          className="flex items-center gap-2 rounded-lg bg-cirkle-600 px-4 py-2.5 text-sm text-white font-medium hover:bg-cirkle-700 transition"
        >
          <Plus className="h-4 w-4" /> Request samples
        </Link>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-gray-100 rounded-lg p-1">
        <button
          onClick={() => setTab('samples')}
          className={`flex-1 px-4 py-2 text-sm font-medium rounded-md transition ${tab === 'samples' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
        >
          Active samples ({samples.filter((s) => s.status === 'active').length})
        </button>
        <button
          onClick={() => setTab('swaps')}
          className={`flex-1 px-4 py-2 text-sm font-medium rounded-md transition ${tab === 'swaps' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
        >
          Swap requests {pendingSwaps.length > 0 && `(${pendingSwaps.length})`}
        </button>
      </div>

      {tab === 'samples' && (
        <>
          {samples.length === 0 ? (
            <div className="text-center py-12 bg-white rounded-xl border border-gray-200">
              <QrCode className="h-12 w-12 text-gray-300 mx-auto" />
              <p className="mt-3 text-gray-500">No samples yet</p>
              <p className="mt-1 text-sm text-gray-400">Request samples from your brand partners</p>
            </div>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {samples.map((sample) => (
                <div key={sample.id} className="bg-white rounded-xl border border-gray-200 p-4 space-y-3">
                  <div className="flex items-start gap-3">
                    {sample.product_image ? (
                      <div className="relative w-14 h-14 rounded-lg overflow-hidden border border-gray-200 flex-shrink-0">
                        <Image src={sample.product_image} alt="" fill className="object-cover" sizes="56px" />
                      </div>
                    ) : (
                      <div className="w-14 h-14 rounded-lg bg-gray-100 flex items-center justify-center flex-shrink-0">
                        <QrCode className="h-6 w-6 text-gray-400" />
                      </div>
                    )}
                    <div className="min-w-0 flex-1">
                      <p className="font-medium text-gray-900 text-sm truncate">{sample.product_name}</p>
                      <p className="text-xs text-gray-500 mt-0.5">{sample.brand_name}</p>
                      {(sample.size || sample.color) && (
                        <p className="text-xs text-gray-400 mt-0.5">{[sample.size, sample.color].filter(Boolean).join(' / ')}</p>
                      )}
                      <div className="flex items-center gap-2 mt-1">
                        <span className={`inline-block text-xs px-2 py-0.5 rounded-full ${
                          sample.status === 'active' ? 'bg-green-50 text-green-700' : 'bg-gray-100 text-gray-500'
                        }`}>
                          {sample.status === 'active' ? 'Active' : sample.status}
                        </span>
                        {sample.deposit_status === 'held' && sample.deposit_amount_dkk && (
                          <span className="text-xs text-amber-600 bg-amber-50 px-2 py-0.5 rounded-full">
                            {formatDKK(sample.deposit_amount_dkk)} held
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center justify-between text-sm border-t border-gray-100 pt-2">
                    <div className="text-gray-500">
                      <span className="font-medium text-gray-700">{sample.scan_count}</span> scans
                    </div>
                    <div className="flex items-center gap-2">
                      {sample.last_scanned && (
                        <span className="text-xs text-gray-400">Last: {formatDate(sample.last_scanned)}</span>
                      )}
                      {sample.status === 'active' && (
                        <button
                          onClick={() => openSwapModal(sample)}
                          className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-purple-50 text-purple-700 text-xs font-medium hover:bg-purple-100 transition"
                        >
                          <ArrowLeftRight className="h-3 w-3" /> Swap
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </>
      )}

      {tab === 'swaps' && (
        <>
          {swapRequests.length === 0 ? (
            <div className="text-center py-12 bg-white rounded-xl border border-gray-200">
              <ArrowLeftRight className="h-12 w-12 text-gray-300 mx-auto" />
              <p className="mt-3 text-gray-500">No swap requests</p>
            </div>
          ) : (
            <div className="space-y-3">
              {swapRequests.map((sw) => (
                <div key={sw.id} className="bg-white rounded-xl border border-gray-200 p-4 space-y-3">
                  <div className="flex items-start justify-between">
                    <div>
                      <p className="text-sm font-medium text-gray-900">
                        {sw.return_product_name} → {sw.new_product_name}
                      </p>
                      <p className="text-xs text-gray-500 mt-0.5">
                        {sw.new_size} / {sw.new_color}
                        {sw.reason && ` — ${sw.reason}`}
                      </p>
                    </div>
                    <span className={`text-xs font-medium px-2.5 py-1 rounded-full ${
                      sw.status === 'completed' ? 'bg-green-50 text-green-700'
                        : sw.status === 'cancelled' ? 'bg-gray-100 text-gray-500'
                        : 'bg-amber-50 text-amber-700'
                    }`}>
                      {SWAP_STATUS_LABELS[sw.status] ?? sw.status}
                    </span>
                  </div>

                  {sw.status === 'approved' && (
                    <div>
                      {trackingSwapId === sw.id ? (
                        <div className="flex items-center gap-2">
                          <input
                            type="text"
                            value={trackingNumber}
                            onChange={(e) => setTrackingNumber(e.target.value)}
                            placeholder="Return tracking number"
                            className="flex-1 rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-cirkle-500 focus:outline-none"
                          />
                          <button
                            onClick={() => submitReturnTracking(sw.id)}
                            className="px-3 py-2 rounded-lg bg-cirkle-600 text-white text-sm font-medium hover:bg-cirkle-700"
                          >
                            Submit
                          </button>
                        </div>
                      ) : (
                        <button
                          onClick={() => setTrackingSwapId(sw.id)}
                          className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-purple-50 text-purple-700 text-sm font-medium hover:bg-purple-100"
                        >
                          <Truck className="h-4 w-4" /> Enter return tracking
                        </button>
                      )}
                    </div>
                  )}

                  {sw.return_tracking_number && (
                    <p className="text-xs text-gray-400">Return tracking: {sw.return_tracking_number}</p>
                  )}
                </div>
              ))}
            </div>
          )}
        </>
      )}

      {/* Swap modal */}
      {swapSample && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4" onClick={() => setSwapSample(null)}>
          <div className="bg-white rounded-xl max-w-md w-full p-6 space-y-4" onClick={(e) => e.stopPropagation()}>
            <h2 className="text-lg font-semibold text-gray-900">Swap sample</h2>
            <p className="text-sm text-gray-500">
              Returning: <span className="font-medium text-gray-700">{swapSample.product_name}</span>
              {swapSample.size && ` (${swapSample.size})`}
            </p>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Replacement product</label>
              <select
                value={swapProductId}
                onChange={(e) => { setSwapProductId(e.target.value); setSwapSize(''); setSwapColor(''); }}
                className="w-full rounded-lg border border-gray-300 px-3 py-2.5 text-gray-900 focus:border-cirkle-500 focus:outline-none bg-white"
              >
                <option value="">Select product</option>
                {brandProducts.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}{p.deposit_amount_dkk ? ` (deposit: ${formatDKK(p.deposit_amount_dkk)})` : ''}
                  </option>
                ))}
              </select>
            </div>

            {selectedSwapProduct && (
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Size</label>
                  <select
                    value={swapSize}
                    onChange={(e) => setSwapSize(e.target.value)}
                    className="w-full rounded-lg border border-gray-300 px-3 py-2.5 text-gray-900 focus:border-cirkle-500 focus:outline-none bg-white"
                  >
                    <option value="">Select</option>
                    {selectedSwapProduct.sizes.map((s) => <option key={s} value={s}>{s}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Color</label>
                  <select
                    value={swapColor}
                    onChange={(e) => setSwapColor(e.target.value)}
                    className="w-full rounded-lg border border-gray-300 px-3 py-2.5 text-gray-900 focus:border-cirkle-500 focus:outline-none bg-white"
                  >
                    <option value="">Select</option>
                    {selectedSwapProduct.colors.map((c) => <option key={c} value={c}>{c}</option>)}
                  </select>
                </div>
              </div>
            )}

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Reason</label>
              <select
                value={swapReason}
                onChange={(e) => setSwapReason(e.target.value)}
                className="w-full rounded-lg border border-gray-300 px-3 py-2.5 text-gray-900 focus:border-cirkle-500 focus:outline-none bg-white"
              >
                <option value="">Select reason</option>
                <option value="Not performing">Not performing</option>
                <option value="Wrong size">Wrong size</option>
                <option value="Seasonal change">Seasonal change</option>
                <option value="Other">Other</option>
              </select>
            </div>

            <div className="flex gap-3 pt-2">
              <button
                onClick={submitSwap}
                disabled={swapSubmitting || !swapProductId || !swapSize || !swapColor}
                className="flex-1 rounded-lg bg-cirkle-600 px-4 py-2.5 text-white font-medium hover:bg-cirkle-700 transition disabled:opacity-50"
              >
                {swapSubmitting ? 'Submitting...' : 'Submit swap request'}
              </button>
              <button
                onClick={() => setSwapSample(null)}
                className="rounded-lg border border-gray-300 px-4 py-2.5 text-gray-700 font-medium hover:bg-gray-50 transition"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
