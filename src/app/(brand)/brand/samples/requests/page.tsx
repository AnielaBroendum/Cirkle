'use client';

import { useEffect, useState } from 'react';
import { useAuth } from '@/components/providers/auth-provider';
import { createClient } from '@/lib/supabase';
import { formatDKK } from '@/lib/utils';
import { Inbox, Check, X, Truck } from 'lucide-react';
import { Button, Card, EmptyState, Input, ListSkeleton, StatusPill, THead, TBody, TR, TH, TD } from '@/components/ds';
import { StoresPageHeader } from '@/components/brand/stores-tabs';

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

  const header = <StoresPageHeader subtitle="Samples stores have asked for. Approving creates the samples, QR tags and deposits." />;

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

      {requests.length === 0 ? (
        <EmptyState
          className="bg-surface"
          icon={<Inbox className="h-5 w-5" />}
          title="No sample requests yet"
          description="Requests from retailers will appear here"
        />
      ) : (
        <div className="space-y-4">
          {requests.map((sr) => (
            <Card key={sr.id} padding="none" className="space-y-4 rounded-none p-5 lg:p-6">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="font-brand text-body uppercase tracking-[0.3px] text-primary">{sr.retailer_name}</p>
                  <p className="mt-0.5 text-caption text-slate">
                    {new Date(sr.created_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
                  </p>
                  {sr.note && <p className="mt-2 text-body text-slate">Note: {sr.note}</p>}
                </div>
                <StatusPill status={sr.status} />
              </div>

              <div className="-mx-1 overflow-x-auto">
                <table className="w-full border-collapse font-brand text-body-sm text-primary">
                  <THead>
                    <tr>
                      <TH className="px-3 py-2 text-label font-medium">Product</TH>
                      <TH className="px-3 py-2 text-label font-medium">Size</TH>
                      <TH className="px-3 py-2 text-label font-medium">Colour</TH>
                      <TH className="px-3 py-2 text-right text-label font-medium">Deposit</TH>
                    </tr>
                  </THead>
                  <TBody>
                    {sr.items.map((item) => (
                      <TR key={item.id}>
                        <TD className="px-3 py-2.5">{item.product_name}</TD>
                        <TD className="px-3 py-2.5 text-slate">{item.size}</TD>
                        <TD className="px-3 py-2.5 text-slate">{item.color}</TD>
                        <TD className="whitespace-nowrap px-3 py-2.5 text-right tabular-nums">{formatDKK(item.deposit_amount_dkk)}</TD>
                      </TR>
                    ))}
                  </TBody>
                  <tfoot>
                    <tr className="border-t border-line">
                      <td colSpan={3} className="px-3 py-2.5 text-label uppercase text-slate">Total deposit</td>
                      <td className="whitespace-nowrap px-3 py-2.5 text-right font-medium tabular-nums">{formatDKK(sr.total_deposit)}</td>
                    </tr>
                  </tfoot>
                </table>
              </div>

              {sr.review_note && sr.status !== 'pending' && (
                <p className="text-body text-slate">Review note: {sr.review_note}</p>
              )}

              {/* Actions */}
              {sr.status === 'pending' && (
                <div className="flex flex-wrap items-center gap-2">
                  <Button onClick={() => handleApprove(sr.id)} loading={actionLoading === sr.id && rejectingId !== sr.id} disabled={actionLoading === sr.id} leftIcon={<Check className="h-4 w-4" />}>
                    Approve
                  </Button>
                  {rejectingId === sr.id ? (
                    <div className="flex w-full flex-wrap items-center gap-2 sm:w-auto sm:flex-1">
                      <Input
                        type="text"
                        value={rejectNote}
                        onChange={(e) => setRejectNote(e.target.value)}
                        placeholder="Reason (optional)"
                        aria-label="Reason for rejecting"
                        className="min-w-[180px] flex-1"
                      />
                      <Button variant="secondary" onClick={() => handleReject(sr.id)} loading={actionLoading === sr.id}>
                        Confirm reject
                      </Button>
                      <Button variant="ghost" onClick={() => setRejectingId(null)}>
                        Cancel
                      </Button>
                    </div>
                  ) : (
                    <Button variant="secondary" onClick={() => setRejectingId(sr.id)} leftIcon={<X className="h-4 w-4" />}>
                      Reject
                    </Button>
                  )}
                </div>
              )}

              {sr.status === 'approved' && (
                <div>
                  {shippingId === sr.id ? (
                    <div className="flex flex-wrap items-center gap-2">
                      <Input
                        type="text"
                        value={trackingNumber}
                        onChange={(e) => setTrackingNumber(e.target.value)}
                        placeholder="Tracking number"
                        aria-label="Tracking number"
                        className="min-w-[180px] flex-1"
                      />
                      <Button onClick={() => handleShip(sr.id)} loading={actionLoading === sr.id}>
                        Mark shipped
                      </Button>
                    </div>
                  ) : (
                    <Button onClick={() => setShippingId(sr.id)} leftIcon={<Truck className="h-4 w-4" />}>
                      Ship samples
                    </Button>
                  )}
                </div>
              )}
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
