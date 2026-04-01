'use client';
import { useState, useEffect, useRef, useCallback } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useStore } from '@/lib/store';
import { timeAgo } from '@/lib/constants';
import { createClient } from '@/lib/supabase-browser';
import { sendNotification } from '@/lib/notifications';
import { RankBadge } from '@/components/RankBadge';
import { playNotificationSound, playMessageSound } from '@/lib/sounds';

export default function Header() {
  const pathname = usePathname();
  const router = useRouter();
  const { user, profile, unreadCount, unreadChatCount, notifications, setShowAuth, logout, fetchNotifications, markNotificationsRead, setShowCompose } = useStore();
  const [showNotif, setShowNotif] = useState(false);
  const [showMenu, setShowMenu] = useState(false);
  const [search, setSearch] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [showSearch, setShowSearch] = useState(false);
  const [mobileSearchOpen, setMobileSearchOpen] = useState(false);
  const [acceptedIds, setAcceptedIds] = useState(new Set());
  const notifRef = useRef(null);
  const menuRef = useRef(null);
  const prevUnread = useRef(-1);

  // ===== BROWSER NOTIFICATION PERMISSION =====
  useEffect(() => {
    if (!user || typeof window === 'undefined') return;
    if ('Notification' in window && Notification.permission === 'default') {
      // Ask after 10 seconds of use
      const t = setTimeout(() => Notification.requestPermission(), 10000);
      return () => clearTimeout(t);
    }
  }, [user]);

  // ===== FETCH NOTIFICATIONS + PLAY SOUND =====
  useEffect(() => { if (user) fetchNotifications(); }, [user]);

  useEffect(() => {
    if (unreadCount > prevUnread.current && prevUnread.current >= 0) {
      playNotificationSound();
      // Browser push notification
      if ('Notification' in window && Notification.permission === 'granted' && document.hidden) {
        const latest = notifications.find(n => !n.is_read);
        if (latest) {
          try {
            new Notification('MidasHub ⚡', {
              body: latest.content || 'You have a new notification',
              icon: '/icon-192.png',
              badge: '/icon-192.png',
              tag: 'midashub-notif',
            });
          } catch (e) {}
        }
      }
    }
    prevUnread.current = unreadCount;
  }, [unreadCount, notifications]);

  // ===== REALTIME NOTIFICATIONS + LIGHTWEIGHT CHAT COUNT =====
  useEffect(() => {
    if (!user) return;
    const supabase = createClient();

    // Realtime: instant notification updates
    const notifCh = supabase.channel('notifs-live-' + user.id)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'notifications', filter: `user_id=eq.${user.id}` }, () => {
        fetchNotifications();
      }).subscribe();

    // Realtime: instant chat message detection (just bump unread count)
    const chatCh = supabase.channel('chat-unread-' + user.id)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages' }, (payload) => {
        if (payload.new?.sender_id !== user.id) {
          // New message from someone else — refresh count
          useStore.getState().fetchUnreadChats();
        }
      }).subscribe();

    // Initial fetch
    useStore.getState().fetchUnreadChats();

    // Light backup poll every 60s (not 15s)
    const chatPoll = setInterval(() => useStore.getState().fetchUnreadChats(), 60000);

    return () => {
      supabase.removeChannel(notifCh);
      supabase.removeChannel(chatCh);
      clearInterval(chatPoll);
    };
  }, [user]);

  // ===== SEARCH =====
  useEffect(() => {
    if (!search.trim()) { setSearchResults([]); return; }
    const t = setTimeout(async () => {
      const q = search.trim().replace(/^@+/, '').toLowerCase();
      if (!q) { setSearchResults([]); return; }
      try {
        const supabase = createClient();
        const { data } = await supabase.from('profiles').select('id, username, display_name, avatar_emoji, bio, xp').or(`username.ilike.%${q}%,display_name.ilike.%${q}%`).limit(8);
        setSearchResults(data || []);
      } catch (e) { setSearchResults([]); }
    }, 250);
    return () => clearTimeout(t);
  }, [search]);

  // Close menus on outside click
  useEffect(() => {
    const h = (e) => {
      if (notifRef.current && !notifRef.current.contains(e.target)) setShowNotif(false);
      if (menuRef.current && !menuRef.current.contains(e.target)) setShowMenu(false);
    };
    document.addEventListener('mousedown', h);
    return () => document.removeEventListener('mousedown', h);
  }, []);

  const navItems = [
    { href: '/feed', icon: '🏠', label: 'Feed' },
    { href: '/viral', icon: '🔥', label: 'Viral' },
    { href: '/people', icon: '👥', label: 'People' },
    { href: '/leaderboard', icon: '🏆', label: 'Ranks' },
    { href: '/chat', icon: '💬', label: 'Chat', badge: unreadChatCount },
  ];

  return (
    <>
      <header className="sticky top-0 z-50 glass border-b border-white/5">
        <div className="max-w-6xl mx-auto px-3 sm:px-4 py-2.5 flex items-center gap-3">
          <Link prefetch={false} href="/feed" prefetch={false} className="font-black text-lg sm:text-xl accent-text shrink-0">⚡ MidasHub</Link>

          {/* Desktop search */}
          <div className="hidden sm:flex flex-1 max-w-md mx-4 relative">
            <div className="relative w-full">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-white/20 text-sm">🔍</span>
              <input value={search}
                onChange={(e) => { setSearch(e.target.value); setShowSearch(true); }}
                onFocus={() => setShowSearch(true)}
                placeholder="Search people..."
                className="w-full pl-9 pr-4 py-2 rounded-xl bg-white/5 border border-white/8 text-sm text-white outline-none focus:border-[var(--accent)] transition placeholder:text-white/25"
              />
            </div>
            {showSearch && searchResults.length > 0 && (
              <div className="absolute top-full mt-1 w-full glass rounded-xl p-1.5 shadow-2xl z-50">
                {searchResults.map((u) => (
                  <button key={u.id} onClick={() => { router.push(`/profile/${u.username}`); setSearch(''); setShowSearch(false); }}
                    className="w-full flex items-center gap-3 p-2.5 rounded-lg hover:bg-white/5 transition text-left">
                    <span className="text-2xl">{u.avatar_emoji || '😎'}</span>
                    <div className="min-w-0">
                      <div className="flex items-center gap-1.5"><span className="font-semibold text-sm truncate">{u.display_name}</span><RankBadge xp={u.xp || 0} size="xs" /></div>
                      <div className="text-xs text-white/30 truncate">@{u.username}</div>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Desktop nav */}
          <nav className="hidden md:flex items-center gap-1">
            {navItems.map((item) => (
              <Link key={item.href} href={item.href} prefetch={false}
                className={`relative px-3 py-2 rounded-lg text-sm font-medium transition ${pathname === item.href ? 'text-[var(--accent)] bg-white/5' : 'text-white/40 hover:text-white/70 hover:bg-white/3'}`}>
                {item.icon} {item.label}
                {item.badge > 0 && <span className="absolute -top-1 -right-1 w-4.5 h-4.5 min-w-[18px] px-1 rounded-full flex items-center justify-center text-[9px] font-bold" style={{ background: '#ef4444', color: '#fff' }}>{item.badge > 99 ? '99+' : item.badge}</span>}
              </Link>
            ))}
          </nav>

          {/* Mobile search toggle */}
          <button onClick={() => setMobileSearchOpen(!mobileSearchOpen)} className="sm:hidden text-white/40 text-lg ml-auto">🔍</button>

          {/* Right side: notifs + menu */}
          <div className="flex items-center gap-1.5 ml-auto sm:ml-0">
            {user ? (
              <>
                {/* Post button (desktop) */}
                <button onClick={() => setShowCompose(true)} className="hidden md:flex btn-primary py-1.5 px-4 text-xs items-center gap-1">✏️ Post</button>

                {/* Notifications */}
                <div className="relative" ref={notifRef}>
                  <button onClick={() => { setShowNotif(!showNotif); if (!showNotif) markNotificationsRead(); }}
                    className="relative w-9 h-9 rounded-full flex items-center justify-center text-lg hover:bg-white/5 transition">
                    🔔
                    {unreadCount > 0 && <span className="absolute top-0 right-0 w-4.5 h-4.5 min-w-[18px] px-1 rounded-full flex items-center justify-center text-[9px] font-bold animate-pulse" style={{ background: '#ef4444', color: '#fff' }}>{unreadCount > 9 ? '9+' : unreadCount}</span>}
                  </button>
                  {showNotif && (
                    <div className="absolute top-11 right-0 w-80 sm:w-96 glass rounded-xl shadow-2xl z-50 max-h-[70vh] overflow-y-auto overscroll-contain">
                      <div className="p-3 border-b border-white/5 flex justify-between items-center sticky top-0 glass z-10">
                        <span className="font-bold text-sm">Notifications</span>
                        {notifications.length > 0 && <button onClick={markNotificationsRead} className="text-[10px] text-[var(--accent)]">Mark all read</button>}
                      </div>
                      <div className="p-1.5">
                        {notifications.length === 0 ? (
                          <div className="text-center py-8 text-white/20 text-sm">No notifications yet</div>
                        ) : notifications.slice(0, 30).map(n => {
                          const icon = n.type === 'like' ? '❤️' : n.type === 'comment' ? '💬' : n.type === 'friend_request' ? '👋' : n.type === 'friend_accepted' ? '🤝' : n.type === 'repost' ? '🔄' : n.type === 'viral' ? '🔥' : n.type === 'new_post' ? '✍️' : n.type === 'mention' ? '📣' : '🔔';
                          const message = n.content ||
                            (n.type === 'like' ? 'liked your post' :
                            n.type === 'comment' ? 'commented on your post' :
                            n.type === 'friend_request' ? 'sent you a friend request' :
                            n.type === 'friend_accepted' ? 'accepted your request' :
                            n.type === 'repost' ? 'reposted your post' :
                            n.type === 'new_post' ? 'shared a new post' :
                            n.type === 'mention' ? 'mentioned you' : 'new activity');
                          return (
                            <div key={n.id} className={`flex gap-2.5 p-2.5 rounded-xl transition ${!n.is_read ? 'bg-white/3' : ''}`}>
                              <span className="text-lg shrink-0 mt-0.5">{icon}</span>
                              <div className="flex-1 min-w-0">
                                <div className="flex gap-2 items-start">
                                  <Link prefetch={false} href={`/profile/${n.from_user?.username || ''}`} className="text-xl shrink-0" onClick={() => setShowNotif(false)}>{n.from_user?.avatar_emoji || '😎'}</Link>
                                  <div className="flex-1 min-w-0">
                                    <p className="text-[13px] leading-snug">
                                      <Link prefetch={false} href={`/profile/${n.from_user?.username || ''}`} className="font-bold hover:underline" onClick={() => setShowNotif(false)}>{n.from_user?.display_name || 'Someone'}</Link>{' '}
                                      <span className="text-white/60">{message}</span>
                                    </p>
                                    <div className="text-[10px] text-white/20 mt-0.5">{timeAgo(n.created_at)}</div>
                                    {n.type === 'friend_request' && !n.is_read && !acceptedIds.has(n.id) && (
                                      <div className="flex gap-1.5 mt-1.5">
                                        <button onClick={async () => {
                                          setAcceptedIds(prev => new Set([...prev, n.id]));
                                          const supabase = createClient();
                                          try {
                                            await supabase.from('friendships').update({ status: 'accepted' }).or(`and(requester_id.eq.${n.from_user_id},addressee_id.eq.${user.id})`);
                                            sendNotification({ toUserId: n.from_user_id, fromUserId: user.id, type: 'friend_accepted', content: 'accepted your friend request 🤝' });
                                            await supabase.from('notifications').update({ is_read: true, content: 'friend request accepted ✓' }).eq('id', n.id);
                                            useStore.getState().showToast('Friend added ✓');
                                            fetchNotifications();
                                          } catch (e) { setAcceptedIds(prev => { const s = new Set(prev); s.delete(n.id); return s; }); }
                                        }} className="btn-primary py-1.5 px-3 text-[11px]">Accept</button>
                                        <button onClick={async () => {
                                          setAcceptedIds(prev => new Set([...prev, n.id]));
                                          const supabase = createClient();
                                          try {
                                            await supabase.from('friendships').delete().or(`and(requester_id.eq.${n.from_user_id},addressee_id.eq.${user.id})`);
                                            await supabase.from('notifications').update({ is_read: true, content: 'friend request declined' }).eq('id', n.id);
                                            fetchNotifications();
                                          } catch (e) {}
                                        }} className="btn-secondary py-1.5 px-3 text-[11px]">Decline</button>
                                      </div>
                                    )}
                                    {n.type === 'friend_request' && (n.is_read || acceptedIds.has(n.id)) && (
                                      <div className="text-xs text-green-400 mt-1.5 font-semibold">✓ Handled</div>
                                    )}
                                  </div>
                                </div>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </div>

                {/* User menu */}
                <div className="relative" ref={menuRef}>
                  <button onClick={() => setShowMenu(!showMenu)} className="flex items-center gap-1.5 hover:bg-white/5 rounded-lg px-1.5 py-1 transition">
                    <span className="text-2xl">{profile?.avatar_emoji || '😎'}</span>
                  </button>
                  {showMenu && (
                    <div className="absolute top-11 right-0 w-52 glass rounded-xl p-1.5 shadow-2xl">
                      <Link prefetch={false} href={`/profile/${profile?.username}`} className="flex items-center gap-2.5 p-2.5 rounded-lg hover:bg-white/5 transition" onClick={() => setShowMenu(false)}>
                        <span className="text-2xl">{profile?.avatar_emoji || '😎'}</span>
                        <div className="min-w-0">
                          <div className="flex items-center gap-1.5"><span className="font-semibold text-sm truncate">{profile?.display_name}</span></div>
                          <div className="flex items-center gap-1.5 mt-0.5">
                            <span className="text-[11px] text-white/30 truncate">@{profile?.username}</span>
                            <RankBadge xp={profile?.xp || 0} size="xs" />
                          </div>
                        </div>
                      </Link>
                      <div className="border-t border-white/5 my-1" />
                      <Link prefetch={false} href={`/profile/${profile?.username}`} className="block p-2 px-3 rounded-lg hover:bg-white/5 text-sm transition" onClick={() => setShowMenu(false)}>👤 Profile</Link>
                      <Link prefetch={false} href="/settings" prefetch={false} className="block p-2 px-3 rounded-lg hover:bg-white/5 text-sm transition" onClick={() => setShowMenu(false)}>⚙️ Settings</Link>
                      <Link prefetch={false} href="/bookmarks" prefetch={false} className="block p-2 px-3 rounded-lg hover:bg-white/5 text-sm transition" onClick={() => setShowMenu(false)}>🔖 Saved</Link>
                      <div className="border-t border-white/5 my-1" />
                      <button onClick={() => { setShowMenu(false); logout(); }} className="w-full text-left p-2 px-3 rounded-lg hover:bg-red-500/10 text-red-400 text-sm transition">🚪 Log Out</button>
                    </div>
                  )}
                </div>
              </>
            ) : (
              <div className="flex gap-1.5">
                <button onClick={() => setShowAuth(true, 'login')} className="btn-secondary py-1.5 px-3 text-xs">Log In</button>
                <button onClick={() => setShowAuth(true, 'signup')} className="btn-primary py-1.5 px-3 text-xs">Join ⚡</button>
              </div>
            )}
          </div>

          {/* Mobile search dropdown */}
          {mobileSearchOpen && (
            <div className="absolute top-full left-0 right-0 glass p-3 border-b border-white/5 sm:hidden z-50">
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-white/20 text-sm">🔍</span>
                <input value={search} autoFocus onChange={(e) => { setSearch(e.target.value); setShowSearch(true); }}
                  placeholder="Search people..." className="w-full pl-9 pr-4 py-2.5 rounded-xl bg-white/5 border border-white/8 text-sm text-white outline-none focus:border-[var(--accent)] placeholder:text-white/25" style={{ fontSize: '16px' }} />
              </div>
              {searchResults.length > 0 && (
                <div className="mt-1 rounded-xl bg-white/3 p-1">
                  {searchResults.slice(0, 5).map((u) => (
                    <button key={u.id} onClick={() => { router.push(`/profile/${u.username}`); setSearch(''); setMobileSearchOpen(false); }}
                      className="w-full flex items-center gap-3 p-2.5 rounded-lg hover:bg-white/5 transition text-left">
                      <span className="text-xl">{u.avatar_emoji || '😎'}</span>
                      <div><div className="font-semibold text-sm">{u.display_name}</div><div className="text-xs text-white/30">@{u.username}</div></div>
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </header>

      {/* Mobile bottom nav */}
      <div className="md:hidden fixed bottom-0 left-0 right-0 glass border-t border-white/5 z-50 bottom-nav">
        <div className="flex justify-around py-1.5">
          {navItems.map((item) => (
            <Link key={item.href} href={item.href} prefetch={false}
              className={`relative flex flex-col items-center gap-0.5 px-3 py-1 text-[10px] transition ${pathname === item.href ? 'text-[var(--accent)]' : 'text-white/35'}`}>
              <span className="text-lg">{item.icon}</span>
              <span>{item.label}</span>
              {item.badge > 0 && <span className="absolute top-0 right-1 min-w-[16px] h-4 px-1 rounded-full flex items-center justify-center text-[8px] font-bold" style={{ background: '#ef4444', color: '#fff' }}>{item.badge > 9 ? '9+' : item.badge}</span>}
            </Link>
          ))}
          {user && (
            <button onClick={() => setShowCompose(true)} className="flex flex-col items-center gap-0.5 px-3 py-1 text-[10px] text-white/35">
              <span className="text-lg">✏️</span><span>Post</span>
            </button>
          )}
        </div>
      </div>
    </>
  );
}
