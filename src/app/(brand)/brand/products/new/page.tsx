'use client';

import { useEffect, useState } from 'react';
import { useAuth } from '@/components/providers/auth-provider';
import { createClient } from '@/lib/supabase';
import { ProductForm } from '@/components/brand/product-form';
import { Skeleton } from '@/components/ds';

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
    return <FormSkeleton />;
  }

  return <ProductForm brandProfileId={brandProfileId} title="Add product" />;
}

function FormSkeleton() {
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
