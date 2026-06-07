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

const FROM_EMAIL = process.env.EMAIL_FROM || 'Cirkle <noreply@cirkle.dk>';

async function sendEmail(to: string, subject: string, html: string) {
  const resend = await getResend();
  if (resend) {
    await resend.emails.send({ from: FROM_EMAIL, to, subject, html });
  } else {
    console.log(`[EMAIL] To: ${to}\n  Subject: ${subject}\n  Body: ${html.replace(/<[^>]+>/g, '')}`);
  }
}

function wrapHtml(content: string): string {
  return `
    <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 560px; margin: 0 auto; padding: 32px 16px;">
      <div style="text-align: center; margin-bottom: 32px;">
        <h1 style="font-size: 24px; font-weight: 700; color: #0c93e9; margin: 0;">Cirkle</h1>
      </div>
      ${content}
      <div style="margin-top: 40px; padding-top: 20px; border-top: 1px solid #e5e7eb; text-align: center;">
        <p style="font-size: 12px; color: #9ca3af;">Cirkle — Discover Fashion Everywhere</p>
      </div>
    </div>
  `;
}

export async function sendOrderConfirmation(
  consumerEmail: string,
  order: { order_number: number; total_dkk: number; items: { name: string; size?: string | null; color?: string | null }[] },
  brandName: string,
) {
  const itemsList = order.items
    .map((i) => `<li>${i.name}${i.size || i.color ? ` (${[i.size, i.color].filter(Boolean).join(' / ')})` : ''}</li>`)
    .join('');

  await sendEmail(
    consumerEmail,
    `Ordrebekraeftelse #${order.order_number}`,
    wrapHtml(`
      <h2 style="font-size: 20px; color: #111827;">Tak for din ordre!</h2>
      <p style="color: #4b5563;">Din ordre #${order.order_number} er modtaget og vil blive behandlet af <strong>${brandName}</strong>.</p>
      <div style="background: #f9fafb; border-radius: 12px; padding: 16px; margin: 20px 0;">
        <p style="font-size: 14px; font-weight: 600; color: #111827; margin: 0 0 8px;">Produkter:</p>
        <ul style="color: #4b5563; font-size: 14px; margin: 0; padding-left: 20px;">${itemsList}</ul>
        <p style="font-size: 16px; font-weight: 700; color: #111827; margin: 12px 0 0;">Total: ${formatDKK(order.total_dkk)}</p>
      </div>
      <p style="color: #6b7280; font-size: 14px;">Du modtager en email, naar din ordre skifter status.</p>
    `),
  );
}

export async function sendNewOrderToBrand(
  brandEmail: string,
  order: { order_number: number; total_dkk: number; consumer_name: string; items: { name: string }[] },
) {
  const itemsList = order.items.map((i) => `<li>${i.name}</li>`).join('');

  await sendEmail(
    brandEmail,
    `Ny ordre #${order.order_number}`,
    wrapHtml(`
      <h2 style="font-size: 20px; color: #111827;">Ny ordre modtaget!</h2>
      <p style="color: #4b5563;">Du har modtaget en ny ordre fra <strong>${order.consumer_name}</strong>.</p>
      <div style="background: #f9fafb; border-radius: 12px; padding: 16px; margin: 20px 0;">
        <p style="font-size: 14px; color: #4b5563;">Ordre #${order.order_number}</p>
        <ul style="color: #4b5563; font-size: 14px; margin: 8px 0; padding-left: 20px;">${itemsList}</ul>
        <p style="font-size: 16px; font-weight: 700; color: #111827; margin: 12px 0 0;">Total: ${formatDKK(order.total_dkk)}</p>
      </div>
      <p style="color: #6b7280; font-size: 14px;">Log ind paa Cirkle for at behandle ordren.</p>
    `),
  );
}

const STATUS_LABELS: Record<string, string> = {
  confirmed: 'bekraeftet',
  packed: 'pakket',
  shipped: 'afsendt',
  delivered: 'leveret',
  cancelled: 'annulleret',
};

export async function sendOrderStatusUpdate(
  consumerEmail: string,
  order: { order_number: number; status: string; tracking_number?: string | null; tracking_url?: string | null },
  brandName: string,
) {
  const statusLabel = STATUS_LABELS[order.status] || order.status;
  const trackingHtml =
    order.tracking_number
      ? `<div style="background: #ecfdf5; border-radius: 12px; padding: 16px; margin: 20px 0;">
          <p style="font-size: 14px; font-weight: 600; color: #065f46; margin: 0;">Tracking: ${order.tracking_number}</p>
          ${order.tracking_url ? `<a href="${order.tracking_url}" style="font-size: 14px; color: #0c93e9; margin-top: 8px; display: inline-block;">Spor din pakke</a>` : ''}
        </div>`
      : '';

  await sendEmail(
    consumerEmail,
    `Ordre #${order.order_number} er ${statusLabel}`,
    wrapHtml(`
      <h2 style="font-size: 20px; color: #111827;">Din ordre er ${statusLabel}</h2>
      <p style="color: #4b5563;">Ordre #${order.order_number} fra <strong>${brandName}</strong> har faet ny status: <strong>${statusLabel}</strong>.</p>
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
    `${brandName} inviterer dig til Cirkle`,
    wrapHtml(`
      <h2 style="font-size: 20px; color: #111827;">Du er inviteret!</h2>
      <p style="color: #4b5563;"><strong>${brandName}</strong> vil gerne samarbejde med dig paa Cirkle — en platform hvor dine kunder kan scanne og koebe produkter direkte fra din butik.</p>
      <div style="text-align: center; margin: 28px 0;">
        <a href="${inviteUrl}" style="background: #0c93e9; color: white; padding: 12px 32px; border-radius: 8px; text-decoration: none; font-weight: 600; font-size: 16px;">Accepter invitation</a>
      </div>
      <p style="color: #9ca3af; font-size: 12px;">Linket er gyldigt i 30 dage.</p>
    `),
  );
}
