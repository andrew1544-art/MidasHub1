import { createBrowserClient } from '@supabase/ssr';

let client = null;

export function createClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  // During build/prerender, env vars may not exist — return a dummy
  if (!url || !key || url === 'your_supabase_project_url') {
    return createBrowserClient(
      'https://placeholder.supabase.co',
      'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.placeholder'
    );
  }

  if (!client) {
    client = createBrowserClient(url, key);
  }
  return client;
}
