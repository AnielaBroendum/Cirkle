'use client';

import { useEffect, useState, useCallback } from 'react';
import { useAuth } from '@/components/providers/auth-provider';
import { createClient } from '@/lib/supabase';
import { formatDKK } from '@/lib/utils';
import {
  ShoppingBag,
  Check,
  Package,
  Truck,
  Home,
  Clock,
  ChevronDown,
  ChevronUp,
  MapPin,
  X,
} from 'lucide-react';

type OrderItem = {
  id: string;
  product_name: string;
  size: string | null;
  color: string | null;
  quantity: number;
  unit_price_dkk: number;
};

type OrderEvent = {
  id: string;
  status: string;
  note: string | null;
  created_at: string;
};

type Order = {
  id: string;
  order_number: number;
  status: string;
  total_dkk: number;
  shipping_name: string;
  shipping_address: string;
  shipping_city: string;
  shipping_postal_code: string;
  shipping_country: string;
  tracking_number: string | null;
  created_at: string;
  consumer_user_id: string;
  order_items: OrderItem[];
  order_events: OrderEvent[];
  profiles: { name: string; email: string } | null;
};

const STATUS_CONFIG: Record<string, { label: string; icon: typeof Clock; color: string; bg: string }> = {
  pending: { label: 'Afventer', icon: Clock, color: 'text-yellow-700', bg: 'bg-yellow-100' },
  confirmed: { label: 'Bekraeftet', icon: Check, color: 'text-blue-700', bg: 'bg-blue-100' },
  packed: { label: 'Pakket', icon: Package, color: 'text-purple-700', bg: 'bg-purple-100' },
  shipped: { label: 'Afsendt', icon: Truck, color: 'text-cirkle-700', bg: 'bg-cirkle-100' },
  delivered: { label: 'Leveret', icon: Home, color: 'text-green-700', bg: 'bg-green-100' },
  cancelled: { label: 'Annulleret', icon: X, color: 'text-red-700', bg: 'bg-red-100' },
};

const STATUS_SORT_ORDER: Record<string, number> = {
  pending: 0,
  confirmed: 1,
  packed: 2,
  shipped: 3,
  delivered: 4,
  cancelled: 5,
};

const NEXT_STATUS: Record<string, { status: string; label: string; needsTracking?: boolean }> = {
  pending: { status: 'confirmed', label: 'Bekraeft' },
  confirmed: { status: 'packed', label: 'Marker som pakket' },
  packed: { status: 'shipped', label: 'Marker som afsendt', needsTracking: true },
  shipped: { status: 'delivered', label: 'Marker som leveret' },
};

type FilterStatus = 'all' | 'pending' | 'confirmed' | 'packed' | 'shipped' | 'delivered';

export default function BrandOrdersPage() {
  const { user } = useAuth();
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedOrder, setExpandedOrder] = useState<string | null>(null);
  const [trackingInput, setTrackingInput] = useState('');
  const [trackingUrlInput, setTrackingUrlInput] = useState('');
  const [updatingOrder, setUpdatingOrder] = useState<string | null>(null);
  const [filter, setFilter] = useState<FilterStatus>('all');

  const loadOrders = useCallback(async () => {
    if (!user) return;
    const supabase = createClient();

    const { data: bp } = await supabase
      .from('brand_profiles')
      .select('id')
      .eq('user_id', user.id)
      .single();

    if (!bp) return;

    const { data } = await supabase
      .from('orders')
      .select(`
        id, order_number, status, total_dkk,
        shipping_name, shipping_address, shipping_city, shipping_postal_code, shipping_country,
        tracking_number, created_at, consumer_user_id,
        order_items (id, product_name, size, color, quantity, unit_price_dkk),
        order_events (id, status, note, created_at),
        profiles!orders_consumer_user_id_fkey (name, email)
      `)
      .eq('brand_id', (bp as { id: string }).id)
      .order('created_at', { ascending: false });

    const allOrders = (data ?? []) as unknown as Order[];
    allOrders.sort((a, b) => {
      const sa = STATUS_SORT_ORDER[a.status] ?? 99;
      const sb = STATUS_SORT_ORDER[b.status] ?? 99;
      if (sa !== sb) return sa - sb;
      return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
    });

    setOrders(allOrders);
    setLoading(false);
  }, [user]);

  useEffect(() => {
    loadOrders();
  }, [loadOrders]);

  async function updateStatus(orderId: string, newStatus: string) {
    setUpdatingOrder(orderId);
    try {
      const body: Record<string, string> = { status: newStatus };
      if (newStatus === 'shipped' && trackingInput) {
        body.tracking_number = trackingInput;
        if (trackingUrlInput) body.tracking_url = trackingUrlInput;
      }

      const res = await fetch(`/api/orders/${orderId}/status`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      if (res.ok) {
        setTrackingInput('');
        setTrackingUrlInput('');
        setExpandedOrder(null);
        await loadOrders();
      }
    } finally {
      setUpdatingOrder(null);
    }
  }

  const filteredOrders = filter === 'all' ? orders : orders.filter((o) => o.status === filter);

  const counts = orders.reduce(
    (acc, o) => {
      acc[o.status] = (acc[o.status] || 0) + 1;
      return acc;
    },
    {} as Record<string, number>,
  );

  if (loading) {
    return <div className="animate-pulse text-gray-400">Henter ordrer...</div>;
  }

  const FILTER_TABS: { key: FilterStatus; label: string }[] = [
    { key: 'all', label: `Alle (${orders.length})` },
    { key: 'pending', label: `Afventer (${counts.pending || 0})` },
    { key: 'confirmed', label: `Bekraeftet (${counts.confirmed || 0})` },
    { key: 'packed', label: `Pakket (${counts.packed || 0})` },
    { key: 'shipped', label: `Afsendt (${counts.shipped || 0})` },
    { key: 'delivered', label: `Leveret (${counts.delivered || 0})` },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Ordrer</h1>
        <p className="mt-1 text-gray-500">Administrer og send dine ordrer</p>
      </div>

      {/* Filter tabs */}
      <div className="flex gap-2 overflow-x-auto pb-1">
        {FILTER_TABS.map((tab) => (
          <button
            key={tab.key}
            onClick={() => setFilter(tab.key)}
            className={`px-3 py-1.5 rounded-full text-sm font-medium whitespace-nowrap transition-colors ${
              filter === tab.key
                ? 'bg-cirkle-600 text-white'
                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {filteredOrders.length === 0 ? (
        <div className="text-center py-16">
          <ShoppingBag className="h-12 w-12 text-gray-300 mx-auto" />
          <p className="mt-3 text-gray-500">Ingen ordrer</p>
        </div>
      ) : (
        <div className="space-y-3">
          {filteredOrders.map((order) => {
            const config = STATUS_CONFIG[order.status] || STATUS_CONFIG.pending;
            const StatusIcon = config.icon;
            const isExpanded = expandedOrder === order.id;
            const nextAction = NEXT_STATUS[order.status];
            const isUpdating = updatingOrder === order.id;
            const customerName = order.profiles?.name || order.shipping_name;

            return (
              <div
                key={order.id}
                className="bg-white rounded-xl border border-gray-200 overflow-hidden"
              >
                {/* Order header */}
                <button
                  onClick={() => setExpandedOrder(isExpanded ? null : order.id)}
                  className="w-full flex items-center gap-4 p-4 text-left hover:bg-gray-50 transition"
                >
                  <div className={`p-2 rounded-lg ${config.bg} ${config.color} flex-shrink-0`}>
                    <StatusIcon className="h-5 w-5" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-bold text-gray-900">
                        #{order.order_number}
                      </span>
                      <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${config.bg} ${config.color}`}>
                        {config.label}
                      </span>
                    </div>
                    <p className="text-sm text-gray-600 truncate mt-0.5">{customerName}</p>
                    <p className="text-xs text-gray-400 mt-0.5">
                      {new Date(order.created_at).toLocaleDateString('da-DK', {
                        day: 'numeric',
                        month: 'short',
                        year: 'numeric',
                      })}
                      {' — '}
                      {formatDKK(order.total_dkk)}
                    </p>
                  </div>
                  <div className="flex-shrink-0 text-gray-400">
                    {isExpanded ? <ChevronUp className="h-5 w-5" /> : <ChevronDown className="h-5 w-5" />}
                  </div>
                </button>

                {/* Expanded details */}
                {isExpanded && (
                  <div className="border-t border-gray-100 p-4 space-y-4">
                    {/* Items */}
                    <div>
                      <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">
                        Produkter
                      </h3>
                      <div className="space-y-2">
                        {order.order_items.map((item) => (
                          <div key={item.id} className="flex justify-between text-sm">
                            <div>
                              <span className="text-gray-900">{item.product_name}</span>
                              {(item.size || item.color) && (
                                <span className="text-gray-400 ml-1">
                                  ({[item.size, item.color].filter(Boolean).join(' / ')})
                                </span>
                              )}
                              <span className="text-gray-400 ml-1">x{item.quantity}</span>
                            </div>
                            <span className="text-gray-600 font-medium">
                              {formatDKK(item.unit_price_dkk * item.quantity)}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Shipping address */}
                    <div>
                      <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">
                        <MapPin className="h-3 w-3 inline mr-1" />
                        Leveringsadresse
                      </h3>
                      <div className="text-sm text-gray-700 bg-gray-50 rounded-lg p-3">
                        <p className="font-medium">{order.shipping_name}</p>
                        <p>{order.shipping_address}</p>
                        <p>{order.shipping_postal_code} {order.shipping_city}</p>
                        <p>{order.shipping_country}</p>
                      </div>
                    </div>

                    {/* Tracking info (if shipped) */}
                    {order.tracking_number && (
                      <div className="bg-cirkle-50 rounded-lg p-3">
                        <p className="text-xs font-semibold text-cirkle-800">Tracking</p>
                        <p className="text-sm text-cirkle-700 mt-0.5">{order.tracking_number}</p>
                      </div>
                    )}

                    {/* Timeline */}
                    <div>
                      <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">
                        Historik
                      </h3>
                      <div className="space-y-1">
                        {order.order_events
                          .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
                          .map((event) => {
                            const evConfig = STATUS_CONFIG[event.status];
                            return (
                              <div key={event.id} className="flex items-center gap-2 text-sm">
                                <span className={`w-2 h-2 rounded-full ${evConfig?.bg || 'bg-gray-200'}`} />
                                <span className="text-gray-700">{evConfig?.label || event.status}</span>
                                <span className="text-gray-400 text-xs">
                                  {new Date(event.created_at).toLocaleDateString('da-DK', {
                                    day: 'numeric',
                                    month: 'short',
                                    hour: '2-digit',
                                    minute: '2-digit',
                                  })}
                                </span>
                              </div>
                            );
                          })}
                      </div>
                    </div>

                    {/* Action buttons */}
                    {nextAction && (
                      <div className="pt-2 border-t border-gray-100 space-y-3">
                        {nextAction.needsTracking && (
                          <div className="space-y-2">
                            <input
                              type="text"
                              placeholder="Tracking nummer"
                              value={trackingInput}
                              onChange={(e) => setTrackingInput(e.target.value)}
                              className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-cirkle-500"
                            />
                            <input
                              type="url"
                              placeholder="Tracking URL (valgfrit)"
                              value={trackingUrlInput}
                              onChange={(e) => setTrackingUrlInput(e.target.value)}
                              className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-cirkle-500"
                            />
                          </div>
                        )}
                        <div className="flex gap-2">
                          <button
                            onClick={() => updateStatus(order.id, nextAction.status)}
                            disabled={isUpdating || (nextAction.needsTracking && !trackingInput)}
                            className="flex-1 px-4 py-2.5 bg-cirkle-600 text-white text-sm font-medium rounded-lg hover:bg-cirkle-700 disabled:opacity-50 disabled:cursor-not-allowed transition"
                          >
                            {isUpdating ? 'Opdaterer...' : nextAction.label}
                          </button>
                          {order.status === 'pending' && (
                            <button
                              onClick={() => updateStatus(order.id, 'cancelled')}
                              disabled={isUpdating}
                              className="px-4 py-2.5 bg-red-50 text-red-700 text-sm font-medium rounded-lg hover:bg-red-100 disabled:opacity-50 transition"
                            >
                              Annuller
                            </button>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
