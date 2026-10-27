import type { SupabaseClient } from '@supabase/supabase-js';
import { sendOrderStatusUpdate } from './email';
import { VALID_TRANSITIONS, isCarrier, trackingUrl, type Carrier } from './orders';
import { sendPush } from './push';

export type OrderForUpdate = {
  id: string;
  order_number: number;
  status: string;
  consumer_user_id: string;
  brand_id: string;
  carrier: string | null;
  tracking_number: string | null;
  tracking_url: string | null;
};

export const ORDER_FOR_UPDATE_COLUMNS = 'id, order_number, status, consumer_user_id, brand_id, carrier, tracking_number, tracking_url';

export type StatusChange = {
  status: string;
  carrier?: string | null;
  tracking_number?: string | null;
  tracking_url?: string | null;
  note?: string | null;
};

// Figma "App / 16": one message per step.
function pushText(status: string, brandName: string, carrier: string | null): string | null {
  switch (status) {
    case 'confirmed':
      return `${brandName} has your order.`;
    case 'packed':
      return 'Being packed.';
    case 'shipped':
      return carrier && carrier !== 'Other' ? `On its way with ${carrier}.` : 'On its way.';
    case 'delivered':
      return "It's here. Now it's yours.";
    case 'cancelled':
      return `${brandName} cancelled your order.`;
    default:
      return null;
  }
}

/**
 * Moves one order to a new status: its own timestamp, timeline event, email
 * and push. Used for single updates and for "Mark selected as shipped".
 * The caller has already checked that the order belongs to the brand.
 */
export async function applyOrderStatus(
  admin: SupabaseClient,
  order: OrderForUpdate,
  change: StatusChange,
  brandName: string
): Promise<{ ok: true } | { ok: false; status: number; error: string }> {
  const { status } = change;
  if (!(VALID_TRANSITIONS[order.status] ?? []).includes(status)) {
    return { ok: false, status: 400, error: `Cannot move #${order.order_number} from ${order.status} to ${status}` };
  }
  if (change.carrier && !isCarrier(change.carrier)) {
    return { ok: false, status: 400, error: 'Unknown carrier' };
  }

  const now = new Date().toISOString();
  const update: Record<string, unknown> = { status };
  let carrier = order.carrier;
  let number = order.tracking_number;
  let link = order.tracking_url;
  if (status === 'shipped') {
    update.shipped_at = now;
    if (change.carrier) carrier = update.carrier = change.carrier as Carrier;
    if (change.tracking_number?.trim()) number = update.tracking_number = change.tracking_number.trim();
    // A known carrier gets its own tracking page; "Other" can pass a link.
    link = update.tracking_url = trackingUrl(carrier, number) ?? (change.tracking_url?.trim() || null);
  }
  if (status === 'delivered') update.delivered_at = now;

  const { error } = await admin.from('orders').update(update).eq('id', order.id);
  if (error) return { ok: false, status: 500, error: error.message };

  const { error: eventError } = await admin
    .from('order_events')
    .insert({ order_id: order.id, status, note: change.note || null, created_at: now });
  if (eventError) console.error('[orders] event insert failed:', eventError.message);

  const { data: consumer } = await admin.from('profiles').select('email').eq('id', order.consumer_user_id).single();
  if (consumer?.email) {
    try {
      await sendOrderStatusUpdate(
        consumer.email,
        { order_number: order.order_number, status, carrier, tracking_number: number, tracking_url: link },
        brandName
      );
    } catch (e) {
      console.error('Failed to send status email:', e);
    }
  }

  const text = pushText(status, brandName, carrier);
  if (text) {
    try {
      await sendPush(admin, order.consumer_user_id, {
        title: 'Flaym',
        body: text,
        url: `/consumer/orders/${order.id}`,
        tag: `order-${order.id}-${status}`,
      });
    } catch (e) {
      console.error('Failed to send push:', e);
    }
  }

  return { ok: true };
}
