'use client';

import { useEffect, useState } from 'react';
import Image from 'next/image';
import { useAuth } from '@/components/providers/auth-provider';
import { createClient } from '@/lib/supabase';
import { QrCode } from 'lucide-react';
import type { Database } from '@/lib/database.types';

type Sample = Database['public']['Tables']['samples']['Row'];
type Product = Database['public']['Tables']['products']['Row'];
type BrandProfile = Database['public']['Tables']['brand_profiles']['Row'];

type SampleWithDetails = Sample & {
  product_name: string;
  product_image: string | null;
  brand_name: string;
  scan_count: number;
  last_scanned: string | null;
};

export default function RetailerSamplesPage() {
  const { user } = useAuth();
  const [samples, setSamples] = useState<SampleWithDetails[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    const supabase = createClient();

    supabase
      .from('retailer_profiles')
      .select('id')
      .eq('user_id', user.id)
      .single()
      .then(async ({ data: rp }: { data: { id: string } | null }) => {
        if (!rp) {
          setLoading(false);
          return;
        }

        const retailerId = (rp as { id: string }).id;

        const { data: samplesData } = await supabase
          .from('samples')
          .select('*')
          .eq('retailer_id', retailerId)
          .order('created_at', { ascending: false });

        if (!samplesData || samplesData.length === 0) {
          setLoading(false);
          return;
        }

        const typed = samplesData as Sample[];
        const productIds = Array.from(new Set(typed.map((s) => s.product_id)));
        const brandIds = Array.from(new Set(typed.map((s) => s.brand_id)));
        const sampleIds = typed.map((s) => s.id);

        const [productsRes, brandsRes, scansRes] = await Promise.all([
          supabase.from('products').select('id, name, images').in('id', productIds),
          supabase.from('brand_profiles').select('id, name').in('id', brandIds),
          supabase
            .from('scans')
            .select('sample_id, scanned_at')
            .in('sample_id', sampleIds)
            .order('scanned_at', { ascending: false }),
        ]);

        const productMap = new Map(
          ((productsRes.data ?? []) as Pick<Product, 'id' | 'name' | 'images'>[]).map((p) => [
            p.id,
            p,
          ])
        );
        const brandMap = new Map(
          ((brandsRes.data ?? []) as Pick<BrandProfile, 'id' | 'name'>[]).map((b) => [
            b.id,
            b.name,
          ])
        );

        // Compute scan counts and last scanned per sample
        const scanCounts = new Map<string, number>();
        const lastScanned = new Map<string, string>();
        for (const scan of (scansRes.data ?? []) as {
          sample_id: string | null;
          scanned_at: string;
        }[]) {
          if (scan.sample_id) {
            scanCounts.set(
              scan.sample_id,
              (scanCounts.get(scan.sample_id) ?? 0) + 1
            );
            if (!lastScanned.has(scan.sample_id)) {
              lastScanned.set(scan.sample_id, scan.scanned_at);
            }
          }
        }

        const enriched: SampleWithDetails[] = typed.map((s) => {
          const product = productMap.get(s.product_id);
          return {
            ...s,
            product_name: product?.name ?? 'Ukendt produkt',
            product_image: product?.images?.[0] ?? null,
            brand_name: brandMap.get(s.brand_id) ?? 'Ukendt brand',
            scan_count: scanCounts.get(s.id) ?? 0,
            last_scanned: lastScanned.get(s.id) ?? null,
          };
        });

        setSamples(enriched);
        setLoading(false);
      });
  }, [user]);

  function formatDate(dateStr: string): string {
    return new Date(dateStr).toLocaleDateString('da-DK', {
      day: 'numeric',
      month: 'short',
    });
  }

  if (loading) {
    return <div className="animate-pulse text-gray-400">Henter prøver...</div>;
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Prøver</h1>
        <p className="mt-1 text-gray-500">
          Alle prøver tildelt din butik
        </p>
      </div>

      {samples.length === 0 ? (
        <div className="text-center py-12 bg-white rounded-xl border border-gray-200">
          <QrCode className="h-12 w-12 text-gray-300 mx-auto" />
          <p className="mt-3 text-gray-500">Ingen prøver endnu</p>
          <p className="mt-1 text-sm text-gray-400">
            Prøver tilføjes af de brands du samarbejder med
          </p>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {samples.map((sample) => (
            <div
              key={sample.id}
              className="bg-white rounded-xl border border-gray-200 p-4 space-y-3"
            >
              <div className="flex items-start gap-3">
                {sample.product_image ? (
                  <div className="relative w-14 h-14 rounded-lg overflow-hidden border border-gray-200 flex-shrink-0">
                    <Image
                      src={sample.product_image}
                      alt=""
                      fill
                      className="object-cover"
                      sizes="56px"
                    />
                  </div>
                ) : (
                  <div className="w-14 h-14 rounded-lg bg-gray-100 flex items-center justify-center flex-shrink-0">
                    <QrCode className="h-6 w-6 text-gray-400" />
                  </div>
                )}
                <div className="min-w-0 flex-1">
                  <p className="font-medium text-gray-900 text-sm truncate">
                    {sample.product_name}
                  </p>
                  <p className="text-xs text-gray-500 mt-0.5">{sample.brand_name}</p>
                  <span
                    className={`inline-block mt-1 text-xs px-2 py-0.5 rounded-full ${
                      sample.status === 'active'
                        ? 'bg-green-50 text-green-700'
                        : 'bg-gray-100 text-gray-500'
                    }`}
                  >
                    {sample.status === 'active' ? 'Aktiv' : sample.status === 'inactive' ? 'Inaktiv' : sample.status}
                  </span>
                </div>
              </div>

              <div className="flex items-center justify-between text-sm border-t border-gray-100 pt-2">
                <div className="text-gray-500">
                  <span className="font-medium text-gray-700">{sample.scan_count}</span>{' '}
                  scanninger
                </div>
                {sample.last_scanned && (
                  <span className="text-xs text-gray-400">
                    Sidst: {formatDate(sample.last_scanned)}
                  </span>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
