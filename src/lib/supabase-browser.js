import { createClient as createSupabaseClient } from '@supabase/supabase-js';

let client = null;
let lastRefresh = 0;
let lastActivity = Date.now();
let keepaliveTimer = null;

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

  // Keepalive: refresh session every 3 minutes to prevent stale connections
  if (typeof window !== 'undefined' && !keepaliveTimer) {
    keepaliveTimer = setInterval(() => {
      if (!client) return;
      // Only ping if user has been active (touched screen, typed, scrolled)
      if (Date.now() - lastActivity < 600000) {
        client.auth.getSession().catch(() => {});
      }
    }, 180000); // every 3 min

    // Track user activity
    ['click', 'keydown', 'scroll', 'touchstart'].forEach(evt => {
      document.addEventListener(evt, () => { lastActivity = Date.now(); }, { passive: true, capture: false });
    });
  }

  return client;
}

// Helper: run a promise with a timeout
function withTimeout(promise, ms) {
  return Promise.race([
    promise,
    new Promise((_, reject) => setTimeout(() => reject(new Error('timeout')), ms))
  ]);
}

// Force recreate the Supabase client (nuclear option for dead connections)
export function resetClient() {
  client = null;
  return createClient();
}

// Ensure fresh auth — with 2s timeout so it never blocks the UI
export async function ensureFreshAuth() {
  if (!client) return;
  try {
    const { data: { session } } = await withTimeout(client.auth.getSession(), 2000);
    if (session) { lastRefresh = Date.now(); return; }
    await withTimeout(client.auth.refreshSession(), 3000);
    lastRefresh = Date.now();
  } catch(e) { /* Timed out or failed — don't block */ }
}

// Pre-write check: actually test the connection is alive
export async function ensureAlive() {
  if (!client) return;
  try {
    // Do a real server round-trip, not just read localStorage
    const result = await withTimeout(
      client.from('profiles').select('id').limit(1).maybeSingle(),
      3000
    );
    if (result.error) {
      // Connection is dead — refresh auth
      await withTimeout(client.auth.refreshSession(), 3000);
      lastRefresh = Date.now();
    }
  } catch(e) {
    // Timed out — connection is truly dead, recreate client
    try {
      resetClient();
      await withTimeout(client.auth.refreshSession(), 3000);
      lastRefresh = Date.now();
    } catch(e2) {}
  }
}

// Force full refresh
export async function refreshSession() {
  if (!client) return false;
  try {
    const { data } = await withTimeout(client.auth.refreshSession(), 3000);
    if (data?.session) { lastRefresh = Date.now(); return true; }
    return false;
  } catch(e) { return false; }
}

export function isTokenStale() {
  return lastRefresh > 0 && Date.now() - lastRefresh > 300000;
}
