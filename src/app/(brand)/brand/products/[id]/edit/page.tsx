'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { useAuth } from '@/components/providers/auth-provider';
import { createClient } from '@/lib/supabase';
import Link from 'next/link';
import { Package } from 'lucide-react';
import { ProductForm } from '@/components/brand/product-form';
import { EmptyState, Skeleton, buttonClasses } from '@/components/ds';
import type { Database } from '@/lib/database.types';

type Product = Database['public']['Tables']['products']['Row'];
type ProductVariant = Database['public']['Tables']['product_variants']['Row'];

export default function EditProductPage() {
  const { id } = useParams<{ id: string }>();
  const { user } = useAuth();
  const [brandProfileId, setBrandProfileId] = useState<string | null>(null);
  const [product, setProduct] = useState<Product | null>(null);
  const [variants, setVariants] = useState<ProductVariant[]>([]);
  const [loading, setLoading] = useState(true);
  const [stores, setStores] = useState<string[]>([]);

  useEffect(() => {
    if (!user || !id) return;
    const supabase = createClient();

    Promise.all([
      supabase.from('brand_profiles').select('id').eq('user_id', user.id).single(),
      supabase.from('products').select('*').eq('id', id).single(),
      supabase.from('product_variants').select('*').eq('product_id', id),
    ]).then(([bpRes, pRes, vRes]) => {
      if (bpRes.data) setBrandProfileId((bpRes.data as { id: string }).id);
      if (pRes.data) setProduct(pRes.data as Product);
      if (vRes.data) setVariants(vRes.data as ProductVariant[]);
      setLoading(false);
    });
  }, [user, id]);

  // "In stores": stores holding an active sample of this product
  useEffect(() => {
    if (!id) return;
    const supabase = createClient();
    supabase
      .from('samples')
      .select('retailer_id')
      .eq('product_id', id)
      .eq('status', 'active')
      .then(async ({ data }: { data: { retailer_id: string }[] | null }) => {
        const retailerIds = Array.from(new Set((data ?? []).map((s) => s.retailer_id)));
        if (!retailerIds.length) return;
        const { data: retailers } = await supabase.from('retailer_profiles').select('name').in('id', retailerIds);
        setStores(((retailers ?? []) as { name: string }[]).map((r) => r.name).sort());
      });
  }, [id]);

  if (loading || !brandProfileId) {
    return (
      <div className="space-y-6">
        <div>
          <Skeleton className="h-4 w-40" />
          <Skeleton className="mt-2 h-10 w-64" />
        </div>
        <div className="grid gap-4 lg:grid-cols-[617fr_455fr] lg:gap-5">
          <Skeleton className="h-[480px] w-full" />
          <Skeleton className="h-[320px] w-full" />
        </div>
      </div>
    );
  }

  if (!product) {
    return (
      <EmptyState
        className="bg-surface"
        icon={<Package className="h-5 w-5" />}
        title="Product not found"
        description="It may have been deleted."
        action={
          <Link href="/brand/products" className={buttonClasses({ variant: 'secondary' })}>
            Back to product library
          </Link>
        }
      />
    );
  }

  return (
    <ProductForm
      brandProfileId={brandProfileId}
      product={product}
      existingVariants={variants}
      title="Edit product"
      stores={stores}
    />
  );
}
