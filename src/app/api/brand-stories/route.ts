import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase-server';
import { createAdminClient } from '@/lib/supabase-admin';
import { bufferReader } from '@/lib/media-probe';
import { STORY_RULES, checkStory, fileType } from '@/lib/media-rules';

// Brand stories (Figma "Brand Portal / 08"). The browser checks the file and
// uploads it to brand-stories/{brand_id}/…; this route checks it again from
// the stored bytes (codec, length, size), deletes it if it fails, and only
// then adds it to the brand's stories.

const BUCKET = 'brand-stories';

async function currentBrand() {
  const supabase = await createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { supabase, brandId: null as string | null, status: 401 };
  const { data } = await supabase.from('brand_profiles').select('id').eq('user_id', user.id).single();
  return { supabase, brandId: (data as { id: string } | null)?.id ?? null, status: data ? 200 : 403 };
}

export async function POST(request: NextRequest) {
  const { brandId, status } = await currentBrand();
  if (!brandId) return NextResponse.json({ error: status === 401 ? 'Unauthorized' : 'Not a brand' }, { status });

  const { path } = await request.json().catch(() => ({}));
  if (typeof path !== 'string' || !path.startsWith(`${brandId}/`) || path.includes('..')) {
    return NextResponse.json({ error: 'Invalid file' }, { status: 400 });
  }

  const admin = createAdminClient();
  const reject = async (error: string, code = 422) => {
    await admin.storage.from(BUCKET).remove([path]);
    return NextResponse.json({ error }, { status: code });
  };

  const { count } = await admin.from('brand_stories').select('id', { count: 'exact', head: true }).eq('brand_id', brandId);
  if ((count ?? 0) >= STORY_RULES.maxStories) return reject('You already have 10 stories. Remove one first.', 409);

  const { data: blob, error: downloadError } = await admin.storage.from(BUCKET).download(path);
  if (downloadError || !blob) return NextResponse.json({ error: 'Upload not found' }, { status: 404 });

  const bytes = new Uint8Array(await blob.arrayBuffer());
  const check = await checkStory(bufferReader(bytes), blob.type || fileType({ name: path, type: '' }));
  if (!check.ok) return reject(check.error);

  const { data: url } = admin.storage.from(BUCKET).getPublicUrl(path);
  const { data: story, error } = await admin
    .from('brand_stories')
    .insert({
      brand_id: brandId,
      position: (count ?? 0) + 1,
      kind: check.kind,
      path,
      url: url.publicUrl,
      duration_seconds: check.durationSeconds,
      width: check.width,
      height: check.height,
      bytes: bytes.length,
    })
    .select('*')
    .single();
  if (error) return reject(error.message, 500);

  return NextResponse.json({ story });
}

// Body: { ids: [...] } in the new order.
export async function PATCH(request: NextRequest) {
  const { supabase, brandId, status } = await currentBrand();
  if (!brandId) return NextResponse.json({ error: status === 401 ? 'Unauthorized' : 'Not a brand' }, { status });

  const { ids } = await request.json().catch(() => ({}));
  if (!Array.isArray(ids) || ids.some((id) => typeof id !== 'string')) {
    return NextResponse.json({ error: 'Invalid order' }, { status: 400 });
  }
  const { error } = await supabase.rpc('reorder_brand_stories', { p_ids: ids });
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ ok: true });
}

export async function DELETE(request: NextRequest) {
  const { supabase, brandId, status } = await currentBrand();
  if (!brandId) return NextResponse.json({ error: status === 401 ? 'Unauthorized' : 'Not a brand' }, { status });

  const id = request.nextUrl.searchParams.get('id');
  const admin = createAdminClient();
  const { data: story } = await admin.from('brand_stories').select('id, path').eq('id', id).eq('brand_id', brandId).single();
  if (!story) return NextResponse.json({ error: 'Story not found' }, { status: 404 });

  await admin.from('brand_stories').delete().eq('id', story.id);
  await admin.storage.from(BUCKET).remove([story.path]);

  // Close the gap so positions stay 1…n.
  const { data: rest } = await admin.from('brand_stories').select('id').eq('brand_id', brandId).order('position');
  if (rest?.length) await supabase.rpc('reorder_brand_stories', { p_ids: rest.map((s: { id: string }) => s.id) });

  return NextResponse.json({ removed: true });
}
