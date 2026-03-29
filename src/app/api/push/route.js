import { NextResponse } from 'next/server';
import webpush from 'web-push';
import { createClient } from '@supabase/supabase-js';

const VAPID_PUBLIC = 'BEUwvEX0AosCeqokhBC04Mjp17WryT_DEnG_aPwBWaqZ1ENQmQGRHADql_P40bVX3OeRAiyev8_3ww4eDQUb-_o';
const VAPID_PRIVATE = process.env.VAPID_PRIVATE_KEY || 'roTy1aYPXilK215iGnPWwWBKREctBR5hjrixMfr2wsE';

webpush.setVapidDetails('mailto:admin@midashub.app', VAPID_PUBLIC, VAPID_PRIVATE);

function getSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
  );
}

// POST /api/push — send push to a user
export async function POST(request) {
  try {
    const { userId, title, body, url, tag } = await request.json();
    if (!userId) return NextResponse.json({ error: 'userId required' }, { status: 400 });

    const sb = getSupabase();
    const { data: subs } = await sb.from('push_subscriptions').select('*').eq('user_id', userId);
    if (!subs?.length) return NextResponse.json({ sent: 0 });

    const payload = JSON.stringify({ title: title || 'MidasHub ⚡', body: body || 'New notification', url: url || '/feed', tag: tag || 'midashub', icon: '/icon-192.png' });

    let sent = 0;
    for (const sub of subs) {
      try {
        const subscription = { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } };
        await webpush.sendNotification(subscription, payload);
        sent++;
      } catch (err) {
        // Remove invalid/expired subscriptions
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

// PUT /api/push — register/update subscription
export async function PUT(request) {
  try {
    const { userId, subscription } = await request.json();
    if (!userId || !subscription) return NextResponse.json({ error: 'missing data' }, { status: 400 });

    const sb = getSupabase();
    // Upsert by endpoint
    const { data: existing } = await sb.from('push_subscriptions').select('id').eq('endpoint', subscription.endpoint).eq('user_id', userId).maybeSingle();
    if (existing) {
      await sb.from('push_subscriptions').update({ p256dh: subscription.keys.p256dh, auth: subscription.keys.auth, updated_at: new Date().toISOString() }).eq('id', existing.id);
    } else {
      await sb.from('push_subscriptions').insert({ user_id: userId, endpoint: subscription.endpoint, p256dh: subscription.keys.p256dh, auth: subscription.keys.auth });
    }
    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
