import { createClient } from '@/lib/supabase-browser';

// Centralized notification sender — fire and forget, never blocks UI
export async function sendNotification({ toUserId, fromUserId, type, referenceId = null, content = '' }) {
  // Don't notify yourself
  if (toUserId === fromUserId) return;
  if (!toUserId || !fromUserId) return;

  try {
    const supabase = createClient();
    const { error } = await supabase.from('notifications').insert({
      user_id: toUserId,
      from_user_id: fromUserId,
      type,
      reference_id: referenceId || null,
      content: content || null,
    });
    if (error) {
      console.warn('Notification send failed:', error.message, { toUserId, type });
    }
  } catch (e) {
    console.warn('Notification exception:', e.message);
  }
}
