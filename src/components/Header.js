'use client';
import { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useStore } from '@/lib/store';
import { formatCount, timeAgo } from '@/lib/constants';
import { createClient } from '@/lib/supabase-browser';

export default function Header() {
  const pathname = usePathname();
  const router = useRouter();
  const { user, profile, unreadCount, notifications, showAuth, setShowAuth, logout, fetchNotifications, markNotificationsRead, setShowCompose } = useStore();
  const [showNotif, setShowNotif] = useState(false);
  const [showMenu, setShowMenu] = useState(false);
  const [search, setSearch] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [showSearch, setShowSearch] = useState(false);
  const notifRef = useRef(null);
  const menuRef = useRef(null);

  useEffect(() => {
    if (user) fetchNotifications();
  }, [user]);

  // Subscribe to real-time notifications
  useEffect(() => {
    if (!user) return;
    const supabase = createClient();
    const channel = supabase
      .channel('notifications')
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'notifications',
        filter: `user_id=eq.${user.id}`,
      }, () => {
        fetchNotifications();
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [user]);

  // Search users
  useEffect(() => {
    if (!search.trim()) { setSearchResults([]); return; }
    const timeout = setTimeout(async () => {
      const supabase = createClient();
      const { data } = await supabase
        .from('profiles')
        .select('id, username, display_name, avatar_emoji')
        .or(`username.ilike.%${search}%,display_name.ilike.%${search}%`)
        .limit(6);
      setSearchResults(data || []);
    }, 300);
    return () => clearTimeout(timeout);
  }, [search]);

  // Close dropdowns on outside click
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
    { href: '/chat', icon: '💬', label: 'Chat' },
  ];

  return (
    <header className="sticky top-0 z-50 glass">
      <div className="max-w-5xl mx-auto flex items-center h-16 px-4 gap-3">
        {/* Logo */}
        <Link href={user ? '/feed' : '/'} className="flex items-center gap-2.5 shrink-0 group">
          <div className="w-9 h-9 rounded-xl midas-gradient flex items-center justify-center text-lg animate-glow">
            ⚡
          </div>
          <span className="text-xl font-extrabold gold-gradient hidden sm:block">
            MIDASHUB
          </span>
        </Link>

        {/* Search */}
        <div className="flex-1 max-w-md relative">
          <input
            value={search}
            onChange={(e) => { setSearch(e.target.value); setShowSearch(true); }}
            onFocus={() => setShowSearch(true)}
            onBlur={() => setTimeout(() => setShowSearch(false), 200)}
            placeholder="Search people, posts..."
            className="input-field w-full pl-10 py-2.5 text-sm"
          />
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-white/30 text-sm">🔍</span>

          {showSearch && searchResults.length > 0 && (
            <div className="absolute top-full mt-2 w-full glass rounded-xl p-2 shadow-2xl">
              {searchResults.map((u) => (
                <button key={u.id}
                  onClick={() => { router.push(`/profile/${u.username}`); setSearch(''); setShowSearch(false); }}
                  className="w-full flex items-center gap-3 p-2.5 rounded-lg hover:bg-white/5 transition text-left"
                >
                  <span className="text-2xl">{u.avatar_emoji}</span>
                  <div>
                    <div className="font-semibold text-sm">{u.display_name}</div>
                    <div className="text-xs text-white/40">@{u.username}</div>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Nav */}
        <nav className="hidden md:flex gap-1">
          {navItems.map((item) => (
            <Link key={item.href} href={item.href}
              className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium transition-all ${
                pathname === item.href ? 'bg-white/10 text-yellow-400' : 'text-white/50 hover:text-white/80 hover:bg-white/5'
              }`}
            >
              <span>{item.icon}</span>
              <span className="hidden lg:block">{item.label}</span>
            </Link>
          ))}
        </nav>

        {/* Post button */}
        {user && (
          <button onClick={() => setShowCompose(true)} className="btn-primary py-2 px-4 text-xs hidden sm:block">
            ✏️ Post
          </button>
        )}

        {/* Notifications */}
        {user && (
          <div className="relative" ref={notifRef}>
            <button onClick={() => { setShowNotif(!showNotif); if (!showNotif) markNotificationsRead(); }}
              className="w-9 h-9 rounded-lg bg-white/5 flex items-center justify-center text-lg relative hover:bg-white/10 transition"
            >
              🔔
              {unreadCount > 0 && (
                <span className="absolute -top-1 -right-1 w-5 h-5 rounded-full bg-red-500 text-[10px] font-bold flex items-center justify-center animate-pulse-slow">
                  {unreadCount > 9 ? '9+' : unreadCount}
                </span>
              )}
            </button>

            {showNotif && (
              <div className="absolute top-12 right-0 w-80 glass rounded-xl p-2 shadow-2xl animate-slide-up">
                <div className="px-3 py-2 text-sm font-bold border-b border-white/5 mb-1">Notifications</div>
                {notifications.length === 0 ? (
                  <div className="p-6 text-center text-white/30 text-sm">No notifications yet</div>
                ) : notifications.slice(0, 10).map((n) => (
                  <div key={n.id} className={`p-3 rounded-lg text-sm transition cursor-pointer ${!n.is_read ? 'bg-yellow-500/5' : 'hover:bg-white/5'}`}>
                    <div className="flex items-center gap-2">
                      {n.from_user && <span className="text-xl">{n.from_user.avatar_emoji}</span>}
                      <div className="flex-1">
                        <span>{n.content || `${n.from_user?.display_name || 'Someone'} ${n.type === 'like' ? 'liked your post' : n.type === 'comment' ? 'commented on your post' : n.type === 'friend_request' ? 'sent you a friend request' : n.type === 'friend_accepted' ? 'accepted your friend request' : n.type === 'viral' ? '🔥 Your post went viral!' : ''}`}</span>
                      </div>
                    </div>
                    <div className="text-[11px] text-white/30 mt-1">{timeAgo(n.created_at)}</div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* User menu or auth buttons */}
        {user ? (
          <div className="relative" ref={menuRef}>
            <button onClick={() => setShowMenu(!showMenu)}
              className="flex items-center gap-2 hover:bg-white/5 rounded-lg px-2 py-1 transition"
            >
              <span className="text-2xl">{profile?.avatar_emoji || '😎'}</span>
              <span className="text-sm font-semibold hidden sm:block">{profile?.display_name?.split(' ')[0]}</span>
            </button>

            {showMenu && (
              <div className="absolute top-12 right-0 w-56 glass rounded-xl p-2 shadow-2xl animate-slide-up">
                <Link href={`/profile/${profile?.username}`}
                  className="flex items-center gap-3 p-3 rounded-lg hover:bg-white/5 transition"
                  onClick={() => setShowMenu(false)}
                >
                  <span className="text-2xl">{profile?.avatar_emoji}</span>
                  <div>
                    <div className="font-semibold text-sm">{profile?.display_name}</div>
                    <div className="text-xs text-white/40">@{profile?.username}</div>
                  </div>
                </Link>
                <div className="border-t border-white/5 my-1" />
                <Link href={`/profile/${profile?.username}`} className="block p-2.5 px-3 rounded-lg hover:bg-white/5 text-sm transition" onClick={() => setShowMenu(false)}>
                  👤 My Profile
                </Link>
                <Link href="/settings" className="block p-2.5 px-3 rounded-lg hover:bg-white/5 text-sm transition" onClick={() => setShowMenu(false)}>
                  ⚙️ Settings
                </Link>
                <Link href="/bookmarks" className="block p-2.5 px-3 rounded-lg hover:bg-white/5 text-sm transition" onClick={() => setShowMenu(false)}>
                  🔖 Bookmarks
                </Link>
                <div className="border-t border-white/5 my-1" />
                <button onClick={() => { logout(); setShowMenu(false); router.push('/'); }}
                  className="w-full text-left p-2.5 px-3 rounded-lg hover:bg-red-500/10 text-red-400 text-sm transition"
                >
                  🚪 Log Out
                </button>
              </div>
            )}
          </div>
        ) : (
          <div className="flex gap-2">
            <button onClick={() => setShowAuth(true, 'login')} className="btn-secondary py-2 px-4 text-xs">
              Log In
            </button>
            <button onClick={() => setShowAuth(true, 'signup')} className="btn-primary py-2 px-4 text-xs">
              Join Free ⚡
            </button>
          </div>
        )}

        {/* Mobile nav */}
        <div className="md:hidden fixed bottom-0 left-0 right-0 glass border-t border-white/5 flex justify-around py-2 z-50">
          {navItems.map((item) => (
            <Link key={item.href} href={item.href}
              className={`flex flex-col items-center gap-0.5 px-3 py-1 text-xs ${
                pathname === item.href ? 'text-yellow-400' : 'text-white/40'
              }`}
            >
              <span className="text-lg">{item.icon}</span>
              <span>{item.label}</span>
            </Link>
          ))}
          {user && (
            <button onClick={() => setShowCompose(true)} className="flex flex-col items-center gap-0.5 px-3 py-1 text-xs text-white/40">
              <span className="text-lg">✏️</span>
              <span>Post</span>
            </button>
          )}
        </div>
      </div>
    </header>
  );
}
