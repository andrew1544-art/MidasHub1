import { createClient } from '@/lib/supabase-browser';

// Send a web push notification via API
async function sendPush(userId, title, body, url) {
  try {
    const res = await fetch('/api/push', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId, title, body, url }),
    });
    const result = await res.json();
    console.log('[Push] Send result:', result);
  } catch(e) { console.warn('[Push] Send error:', e.message); }
}

// Send notification to a specific user
export async function sendNotification({ toUserId, fromUserId, type, referenceId = null, content = '' }) {
  if (toUserId === fromUserId) return;
  if (!toUserId || !fromUserId) return;
  try {
    const supabase = createClient();
    // Get sender name for push notification
    const { data: sender } = await supabase.from('profiles').select('display_name').eq('id', fromUserId).maybeSingle();
    const name = sender?.display_name || 'Someone';

    // Save to DB
    await supabase.from('notifications').insert({
      user_id: toUserId, from_user_id: fromUserId, type,
      reference_id: referenceId || null, content: content || null,
    });

    // Send web push (works even when app is closed)
    const pushTitle = 'MidasHub ⚡';
    const pushBody = `${name} ${content || 'interacted with your post'}`;
    const pushUrl = type === 'friend_request' ? '/people' : type === 'system' ? '/chat' : '/feed';
    sendPush(toUserId, pushTitle, pushBody, pushUrl);
  } catch (e) { console.warn('Notification failed:', e.message); }
}

// Send push for chat messages
export async function sendMessagePush(toUserId, fromName, messagePreview) {
  const body = messagePreview.length > 60 ? messagePreview.slice(0, 60) + '...' : messagePreview;
  sendPush(toUserId, `${fromName} 💬`, body, '/chat');
}

// Notify all friends when user makes a new post
export async function notifyFriendsOfPost(userId, postPreview) {
  try {
    const supabase = createClient();
    // Get user's name
    const { data: poster } = await supabase.from('profiles').select('display_name').eq('id', userId).maybeSingle();
    const name = poster?.display_name || 'Someone';

    // Get all accepted friends (both directions)
    const [{ data: sent }, { data: received }] = await Promise.all([
      supabase.from('friendships').select('addressee_id').eq('requester_id', userId).eq('status', 'accepted'),
      supabase.from('friendships').select('requester_id').eq('addressee_id', userId).eq('status', 'accepted'),
    ]);

    const friendIds = [
      ...new Set([
        ...(sent || []).map(f => f.addressee_id),
        ...(received || []).map(f => f.requester_id),
      ])
    ];

    if (!friendIds.length) return;

    const preview = postPreview.length > 50 ? postPreview.slice(0, 50) + '...' : postPreview;

    // Save notification + send push to each friend
    const notifs = friendIds.map(fid => ({
      user_id: fid, from_user_id: userId, type: 'new_post',
      content: `posted: "${preview}"`,
    }));

    await supabase.from('notifications').insert(notifs);
    friendIds.forEach(fid => sendPush(fid, `${name} posted ✍️`, preview, '/feed'));
  } catch(e) { console.warn('Friend post notify failed:', e.message); }
}

// Alert ALL admins
export async function alertAdmins({ fromUserId, type, content = '', referenceId = null }) {
  try {
    const supabase = createClient();
    const { data: admins } = await supabase.from('profiles').select('id').eq('is_admin', true);
    if (!admins?.length) return;
    const inserts = admins
      .filter(a => a.id !== fromUserId)
      .map(a => ({
        user_id: a.id, from_user_id: fromUserId, type,
        reference_id: referenceId || null, content: content || null,
      }));
    if (inserts.length) {
      await supabase.from('notifications').insert(inserts);
      // Push to each admin
      inserts.forEach(n => sendPush(n.user_id, '🛡️ MidasHub Admin', content, '/admin'));
    }
  } catch (e) { console.warn('Admin alert failed:', e.message); }
}
