'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { useAuth } from '@/components/providers/auth-provider';
import { createClient } from '@/lib/supabase';
import { formatDKK } from '@/lib/utils';
import { Plus, Package, Pencil, Trash2 } from 'lucide-react';
import type { Database } from '@/lib/database.types';

type Product = Database['public']['Tables']['products']['Row'];

export default function BrandProductsPage() {
  const { user } = useAuth();
  const [products, setProducts] = useState<Product[]>([]);
  const [brandProfileId, setBrandProfileId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    const supabase = createClient();

    supabase
      .from('brand_profiles')
      .select('id')
      .eq('user_id', user.id)
      .single()
      .then(({ data }: { data: { id: string } | null }) => {
        if (!data) return;
        setBrandProfileId(data.id);
        return supabase
          .from('products')
          .select('*')
          .eq('brand_id', data.id)
          .order('created_at', { ascending: false });
      })
      .then((res: { data: Product[] | null } | undefined) => {
        if (res?.data) setProducts(res.data);
        setLoading(false);
      });
  }, [user]);

  async function toggleActive(product: Product) {
    const supabase = createClient();
    const newActive = !product.is_active;
    await supabase.from('products').update({ is_active: newActive }).eq('id', product.id);
    setProducts((prev) =>
      prev.map((p) => (p.id === product.id ? { ...p, is_active: newActive } : p))
    );
  }

  async function deleteProduct(id: string) {
    if (!confirm('Are you sure you want to delete this product?')) return;
    const supabase = createClient();
    await supabase.from('products').delete().eq('id', id);
    setProducts((prev) => prev.filter((p) => p.id !== id));
  }

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div className="animate-pulse bg-gray-200 rounded h-8 w-32" />
          <div className="animate-pulse bg-gray-200 rounded-lg h-10 w-36" />
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-4 space-y-4">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="flex items-center gap-4">
              <div className="animate-pulse bg-gray-200 rounded-lg h-10 w-10" />
              <div className="flex-1 space-y-2">
                <div className="animate-pulse bg-gray-200 rounded h-4 w-40" />
                <div className="animate-pulse bg-gray-100 rounded h-3 w-24" />
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">Products</h1>
        <Link
          href="/brand/products/new"
          className="flex items-center gap-2 rounded-lg bg-cirkle-600 px-4 py-2.5 text-sm text-white font-medium hover:bg-cirkle-700 transition"
        >
          <Plus className="h-4 w-4" /> New product
        </Link>
      </div>

      {products.length === 0 ? (
        <div className="text-center py-12 bg-white rounded-xl border border-gray-200">
          <Package className="h-12 w-12 text-gray-300 mx-auto" />
          <p className="mt-3 font-medium text-gray-700">No products yet</p>
          <p className="text-sm text-gray-400 mt-1">Add your first product to start creating samples and QR codes</p>
          <Link
            href="/brand/products/new"
            className="mt-4 inline-flex items-center gap-2 bg-cirkle-600 text-white text-sm font-medium px-5 py-2.5 rounded-lg hover:bg-cirkle-700 transition"
          >
            <Plus className="h-4 w-4" /> Add first product
          </Link>
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="text-left px-4 py-3 font-medium text-gray-600">Product</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-600 hidden sm:table-cell">Price</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-600 hidden sm:table-cell">Deposit</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-600 hidden md:table-cell">Sizes</th>
                  <th className="text-center px-4 py-3 font-medium text-gray-600">Active</th>
                  <th className="text-right px-4 py-3 font-medium text-gray-600">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {products.map((product) => (
                  <tr key={product.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        {product.images?.[0] ? (
                          <div className="relative w-10 h-10 rounded-lg overflow-hidden border border-gray-200 flex-shrink-0">
                            <Image
                              src={product.images[0]}
                              alt={product.name}
                              fill
                              className="object-cover"
                              sizes="40px"
                            />
                          </div>
                        ) : (
                          <div className="w-10 h-10 rounded-lg bg-gray-100 flex items-center justify-center flex-shrink-0">
                            <Package className="h-5 w-5 text-gray-400" />
                          </div>
                        )}
                        <span className="font-medium text-gray-900">{product.name}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-gray-600 hidden sm:table-cell">{formatDKK(product.price_dkk)}</td>
                    <td className="px-4 py-3 text-gray-600 hidden sm:table-cell">
                      {product.deposit_amount_dkk ? formatDKK(product.deposit_amount_dkk) : '—'}
                    </td>
                    <td className="px-4 py-3 text-gray-600 hidden md:table-cell">
                      {product.sizes?.length ? product.sizes.join(', ') : '—'}
                    </td>
                    <td className="px-4 py-3 text-center">
                      <button
                        onClick={() => toggleActive(product)}
                        className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                          product.is_active ? 'bg-cirkle-500' : 'bg-gray-300'
                        }`}
                      >
                        <span
                          className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                            product.is_active ? 'translate-x-6' : 'translate-x-1'
                          }`}
                        />
                      </button>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-end gap-2">
                        <Link
                          href={`/brand/products/${product.id}/edit`}
                          className="p-2 text-gray-400 hover:text-gray-600 rounded-lg hover:bg-gray-100"
                        >
                          <Pencil className="h-4 w-4" />
                        </Link>
                        <button
                          onClick={() => deleteProduct(product.id)}
                          className="p-2 text-gray-400 hover:text-red-600 rounded-lg hover:bg-red-50"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
