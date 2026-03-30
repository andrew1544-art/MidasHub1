import { create } from 'zustand';
import { createClient } from '@/lib/supabase-browser';

function getSupabase() {
  if (typeof window === 'undefined') return null;
  return createClient();
}

const VAPID_PUBLIC = 'BEUwvEX0AosCeqokhBC04Mjp17WryT_DEnG_aPwBWaqZ1ENQmQGRHADql_P40bVX3OeRAiyev8_3ww4eDQUb-_o';
let pushRegistered = false;

// Register for push notifications (non-blocking, silent)
async function registerPush(userId) {
  if (pushRegistered) return;
  try {
    if (typeof window === 'undefined' || !('serviceWorker' in navigator) || !('PushManager' in window)) { console.log('[Push] Not supported'); return; }
    const reg = await navigator.serviceWorker.ready;
    const perm = await Notification.requestPermission();
    if (perm !== 'granted') { console.log('[Push] Permission denied:', perm); return; }
    let sub = await reg.pushManager.getSubscription();
    if (!sub) {
      sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC),
      });
      console.log('[Push] New subscription created');
    } else {
      console.log('[Push] Existing subscription found');
    }
    const subJson = sub.toJSON();
    const res = await fetch('/api/push', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        userId,
        subscription: { endpoint: sub.endpoint, keys: { p256dh: subJson.keys.p256dh, auth: subJson.keys.auth } },
      }),
    });
    const result = await res.json();
    console.log('[Push] Registration result:', result);
    if (result.ok) pushRegistered = true;
  } catch(e) { console.warn('[Push] Registration error:', e.message); }
}

function urlBase64ToUint8Array(base64String) {
  const padding = '='.repeat((4 - base64String.length % 4) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const raw = atob(base64);
  const arr = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) arr[i] = raw.charCodeAt(i);
  return arr;
}

// Track user session — device, location, browser fingerprint
async function trackSession(supabase, userId) {
  try {
    if (typeof window === 'undefined') return;
    const ua = navigator.userAgent;
    const device = /Mobile|Android|iPhone|iPad/.test(ua) ? (/iPad/.test(ua) ? 'Tablet' : 'Mobile') : 'Desktop';
    const browser = /Firefox/.test(ua) ? 'Firefox' : /Edg/.test(ua) ? 'Edge' : /Chrome/.test(ua) ? 'Chrome' : /Safari/.test(ua) ? 'Safari' : 'Other';
    const os = /Windows/.test(ua) ? 'Windows' : /Mac/.test(ua) ? 'macOS' : /Android/.test(ua) ? 'Android' : /iPhone|iPad/.test(ua) ? 'iOS' : /Linux/.test(ua) ? 'Linux' : 'Other';
    const screen_resolution = `${window.screen.width}x${window.screen.height}`;
    const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone || '';
    const language = navigator.language || '';

    // Get IP + location from free API
    let ip = '', country = '', city = '';
    try {
      const res = await fetch('https://ipapi.co/json/', { signal: AbortSignal.timeout(3000) });
      if (res.ok) {
        const geo = await res.json();
        ip = geo.ip || '';
        country = geo.country_name || '';
        city = geo.city || '';
      }
    } catch(e) {}

    // Save session log
    await supabase.from('user_sessions').insert({
      user_id: userId, ip_address: ip, country, city, device, browser, os,
      screen_resolution, timezone, language,
    }).then(() => {});

    // Update profile with latest info
    await supabase.from('profiles').update({
      last_ip: ip, last_country: country, last_city: city, last_device: `${device} / ${browser} / ${os}`,
      last_browser: browser, login_count: undefined, // handled by DB
    }).eq('id', userId).then(() => {});

    // Increment login count
    const { data: prof } = await supabase.from('profiles').select('login_count').eq('id', userId).maybeSingle();
    await supabase.from('profiles').update({ login_count: (prof?.login_count || 0) + 1 }).eq('id', userId);
  } catch(e) { /* Silent — tracking is non-critical */ }
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
  try {
    const { data } = await supabase.from('profiles').select('*').eq('id', userId).maybeSingle();
    if (data) {
      // Sync email + DOB from auth if missing in profile
      const updates = {};
      if (!data.email) {
        try {
          const { data: { user } } = await supabase.auth.getUser();
          if (user?.email) updates.email = user.email;
          if (!data.date_of_birth && user?.user_metadata?.date_of_birth) updates.date_of_birth = user.user_metadata.date_of_birth;
        } catch(e) {}
      }
      if (Object.keys(updates).length) {
        await supabase.from('profiles').update(updates).eq('id', userId).then(() => {});
        Object.assign(data, updates);
      }
    }
    return data;
  } catch (e) { return null; }
}

let authInitialized = false;
let heartbeatInterval = null;

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

function requestNotifPermission() {
  if (typeof window === 'undefined' || !('Notification' in window)) return;
  if (Notification.permission === 'default') setTimeout(() => Notification.requestPermission(), 5000);
}

function showBrowserNotif(title, body) {
  if (typeof window === 'undefined' || !('Notification' in window)) return;
  if (Notification.permission !== 'granted') return;
  try {
    const n = new Notification(title, { body, icon: '/icon-192.png', badge: '/icon-192.png', tag: 'midashub-' + Date.now(), renotify: true });
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

    // Fast timeout - show UI quickly
    const safetyTimeout = setTimeout(() => { if (get().loading) set({ loading: false }); }, 2500);

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (session?.user) {
        // Load profile and set user IMMEDIATELY, then do background tasks
        const profile = await loadProfile(supabase, session.user.id);
        set({ user: session.user, profile, loading: false });
        clearTimeout(safetyTimeout);
        // Background tasks - don't block UI
        requestNotifPermission();
        registerPush(session.user.id);
        trackSession(supabase, session.user.id);
        startHeartbeat(supabase, session.user.id);
        awardDailyLogin(supabase, session.user.id, set);
      } else {
        set({ loading: false });
        clearTimeout(safetyTimeout);
      }

      supabase.auth.onAuthStateChange(async (event, session) => {
        if (event === 'PASSWORD_RECOVERY') {
          // User clicked password reset link — open reset modal
          if (session?.user) {
            const profile = await loadProfile(supabase, session.user.id);
            set({ user: session.user, profile, loading: false, showAuth: true, authMode: 'reset' });
          }
        } else if (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED') {
          if (session?.user) {
            const profile = await loadProfile(supabase, session.user.id);
            set({ user: session.user, profile, loading: false });
            startHeartbeat(supabase, session.user.id);
            if (event === 'SIGNED_IN') registerPush(session.user.id);
          }
        } else if (event === 'SIGNED_OUT') {
          set({ user: null, profile: null });
          if (heartbeatInterval) clearInterval(heartbeatInterval);
        }
      });
    } catch (err) { clearTimeout(safetyTimeout); set({ loading: false }); }

    // Tab/app visibility — refresh auth token on return
    // Safe now because middleware no longer calls getUser() (no lock conflict)
    if (typeof document !== 'undefined') {
      let lastHidden = 0;
      document.addEventListener('visibilitychange', async () => {
        if (document.visibilityState === 'hidden') {
          lastHidden = Date.now();
          return;
        }
        const away = Date.now() - lastHidden;
        const { user: currentUser } = get();
        if (!currentUser) return;

        try {
          // Refresh the auth session — this renews the token so queries work
          const { data: { session } } = await supabase.auth.getSession();
          if (session?.user) {
            // Token refreshed — update heartbeat
            supabase.from('profiles').update({ last_seen: new Date().toISOString() }).eq('id', session.user.id).then(() => {});
            // Refresh notifications + chat
            if (away > 5000) {
              get().fetchNotifications?.();
              get().fetchUnreadChats?.();
            }
            // Tell all pages to refetch their data
            window.dispatchEvent(new Event('midashub:resumed'));
          } else {
            // Session gone — user needs to log in again
            set({ user: null, profile: null });
          }
        } catch(e) {
          // If getSession fails, just try heartbeat
          supabase.from('profiles').update({ last_seen: new Date().toISOString() }).eq('id', currentUser.id).then(() => {});
        }
      });
    }
  },

  signup: async ({ email, password, username, displayName, avatarEmoji, dateOfBirth, referredBy }) => {
    const supabase = getSupabase();
    if (!supabase) return { error: { message: 'App is loading...' } };
    try {
      const dob = new Date(dateOfBirth);
      const age = Math.floor((Date.now() - dob.getTime()) / (365.25 * 24 * 60 * 60 * 1000));
      if (age < 15) return { error: { message: 'You must be at least 15 years old.' } };
      const { data: existing } = await supabase.from('profiles').select('id').eq('username', username.toLowerCase()).maybeSingle();
      if (existing) return { error: { message: 'Username "' + username + '" is taken.' } };
      const metadata = { username: username.toLowerCase(), display_name: displayName, avatar_emoji: avatarEmoji || '😎', date_of_birth: dateOfBirth, email: email };
      if (referredBy) metadata.referred_by = referredBy.toUpperCase();
      const { data, error } = await supabase.auth.signUp({ email, password, options: { data: metadata, emailRedirectTo: `${window.location.origin}/auth/callback` } });
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
      const { data } = await supabase.from('notifications').select('*, from_user:profiles!notifications_from_user_id_fkey(*)').eq('user_id', user.id).order('created_at', { ascending: false }).limit(30);
      const newUnread = (data || []).filter(n => !n.is_read).length;
      const oldUnread = get().unreadCount;
      set({ notifications: data || [], unreadCount: newUnread });
      if (newUnread > oldUnread && oldUnread >= 0 && data?.length) {
        const newest = data.find(n => !n.is_read);
        if (newest) showBrowserNotif('MidasHub', `${newest.from_user?.display_name || 'Someone'} ${newest.content || 'interacted with your post'}`);
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

  // === CHAT UNREAD — single fast query ===
  unreadChatCount: 0,
  postingInBackground: false,

  // === BACKGROUND POST — survives navigation ===
  backgroundPost: async ({ content, sourcePlatform, sourceUrl, tags, mediaUrls, hasVideo, isPublic, quote }) => {
    const supabase = getSupabase();
    const { user } = get();
    if (!user || !supabase) return;
    set({ postingInBackground: true });

    try {
      let finalContent = content.trim();
      if (quote) {
        finalContent += `\n\n💬 Reposting @${quote.username}:\n"${quote.content.slice(0, 200)}${quote.content.length > 200 ? '...' : ''}"`;
      }
      const parsedTags = (tags || '').split(',').map(t => t.trim().replace('#', '').toLowerCase()).filter(Boolean);
      const urls = mediaUrls || [];

      const { error: postErr } = await supabase.from('posts').insert({
        user_id: user.id,
        content: finalContent,
        source_platform: sourcePlatform || 'midashub',
        source_url: sourceUrl?.trim() || null,
        media_urls: urls,
        media_type: urls.length > 0 ? (hasVideo ? 'video' : 'image') : null,
        tags: parsedTags,
        is_public: isPublic !== false,
      });

      if (postErr) {
        get().showToast?.('❌ Post failed: ' + postErr.message);
      } else {
        get().showToast?.('Posted! ⚡');
        window.dispatchEvent(new Event('midashub:newpost'));
      }
    } catch(e) {
      get().showToast?.('❌ Post failed. Try again.');
    }
    set({ postingInBackground: false });
  },

  fetchUnreadChats: async () => {
    const supabase = getSupabase();
    const { user } = get();
    if (!user || !supabase) return;
    try {
      // Get all conversations + last_read in ONE query
      const { data: memberships } = await supabase.from('conversation_members').select('conversation_id, last_read_at').eq('user_id', user.id);
      if (!memberships?.length) { set({ unreadChatCount: 0 }); return; }
      // Batch: count all unread across all convos in PARALLEL (not sequential)
      const counts = await Promise.all(
        memberships.map(m =>
          supabase.from('messages').select('*', { count: 'exact', head: true })
            .eq('conversation_id', m.conversation_id).neq('sender_id', user.id)
            .gt('created_at', m.last_read_at || '1970-01-01')
            .then(r => r.count || 0)
            .catch(() => 0)
        )
      );
      set({ unreadChatCount: counts.reduce((a, b) => a + b, 0) });
    } catch (e) {}
  },
}));

// Heartbeat — update last_seen every 3 minutes (single source, no duplicates)
function startHeartbeat(supabase, userId) {
  if (heartbeatInterval) clearInterval(heartbeatInterval);
  supabase.from('profiles').update({ last_seen: new Date().toISOString() }).eq('id', userId).then(() => {});
  heartbeatInterval = setInterval(() => {
    supabase.from('profiles').update({ last_seen: new Date().toISOString() }).eq('id', userId).then(() => {});
  }, 180000); // 3 min
}
