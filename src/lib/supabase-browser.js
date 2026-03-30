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

  return client;
}

// Helper: run a promise with a timeout — never hang
function withTimeout(promise, ms) {
  return Promise.race([
    promise,
    new Promise((_, reject) => setTimeout(() => reject(new Error('timeout')), ms))
  ]);
}

// Ensure fresh auth — with 2s timeout so it never blocks the UI
export async function ensureFreshAuth() {
  if (!client) return;
  try {
    const { data: { session } } = await withTimeout(client.auth.getSession(), 2000);
    if (session) { lastRefresh = Date.now(); return; }
    // No session — try refresh with timeout
    await withTimeout(client.auth.refreshSession(), 3000);
    lastRefresh = Date.now();
  } catch(e) { /* Timed out or failed — don't block */ }
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
