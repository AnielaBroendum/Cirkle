// Display helpers for the order screens (Figma 07 / 15). Estimates only: the
// app has no carrier data, so this mirrors the "3–5 business days" promise
// shown at checkout.

function addBusinessDays(date: Date, days: number) {
  const d = new Date(date);
  let added = 0;
  while (added < days) {
    d.setDate(d.getDate() + 1);
    const day = d.getDay();
    if (day !== 0 && day !== 6) added++;
  }
  return d;
}

export function expectedDelivery(createdAt: string) {
  const placed = new Date(createdAt);
  return { from: addBusinessDays(placed, 3), to: addBusinessDays(placed, 5) };
}

/** "Thu 16 Oct" */
export function formatDay(d: Date) {
  return d.toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' }).replace(',', '');
}

/** "Thu 14–17 Oct", or "Thu 30 Oct – Tue 4 Nov" across months. */
export function formatRange(from: Date, to: Date) {
  if (from.getMonth() === to.getMonth()) {
    const weekday = from.toLocaleDateString('en-GB', { weekday: 'short' });
    const month = to.toLocaleDateString('en-GB', { month: 'short' });
    return `${weekday} ${from.getDate()}–${to.getDate()} ${month}`;
  }
  return `${formatDay(from)} – ${formatDay(to)}`;
}

/** True once the whole day has passed (estimates in the past get different wording). */
export function isPastDay(d: Date) {
  const end = new Date(d);
  end.setHours(23, 59, 59, 999);
  return end.getTime() < Date.now();
}

export const ACTIVE_STATUSES = ['pending', 'confirmed', 'packed', 'shipped'];
