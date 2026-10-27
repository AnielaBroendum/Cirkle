import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase-server';
import { OPTIONAL_CONSENTS, currentConsents, type ConsentSource, type OptionalConsent } from '@/lib/consents';

// Shopper consents (Figma App 02). GET returns the current choices; POST logs
// new choices. Rows are only ever added (RLS: own rows, insert and read only).

async function readState(supabase: Awaited<ReturnType<typeof createServerSupabaseClient>>, userId: string) {
  const { data, error } = await supabase
    .from('consumer_consents')
    .select('consent, granted, created_at')
    .eq('user_id', userId);
  return { state: data ? currentConsents(data) : null, error };
}

export async function GET() {
  const supabase = await createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const { state, error } = await readState(supabase, user.id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(state);
}

/**
 * Body: { source: 'consent_screen' | 'profile', choices: { share_with_brands?: boolean, news_from_brands?: boolean } }
 * The consent screen also logs the "Data for the chain" acknowledgement. From
 * the profile only choices that changed are logged.
 */
export async function POST(request: NextRequest) {
  const supabase = await createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const body = await request.json().catch(() => null);
  const source = body?.source as ConsentSource;
  const choices = (body?.choices ?? {}) as Partial<Record<OptionalConsent, unknown>>;
  if (source !== 'consent_screen' && source !== 'profile') {
    return NextResponse.json({ error: 'Unknown source' }, { status: 400 });
  }
  for (const [kind, value] of Object.entries(choices)) {
    if (!(OPTIONAL_CONSENTS as readonly string[]).includes(kind) || typeof value !== 'boolean') {
      return NextResponse.json({ error: `Invalid choice: ${kind}` }, { status: 400 });
    }
  }

  const { state: before, error: readError } = await readState(supabase, user.id);
  if (readError || !before) return NextResponse.json({ error: readError?.message ?? 'Failed' }, { status: 500 });

  const rows: { user_id: string; consent: string; granted: boolean; source: ConsentSource }[] = [];
  if (source === 'consent_screen') {
    rows.push({ user_id: user.id, consent: 'chain', granted: true, source });
  }
  for (const kind of OPTIONAL_CONSENTS) {
    const granted = choices[kind];
    if (typeof granted !== 'boolean') continue;
    // The consent screen records every choice, even "off"; the profile only changes.
    if (source === 'profile' && before[kind].at && before[kind].granted === granted) continue;
    rows.push({ user_id: user.id, consent: kind, granted, source });
  }

  if (rows.length > 0) {
    const { error } = await supabase.from('consumer_consents').insert(rows);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const { state } = await readState(supabase, user.id);
  return NextResponse.json(state, { status: rows.length > 0 ? 201 : 200 });
}
