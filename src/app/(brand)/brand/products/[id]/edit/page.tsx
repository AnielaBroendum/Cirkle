'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { useAuth } from '@/components/providers/auth-provider';
import { createClient } from '@/lib/supabase';
import { ProductForm } from '@/components/brand/product-form';
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

  if (loading || !brandProfileId) {
    return <div className="animate-pulse text-gray-400">Henter produkt...</div>;
  }

  if (!product) {
    return <p className="text-gray-500">Produkt ikke fundet.</p>;
  }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-gray-900">Rediger produkt</h1>
      <ProductForm
        brandProfileId={brandProfileId}
        product={product}
        existingVariants={variants}
      />
    </div>
  );
}
