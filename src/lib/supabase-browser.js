import { createClient as createSupabaseClient } from '@supabase/supabase-js';

let client = null;

export function createClient() {
  if (client) return client;

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url || !key || url === 'your_supabase_project_url') {
    return createSupabaseClient(
      'https://placeholder.supabase.co',
      'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.placeholder',
      { auth: { persistSession: false } }
    );
  }

  // Use supabase-js directly (not @supabase/ssr) to control auth lock
  // This bypasses navigator.locks which freezes the app after background
  client = createSupabaseClient(url, key, {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true,
      flowType: 'pkce',
      // Replace navigator.locks with a no-op lock
      // Prevents the 5-second freeze when app returns from background
      lock: async (_name, _acquireTimeout, fn) => {
        return await fn();
      },
    },
  });
  return client;
}
