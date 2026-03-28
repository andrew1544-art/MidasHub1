import { createBrowserClient } from '@supabase/ssr';

let client = null;

export function createClient() {
  // Return existing singleton
  if (client) return client;

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  // During build/prerender, return a placeholder
  if (!url || !key || url === 'your_supabase_project_url') {
    return createBrowserClient(
      'https://placeholder.supabase.co',
      'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.placeholder'
    );
  }

  // Create singleton client with lock config to prevent orphaned locks
  client = createBrowserClient(url, key, {
    auth: {
      flowType: 'pkce',
      detectSessionInUrl: true,
      persistSession: true,
      autoRefreshToken: true,
      // Increase lock timeout to prevent premature force-acquire
      lock: {
        acquireTimeout: 10000,
      },
    },
  });

  return client;
}
