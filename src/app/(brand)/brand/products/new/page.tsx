'use client';

import { useEffect, useState } from 'react';
import { useAuth } from '@/components/providers/auth-provider';
import { createClient } from '@/lib/supabase';
import { ProductForm } from '@/components/brand/product-form';

export default function NewProductPage() {
  const { user } = useAuth();
  const [brandProfileId, setBrandProfileId] = useState<string | null>(null);

  useEffect(() => {
    if (!user) return;
    const supabase = createClient();
    supabase
      .from('brand_profiles')
      .select('id')
      .eq('user_id', user.id)
      .single()
      .then(({ data }: { data: { id: string } | null }) => {
        if (data) setBrandProfileId(data.id);
      });
  }, [user]);

  if (!brandProfileId) {
    return <div className="animate-pulse text-gray-400">Loading...</div>;
  }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-gray-900">Nyt produkt</h1>
      <ProductForm brandProfileId={brandProfileId} />
    </div>
  );
}
