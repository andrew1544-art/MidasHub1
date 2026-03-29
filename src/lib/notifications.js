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
