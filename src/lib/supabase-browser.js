import { createBrowserClient } from '@supabase/ssr';

let client = null;

export function createClient() {
  if (client) return client;

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url || !key || url === 'your_supabase_project_url') {
    return createBrowserClient(
      'https://placeholder.supabase.co',
      'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.placeholder'
    );
  }

  // Simple — no custom auth config. Let Supabase handle everything.
  // The middleware no longer calls getUser(), so no lock conflicts.
  client = createBrowserClient(url, key);
  return client;
}
