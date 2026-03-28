import { create } from 'zustand';
import { createClient } from '@/lib/supabase-browser';

function getSupabase() {
  if (typeof window === 'undefined') return null;
  return createClient();
}

function friendlyError(msg) {
  if (!msg) return 'Something went wrong. Try again.';
  const m = msg.toLowerCase();
  if (m.includes('email not confirmed')) return 'Check your email and click the verification link first, then log in.';
  if (m.includes('invalid login') || m.includes('invalid_credentials')) return 'Wrong email or password.';
  if (m.includes('already registered') || m.includes('already been registered')) return 'This email is already registered. Try logging in.';
  if (m.includes('rate limit') || m.includes('too many')) return 'Too many attempts. Wait a minute and try again.';
  if (m.includes('signup is disabled')) return 'Signups are temporarily disabled.';
  if (m.includes('network') || m.includes('fetch')) return 'Network error. Check your connection.';
  return msg;
}

export const useStore = create((set, get) => ({
  user: null,
  profile: null,
  loading: true,
  showCompose: false,
  showAuth: false,
  authMode: 'signup',
  toast: null,
  theme: 'default',

  setShowCompose: (v) => set({ showCompose: v }),
  setShowAuth: (v, mode = 'signup') => set({ showAuth: v, authMode: mode }),

  showToast: (msg) => {
    set({ toast: msg });
    setTimeout(() => set({ toast: null }), 3000);
  },

  loadTheme: () => {
    if (typeof window === 'undefined') return;
    set({ theme: localStorage.getItem('midashub-theme') || 'default' });
  },

  setTheme: (t) => {
    set({ theme: t });
    if (typeof window !== 'undefined') localStorage.setItem('midashub-theme', t);
  },

  initAuth: async () => {
    const supabase = getSupabase();
    if (!supabase) { set({ loading: false }); return; }

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (session?.user) {
        const { data: profile } = await supabase.from('profiles').select('*').eq('id', session.user.id).maybeSingle();
        set({ user: session.user, profile, loading: false });
      } else {
        set({ loading: false });
      }

      // Listen for auth changes — use event filtering to prevent lock storms
      const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
        if (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED') {
          if (session?.user) {
            const { data: profile } = await supabase.from('profiles').select('*').eq('id', session.user.id).maybeSingle();
            set({ user: session.user, profile });
          }
        } else if (event === 'SIGNED_OUT') {
          set({ user: null, profile: null });
        }
      });

      // Store subscription for cleanup
      if (typeof window !== 'undefined') {
        window.__midashub_auth_sub = subscription;
      }
    } catch (err) {
      console.error('Auth init error:', err);
      set({ loading: false });
    }
  },

  signup: async ({ email, password, username, displayName, avatarEmoji, dateOfBirth }) => {
    const supabase = getSupabase();
    if (!supabase) return { error: { message: 'App is loading...' } };

    try {
      const dob = new Date(dateOfBirth);
      const age = Math.floor((Date.now() - dob.getTime()) / (365.25 * 24 * 60 * 60 * 1000));
      if (age < 15) return { error: { message: 'You must be at least 15 years old.' } };

      const { data: existing } = await supabase.from('profiles').select('id').eq('username', username.toLowerCase()).maybeSingle();
      if (existing) return { error: { message: 'Username "' + username + '" is taken.' } };

      const { data, error } = await supabase.auth.signUp({
        email, password,
        options: {
          data: { username: username.toLowerCase(), display_name: displayName, avatar_emoji: avatarEmoji || '😎' },
          emailRedirectTo: `${window.location.origin}/auth/callback`,
        },
      });

      if (error) return { error: { message: friendlyError(error.message) } };
      if (data?.user?.identities?.length === 0) return { error: { message: 'Email already registered. Check inbox for verification or log in.' } };
      return { data, needsVerification: true };
    } catch (err) {
      return { error: { message: 'Connection error. Try again.' } };
    }
  },

  login: async ({ identifier, password }) => {
    const supabase = getSupabase();
    if (!supabase) return { error: { message: 'App is loading...' } };

    try {
      let email = identifier.trim();
      if (!email.includes('@')) {
        return { error: { message: 'Please use your email address to log in.' } };
      }

      const { data, error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) return { error: { message: friendlyError(error.message) } };

      const { data: profile } = await supabase.from('profiles').select('*').eq('id', data.user.id).maybeSingle();
      set({ user: data.user, profile, showAuth: false });
      get().showToast('Welcome back! ⚡');
      return { data };
    } catch (err) {
      return { error: { message: 'Connection error. Try again.' } };
    }
  },

  logout: async () => {
    const supabase = getSupabase();
    if (supabase) {
      try { await supabase.auth.signOut(); } catch (e) {}
    }
    set({ user: null, profile: null });
  },

  updateProfile: async (updates) => {
    const supabase = getSupabase();
    const { user } = get();
    if (!user || !supabase) return { error: { message: 'Not logged in' } };
    try {
      const { data, error } = await supabase.from('profiles').update({ ...updates, updated_at: new Date().toISOString() }).eq('id', user.id).select().single();
      if (!error && data) set({ profile: data });
      return { data, error };
    } catch (err) {
      return { error: { message: 'Failed to save.' } };
    }
  },

  notifications: [],
  unreadCount: 0,

  fetchNotifications: async () => {
    const supabase = getSupabase();
    const { user } = get();
    if (!user || !supabase) return;
    try {
      const { data } = await supabase.from('notifications').select('*, from_user:profiles!notifications_from_user_id_fkey(*)').eq('user_id', user.id).order('created_at', { ascending: false }).limit(50);
      const unread = (data || []).filter(n => !n.is_read).length;
      set({ notifications: data || [], unreadCount: unread });
    } catch (e) {}
  },

  markNotificationsRead: async () => {
    const supabase = getSupabase();
    const { user } = get();
    if (!user || !supabase) return;
    try {
      await supabase.from('notifications').update({ is_read: true }).eq('user_id', user.id).eq('is_read', false);
      set(s => ({ notifications: s.notifications.map(n => ({ ...n, is_read: true })), unreadCount: 0 }));
    } catch (e) {}
  },
}));
