import { createClient } from '@/lib/supabase-browser';

// Send notification to a specific user
export async function sendNotification({ toUserId, fromUserId, type, referenceId = null, content = '' }) {
  if (toUserId === fromUserId) return;
  if (!toUserId || !fromUserId) return;
  try {
    const supabase = createClient();
    await supabase.from('notifications').insert({
      user_id: toUserId, from_user_id: fromUserId, type,
      reference_id: referenceId || null, content: content || null,
    });
  } catch (e) { console.warn('Notification failed:', e.message); }
}

// Alert ALL admins (for KYC, trade disputes, etc)
export async function alertAdmins({ fromUserId, type, content = '', referenceId = null }) {
  try {
    const supabase = createClient();
    const { data: admins } = await supabase.from('profiles').select('id').eq('is_admin', true);
    if (!admins?.length) return;
    const inserts = admins
      .filter(a => a.id !== fromUserId) // don't notify yourself
      .map(a => ({
        user_id: a.id, from_user_id: fromUserId, type,
        reference_id: referenceId || null, content: content || null,
      }));
    if (inserts.length) await supabase.from('notifications').insert(inserts);
  } catch (e) { console.warn('Admin alert failed:', e.message); }
}
