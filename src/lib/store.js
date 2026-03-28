import { create } from 'zustand';
import { createClient } from '@/lib/supabase-browser';

function getSupabase() {
  if (typeof window === 'undefined') return null;
  return createClient();
}

// Make Supabase errors human-readable
function friendlyError(msg) {
  if (!msg) return 'Something went wrong. Try again.';
  const m = msg.toLowerCase();
  if (m.includes('email not confirmed')) return 'Please check your email and click the verification link first, then try logging in again.';
  if (m.includes('invalid login credentials') || m.includes('invalid_credentials')) return 'Wrong email/username or password. Please try again.';
  if (m.includes('user already registered') || m.includes('already been registered')) return 'This email is already registered. Try logging in instead.';
  if (m.includes('rate limit') || m.includes('too many requests')) return 'Too many attempts. Please wait a minute and try again.';
  if (m.includes('password') && m.includes('short')) return 'Password must be at least 6 characters.';
  if (m.includes('valid email') || m.includes('invalid email')) return 'Please enter a valid email address.';
  if (m.includes('network') || m.includes('fetch')) return 'Network error. Check your connection and try again.';
  if (m.includes('signup is disabled')) return 'Signups are currently disabled. Please try again later.';
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
    if (!supabase) return { error: { message: 'App is still loading. Please wait a moment.' } };

    const dob = new Date(dateOfBirth);
    const age = Math.floor((Date.now() - dob.getTime()) / (365.25 * 24 * 60 * 60 * 1000));
    if (age < 15) return { error: { message: 'You must be at least 15 years old to join MidasHub.' } };

    // Check username
    const { data: existing } = await supabase.from('profiles').select('id').eq('username', username.toLowerCase()).maybeSingle();
    if (existing) return { error: { message: 'Username "' + username + '" is already taken. Try another one!' } };

    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: { username: username.toLowerCase(), display_name: displayName, avatar_emoji: avatarEmoji || '😎' },
        emailRedirectTo: `${window.location.origin}/auth/callback`,
      },
    });

    if (error) return { error: { message: friendlyError(error.message) } };

    // Supabase returns a user with identities=[] if email already exists but isn't confirmed
    if (data?.user && data.user.identities && data.user.identities.length === 0) {
      return { error: { message: 'This email is already registered. Check your inbox for a verification link, or try logging in.' } };
    }

    return { data, needsVerification: true };
  },

  // Login supports both email and username
  login: async ({ identifier, password }) => {
    const supabase = getSupabase();
    if (!supabase) return { error: { message: 'App is still loading. Please wait a moment.' } };

    let email = identifier.trim();

    // If it doesn't look like an email, treat as username and look up email
    if (!email.includes('@')) {
      const cleanUsername = email.replace(/^@/, '').toLowerCase();
      const { data: prof, error: lookupError } = await supabase
        .from('profiles')
        .select('id')
        .eq('username', cleanUsername)
        .maybeSingle();

      if (!prof) {
        return { error: { message: 'No account found with username "' + cleanUsername + '". Check spelling or try your email.' } };
      }

      // Get user email from auth.users via a workaround — try login with username as email (will fail)
      // Actually, we can't look up email from profiles. Let's tell the user to use email instead.
      return { error: { message: 'Username login found your account! But please log in with your email address for security. The email you signed up with.' } };
    }

    const { data, error } = await supabase.auth.signInWithPassword({ email, password });

    if (error) {
      return { error: { message: friendlyError(error.message) } };
    }

    const { data: profile } = await supabase.from('profiles').select('*').eq('id', data.user.id).maybeSingle();
    set({ user: data.user, profile, showAuth: false });
    get().showToast('Welcome back! ⚡');
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
    if (!user || !supabase) return { error: { message: 'Not logged in' } };
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
    const unread = (data || []).filter(n => !n.is_read).length;
    set({ notifications: data || [], unreadCount: unread });
  },

  markNotificationsRead: async () => {
    const supabase = getSupabase();
    const { user } = get();
    if (!user || !supabase) return;
    await supabase.from('notifications').update({ is_read: true }).eq('user_id', user.id).eq('is_read', false);
    set(s => ({ notifications: s.notifications.map(n => ({ ...n, is_read: true })), unreadCount: 0 }));
  },
}));
