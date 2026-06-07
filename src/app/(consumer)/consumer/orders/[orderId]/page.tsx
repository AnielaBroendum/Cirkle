'use client';

import { useEffect, useState } from 'react';
import { useRouter, useParams } from 'next/navigation';
import Image from 'next/image';
import { ChevronLeft, ExternalLink, Package } from 'lucide-react';
import { useAuth } from '@/components/providers/auth-provider';
import { createClient } from '@/lib/supabase';
import { formatDKK } from '@/lib/utils';
import OrderTimeline from '@/components/consumer/order-timeline';

type OrderDetail = {
  id: string;
  order_number: number;
  status: string;
  total_dkk: number;
  points_used: number;
  discount_dkk: number;
  shipping_name: string;
  shipping_address: string;
  shipping_city: string;
  shipping_postal_code: string;
  tracking_number: string | null;
  tracking_url: string | null;
  created_at: string;
  brand_profiles: { name: string };
  order_items: {
    id: string;
    product_name: string;
    size: string | null;
    color: string | null;
    quantity: number;
    unit_price_dkk: number;
    products: { images: string[] };
  }[];
  order_events: {
    id: string;
    status: string;
    note: string | null;
    created_at: string;
  }[];
};

export default function OrderDetailPage() {
  const router = useRouter();
  const { orderId } = useParams<{ orderId: string }>();
  const { user } = useAuth();
  const [order, setOrder] = useState<OrderDetail | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    const supabase = createClient();

    supabase
      .from('orders')
      .select(`
        *,
        brand_profiles (name),
        order_items (
          id, product_name, size, color, quantity, unit_price_dkk,
          products (images)
        ),
        order_events (
          id, status, note, created_at
        )
      `)
      .eq('id', orderId)
      .eq('consumer_user_id', user.id)
      .single()
      .then(({ data }: { data: OrderDetail | null }) => {
        setOrder(data);
        setLoading(false);
      });
  }, [user, orderId]);

  if (loading) {
    return <div className="py-12 text-center text-gray-400 animate-pulse">Henter ordre...</div>;
  }

  if (!order) {
    return (
      <div className="py-12 text-center">
        <p className="text-gray-500">Ordre ikke fundet</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <button onClick={() => router.back()} className="p-1 -ml-1 text-gray-600">
          <ChevronLeft className="h-5 w-5" />
        </button>
        <div>
          <h1 className="text-xl font-bold text-gray-900">Ordre #{order.order_number}</h1>
          <p className="text-xs text-gray-400">
            {new Date(order.created_at).toLocaleDateString('da-DK', {
              day: 'numeric',
              month: 'long',
              year: 'numeric',
            })}
          </p>
        </div>
      </div>

      {/* Timeline */}
      <div className="bg-white rounded-xl border border-gray-100 p-4">
        <h2 className="text-sm font-semibold text-gray-900 mb-4">Status</h2>
        <OrderTimeline
          events={order.order_events.sort(
            (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
          )}
        />
      </div>

      {/* Tracking */}
      {order.tracking_number && (
        <div className="bg-cirkle-50 rounded-xl border border-cirkle-100 p-4">
          <h2 className="text-sm font-semibold text-cirkle-900 mb-1">Tracking</h2>
          <p className="text-sm text-cirkle-700">{order.tracking_number}</p>
          {order.tracking_url && (
            <a
              href={order.tracking_url}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 text-sm font-medium text-cirkle-600 hover:underline mt-2"
            >
              Spor pakke <ExternalLink className="h-3 w-3" />
            </a>
          )}
        </div>
      )}

      {/* Items */}
      <div>
        <h2 className="text-sm font-semibold text-gray-900 mb-3">Produkter</h2>
        <div className="space-y-3">
          {order.order_items.map((item) => {
            const imageUrl = item.products?.images?.[0];
            return (
              <div key={item.id} className="flex gap-3 p-3 bg-gray-50 rounded-xl">
                {imageUrl ? (
                  <div className="relative w-14 h-14 rounded-lg overflow-hidden flex-shrink-0">
                    <Image src={imageUrl} alt={item.product_name} fill className="object-cover" sizes="56px" />
                  </div>
                ) : (
                  <div className="w-14 h-14 rounded-lg bg-gray-200 flex items-center justify-center flex-shrink-0">
                    <Package className="h-5 w-5 text-gray-400" />
                  </div>
                )}
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-900">{item.product_name}</p>
                  {(item.size || item.color) && (
                    <p className="text-xs text-gray-500 mt-0.5">
                      {[item.size, item.color].filter(Boolean).join(' / ')}
                    </p>
                  )}
                  <p className="text-sm font-medium text-gray-700 mt-1">
                    {item.quantity}x {formatDKK(item.unit_price_dkk)}
                  </p>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Summary */}
      <div className="border-t border-gray-200 pt-4 space-y-2">
        <div className="flex justify-between text-sm text-gray-600">
          <span>Subtotal</span>
          <span>{formatDKK(order.total_dkk + order.discount_dkk)}</span>
        </div>
        {order.points_used > 0 && (
          <div className="flex justify-between text-sm text-cirkle-600">
            <span>Point rabat ({order.points_used} point)</span>
            <span>-{formatDKK(order.discount_dkk)}</span>
          </div>
        )}
        <div className="flex justify-between text-sm text-gray-600">
          <span>Levering</span>
          <span className="text-green-600">Gratis</span>
        </div>
        <div className="flex justify-between font-bold text-gray-900 pt-2 border-t border-gray-100">
          <span>Total</span>
          <span>{formatDKK(order.total_dkk)}</span>
        </div>
      </div>

      {/* Shipping */}
      <div>
        <h2 className="text-sm font-semibold text-gray-900 mb-2">Leveringsadresse</h2>
        <div className="text-sm text-gray-600 bg-gray-50 rounded-xl p-4">
          <p className="font-medium text-gray-900">{order.shipping_name}</p>
          <p>{order.shipping_address}</p>
          <p>{order.shipping_postal_code} {order.shipping_city}</p>
        </div>
      </div>

      {/* Brand */}
      <div className="text-center py-4">
        <p className="text-xs text-gray-400">
          Pakket og afsendt af <span className="font-medium">{order.brand_profiles.name}</span>
        </p>
      </div>
    </div>
  );
}
