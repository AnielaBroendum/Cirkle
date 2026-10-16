'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/components/providers/auth-provider';
import { createClient } from '@/lib/supabase';
import { formatDKK } from '@/lib/utils';
import { QrCode, Package, Store } from 'lucide-react';
import Link from 'next/link';
import { Button, Card, EmptyState, Field, Select, Skeleton, buttonClasses } from '@/components/ds';
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

  const header = (
    <div>
      <p className="text-body text-muted">
        <Link href="/brand/samples" className="hover:text-primary">
          Stores and QR tags
        </Link>{' '}
        / New sample
      </p>
      <h1 className="mt-1 font-brand text-heading-xl uppercase text-primary">Add sample</h1>
      <p className="mt-1 text-body text-muted">Pick a product and a partner store. We generate the store&apos;s QR tag right away.</p>
    </div>
  );

  if (pageLoading) {
    return (
      <div className="max-w-xl space-y-6">
        {header}
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  return (
    <div className="max-w-xl space-y-6">
      {header}

      {products.length === 0 ? (
        <EmptyState
          className="bg-surface"
          icon={<Package className="h-5 w-5" />}
          title="No products yet"
          description="You need to create a product first."
          action={
            <Link href="/brand/products/new" className={buttonClasses()}>
              Create product
            </Link>
          }
        />
      ) : retailers.length === 0 ? (
        <EmptyState
          className="bg-surface"
          icon={<Store className="h-5 w-5" />}
          title="No partner stores yet"
          description="You have no active retail partnerships yet."
          action={
            <Link href="/brand/samples" className={buttonClasses()}>
              Invite a store
            </Link>
          }
        />
      ) : (
        <Card padding="none" className="space-y-5 rounded-none p-5 lg:p-6">
          <Field label="Product *" htmlFor="sample-product">
            <Select id="sample-product" value={selectedProduct} onChange={(e) => setSelectedProduct(e.target.value)}>
              <option value="">Select product</option>
              {products.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name} — {formatDKK(p.price_dkk)}
                </option>
              ))}
            </Select>
          </Field>

          <Field label="Store *" htmlFor="sample-store">
            <Select id="sample-store" value={selectedRetailer} onChange={(e) => setSelectedRetailer(e.target.value)}>
              <option value="">Select store</option>
              {retailers.map((r) => (
                <option key={r.retailer_id} value={r.retailer_id}>
                  {r.retailer_name}
                </option>
              ))}
            </Select>
          </Field>

          {error && (
            <p role="alert" className="border border-accent bg-accent-subtle px-4 py-3 text-body text-accent-strong">
              {error}
            </p>
          )}

          <div className="flex flex-col-reverse gap-3 sm:flex-row">
            <Link href="/brand/samples" className={buttonClasses({ variant: 'secondary' })}>
              Cancel
            </Link>
            <Button
              onClick={handleCreate}
              disabled={loading || !selectedProduct || !selectedRetailer}
              loading={loading}
              leftIcon={<QrCode className="h-4 w-4" />}
              className="sm:flex-1"
            >
              {loading ? 'Creating…' : 'Create sample & generate QR'}
            </Button>
          </div>
        </Card>
      )}
    </div>
  );
}
