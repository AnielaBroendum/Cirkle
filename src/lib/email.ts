import { formatDKK } from './utils';

let resendClient: any = null;

async function getResend() {
  if (!process.env.RESEND_API_KEY) return null;
  if (!resendClient) {
    const { Resend } = await import('resend');
    resendClient = new Resend(process.env.RESEND_API_KEY);
  }
  return resendClient;
}

// The sender domain must be verified in Resend, otherwise every send is rejected.
const FROM_EMAIL = process.env.EMAIL_FROM || 'Flaym <noreply@cirkle.dk>';

async function sendEmail(to: string, subject: string, html: string) {
  const resend = await getResend();
  if (!resend) {
    console.log(`[EMAIL] To: ${to}\n  Subject: ${subject}\n  Body: ${html.replace(/<[^>]+>/g, '')}`);
    return;
  }
  // Resend reports failures (e.g. an unverified sender domain) in the result
  // instead of throwing, so log them or they disappear silently.
  try {
    const { error } = await resend.emails.send({ from: FROM_EMAIL, to, subject, html });
    if (error) console.error(`[EMAIL] Resend rejected "${subject}" to ${to}:`, error);
  } catch (err) {
    console.error(`[EMAIL] Sending "${subject}" to ${to} failed:`, err);
  }
}

/** Escape user-supplied text (names, product names) before putting it in HTML. */
function esc(value: string | number | null | undefined): string {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

// Flaym design tokens (see tailwind.config.ts). Email clients need inline styles.
const C = {
  primary: '#2C2324',
  onPrimary: '#FFFFFF',
  muted: '#5E5856', // Slate: Figma light/text tertiary (Char is never text)
  line: '#D5D1C8',
  surfaceMuted: '#E7E3DB',
  canvasWarm: '#F4F2EE',
  accent: '#FF5000',
  success: '#2F7D4F',
  successSubtle: '#DCEFE3',
};
const FONT = "'IBM Plex Mono', ui-monospace, Menlo, Consolas, 'Courier New', monospace";

const heading = (text: string) =>
  `<h2 style="font-family: ${FONT}; font-size: 20px; font-weight: 500; letter-spacing: 0.4px; text-transform: uppercase; color: ${C.primary}; margin: 0 0 12px;">${text}</h2>`;
const para = (html: string) =>
  `<p style="font-size: 14px; line-height: 1.5; color: ${C.primary}; margin: 0 0 16px;">${html}</p>`;
const note = (html: string) => `<p style="font-size: 12px; line-height: 1.5; color: ${C.muted}; margin: 0;">${html}</p>`;
const box = (html: string, bg: string = C.canvasWarm) =>
  `<div style="background: ${bg}; border: 1px solid ${C.line}; padding: 16px; margin: 20px 0;">${html}</div>`;

function wrapHtml(content: string): string {
  return `
    <div style="font-family: ${FONT}; background: #FFFFFF; color: ${C.primary}; max-width: 560px; margin: 0 auto; padding: 32px 16px;">
      <div style="background: ${C.primary}; padding: 20px 24px; margin-bottom: 32px;">
        <span style="font-family: ${FONT}; font-size: 24px; font-weight: 500; color: ${C.onPrimary}; letter-spacing: 0.5px;">flaym</span>
      </div>
      ${content}
      <div style="margin-top: 40px; padding-top: 16px; border-top: 1px solid ${C.line};">
        ${note('FLAYM · Scan it. Save it. Pass it on.')}
      </div>
    </div>
  `;
}

const itemLine = (i: { name: string; size?: string | null; color?: string | null }) =>
  `<li style="margin: 0 0 4px;">${esc(i.name)}${i.size || i.color ? ` (${esc([i.size, i.color].filter(Boolean).join(' / '))})` : ''}</li>`;
const itemList = (html: string) =>
  `<ul style="font-size: 14px; color: ${C.primary}; margin: 8px 0; padding-left: 20px;">${html}</ul>`;
const total = (ore: number) =>
  `<p style="font-size: 14px; font-weight: 500; color: ${C.primary}; margin: 12px 0 0; padding-top: 12px; border-top: 1px solid ${C.line};">TOTAL ${formatDKK(ore)}</p>`;

export async function sendOrderConfirmation(
  consumerEmail: string,
  order: { order_number: number; total_dkk: number; items: { name: string; size?: string | null; color?: string | null }[] },
  brandName: string,
) {
  await sendEmail(
    consumerEmail,
    `Order confirmation #${order.order_number}`,
    wrapHtml(`
      ${heading('Thank you for your order')}
      ${para(`Your order #${order.order_number} has been received and will be packed and shipped by <strong>${esc(brandName)}</strong>.`)}
      ${box(`${note('PRODUCTS')}${itemList(order.items.map(itemLine).join(''))}${total(order.total_dkk)}`)}
      ${note('We will email you when your order status changes.')}
    `),
  );
}

export async function sendNewOrderToBrand(
  brandEmail: string,
  order: { order_number: number; total_dkk: number; consumer_name: string; items: { name: string }[] },
) {
  await sendEmail(
    brandEmail,
    `New order #${order.order_number}`,
    wrapHtml(`
      ${heading('New order')}
      ${para(`You have a new order from <strong>${esc(order.consumer_name)}</strong>.`)}
      ${box(`${note(`ORDER #${order.order_number}`)}${itemList(order.items.map(itemLine).join(''))}${total(order.total_dkk)}`)}
      ${note('Log in to Flaym to confirm and ship the order.')}
    `),
  );
}

const STATUS_LABELS: Record<string, string> = {
  confirmed: 'confirmed',
  packed: 'packed',
  shipped: 'shipped',
  delivered: 'delivered',
  cancelled: 'cancelled',
};

export async function sendOrderStatusUpdate(
  consumerEmail: string,
  order: {
    order_number: number;
    status: string;
    carrier?: string | null;
    tracking_number?: string | null;
    tracking_url?: string | null;
  },
  brandName: string,
) {
  const statusLabel = STATUS_LABELS[order.status] || order.status;
  const carrierName = order.carrier && order.carrier !== 'Other' ? order.carrier : null;
  const trackingHtml = order.tracking_number || (order.status === 'shipped' && carrierName)
    ? box(
        `<p style="font-size: 14px; font-weight: 500; color: ${C.success}; margin: 0;">${carrierName ? `${esc(carrierName)}` : 'Tracking'}${order.tracking_number ? `: ${esc(order.tracking_number)}` : ''}</p>
         ${order.tracking_url ? `<a href="${esc(order.tracking_url)}" style="font-size: 14px; color: ${C.primary}; text-decoration: underline; margin-top: 8px; display: inline-block;">Track your package</a>` : ''}`,
        C.successSubtle,
      )
    : '';

  await sendEmail(
    consumerEmail,
    `Order #${order.order_number} is now ${statusLabel}`,
    wrapHtml(`
      ${heading('Your order has been updated')}
      ${para(`Order #${order.order_number} from <strong>${esc(brandName)}</strong> is now <strong>${esc(statusLabel)}</strong>.`)}
      ${trackingHtml}
    `),
  );
}

export async function sendRetailerInvitation(
  email: string,
  brandName: string,
  inviteUrl: string,
) {
  await sendEmail(
    email,
    `${brandName} invites you to Flaym`,
    wrapHtml(`
      ${heading('You are invited')}
      ${para(`<strong>${esc(brandName)}</strong> wants to partner with you on Flaym. Show their products in your store; customers scan a tag to buy, and you earn commission on what sells.`)}
      <div style="margin: 28px 0;">
        <a href="${esc(inviteUrl)}" style="display: inline-block; background: ${C.accent}; color: ${C.onPrimary}; padding: 14px 32px; text-decoration: none; font-family: ${FONT}; font-weight: 500; font-size: 14px;">Accept invitation</a>
      </div>
      ${note('This link is valid for 30 days.')}
    `),
  );
}
