'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { useAuth } from '@/components/providers/auth-provider';
import { createClient } from '@/lib/supabase';
import { formatDKK } from '@/lib/utils';
import { ShoppingBag, ChevronRight, Package } from 'lucide-react';

type Order = {
  id: string;
  order_number: number;
  status: string;
  total_dkk: number;
  created_at: string;
  order_items: {
    product_name: string;
    size: string | null;
    color: string | null;
    products: { images: string[] };
  }[];
};

const STATUS_LABELS: Record<string, { text: string; className: string }> = {
  pending: { text: 'Pending', className: 'bg-yellow-100 text-yellow-700' },
  confirmed: { text: 'Confirmed', className: 'bg-blue-100 text-blue-700' },
  packed: { text: 'Packed', className: 'bg-purple-100 text-purple-700' },
  shipped: { text: 'Shipped', className: 'bg-cirkle-100 text-cirkle-700' },
  delivered: { text: 'Delivered', className: 'bg-green-100 text-green-700' },
  cancelled: { text: 'Cancelled', className: 'bg-red-100 text-red-700' },
};

export default function ConsumerOrdersPage() {
  const { user } = useAuth();
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    const supabase = createClient();

    supabase
      .from('orders')
      .select(`
        id, order_number, status, total_dkk, created_at,
        order_items (
          product_name, size, color,
          products (images)
        )
      `)
      .eq('consumer_user_id', user.id)
      .order('created_at', { ascending: false })
      .then(({ data }: { data: Order[] | null }) => {
        setOrders(data ?? []);
        setLoading(false);
      });
  }, [user]);

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="animate-pulse bg-gray-200 rounded h-8 w-36" />
        {[...Array(3)].map((_, i) => (
          <div key={i} className="flex items-center gap-4 p-4 bg-white rounded-xl border border-gray-100">
            <div className="animate-pulse bg-gray-200 rounded-lg h-16 w-16" />
            <div className="flex-1 space-y-2">
              <div className="animate-pulse bg-gray-200 rounded h-4 w-40" />
              <div className="animate-pulse bg-gray-100 rounded h-3 w-24" />
            </div>
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-gray-900">My orders</h1>

      {orders.length === 0 ? (
        <div className="text-center py-16">
          <ShoppingBag className="h-12 w-12 text-gray-300 mx-auto" />
          <p className="mt-3 font-medium text-gray-700">No orders yet</p>
          <p className="text-sm text-gray-400 mt-1">Scan a QR code to discover and buy products</p>
        </div>
      ) : (
        <div className="space-y-3">
          {orders.map((order) => {
            const firstItem = order.order_items?.[0];
            const statusConfig = STATUS_LABELS[order.status] || STATUS_LABELS.pending;
            const imageUrl = firstItem?.products?.images?.[0];

            return (
              <Link
                key={order.id}
                href={`/consumer/orders/${order.id}`}
                className="flex items-center gap-4 p-4 bg-white rounded-xl border border-gray-100 hover:border-gray-200 transition"
              >
                {imageUrl ? (
                  <div className="relative w-16 h-16 rounded-lg overflow-hidden flex-shrink-0">
                    <Image src={imageUrl} alt={firstItem?.product_name || ''} fill className="object-cover" sizes="64px" />
                  </div>
                ) : (
                  <div className="w-16 h-16 rounded-lg bg-gray-100 flex items-center justify-center flex-shrink-0">
                    <Package className="h-6 w-6 text-gray-300" />
                  </div>
                )}
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-gray-900 truncate">
                    {firstItem?.product_name || 'Order'}
                  </p>
                  <div className="flex items-center gap-2 mt-1">
                    <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${statusConfig.className}`}>
                      {statusConfig.text}
                    </span>
                    <span className="text-xs text-gray-400">
                      #{order.order_number}
                    </span>
                  </div>
                  <p className="text-xs text-gray-500 mt-1">
                    {new Date(order.created_at).toLocaleDateString('en-GB')} — {formatDKK(order.total_dkk)}
                  </p>
                </div>
                <ChevronRight className="h-4 w-4 text-gray-300 flex-shrink-0" />
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
