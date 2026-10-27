import QRCode from 'qrcode';
import type { NextRequest } from 'next/server';
import type { SupabaseClient } from '@supabase/supabase-js';
import { getBaseUrl } from './base-url';

// One QR code per sample, made once when the sample is created and stored as
// a PNG. Printing a tag later reuses that stored image, so the code never
// changes (Figma 05: "Print it again: it keeps the same code").

export function sampleScanUrl(request: NextRequest, sampleId: string): string {
  return `${getBaseUrl(request)}/p/${sampleId}`;
}

/** Renders the sample's QR, stores it at brand-assets/qr-codes/{id}.png and saves the URL on the sample. */
export async function createSampleQr(
  supabase: SupabaseClient,
  request: NextRequest,
  sampleId: string
): Promise<string | null> {
  const png = await QRCode.toBuffer(sampleScanUrl(request, sampleId), {
    type: 'png',
    width: 400,
    margin: 2,
    color: { dark: '#2C2324', light: '#FFFFFF' },
  });
  const fileName = `qr-codes/${sampleId}.png`;
  const { error } = await supabase.storage.from('brand-assets').upload(fileName, png, { contentType: 'image/png', upsert: true });
  if (error) return null;
  const { data } = supabase.storage.from('brand-assets').getPublicUrl(fileName);
  await supabase.from('samples').update({ qr_code_url: data.publicUrl }).eq('id', sampleId);
  return data.publicUrl;
}
