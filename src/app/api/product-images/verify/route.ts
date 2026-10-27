import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase-server';
import { createAdminClient } from '@/lib/supabase-admin';
import { bufferReader } from '@/lib/media-probe';
import { checkProductImage, fileType } from '@/lib/media-rules';

// Product images (Figma "Brand Portal / 04"): after the browser uploads to
// product-images/{brand_id}/…, this checks the stored file (type, size,
// 3:4, at least 1200 × 1600) and deletes it if it fails. The bucket itself
// already refuses other file types and files over 10 MB.

const BUCKET = 'product-images';

export async function POST(request: NextRequest) {
  const supabase = await createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { data: brand } = await supabase.from('brand_profiles').select('id').eq('user_id', user.id).single();
  if (!brand) return NextResponse.json({ error: 'Not a brand' }, { status: 403 });

  const { path } = await request.json().catch(() => ({}));
  if (typeof path !== 'string' || !path.startsWith(`${brand.id}/`) || path.includes('..')) {
    return NextResponse.json({ error: 'Invalid file' }, { status: 400 });
  }

  const admin = createAdminClient();
  const { data: blob, error } = await admin.storage.from(BUCKET).download(path);
  if (error || !blob) return NextResponse.json({ error: 'Upload not found' }, { status: 404 });

  const bytes = new Uint8Array(await blob.arrayBuffer());
  const check = await checkProductImage(bufferReader(bytes), blob.type || fileType({ name: path, type: '' }));
  if (!check.ok) {
    await admin.storage.from(BUCKET).remove([path]);
    return NextResponse.json({ error: check.error }, { status: 422 });
  }

  const { data: url } = admin.storage.from(BUCKET).getPublicUrl(path);
  return NextResponse.json({ url: url.publicUrl, width: check.width, height: check.height });
}
