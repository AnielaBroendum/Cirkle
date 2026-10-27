'use client';

import { cn } from '@/components/ds';
import { FlameIcon } from './checkout-parts';

type OrderEvent = {
  id: string;
  status: string;
  note: string | null;
  created_at: string;
};

// Figma 15 "Tracking" steps. Each step lists the order statuses that reach it.
// "Out for delivery" has no data source yet (no carrier integration), so it
// only lights up together with Delivered.
const STEPS: { label: string; statuses: string[] }[] = [
  { label: 'Order received', statuses: ['pending'] },
  { label: 'Being packed', statuses: ['confirmed', 'packed'] },
  { label: 'On its way', statuses: ['shipped'] },
  { label: 'Out for delivery', statuses: [] },
  { label: 'Delivered', statuses: ['delivered'] },
];

const CANCELLED_LABELS: Record<string, string> = {
  pending: 'Order received',
  confirmed: 'Confirmed',
  packed: 'Being packed',
  shipped: 'On its way',
  delivered: 'Delivered',
  cancelled: 'Cancelled',
};

type Step = { key: string; label: string; complete: boolean; event?: OrderEvent };

export default function OrderTimeline({ events }: { events: OrderEvent[] }) {
  const reached = new Set(events.map((e) => e.status));
  const isCancelled = reached.has('cancelled');

  let steps: Step[];
  if (isCancelled) {
    steps = events.map((e) => ({ key: e.id, label: CANCELLED_LABELS[e.status] ?? e.status, complete: true, event: e }));
  } else {
    // A later status completes every earlier step: shipping can skip confirm/pack.
    const furthest = STEPS.reduce((last, step, i) => (step.statuses.some((st) => reached.has(st)) ? i : last), 0);
    steps = STEPS.map((step, i) => ({
      key: step.label,
      label: step.label,
      complete: i <= furthest,
      event: [...events].reverse().find((e) => step.statuses.includes(e.status)),
    }));
  }
  // The latest completed step is shown in medium weight ("On its way" in Figma).
  const currentIndex = steps.reduce((last, s, i) => (s.complete ? i : last), -1);

  return (
    <ol>
      {steps.map((step, i) => {
        const { event, complete: isComplete } = step;
        const isLast = i === steps.length - 1;
        const nextComplete = steps[i + 1]?.complete ?? false;

        return (
          <li key={step.key} className="flex gap-4">
            {/* Flame (done) or open step, joined by a 2px line */}
            <div className="flex w-3.5 flex-col items-center">
              <span className="grid h-[17px] place-items-center">
                {isComplete ? (
                  <FlameIcon />
                ) : (
                  <span className="h-3.5 w-3.5 rounded-pill border-2 border-char bg-canvas-dark" />
                )}
              </span>
              {!isLast && <span className={cn('my-1 w-0.5 flex-1', isComplete && nextComplete ? 'bg-accent' : 'bg-line-dark')} />}
            </div>

            <div className="min-h-[41px] pb-3">
              <p
                className={cn(
                  'text-body-lg leading-[17px]',
                  isComplete ? 'text-on-primary' : 'text-smoke',
                  i === currentIndex && 'font-medium'
                )}
              >
                {step.label}
              </p>
              {event && (
                <p className="mt-1 text-caption text-smoke">
                  {new Date(event.created_at).toLocaleDateString('en-GB', {
                    day: 'numeric',
                    month: 'short',
                    hour: '2-digit',
                    minute: '2-digit',
                  })}
                </p>
              )}
              {event?.note && <p className="mt-0.5 text-caption text-ash">{event.note}</p>}
            </div>
          </li>
        );
      })}
    </ol>
  );
}
