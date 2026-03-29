import { NextResponse } from 'next/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const VAPID_PUBLIC = 'BEUwvEX0AosCeqokhBC04Mjp17WryT_DEnG_aPwBWaqZ1ENQmQGRHADql_P40bVX3OeRAiyev8_3ww4eDQUb-_o';
const VAPID_PRIVATE = process.env.VAPID_PRIVATE_KEY || '';

function getSupabase() {
  const { createClient } = require('@supabase/supabase-js');
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  return createClient(url, key);
}

// POST — send push notification to a user
export async function POST(request) {
  try {
    const { userId, title, body: pushBody, url, tag } = await request.json();
    if (!userId) return NextResponse.json({ error: 'userId required' }, { status: 400 });
    if (!VAPID_PRIVATE) return NextResponse.json({ error: 'VAPID_PRIVATE_KEY not set' }, { status: 500 });

    const sb = getSupabase();
    if (!sb) return NextResponse.json({ error: 'Supabase not configured' }, { status: 500 });

    const { data: subs, error: fetchErr } = await sb.from('push_subscriptions').select('*').eq('user_id', userId);
    if (fetchErr) return NextResponse.json({ error: 'DB error: ' + fetchErr.message, sent: 0 });
    if (!subs?.length) return NextResponse.json({ sent: 0, reason: 'no subscriptions found' });

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
    const errors = [];
    for (const sub of subs) {
      try {
        await webpush.sendNotification(
          { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
          payload
        );
        sent++;
      } catch (err) {
        errors.push(err.statusCode || err.message);
        if (err.statusCode === 410 || err.statusCode === 404) {
          await sb.from('push_subscriptions').delete().eq('id', sub.id);
        }
      }
    }
    return NextResponse.json({ sent, total: subs.length, errors });
  } catch (e) {
    return NextResponse.json({ error: e.message, stack: e.stack?.slice(0, 200) }, { status: 500 });
  }
}

// PUT — register push subscription
export async function PUT(request) {
  try {
    const { userId, subscription } = await request.json();
    if (!userId || !subscription?.endpoint || !subscription?.keys?.p256dh || !subscription?.keys?.auth) {
      return NextResponse.json({ error: 'missing fields', received: { userId: !!userId, endpoint: !!subscription?.endpoint, p256dh: !!subscription?.keys?.p256dh, auth: !!subscription?.keys?.auth } }, { status: 400 });
    }

    const sb = getSupabase();
    if (!sb) return NextResponse.json({ error: 'Supabase not configured' }, { status: 500 });

    // Upsert
    const { data: existing } = await sb.from('push_subscriptions')
      .select('id').eq('endpoint', subscription.endpoint).eq('user_id', userId).maybeSingle();

    if (existing) {
      const { error } = await sb.from('push_subscriptions').update({
        p256dh: subscription.keys.p256dh,
        auth: subscription.keys.auth,
        updated_at: new Date().toISOString(),
      }).eq('id', existing.id);
      if (error) return NextResponse.json({ error: 'update failed: ' + error.message }, { status: 500 });
      return NextResponse.json({ ok: true, action: 'updated' });
    } else {
      const { error } = await sb.from('push_subscriptions').insert({
        user_id: userId,
        endpoint: subscription.endpoint,
        p256dh: subscription.keys.p256dh,
        auth: subscription.keys.auth,
      });
      if (error) return NextResponse.json({ error: 'insert failed: ' + error.message }, { status: 500 });
      return NextResponse.json({ ok: true, action: 'created' });
    }
  } catch (e) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

// GET — debug endpoint to check status
export async function GET(request) {
  const url = new URL(request.url);
  const userId = url.searchParams.get('userId');
  
  const checks = {
    vapid_set: !!VAPID_PRIVATE,
    supabase_url: !!process.env.NEXT_PUBLIC_SUPABASE_URL,
    service_role: !!process.env.SUPABASE_SERVICE_ROLE_KEY,
  };

  if (userId) {
    const sb = getSupabase();
    if (sb) {
      const { data, error } = await sb.from('push_subscriptions').select('id, endpoint, created_at').eq('user_id', userId);
      checks.subscriptions = data?.length || 0;
      checks.sub_error = error?.message || null;
    }
  }
  return NextResponse.json(checks);
}
