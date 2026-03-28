import { create } from 'zustand';
import { createClient } from '@/lib/supabase-browser';

function getSupabase() {
  if (typeof window === 'undefined') return null;
  return createClient();
}

export const useStore = create((set, get) => ({
  user: null,
  profile: null,
  loading: true,

  // UI
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
    const saved = localStorage.getItem('midashub-theme') || 'default';
    set({ theme: saved });
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
        const { data: profile } = await supabase.from('profiles').select('*').eq('id', session.user.id).single();
        set({ user: session.user, profile, loading: false });
      } else {
        set({ loading: false });
      }
      supabase.auth.onAuthStateChange(async (event, session) => {
        if (session?.user) {
          const { data: profile } = await supabase.from('profiles').select('*').eq('id', session.user.id).single();
          set({ user: session.user, profile });
        } else {
          set({ user: null, profile: null });
        }
      });
    } catch (err) {
      console.error('Auth init error:', err);
      set({ loading: false });
    }
  },

  signup: async ({ email, password, username, displayName, avatarEmoji, dateOfBirth }) => {
    const supabase = getSupabase();
    if (!supabase) return { error: { message: 'Client not ready' } };
    const dob = new Date(dateOfBirth);
    const age = Math.floor((Date.now() - dob.getTime()) / (365.25 * 24 * 60 * 60 * 1000));
    if (age < 15) return { error: { message: 'You must be at least 15 years old to join MidasHub.' } };
    const { data: existing } = await supabase.from('profiles').select('id').eq('username', username.toLowerCase()).single();
    if (existing) return { error: { message: 'Username already taken. Try another one!' } };
    const { data, error } = await supabase.auth.signUp({
      email, password,
      options: {
        data: { username: username.toLowerCase(), display_name: displayName, avatar_emoji: avatarEmoji || '😎' },
        emailRedirectTo: `${window.location.origin}/auth/callback`,
      },
    });
    if (error) return { error };
    return { data, needsVerification: true };
  },

  login: async ({ email, password }) => {
    const supabase = getSupabase();
    if (!supabase) return { error: { message: 'Client not ready' } };
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) return { error };
    const { data: profile } = await supabase.from('profiles').select('*').eq('id', data.user.id).single();
    set({ user: data.user, profile, showAuth: false });
    return { data };
  },

  logout: async () => {
    const supabase = getSupabase();
    if (supabase) await supabase.auth.signOut();
    set({ user: null, profile: null });
  },

  updateProfile: async (updates) => {
    const supabase = getSupabase();
    const { user } = get();
    if (!user || !supabase) return;
    const { data, error } = await supabase.from('profiles').update({ ...updates, updated_at: new Date().toISOString() }).eq('id', user.id).select().single();
    if (!error && data) set({ profile: data });
    return { data, error };
  },

  notifications: [],
  unreadCount: 0,

  fetchNotifications: async () => {
    const supabase = getSupabase();
    const { user } = get();
    if (!user || !supabase) return;
    const { data } = await supabase.from('notifications').select('*, from_user:profiles!notifications_from_user_id_fkey(*)').eq('user_id', user.id).order('created_at', { ascending: false }).limit(50);
    const unread = (data || []).filter((n) => !n.is_read).length;
    set({ notifications: data || [], unreadCount: unread });
  },

  markNotificationsRead: async () => {
    const supabase = getSupabase();
    const { user } = get();
    if (!user || !supabase) return;
    await supabase.from('notifications').update({ is_read: true }).eq('user_id', user.id).eq('is_read', false);
    set((s) => ({ notifications: s.notifications.map((n) => ({ ...n, is_read: true })), unreadCount: 0 }));
  },
}));
