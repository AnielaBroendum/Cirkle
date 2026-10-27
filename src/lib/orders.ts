// Order rules shared by the brand portal, the API and the consumer app.

/** A New order older than this many days gets the "Waiting" badge. */
export const ORDER_WAITING_THRESHOLD_DAYS = 2;

export const CARRIERS = ['PostNord', 'GLS', 'DAO', 'Bring', 'Other'] as const;
export type Carrier = (typeof CARRIERS)[number];

export function isCarrier(value: unknown): value is Carrier {
  return typeof value === 'string' && (CARRIERS as readonly string[]).includes(value);
}

// Public track-and-trace pages. "Other" has none: the brand can paste a link.
const TRACKING_PAGES: Partial<Record<Carrier, (n: string) => string>> = {
  PostNord: (n) => `https://tracking.postnord.com/dk/?id=${n}`,
  GLS: (n) => `https://gls-group.com/DK/da/find-pakke?match=${n}`,
  DAO: (n) => `https://www.dao.as/privat/find-din-pakke?stregkode=${n}`,
  Bring: (n) => `https://tracking.bring.com/tracking/${n}`,
};

export function trackingUrl(carrier: string | null, trackingNumber: string | null): string | null {
  if (!carrier || !trackingNumber || !isCarrier(carrier)) return null;
  const page = TRACKING_PAGES[carrier];
  return page ? page(encodeURIComponent(trackingNumber.trim())) : null;
}

/** Whole days a New order has waited, or null once it is past New or not over the limit. */
export function waitingDays(order: { status: string; created_at: string }, now = Date.now()): number | null {
  if (order.status !== 'pending') return null;
  const days = Math.floor((now - new Date(order.created_at).getTime()) / (24 * 60 * 60 * 1000));
  return days >= ORDER_WAITING_THRESHOLD_DAYS ? days : null;
}

/** Shipping can skip confirm/pack: Figma ships straight from New. */
export const VALID_TRANSITIONS: Record<string, string[]> = {
  pending: ['confirmed', 'shipped', 'cancelled'],
  confirmed: ['packed', 'shipped', 'cancelled'],
  packed: ['shipped'],
  shipped: ['delivered'],
};
