'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { useAuth } from '@/components/providers/auth-provider';
import { createClient } from '@/lib/supabase';
import { formatDKK } from '@/lib/utils';
import { Plus, QrCode, Download, ExternalLink } from 'lucide-react';
import type { Database } from '@/lib/database.types';

type Sample = Database['public']['Tables']['samples']['Row'];
type Product = Database['public']['Tables']['products']['Row'];
type RetailerProfile = Database['public']['Tables']['retailer_profiles']['Row'];

type SampleWithDetails = Sample & {
  product: Pick<Product, 'name' | 'images'> | null;
  retailer: Pick<RetailerProfile, 'name'> | null;
  scan_count: number;
};

export default function BrandSamplesPage() {
  const { user } = useAuth();
  const [samples, setSamples] = useState<SampleWithDetails[]>([]);
  const [loading, setLoading] = useState(true);

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

        const { data: samplesData } = await supabase
          .from('samples')
          .select('*')
          .eq('brand_id', brandId)
          .order('created_at', { ascending: false });

        if (!samplesData || samplesData.length === 0) {
          setLoading(false);
          return;
        }

        const typedSamples = samplesData as Sample[];
        const productIds = Array.from(new Set(typedSamples.map((s) => s.product_id)));
        const retailerIds = Array.from(new Set(typedSamples.map((s) => s.retailer_id)));
        const sampleIds = typedSamples.map((s) => s.id);

        const [productsRes, retailersRes, scansRes] = await Promise.all([
          supabase.from('products').select('id, name, images').in('id', productIds),
          supabase.from('retailer_profiles').select('id, name').in('id', retailerIds),
          supabase.from('scans').select('sample_id').in('sample_id', sampleIds),
        ]);

        const productsMap = new Map(
          ((productsRes.data ?? []) as Pick<Product, 'id' | 'name' | 'images'>[]).map((p) => [p.id, p])
        );
        const retailersMap = new Map(
          ((retailersRes.data ?? []) as (Pick<RetailerProfile, 'id' | 'name'>)[]).map((r) => [r.id, r])
        );

        const scanCounts = new Map<string, number>();
        for (const scan of (scansRes.data ?? []) as { sample_id: string | null }[]) {
          if (scan.sample_id) {
            scanCounts.set(scan.sample_id, (scanCounts.get(scan.sample_id) ?? 0) + 1);
          }
        }

        const enriched: SampleWithDetails[] = typedSamples.map((s) => ({
          ...s,
          product: productsMap.get(s.product_id) ?? null,
          retailer: retailersMap.get(s.retailer_id) ?? null,
          scan_count: scanCounts.get(s.id) ?? 0,
        }));

        setSamples(enriched);
        setLoading(false);
      });
  }, [user]);

  function downloadQr(url: string, productName: string) {
    const a = document.createElement('a');
    a.href = url;
    a.download = `qr-${productName.toLowerCase().replace(/\s+/g, '-')}.png`;
    a.click();
  }

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div className="animate-pulse bg-gray-200 rounded h-8 w-28" />
          <div className="animate-pulse bg-gray-200 rounded-lg h-10 w-32" />
        </div>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="bg-white rounded-xl border border-gray-200 p-4 space-y-3">
              <div className="flex items-center gap-3">
                <div className="animate-pulse bg-gray-200 rounded-lg h-10 w-10" />
                <div className="space-y-2">
                  <div className="animate-pulse bg-gray-200 rounded h-4 w-28" />
                  <div className="animate-pulse bg-gray-100 rounded h-3 w-16" />
                </div>
              </div>
              <div className="animate-pulse bg-gray-100 rounded h-[120px] w-[120px] mx-auto" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  const grouped = new Map<string, { retailerName: string; samples: SampleWithDetails[] }>();
  for (const sample of samples) {
    const key = sample.retailer_id;
    if (!grouped.has(key)) {
      grouped.set(key, {
        retailerName: sample.retailer?.name ?? 'Unknown store',
        samples: [],
      });
    }
    grouped.get(key)!.samples.push(sample);
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">Samples</h1>
        <Link
          href="/brand/samples/new"
          className="flex items-center gap-2 rounded-lg bg-cirkle-600 px-4 py-2.5 text-sm text-white font-medium hover:bg-cirkle-700 transition"
        >
          <Plus className="h-4 w-4" /> New sample
        </Link>
      </div>

      {samples.length === 0 ? (
        <div className="text-center py-12 bg-white rounded-xl border border-gray-200">
          <QrCode className="h-12 w-12 text-gray-300 mx-auto" />
          <p className="mt-3 font-medium text-gray-700">No samples yet</p>
          <p className="mt-1 text-sm text-gray-400">
            Create samples to generate QR codes for your retail partners
          </p>
        </div>
      ) : (
        <div className="space-y-8">
          {Array.from(grouped.entries()).map(([retailerId, group]) => (
            <div key={retailerId}>
              <h2 className="text-lg font-semibold text-gray-900 mb-3">{group.retailerName}</h2>
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {group.samples.map((sample) => (
                  <div
                    key={sample.id}
                    className="bg-white rounded-xl border border-gray-200 p-4 space-y-3"
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex items-center gap-3">
                        {sample.product?.images?.[0] ? (
                          <div className="relative w-10 h-10 rounded-lg overflow-hidden border border-gray-200 flex-shrink-0">
                            <Image
                              src={sample.product.images[0]}
                              alt=""
                              fill
                              className="object-cover"
                              sizes="40px"
                            />
                          </div>
                        ) : (
                          <div className="w-10 h-10 rounded-lg bg-gray-100 flex items-center justify-center flex-shrink-0">
                            <QrCode className="h-5 w-5 text-gray-400" />
                          </div>
                        )}
                        <div>
                          <p className="font-medium text-gray-900 text-sm">
                            {sample.product?.name ?? 'Unknown product'}
                          </p>
                          <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
                            <span
                              className={`inline-block text-xs px-2 py-0.5 rounded-full ${
                                sample.status === 'active'
                                  ? 'bg-green-50 text-green-700'
                                  : 'bg-gray-100 text-gray-500'
                              }`}
                            >
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
                    </div>

                    <div className="flex items-center justify-between text-sm text-gray-500">
                      <span>{sample.scan_count} scans</span>
                      <div className="flex items-center gap-1">
                        {sample.qr_code_url && (
                          <button
                            onClick={() =>
                              downloadQr(
                                sample.qr_code_url!,
                                sample.product?.name ?? 'sample'
                              )
                            }
                            className="p-1.5 text-gray-400 hover:text-gray-600 rounded-lg hover:bg-gray-100"
                            title="Download QR"
                          >
                            <Download className="h-4 w-4" />
                          </button>
                        )}
                        <Link
                          href={`${process.env.NEXT_PUBLIC_QR_BASE_URL}/p/${sample.id}`}
                          target="_blank"
                          className="p-1.5 text-gray-400 hover:text-gray-600 rounded-lg hover:bg-gray-100"
                          title="Open scan page"
                        >
                          <ExternalLink className="h-4 w-4" />
                        </Link>
                      </div>
                    </div>

                    {sample.qr_code_url && (
                      <div className="flex justify-center pt-1">
                        <Image
                          src={sample.qr_code_url}
                          alt="QR Code"
                          width={120}
                          height={120}
                          className="rounded-lg"
                        />
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
