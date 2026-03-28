import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';

export function createServerSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  // During build, env vars may be missing
  if (!url || !key || url === 'your_supabase_project_url') {
    return null;
  }

  const cookieStore = cookies();
  return createServerClient(url, key, {
    cookies: {
      get(name) {
        return cookieStore.get(name)?.value;
      },
      set(name, value, options) {
        try { cookieStore.set({ name, value, ...options }); } catch (e) {}
      },
      remove(name, options) {
        try { cookieStore.set({ name, value: '', ...options }); } catch (e) {}
      },
    },
  });
}
