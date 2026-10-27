import webpush from 'web-push';
import type { SupabaseClient } from '@supabase/supabase-js';

// Web push to the consumer's installed PWA / browser (Figma "App / 16").
// Needs NEXT_PUBLIC_VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY and VAPID_SUBJECT.
// Without them, sends are skipped and the Resend email is the only message.

let configured: boolean | null = null;

function configure(): boolean {
  if (configured !== null) return configured;
  const publicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
  const privateKey = process.env.VAPID_PRIVATE_KEY;
  if (!publicKey || !privateKey) {
    console.log('[PUSH] VAPID keys missing, push disabled');
    configured = false;
    return false;
  }
  webpush.setVapidDetails(process.env.VAPID_SUBJECT || 'mailto:hello@cirkle.dk', publicKey, privateKey);
  configured = true;
  return true;
}

export type PushPayload = { title: string; body: string; url: string; tag?: string };

/** Sends to every subscription the user has; drops subscriptions the browser has revoked. */
export async function sendPush(admin: SupabaseClient, userId: string, payload: PushPayload): Promise<number> {
  if (!configure()) return 0;
  const { data: subs } = await admin.from('push_subscriptions').select('id, endpoint, p256dh, auth').eq('user_id', userId);
  let sent = 0;
  for (const sub of (subs ?? []) as { id: string; endpoint: string; p256dh: string; auth: string }[]) {
    try {
      await webpush.sendNotification(
        { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
        JSON.stringify(payload),
        { TTL: 60 * 60 * 24 }
      );
      sent++;
    } catch (err) {
      const status = (err as { statusCode?: number }).statusCode;
      if (status === 404 || status === 410) {
        await admin.from('push_subscriptions').delete().eq('id', sub.id);
      } else {
        console.error('[PUSH] send failed:', status ?? err);
      }
    }
  }
  console.log(`[PUSH] ${payload.tag ?? payload.title} → ${sent} device(s)`);
  return sent;
}
