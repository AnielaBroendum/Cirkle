// Store payout rules (Figma "Retail Portal / 02 Dashboard").

/** Days after delivery a buyer can return an item. The store's cut waits until it has passed. */
export const RETURN_PERIOD_DAYS = 14;

/** Day of the month Flaym pays out every Ready cut. */
export const PAYOUT_DAY_OF_MONTH = 1;

export type PayoutStatus = 'return_period' | 'ready' | 'paid_out';

export const PAYOUT_STATUSES: PayoutStatus[] = ['return_period', 'ready', 'paid_out'];

export const PAYOUT_STATUS_LABEL: Record<PayoutStatus, string> = {
  return_period: 'Return period',
  ready: 'Ready',
  paid_out: 'Paid out',
};

export function returnPeriodEnd(deliveredAt: Date): Date {
  return new Date(deliveredAt.getTime() + RETURN_PERIOD_DAYS * 24 * 60 * 60 * 1000);
}

/** The next payout date after `now` (today counts if it is the payout day). */
export function nextPayoutDate(now = new Date()): Date {
  const thisMonth = new Date(now.getFullYear(), now.getMonth(), PAYOUT_DAY_OF_MONTH);
  if (thisMonth >= new Date(now.getFullYear(), now.getMonth(), now.getDate())) return thisMonth;
  return new Date(now.getFullYear(), now.getMonth() + 1, PAYOUT_DAY_OF_MONTH);
}
