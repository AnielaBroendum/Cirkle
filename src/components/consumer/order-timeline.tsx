'use client';

import { Check, Clock, Package, Truck, Home, X } from 'lucide-react';

type OrderEvent = {
  id: string;
  status: string;
  note: string | null;
  created_at: string;
};

const STATUS_CONFIG: Record<string, { label: string; icon: typeof Check; color: string }> = {
  pending: { label: 'Order received', icon: Clock, color: 'text-yellow-600 bg-yellow-100' },
  confirmed: { label: 'Confirmed', icon: Check, color: 'text-blue-600 bg-blue-100' },
  packed: { label: 'Packed', icon: Package, color: 'text-purple-600 bg-purple-100' },
  shipped: { label: 'Shipped', icon: Truck, color: 'text-cirkle-600 bg-cirkle-100' },
  delivered: { label: 'Delivered', icon: Home, color: 'text-green-600 bg-green-100' },
  cancelled: { label: 'Cancelled', icon: X, color: 'text-red-600 bg-red-100' },
};

const STATUS_ORDER = ['pending', 'confirmed', 'packed', 'shipped', 'delivered'];

export default function OrderTimeline({ events }: { events: OrderEvent[] }) {
  const completedStatuses = new Set(events.map((e) => e.status));
  const eventMap = new Map(events.map((e) => [e.status, e]));
  const isCancelled = completedStatuses.has('cancelled');

  const steps = isCancelled
    ? events.map((e) => e.status)
    : STATUS_ORDER;

  return (
    <div className="space-y-0">
      {steps.map((status, i) => {
        const config = STATUS_CONFIG[status] || STATUS_CONFIG.pending;
        const event = eventMap.get(status);
        const isComplete = completedStatuses.has(status);
        const isLast = i === steps.length - 1;
        const Icon = config.icon;

        return (
          <div key={status} className="flex gap-3">
            {/* Vertical line + icon */}
            <div className="flex flex-col items-center">
              <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 ${
                isComplete ? config.color : 'bg-gray-100 text-gray-300'
              }`}>
                <Icon className="h-4 w-4" />
              </div>
              {!isLast && (
                <div className={`w-0.5 flex-1 min-h-[24px] ${
                  isComplete ? 'bg-cirkle-200' : 'bg-gray-100'
                }`} />
              )}
            </div>

            {/* Content */}
            <div className={`pb-4 ${!isLast ? '' : ''}`}>
              <p className={`text-sm font-medium ${isComplete ? 'text-gray-900' : 'text-gray-400'}`}>
                {config.label}
              </p>
              {event && (
                <p className="text-xs text-gray-400 mt-0.5">
                  {new Date(event.created_at).toLocaleDateString('en-GB', {
                    day: 'numeric',
                    month: 'short',
                    hour: '2-digit',
                    minute: '2-digit',
                  })}
                </p>
              )}
              {event?.note && (
                <p className="text-xs text-gray-500 mt-0.5">{event.note}</p>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
