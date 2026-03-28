'use client';
import { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useStore } from '@/lib/store';
import { timeAgo } from '@/lib/constants';
import { createClient } from '@/lib/supabase-browser';
import { RankBadge } from '@/components/RankBadge';

export default function Header() {
  const pathname = usePathname();
  const router = useRouter();
  const { user, profile, unreadCount, notifications, setShowAuth, logout, fetchNotifications, markNotificationsRead, setShowCompose } = useStore();
  const [showNotif, setShowNotif] = useState(false);
  const [showMenu, setShowMenu] = useState(false);
  const [search, setSearch] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [showSearch, setShowSearch] = useState(false);
  const [mobileSearchOpen, setMobileSearchOpen] = useState(false);
  const notifRef = useRef(null);
  const menuRef = useRef(null);

  useEffect(() => { if (user) fetchNotifications(); }, [user]);

  // Realtime notifications
  useEffect(() => {
    if (!user) return;
    const supabase = createClient();
    const channel = supabase.channel('notifs-' + user.id)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'notifications', filter: `user_id=eq.${user.id}` }, () => {
        try { fetchNotifications(); } catch (e) {}
      })
      .subscribe();

    // Also poll every 30s in case realtime disconnects
    const poll = setInterval(() => { try { fetchNotifications(); } catch (e) {} }, 30000);

    return () => { supabase.removeChannel(channel); clearInterval(poll); };
  }, [user]);

  useEffect(() => {
    if (!search.trim()) { setSearchResults([]); return; }
    const t = setTimeout(async () => {
      const supabase = createClient();
      const { data } = await supabase.from('profiles')
        .select('id, username, display_name, avatar_emoji, bio, xp')
        .or(`username.ilike.%${search}%,display_name.ilike.%${search}%`)
        .limit(8);
      setSearchResults(data || []);
    }, 250);
    return () => clearTimeout(t);
  }, [search]);

  useEffect(() => {
    const handler = (e) => {
      if (notifRef.current && !notifRef.current.contains(e.target)) setShowNotif(false);
      if (menuRef.current && !menuRef.current.contains(e.target)) setShowMenu(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const navItems = [
    { href: '/feed', icon: '🏠', label: 'Feed' },
    { href: '/viral', icon: '🔥', label: 'Viral' },
    { href: '/people', icon: '👥', label: 'People' },
    { href: '/leaderboard', icon: '🏆', label: 'Ranks' },
    { href: '/chat', icon: '💬', label: 'Chat' },
  ];

  return (
    <>
      <header className="sticky top-0 z-50 glass">
        <div className="max-w-5xl mx-auto flex items-center h-14 px-3 sm:px-4 gap-2 sm:gap-3">
          {/* Logo */}
          <Link href={user ? '/feed' : '/'} className="flex items-center gap-2 shrink-0">
            <div className="w-8 h-8 rounded-lg accent-gradient flex items-center justify-center text-base animate-glow">⚡</div>
            <span className="text-lg font-extrabold accent-text hidden sm:block">MIDASHUB</span>
          </Link>

          {/* Desktop search */}
          <div className="hidden sm:block flex-1 max-w-sm relative">
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-white/20 text-sm">🔍</span>
              <input value={search}
                onChange={(e) => { setSearch(e.target.value); setShowSearch(true); }}
                onFocus={() => setShowSearch(true)}
                onBlur={() => setTimeout(() => setShowSearch(false), 200)}
                placeholder="Search people..."
                className="w-full pl-9 pr-4 py-2 rounded-xl bg-white/5 border border-white/8 text-sm text-white outline-none focus:border-[var(--accent)] transition placeholder:text-white/25"
              />
            </div>
            {showSearch && searchResults.length > 0 && (
              <div className="absolute top-full mt-1 w-full glass rounded-xl p-1.5 shadow-2xl z-50 animate-slide-up">
                {searchResults.map((u) => (
                  <button key={u.id} onClick={() => { router.push(`/profile/${u.username}`); setSearch(''); }}
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

          {/* Mobile search button */}
          <button onClick={() => setMobileSearchOpen(!mobileSearchOpen)} className="sm:hidden w-8 h-8 rounded-lg bg-white/5 flex items-center justify-center text-sm ml-auto">
            🔍
          </button>

          {/* Desktop nav */}
          <nav className="hidden md:flex gap-0.5">
            {navItems.map((item) => (
              <Link key={item.href} href={item.href}
                className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium transition-all ${pathname === item.href ? 'bg-white/8 text-[var(--accent)]' : 'text-white/40 hover:text-white/70 hover:bg-white/5'}`}>
                <span className="text-base">{item.icon}</span>
                <span className="hidden lg:block">{item.label}</span>
              </Link>
            ))}
          </nav>

          {/* Post button */}
          {user && <button onClick={() => setShowCompose(true)} className="btn-primary py-1.5 px-3 text-xs hidden sm:block">✏️ Post</button>}

          {/* Notifications */}
          {user && (
            <div className="relative" ref={notifRef}>
              <button onClick={() => { setShowNotif(!showNotif); if (!showNotif) markNotificationsRead(); }}
                className="w-8 h-8 rounded-lg bg-white/5 flex items-center justify-center text-base relative hover:bg-white/10 transition">
                🔔
                {unreadCount > 0 && (
                  <span className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-red-500 text-[9px] font-bold flex items-center justify-center animate-pulse">
                    {unreadCount > 9 ? '9+' : unreadCount}
                  </span>
                )}
              </button>
              {showNotif && (
                <div className="absolute top-11 right-0 w-72 sm:w-80 glass rounded-xl p-1.5 shadow-2xl animate-slide-up">
                  <div className="px-3 py-2 text-sm font-bold border-b border-white/5 mb-1 flex items-center justify-between">
                    <span>Notifications</span>
                    {notifications.length > 0 && <span className="text-[10px] text-white/20 font-normal">{notifications.length}</span>}
                  </div>
                  {notifications.length === 0 ? (
                    <div className="p-8 text-center text-white/20 text-sm">
                      <div className="text-2xl mb-2">🔔</div>
                      No notifications yet
                    </div>
                  ) : notifications.slice(0, 10).map((n) => {
                    const icon = n.type === 'like' ? '❤️' : n.type === 'comment' ? '💬' : n.type === 'friend_request' ? '👋' : n.type === 'friend_accepted' ? '🤝' : n.type === 'repost' ? '🔄' : n.type === 'mention' ? '📢' : n.type === 'viral' ? '🔥' : '🔔';
                    const message = n.content || (
                      n.type === 'like' ? 'liked your post' :
                      n.type === 'comment' ? 'commented on your post' :
                      n.type === 'friend_request' ? 'sent you a friend request' :
                      n.type === 'friend_accepted' ? 'accepted your friend request' :
                      n.type === 'repost' ? 'reposted your post' :
                      n.type === 'mention' ? 'mentioned you' :
                      n.type === 'viral' ? 'Your post is going viral!' :
                      'sent you a notification'
                    );
                    return (
                      <div key={n.id} className={`p-2.5 rounded-lg text-sm transition ${!n.is_read ? 'bg-[var(--accent)]/5 border-l-2 border-[var(--accent)]' : 'hover:bg-white/3'}`}>
                        <div className="flex items-start gap-2.5">
                          <div className="relative shrink-0">
                            {n.from_user && <span className="text-lg">{n.from_user.avatar_emoji || '😎'}</span>}
                            <span className="absolute -bottom-0.5 -right-0.5 text-[10px]">{icon}</span>
                          </div>
                          <div className="min-w-0 flex-1">
                            <p className="text-[13px] leading-snug">
                              <Link href={`/profile/${n.from_user?.username || ''}`} className="font-bold hover:underline" onClick={() => setShowNotif(false)}>
                                {n.from_user?.display_name || 'Someone'}
                              </Link>{' '}
                              <span className="text-white/60">{message}</span>
                            </p>
                            <div className="text-[10px] text-white/20 mt-0.5">{timeAgo(n.created_at)}</div>
                            {n.type === 'friend_request' && (
                              <div className="flex gap-1.5 mt-1.5">
                                <button onClick={async () => {
                                  const supabase = createClient();
                                  try {
                                    await supabase.from('friendships').update({ status: 'accepted' }).or(`and(requester_id.eq.${n.from_user_id},addressee_id.eq.${user.id})`);
                                    await supabase.from('notifications').insert({ user_id: n.from_user_id, from_user_id: user.id, type: 'friend_accepted', content: `${profile?.display_name} accepted your friend request` });
                                    fetchNotifications();
                                    useStore.getState().showToast('Friend request accepted ✓');
                                  } catch (e) {}
                                }} className="btn-primary py-1 px-3 text-[10px]">Accept</button>
                                <button onClick={async () => {
                                  const supabase = createClient();
                                  try {
                                    await supabase.from('friendships').delete().or(`and(requester_id.eq.${n.from_user_id},addressee_id.eq.${user.id})`);
                                    fetchNotifications();
                                  } catch (e) {}
                                }} className="btn-secondary py-1 px-3 text-[10px]">Decline</button>
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* User / Auth */}
          {user ? (
            <div className="relative" ref={menuRef}>
              <button onClick={() => setShowMenu(!showMenu)} className="flex items-center gap-1.5 hover:bg-white/5 rounded-lg px-1.5 py-1 transition">
                <span className="text-2xl">{profile?.avatar_emoji || '😎'}</span>
              </button>
              {showMenu && (
                <div className="absolute top-11 right-0 w-52 glass rounded-xl p-1.5 shadow-2xl animate-slide-up">
                  <Link href={`/profile/${profile?.username}`} className="flex items-center gap-2.5 p-2.5 rounded-lg hover:bg-white/5 transition" onClick={() => setShowMenu(false)}>
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
                  <Link href={`/profile/${profile?.username}`} className="block p-2 px-3 rounded-lg hover:bg-white/5 text-sm transition" onClick={() => setShowMenu(false)}>👤 Profile</Link>
                  <Link href="/settings" className="block p-2 px-3 rounded-lg hover:bg-white/5 text-sm transition" onClick={() => setShowMenu(false)}>⚙️ Settings</Link>
                  <Link href="/bookmarks" className="block p-2 px-3 rounded-lg hover:bg-white/5 text-sm transition" onClick={() => setShowMenu(false)}>🔖 Saved</Link>
                  <div className="border-t border-white/5 my-1" />
                  <button onClick={() => { setShowMenu(false); logout(); }} className="w-full text-left p-2 px-3 rounded-lg hover:bg-red-500/10 text-red-400 text-sm transition">
                    🚪 Log Out
                  </button>
                </div>
              )}
            </div>
          ) : (
            <div className="flex gap-1.5">
              <button onClick={() => setShowAuth(true, 'login')} className="btn-secondary py-1.5 px-3 text-xs">Log In</button>
              <button onClick={() => setShowAuth(true, 'signup')} className="btn-primary py-1.5 px-3 text-xs">Join ⚡</button>
            </div>
          )}
        </div>

        {/* Mobile search dropdown */}
        {mobileSearchOpen && (
          <div className="sm:hidden px-3 pb-3 animate-slide-up">
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-white/20 text-sm">🔍</span>
              <input value={search} autoFocus
                onChange={(e) => { setSearch(e.target.value); setShowSearch(true); }}
                placeholder="Search people..."
                className="w-full pl-9 pr-4 py-2.5 rounded-xl bg-white/5 border border-white/8 text-sm text-white outline-none focus:border-[var(--accent)] transition placeholder:text-white/25"
              />
            </div>
            {searchResults.length > 0 && (
              <div className="mt-1 rounded-xl bg-white/3 p-1">
                {searchResults.slice(0, 5).map((u) => (
                  <button key={u.id} onClick={() => { router.push(`/profile/${u.username}`); setSearch(''); setMobileSearchOpen(false); }}
                    className="w-full flex items-center gap-3 p-2.5 rounded-lg hover:bg-white/5 transition text-left">
                    <span className="text-xl">{u.avatar_emoji || '😎'}</span>
                    <div>
                      <div className="font-semibold text-sm">{u.display_name}</div>
                      <div className="text-xs text-white/30">@{u.username}</div>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>
        )}
      </header>

      {/* Mobile bottom nav */}
      <div className="md:hidden fixed bottom-0 left-0 right-0 glass border-t border-white/5 z-50">
        <div className="flex justify-around py-1.5">
          {navItems.map((item) => (
            <Link key={item.href} href={item.href}
              className={`flex flex-col items-center gap-0.5 px-3 py-1 text-[10px] transition ${pathname === item.href ? 'text-[var(--accent)]' : 'text-white/35'}`}>
              <span className="text-lg">{item.icon}</span>
              <span>{item.label}</span>
            </Link>
          ))}
          {user && (
            <button onClick={() => setShowCompose(true)}
              className="flex flex-col items-center gap-0.5 px-3 py-1 text-[10px] text-white/35">
              <span className="text-lg">✏️</span>
              <span>Post</span>
            </button>
          )}
        </div>
      </div>
    </>
  );
}
