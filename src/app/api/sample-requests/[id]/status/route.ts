import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase-server';

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const supabase = await createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await request.json();
  const { status, review_note, tracking_number } = body;

  const validTransitions: Record<string, string[]> = {
    pending: ['rejected'],
    approved: ['shipped'],
    shipped: ['received'],
  };

  const { data: sr } = await supabase.from('sample_requests').select('*').eq('id', id).single();
  if (!sr) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  if (!validTransitions[sr.status]?.includes(status)) {
    return NextResponse.json({ error: `Cannot transition from ${sr.status} to ${status}` }, { status: 400 });
  }

  const updateData: Record<string, unknown> = { status };

  if (status === 'rejected') {
    updateData.reviewed_at = new Date().toISOString();
    if (review_note) updateData.review_note = review_note;
  }

  if (status === 'shipped' && tracking_number) {
    updateData.review_note = `Tracking: ${tracking_number}`;
  }

  const { error } = await supabase.from('sample_requests').update(updateData).eq('id', id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ success: true });
}
