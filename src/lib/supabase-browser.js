import { createClient as createSupabaseClient } from '@supabase/supabase-js';

let client = null;

export function createClient() {
  if (client) return client;

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url || !key || url === 'your_supabase_project_url') {
    return createSupabaseClient(
      'https://placeholder.supabase.co',
      'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.placeholder'
    );
  }

  client = createSupabaseClient(url, key, {
    auth: {
      flowType: 'pkce',
      autoRefreshToken: true,
      persistSession: true,
      detectSessionInUrl: true,
      storageKey: 'midashub-auth',
      // Bypass navigator.locks — prevents the 5-second freeze
      // when app returns from background
      lock: async (_name, _acquireTimeout, fn) => {
        return await fn();
      },
    },
  });
  return client;
}
