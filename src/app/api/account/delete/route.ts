import { NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase-server';
import { createAdminClient } from '@/lib/supabase-admin';

// Delete my account (Apple App Store rule 5.1.1(v)). Shoppers only.
//
// Orders, returns, scans and events stay so brand and store numbers don't
// change: the name and address on the shopper's orders and their return
// comments are blanked first, then deleting the auth user cascades to the
// profile, which deletes points, saves, consents and push subscriptions and
// sets the user to NULL everywhere else (migration 032).

const DELETED_NAME = 'Deleted user';

export async function POST() {
  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const admin = createAdminClient();

  const { data: profile } = await admin.from('profiles').select('role').eq('id', user.id).single();
  const role = (profile as { role?: string } | null)?.role ?? user.user_metadata?.role;
  if (role !== 'consumer') {
    // Brand and store accounts own shared data (products, samples, payouts).
    return NextResponse.json(
      { error: 'Only shopper accounts can be deleted in the app. Contact us to close a brand or store account.' },
      { status: 403 }
    );
  }

  const { error: ordersError } = await admin
    .from('orders')
    .update({
      shipping_name: DELETED_NAME,
      shipping_address: '',
      shipping_city: '',
      shipping_postal_code: '',
    })
    .eq('consumer_user_id', user.id);
  if (ordersError) {
    console.error('[account/delete] anonymise orders failed:', ordersError.message);
    return NextResponse.json({ error: 'Could not delete your account. Please try again.' }, { status: 500 });
  }

  const { error: returnsError } = await admin.from('returns').update({ comment: null }).eq('user_id', user.id);
  if (returnsError) {
    console.error('[account/delete] anonymise returns failed:', returnsError.message);
    return NextResponse.json({ error: 'Could not delete your account. Please try again.' }, { status: 500 });
  }

  const { error: deleteError } = await admin.auth.admin.deleteUser(user.id);
  if (deleteError) {
    console.error('[account/delete] delete user failed:', deleteError.message);
    return NextResponse.json({ error: 'Could not delete your account. Please try again.' }, { status: 500 });
  }

  return NextResponse.json({ deleted: true });
}
