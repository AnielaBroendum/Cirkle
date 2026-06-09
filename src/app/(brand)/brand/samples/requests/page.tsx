'use client';

import { useEffect, useState } from 'react';
import { useAuth } from '@/components/providers/auth-provider';
import { createClient } from '@/lib/supabase';
import { formatDKK } from '@/lib/utils';
import { Inbox, Check, X, Truck, PackageCheck } from 'lucide-react';

type RequestItem = {
  id: string;
  product_name: string;
  size: string;
  color: string;
  deposit_amount_dkk: number;
};

type SampleRequest = {
  id: string;
  retailer_name: string;
  status: string;
  note: string | null;
  review_note: string | null;
  items: RequestItem[];
  total_deposit: number;
  created_at: string;
};

export default function BrandSampleRequestsPage() {
  const { user } = useAuth();
  const [requests, setRequests] = useState<SampleRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [rejectNote, setRejectNote] = useState('');
  const [rejectingId, setRejectingId] = useState<string | null>(null);
  const [trackingNumber, setTrackingNumber] = useState('');
  const [shippingId, setShippingId] = useState<string | null>(null);

  useEffect(() => {
    if (!user) return;
    loadRequests();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  async function loadRequests() {
    const supabase = createClient();
    const { data: bp } = await supabase
      .from('brand_profiles')
      .select('id')
      .eq('user_id', user!.id)
      .single();
    if (!bp) { setLoading(false); return; }

    const { data: srs } = await supabase
      .from('sample_requests')
      .select('*')
      .eq('brand_id', (bp as { id: string }).id)
      .order('created_at', { ascending: false });

    if (!srs?.length) { setLoading(false); return; }

    const requestIds = srs.map((r: { id: string }) => r.id);
    const retailerIds = Array.from(new Set(srs.map((r: { retailer_id: string }) => r.retailer_id)));

    const [itemsRes, retailersRes] = await Promise.all([
      supabase.from('sample_request_items').select('*').in('request_id', requestIds),
      supabase.from('retailer_profiles').select('id, name').in('id', retailerIds),
    ]);

    const retailerMap = new Map(
      (retailersRes.data ?? []).map((r: { id: string; name: string }) => [r.id, r.name])
    );

    const productIds = Array.from(new Set((itemsRes.data ?? []).map((i: { product_id: string }) => i.product_id)));
    const { data: products } = await supabase.from('products').select('id, name').in('id', productIds);
    const productMap = new Map((products ?? []).map((p: { id: string; name: string }) => [p.id, p.name]));

    const enriched: SampleRequest[] = srs.map((sr: Record<string, unknown>) => {
      const items = (itemsRes.data ?? [])
        .filter((i: { request_id: string }) => i.request_id === sr.id)
        .map((i: { id: string; product_id: string; size: string; color: string; deposit_amount_dkk: number }) => ({
          id: i.id,
          product_name: productMap.get(i.product_id) ?? 'Unknown',
          size: i.size,
          color: i.color,
          deposit_amount_dkk: i.deposit_amount_dkk,
        }));

      return {
        id: sr.id as string,
        retailer_name: retailerMap.get(sr.retailer_id as string) ?? 'Unknown',
        status: sr.status as string,
        note: sr.note as string | null,
        review_note: sr.review_note as string | null,
        items,
        total_deposit: items.reduce((sum: number, i: RequestItem) => sum + i.deposit_amount_dkk, 0),
        created_at: sr.created_at as string,
      };
    });

    setRequests(enriched);
    setLoading(false);
  }

  async function handleApprove(requestId: string) {
    setActionLoading(requestId);
    const res = await fetch(`/api/sample-requests/${requestId}/approve`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
    });
    if (res.ok) await loadRequests();
    setActionLoading(null);
  }

  async function handleReject(requestId: string) {
    setActionLoading(requestId);
    await fetch(`/api/sample-requests/${requestId}/status`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: 'rejected', review_note: rejectNote }),
    });
    setRejectingId(null);
    setRejectNote('');
    await loadRequests();
    setActionLoading(null);
  }

  async function handleShip(requestId: string) {
    setActionLoading(requestId);
    await fetch(`/api/sample-requests/${requestId}/status`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: 'shipped', tracking_number: trackingNumber }),
    });
    setShippingId(null);
    setTrackingNumber('');
    await loadRequests();
    setActionLoading(null);
  }

  const statusColors: Record<string, string> = {
    pending: 'bg-amber-50 text-amber-700',
    approved: 'bg-blue-50 text-blue-700',
    shipped: 'bg-purple-50 text-purple-700',
    received: 'bg-green-50 text-green-700',
    rejected: 'bg-red-50 text-red-600',
  };

  if (loading) {
    return <div className="space-y-4"><div className="animate-pulse bg-gray-200 rounded h-8 w-48" /><div className="animate-pulse bg-gray-100 rounded-xl h-48" /></div>;
  }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-gray-900">Sample requests</h1>

      {requests.length === 0 ? (
        <div className="text-center py-12 bg-white rounded-xl border border-gray-200">
          <Inbox className="h-12 w-12 text-gray-300 mx-auto" />
          <p className="mt-3 text-gray-500">No sample requests yet</p>
          <p className="mt-1 text-sm text-gray-400">Requests from retailers will appear here</p>
        </div>
      ) : (
        <div className="space-y-4">
          {requests.map((sr) => (
            <div key={sr.id} className="bg-white rounded-xl border border-gray-200 p-5 space-y-4">
              <div className="flex items-start justify-between">
                <div>
                  <p className="font-semibold text-gray-900">{sr.retailer_name}</p>
                  <p className="text-xs text-gray-400 mt-0.5">
                    {new Date(sr.created_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
                  </p>
                  {sr.note && <p className="text-sm text-gray-500 mt-1">Note: {sr.note}</p>}
                </div>
                <span className={`text-xs font-medium px-2.5 py-1 rounded-full capitalize ${statusColors[sr.status] ?? 'bg-gray-100 text-gray-600'}`}>
                  {sr.status}
                </span>
              </div>

              <div className="border border-gray-100 rounded-lg overflow-hidden">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="text-left px-3 py-2 font-medium text-gray-600">Product</th>
                      <th className="text-left px-3 py-2 font-medium text-gray-600">Size</th>
                      <th className="text-left px-3 py-2 font-medium text-gray-600">Color</th>
                      <th className="text-right px-3 py-2 font-medium text-gray-600">Deposit</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50">
                    {sr.items.map((item) => (
                      <tr key={item.id}>
                        <td className="px-3 py-2 text-gray-900">{item.product_name}</td>
                        <td className="px-3 py-2 text-gray-600">{item.size}</td>
                        <td className="px-3 py-2 text-gray-600">{item.color}</td>
                        <td className="px-3 py-2 text-gray-900 text-right">{formatDKK(item.deposit_amount_dkk)}</td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot className="bg-gray-50">
                    <tr>
                      <td colSpan={3} className="px-3 py-2 font-medium text-gray-700">Total deposit</td>
                      <td className="px-3 py-2 font-bold text-gray-900 text-right">{formatDKK(sr.total_deposit)}</td>
                    </tr>
                  </tfoot>
                </table>
              </div>

              {sr.review_note && sr.status !== 'pending' && (
                <p className="text-sm text-gray-500">Review note: {sr.review_note}</p>
              )}

              {/* Actions */}
              {sr.status === 'pending' && (
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => handleApprove(sr.id)}
                    disabled={actionLoading === sr.id}
                    className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-green-50 text-green-700 text-sm font-medium hover:bg-green-100 transition disabled:opacity-50"
                  >
                    <Check className="h-4 w-4" /> Approve
                  </button>
                  {rejectingId === sr.id ? (
                    <div className="flex items-center gap-2 flex-1">
                      <input
                        type="text"
                        value={rejectNote}
                        onChange={(e) => setRejectNote(e.target.value)}
                        placeholder="Reason (optional)"
                        className="flex-1 rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-cirkle-500 focus:outline-none"
                      />
                      <button
                        onClick={() => handleReject(sr.id)}
                        disabled={actionLoading === sr.id}
                        className="px-3 py-2 rounded-lg bg-red-600 text-white text-sm font-medium hover:bg-red-700 disabled:opacity-50"
                      >
                        Confirm
                      </button>
                      <button onClick={() => setRejectingId(null)} className="px-3 py-2 text-sm text-gray-500 hover:text-gray-700">
                        Cancel
                      </button>
                    </div>
                  ) : (
                    <button
                      onClick={() => setRejectingId(sr.id)}
                      className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-red-50 text-red-600 text-sm font-medium hover:bg-red-100 transition"
                    >
                      <X className="h-4 w-4" /> Reject
                    </button>
                  )}
                </div>
              )}

              {sr.status === 'approved' && (
                <div>
                  {shippingId === sr.id ? (
                    <div className="flex items-center gap-2">
                      <input
                        type="text"
                        value={trackingNumber}
                        onChange={(e) => setTrackingNumber(e.target.value)}
                        placeholder="Tracking number"
                        className="flex-1 rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-cirkle-500 focus:outline-none"
                      />
                      <button
                        onClick={() => handleShip(sr.id)}
                        disabled={actionLoading === sr.id}
                        className="px-4 py-2 rounded-lg bg-cirkle-600 text-white text-sm font-medium hover:bg-cirkle-700 disabled:opacity-50"
                      >
                        Mark shipped
                      </button>
                    </div>
                  ) : (
                    <button
                      onClick={() => setShippingId(sr.id)}
                      className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-purple-50 text-purple-700 text-sm font-medium hover:bg-purple-100 transition"
                    >
                      <Truck className="h-4 w-4" /> Ship samples
                    </button>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
