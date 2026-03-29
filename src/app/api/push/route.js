import { NextResponse } from 'next/server';

// Force Node.js runtime (web-push needs crypto)
export const runtime = 'nodejs';

const VAPID_PUBLIC = 'BEUwvEX0AosCeqokhBC04Mjp17WryT_DEnG_aPwBWaqZ1ENQmQGRHADql_P40bVX3OeRAiyev8_3ww4eDQUb-_o';
const VAPID_PRIVATE = process.env.VAPID_PRIVATE_KEY || 'roTy1aYPXilK215iGnPWwWBKREctBR5hjrixMfr2wsE';

function getSupabase() {
  const { createClient } = require('@supabase/supabase-js');
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
  );
}

// POST /api/push — send push to a user
export async function POST(request) {
  try {
    const body = await request.json();
    const { userId, title, body: pushBody, url, tag } = body;
    if (!userId) return NextResponse.json({ error: 'userId required' }, { status: 400 });

    const sb = getSupabase();
    const { data: subs, error: fetchErr } = await sb.from('push_subscriptions').select('*').eq('user_id', userId);
    if (fetchErr || !subs?.length) return NextResponse.json({ sent: 0, reason: fetchErr?.message || 'no subs' });

    const webpush = require('web-push');
    webpush.setVapidDetails('mailto:admin@midashub.app', VAPID_PUBLIC, VAPID_PRIVATE);

    const payload = JSON.stringify({
      title: title || 'MidasHub ⚡',
      body: pushBody || 'New notification',
      url: url || '/feed',
      tag: tag || 'midashub-' + Date.now(),
      icon: '/icon-192.png',
    });

    let sent = 0;
    for (const sub of subs) {
      try {
        await webpush.sendNotification(
          { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
          payload
        );
        sent++;
      } catch (err) {
        if (err.statusCode === 410 || err.statusCode === 404) {
          await sb.from('push_subscriptions').delete().eq('id', sub.id);
        }
      }
    }
    return NextResponse.json({ sent });
  } catch (e) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

// PUT /api/push — register/update push subscription
export async function PUT(request) {
  try {
    const { userId, subscription } = await request.json();
    if (!userId || !subscription?.endpoint || !subscription?.keys) {
      return NextResponse.json({ error: 'missing data' }, { status: 400 });
    }

    const sb = getSupabase();
    // Check if this endpoint already exists for this user
    const { data: existing } = await sb.from('push_subscriptions')
      .select('id').eq('endpoint', subscription.endpoint).eq('user_id', userId).maybeSingle();

    if (existing) {
      await sb.from('push_subscriptions').update({
        p256dh: subscription.keys.p256dh,
        auth: subscription.keys.auth,
        updated_at: new Date().toISOString(),
      }).eq('id', existing.id);
    } else {
      await sb.from('push_subscriptions').insert({
        user_id: userId,
        endpoint: subscription.endpoint,
        p256dh: subscription.keys.p256dh,
        auth: subscription.keys.auth,
      });
    }
    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
