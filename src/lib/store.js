import { create } from 'zustand';
import { createClient } from '@/lib/supabase-browser';

function getSupabase() {
  if (typeof window === 'undefined') return null;
  return createClient();
}

function friendlyError(msg) {
  if (!msg) return 'Something went wrong. Try again.';
  const m = msg.toLowerCase();
  if (m.includes('email not confirmed')) return 'Check your email and click the verification link first.';
  if (m.includes('invalid login') || m.includes('invalid_credentials')) return 'Wrong email or password.';
  if (m.includes('already registered') || m.includes('already been registered')) return 'Email already registered. Try logging in.';
  if (m.includes('rate limit') || m.includes('too many')) return 'Too many attempts. Wait a minute.';
  if (m.includes('network') || m.includes('fetch')) return 'Network error. Check your connection.';
  return msg;
}

async function loadProfile(supabase, userId) {
  try { const { data } = await supabase.from('profiles').select('*').eq('id', userId).maybeSingle(); return data; } catch (e) { return null; }
}

let authInitialized = false;
let heartbeatInterval = null;
let chatCountInterval = null;

async function awardDailyLogin(supabase, userId, set) {
  try {
    const today = new Date().toISOString().split('T')[0];
    const key = `midashub-daily-${today}`;
    if (typeof window !== 'undefined' && localStorage.getItem(key)) return;
    await supabase.rpc('award_xp', { target_user_id: userId, amount: 15 }).catch(() => {});
    if (typeof window !== 'undefined') localStorage.setItem(key, '1');
    const profile = await loadProfile(supabase, userId);
    if (profile) set({ profile });
  } catch (e) {}
}

// Request browser notification permission
function requestNotifPermission() {
  if (typeof window === 'undefined' || !('Notification' in window)) return;
  if (Notification.permission === 'default') {
    setTimeout(() => Notification.requestPermission(), 5000);
  }
}

// Send browser notification (even when app is in background)
function showBrowserNotif(title, body, icon = '⚡') {
  if (typeof window === 'undefined' || !('Notification' in window)) return;
  if (Notification.permission !== 'granted') return;
  try {
    const n = new Notification(title, {
      body, icon: '/icon-192.png', badge: '/icon-192.png',
      tag: 'midashub-' + Date.now(), renotify: true, vibrate: [200, 100, 200],
    });
    n.onclick = () => { window.focus(); n.close(); };
  } catch (e) {}
}

export const useStore = create((set, get) => ({
  user: null, profile: null, loading: true,
  showCompose: false, showAuth: false, authMode: 'signup',
  toast: null, theme: 'default',

  setShowCompose: (v) => set({ showCompose: v }),
  setShowAuth: (v, mode = 'signup') => set({ showAuth: v, authMode: mode }),
  showToast: (msg) => { set({ toast: msg }); setTimeout(() => set({ toast: null }), 3000); },
  loadTheme: () => { if (typeof window === 'undefined') return; set({ theme: localStorage.getItem('midashub-theme') || 'default' }); },
  setTheme: (t) => { set({ theme: t }); if (typeof window !== 'undefined') localStorage.setItem('midashub-theme', t); },

  initAuth: async () => {
    if (authInitialized) return;
    authInitialized = true;
    const supabase = getSupabase();
    if (!supabase) { set({ loading: false }); return; }

    const safetyTimeout = setTimeout(() => { if (get().loading) set({ loading: false }); }, 4000);

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (session?.user) {
        const profile = await loadProfile(supabase, session.user.id);
        set({ user: session.user, profile, loading: false });
        awardDailyLogin(supabase, session.user.id, set);
        requestNotifPermission();
        // Start heartbeat (update last_seen every 2 min)
        startHeartbeat(supabase, session.user.id);
        // Start chat count polling
        startChatCountPoll(supabase, session.user.id, set);
      } else { set({ loading: false }); }
      clearTimeout(safetyTimeout);

      supabase.auth.onAuthStateChange(async (event, session) => {
        if (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED') {
          if (session?.user) {
            const profile = await loadProfile(supabase, session.user.id);
            set({ user: session.user, profile, loading: false });
            startHeartbeat(supabase, session.user.id);
            startChatCountPoll(supabase, session.user.id, set);
          }
        } else if (event === 'SIGNED_OUT') {
          set({ user: null, profile: null });
          if (heartbeatInterval) clearInterval(heartbeatInterval);
          if (chatCountInterval) clearInterval(chatCountInterval);
        }
      });
    } catch (err) { clearTimeout(safetyTimeout); set({ loading: false }); }

    // Tab visibility — refresh session + heartbeat on return
    if (typeof document !== 'undefined') {
      document.addEventListener('visibilitychange', async () => {
        if (document.visibilityState === 'visible') {
          try {
            const { data: { session } } = await supabase.auth.getSession();
            if (session?.user) {
              const cur = get().user;
              if (!cur || cur.id !== session.user.id) {
                const profile = await loadProfile(supabase, session.user.id);
                set({ user: session.user, profile });
              }
              // Heartbeat on return
              supabase.from('profiles').update({ last_seen: new Date().toISOString() }).eq('id', session.user.id).then(() => {});
              // Refresh chat count
              get().fetchUnreadChats?.();
              get().fetchNotifications?.();
            } else if (get().user) { set({ user: null, profile: null }); }
          } catch (e) {}
        }
      });
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
      const { data, error } = await supabase.auth.signUp({ email, password, options: { data: { username: username.toLowerCase(), display_name: displayName, avatar_emoji: avatarEmoji || '😎' }, emailRedirectTo: `${window.location.origin}/auth/callback` } });
      if (error) return { error: { message: friendlyError(error.message) } };
      if (data?.user?.identities?.length === 0) return { error: { message: 'Email already registered.' } };
      return { data, needsVerification: true };
    } catch (err) { return { error: { message: 'Connection error.' } }; }
  },

  login: async ({ identifier, password }) => {
    const supabase = getSupabase();
    if (!supabase) return { error: { message: 'App is loading...' } };
    try {
      let email = identifier.trim();
      if (!email.includes('@')) return { error: { message: 'Please use your email address to log in.' } };
      const { data, error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) return { error: { message: friendlyError(error.message) } };
      const profile = await loadProfile(supabase, data.user.id);
      set({ user: data.user, profile, showAuth: false });
      get().showToast('Welcome back! ⚡');
      return { data };
    } catch (err) { return { error: { message: 'Connection error.' } }; }
  },

  logout: async () => {
    const supabase = getSupabase();
    if (supabase) { try { await supabase.auth.signOut(); } catch (e) {} }
    if (heartbeatInterval) clearInterval(heartbeatInterval);
    if (chatCountInterval) clearInterval(chatCountInterval);
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
    } catch (err) { return { error: { message: 'Failed to save.' } }; }
  },

  // === NOTIFICATIONS ===
  notifications: [], unreadCount: 0,

  fetchNotifications: async () => {
    const supabase = getSupabase();
    const { user } = get();
    if (!user || !supabase) return;
    try {
      const { data } = await supabase.from('notifications').select('*, from_user:profiles!notifications_from_user_id_fkey(*)').eq('user_id', user.id).order('created_at', { ascending: false }).limit(50);
      const newUnread = (data || []).filter(n => !n.is_read).length;
      const oldUnread = get().unreadCount;
      set({ notifications: data || [], unreadCount: newUnread });

      // Browser push for new notifications
      if (newUnread > oldUnread && data?.length) {
        const newest = data.find(n => !n.is_read);
        if (newest) {
          const name = newest.from_user?.display_name || 'Someone';
          showBrowserNotif('MidasHub', `${name} ${newest.content || 'interacted with your post'}`, '⚡');
        }
      }
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

  // === CHAT UNREAD ===
  unreadChatCount: 0,

  fetchUnreadChats: async () => {
    const supabase = getSupabase();
    const { user } = get();
    if (!user || !supabase) return;
    try {
      const { data: memberships } = await supabase.from('conversation_members').select('conversation_id, last_read_at').eq('user_id', user.id);
      if (!memberships?.length) { set({ unreadChatCount: 0 }); return; }
      let total = 0;
      for (const m of memberships) {
        const { count } = await supabase.from('messages').select('*', { count: 'exact', head: true })
          .eq('conversation_id', m.conversation_id).neq('sender_id', user.id)
          .gt('created_at', m.last_read_at || '1970-01-01');
        total += (count || 0);
      }
      set({ unreadChatCount: total });
    } catch (e) {}
  },
}));

// Heartbeat — update last_seen every 2 minutes
function startHeartbeat(supabase, userId) {
  if (heartbeatInterval) clearInterval(heartbeatInterval);
  // Immediate
  supabase.from('profiles').update({ last_seen: new Date().toISOString() }).eq('id', userId).then(() => {});
  heartbeatInterval = setInterval(() => {
    supabase.from('profiles').update({ last_seen: new Date().toISOString() }).eq('id', userId).then(() => {});
  }, 120000); // 2 min
}

// Chat count polling — every 30 seconds
function startChatCountPoll(supabase, userId, set) {
  if (chatCountInterval) clearInterval(chatCountInterval);
  useStore.getState().fetchUnreadChats();
  chatCountInterval = setInterval(() => {
    useStore.getState().fetchUnreadChats();
  }, 30000);
}
