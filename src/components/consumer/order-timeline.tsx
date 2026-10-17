'use client';

import { cn } from '@/components/ds';
import { FlameIcon } from './checkout-parts';

type OrderEvent = {
  id: string;
  status: string;
  note: string | null;
  created_at: string;
};

// Figma 15 "Tracking" wording for each order status.
const STATUS_LABELS: Record<string, string> = {
  pending: 'Order received',
  confirmed: 'Confirmed',
  packed: 'Being packed',
  shipped: 'On its way',
  delivered: 'Delivered',
  cancelled: 'Cancelled',
};

const STATUS_ORDER = ['pending', 'confirmed', 'packed', 'shipped', 'delivered'];

export default function OrderTimeline({ events }: { events: OrderEvent[] }) {
  const completedStatuses = new Set(events.map((e) => e.status));
  const eventMap = new Map(events.map((e) => [e.status, e]));
  const isCancelled = completedStatuses.has('cancelled');

  const steps = isCancelled ? events.map((e) => e.status) : STATUS_ORDER;
  // The latest completed step is shown in medium weight ("On its way" in Figma).
  const currentIndex = steps.reduce((last, s, i) => (completedStatuses.has(s) ? i : last), -1);

  return (
    <ol>
      {steps.map((status, i) => {
        const event = eventMap.get(status);
        const isComplete = completedStatuses.has(status);
        const isLast = i === steps.length - 1;
        const nextComplete = completedStatuses.has(steps[i + 1]);

        return (
          <li key={status} className="flex gap-4">
            {/* Flame (done) or open step, joined by a 2px line */}
            <div className="flex w-3.5 flex-col items-center">
              <span className="grid h-[17px] place-items-center">
                {isComplete ? (
                  <FlameIcon />
                ) : (
                  <span className="h-3.5 w-3.5 rounded-pill border-2 border-muted bg-canvas-dark" />
                )}
              </span>
              {!isLast && <span className={cn('my-1 w-0.5 flex-1', isComplete && nextComplete ? 'bg-accent' : 'bg-line-dark')} />}
            </div>

            <div className="min-h-[41px] pb-3">
              <p
                className={cn(
                  'text-[15px] leading-[17px]',
                  isComplete ? 'text-on-primary' : 'text-muted',
                  i === currentIndex && 'font-medium'
                )}
              >
                {STATUS_LABELS[status] ?? STATUS_LABELS.pending}
              </p>
              {event && (
                <p className="mt-1 text-caption text-muted">
                  {new Date(event.created_at).toLocaleDateString('en-GB', {
                    day: 'numeric',
                    month: 'short',
                    hour: '2-digit',
                    minute: '2-digit',
                  })}
                </p>
              )}
              {event?.note && <p className="mt-0.5 text-caption text-line">{event.note}</p>}
            </div>
          </li>
        );
      })}
    </ol>
  );
}
