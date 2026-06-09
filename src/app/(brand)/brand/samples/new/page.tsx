'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/components/providers/auth-provider';
import { createClient } from '@/lib/supabase';
import { formatDKK } from '@/lib/utils';
import { QrCode, ArrowLeft } from 'lucide-react';
import Link from 'next/link';
import type { Database } from '@/lib/database.types';

type Product = Database['public']['Tables']['products']['Row'];
type Partnership = Database['public']['Tables']['brand_retailer_partnerships']['Row'];
type RetailerProfile = Database['public']['Tables']['retailer_profiles']['Row'];

type RetailerOption = {
  partnership_id: string;
  retailer_id: string;
  retailer_name: string;
};

export default function NewSamplePage() {
  const router = useRouter();
  const { user } = useAuth();
  const [brandProfileId, setBrandProfileId] = useState<string | null>(null);
  const [products, setProducts] = useState<Product[]>([]);
  const [retailers, setRetailers] = useState<RetailerOption[]>([]);
  const [selectedProduct, setSelectedProduct] = useState('');
  const [selectedRetailer, setSelectedRetailer] = useState('');
  const [loading, setLoading] = useState(false);
  const [pageLoading, setPageLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!user) return;
    const supabase = createClient();

    supabase
      .from('brand_profiles')
      .select('id')
      .eq('user_id', user.id)
      .single()
      .then(async ({ data: bp }: { data: { id: string } | null }) => {
        if (!bp) return;
        const brandId = (bp as { id: string }).id;
        setBrandProfileId(brandId);

        const [productsRes, partnershipsRes] = await Promise.all([
          supabase
            .from('products')
            .select('*')
            .eq('brand_id', brandId)
            .eq('is_active', true)
            .order('name'),
          supabase
            .from('brand_retailer_partnerships')
            .select('*')
            .eq('brand_id', brandId)
            .eq('status', 'active'),
        ]);

        setProducts((productsRes.data ?? []) as Product[]);

        const partnerships = (partnershipsRes.data ?? []) as Partnership[];
        const withRetailer = partnerships.filter(
          (p): p is Partnership & { retailer_id: string } => p.retailer_id !== null
        );
        if (withRetailer.length > 0) {
          const retailerIds = withRetailer.map((p) => p.retailer_id);
          const { data: retailerData } = await supabase
            .from('retailer_profiles')
            .select('id, name')
            .in('id', retailerIds);

          const retailerMap = new Map(
            ((retailerData ?? []) as Pick<RetailerProfile, 'id' | 'name'>[]).map((r) => [
              r.id,
              r.name,
            ])
          );

          setRetailers(
            withRetailer.map((p) => ({
              partnership_id: p.id,
              retailer_id: p.retailer_id,
              retailer_name: retailerMap.get(p.retailer_id) ?? 'Unknown',
            }))
          );
        }

        setPageLoading(false);
      });
  }, [user]);

  async function handleCreate() {
    if (!brandProfileId || !selectedProduct || !selectedRetailer) return;
    setError('');
    setLoading(true);

    const res = await fetch('/api/samples', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        product_id: selectedProduct,
        retailer_id: selectedRetailer,
        brand_id: brandProfileId,
      }),
    });

    if (!res.ok) {
      const data = await res.json();
      setError(data.error ?? 'Something went wrong');
      setLoading(false);
      return;
    }

    router.push('/brand/samples');
  }

  if (pageLoading) {
    return <div className="animate-pulse text-gray-400">Loading...</div>;
  }

  return (
    <div className="space-y-6 max-w-lg">
      <div className="flex items-center gap-3">
        <Link
          href="/brand/samples"
          className="p-2 text-gray-400 hover:text-gray-600 rounded-lg hover:bg-gray-100"
        >
          <ArrowLeft className="h-5 w-5" />
        </Link>
        <h1 className="text-2xl font-bold text-gray-900">Create sample</h1>
      </div>

      {products.length === 0 ? (
        <div className="text-center py-8 bg-white rounded-xl border border-gray-200">
          <p className="text-gray-500">You need to create a product first.</p>
          <Link
            href="/brand/products/new"
            className="mt-2 inline-block text-sm text-cirkle-600 font-medium hover:underline"
          >
            Create product
          </Link>
        </div>
      ) : retailers.length === 0 ? (
        <div className="text-center py-8 bg-white rounded-xl border border-gray-200">
          <p className="text-gray-500">You have no active retail partnerships yet.</p>
          <Link
            href="/brand/partnerships"
            className="mt-2 inline-block text-sm text-cirkle-600 font-medium hover:underline"
          >
            Manage partnerships
          </Link>
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-gray-200 p-6 space-y-5">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Product *</label>
            <select
              value={selectedProduct}
              onChange={(e) => setSelectedProduct(e.target.value)}
              className="w-full rounded-lg border border-gray-300 px-4 py-3 text-gray-900 focus:border-cirkle-500 focus:ring-cirkle-500 focus:outline-none bg-white"
            >
              <option value="">Select product</option>
              {products.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name} — {formatDKK(p.price_dkk)}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Store *</label>
            <select
              value={selectedRetailer}
              onChange={(e) => setSelectedRetailer(e.target.value)}
              className="w-full rounded-lg border border-gray-300 px-4 py-3 text-gray-900 focus:border-cirkle-500 focus:ring-cirkle-500 focus:outline-none bg-white"
            >
              <option value="">Select store</option>
              {retailers.map((r) => (
                <option key={r.retailer_id} value={r.retailer_id}>
                  {r.retailer_name}
                </option>
              ))}
            </select>
          </div>

          {error && (
            <p className="text-sm text-red-600 bg-red-50 rounded-lg px-4 py-3">{error}</p>
          )}

          <button
            onClick={handleCreate}
            disabled={loading || !selectedProduct || !selectedRetailer}
            className="w-full flex items-center justify-center gap-2 rounded-lg bg-cirkle-600 px-4 py-3 text-white font-medium hover:bg-cirkle-700 transition disabled:opacity-50"
          >
            {loading ? (
              'Creating...'
            ) : (
              <>
                <QrCode className="h-4 w-4" /> Create sample & generate QR
              </>
            )}
          </button>
        </div>
      )}
    </div>
  );
}
