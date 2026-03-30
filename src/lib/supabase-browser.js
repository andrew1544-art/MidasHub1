import { createClient as createSupabaseClient } from '@supabase/supabase-js';

let client = null;
let lastRefresh = 0;

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

  client = createSupabaseClient(url, key, {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true,
      flowType: 'pkce',
      lock: async (_name, _acquireTimeout, fn) => await fn(),
    },
  });

  // Proactive token keepalive — refresh every 4 minutes
  // Supabase tokens expire in ~60 min, but mobile browsers freeze JS timers
  // so the token can be stale when user returns. This keeps it alive.
  if (typeof document !== 'undefined') {
    setInterval(async () => {
      try {
        if (document.visibilityState === 'visible') {
          await client.auth.getSession();
          lastRefresh = Date.now();
        }
      } catch(e) {}
    }, 240000); // 4 minutes
  }

  return client;
}

// Force refresh the auth session
export async function refreshSession() {
  if (!client) return;
  try {
    // Always do a full refresh to get a new token
    const { data: { session } } = await client.auth.refreshSession();
    if (session) {
      lastRefresh = Date.now();
      return true;
    }
    // If refreshSession fails, try getSession
    const { data: { session: s2 } } = await client.auth.getSession();
    if (s2) { lastRefresh = Date.now(); return true; }
    return false;
  } catch(e) { return false; }
}

// Check if token is likely stale (hasn't been refreshed in 5+ minutes)
export function isTokenStale() {
  return lastRefresh > 0 && Date.now() - lastRefresh > 300000;
}

// Ensure fresh auth before a write — call this before important operations
export async function ensureFreshAuth() {
  if (!client) return;
  if (isTokenStale() || lastRefresh === 0) {
    await refreshSession();
  }
}
