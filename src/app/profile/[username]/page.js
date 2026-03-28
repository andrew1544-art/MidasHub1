'use client';
import { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import AppShell from '@/components/AppShell';
import PostCard from '@/components/PostCard';
import { useStore } from '@/lib/store';
import { createClient } from '@/lib/supabase-browser';
import { PLATFORM_LIST, formatCount } from '@/lib/constants';

export default function ProfilePage() {
  const { username } = useParams();
  const { user, profile: myProfile, setShowAuth, showToast } = useStore();
  const [profileData, setProfileData] = useState(null);
  const [posts, setPosts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [friendStatus, setFriendStatus] = useState(null);
  const [friendshipId, setFriendshipId] = useState(null);
  const [stats, setStats] = useState({ posts: 0, friends: 0, likes: 0 });
  const [tab, setTab] = useState('posts');
  const isOwnProfile = myProfile?.username === username;

  useEffect(() => { fetchProfile(); }, [username, user]);

  const fetchProfile = async () => {
    setLoading(true);
    const supabase = createClient();
    const { data: prof } = await supabase.from('profiles').select('*').eq('username', username).single();
    if (!prof) { setProfileData(null); setLoading(false); return; }
    setProfileData(prof);

    const { data: userPosts } = await supabase.from('posts').select('*, profiles(*)').eq('user_id', prof.id).order('created_at', { ascending: false });
    if (user && userPosts?.length) {
      const ids = userPosts.map((p) => p.id);
      const [lr, br] = await Promise.all([
        supabase.from('likes').select('post_id').eq('user_id', user.id).in('post_id', ids),
        supabase.from('bookmarks').select('post_id').eq('user_id', user.id).in('post_id', ids),
      ]);
      const liked = new Set((lr.data || []).map((l) => l.post_id));
      const bm = new Set((br.data || []).map((b) => b.post_id));
      userPosts.forEach((p) => { p.user_liked = liked.has(p.id); p.user_bookmarked = bm.has(p.id); });
    }
    setPosts(userPosts || []);

    const { count: fc } = await supabase.from('friendships').select('*', { count: 'exact', head: true }).or(`requester_id.eq.${prof.id},addressee_id.eq.${prof.id}`).eq('status', 'accepted');
    setStats({ posts: (userPosts || []).length, friends: fc || 0, likes: (userPosts || []).reduce((s, p) => s + (p.likes_count || 0), 0) });

    if (user && user.id !== prof.id) {
      const { data: f } = await supabase.from('friendships').select('*').or(`and(requester_id.eq.${user.id},addressee_id.eq.${prof.id}),and(requester_id.eq.${prof.id},addressee_id.eq.${user.id})`).single();
      if (f) { setFriendshipId(f.id); setFriendStatus(f.status === 'accepted' ? 'friends' : f.requester_id === user.id ? 'pending_sent' : 'pending_received'); }
      else { setFriendStatus('none'); }
    }
    setLoading(false);
  };

  const handleFriendAction = async () => {
    if (!user) return setShowAuth(true);
    const supabase = createClient();
    if (friendStatus === 'none') {
      const { data } = await supabase.from('friendships').insert({ requester_id: user.id, addressee_id: profileData.id }).select().single();
      if (data) { setFriendStatus('pending_sent'); setFriendshipId(data.id); await supabase.from('notifications').insert({ user_id: profileData.id, from_user_id: user.id, type: 'friend_request' }); showToast('Request sent ✓'); }
    } else if (friendStatus === 'pending_received') {
      await supabase.from('friendships').update({ status: 'accepted' }).eq('id', friendshipId);
      setFriendStatus('friends'); showToast('Friend added! 🤝');
    } else if (friendStatus === 'friends' || friendStatus === 'pending_sent') {
      await supabase.from('friendships').delete().eq('id', friendshipId);
      setFriendStatus('none'); setFriendshipId(null);
    }
  };

  const socialLinks = profileData ? PLATFORM_LIST.filter(([key]) => profileData[`link_${key}`]).map(([key, p]) => ({ key, ...p, url: profileData[`link_${key}`] })) : [];

  if (loading) return <AppShell><div className="max-w-2xl mx-auto px-4 py-8 text-center"><div className="w-16 h-16 rounded-full skeleton mx-auto mb-3" /><div className="h-5 w-32 skeleton mx-auto mb-2" /><div className="h-4 w-20 skeleton mx-auto" /></div></AppShell>;
  if (!profileData) return <AppShell><div className="max-w-2xl mx-auto px-4 py-16 text-center"><div className="text-5xl mb-3">🤷</div><h2 className="text-xl font-bold mb-2">User not found</h2><p className="text-white/30">@{username} doesn't exist</p><Link href="/people" className="btn-primary inline-block mt-4">Browse People</Link></div></AppShell>;

  return (
    <AppShell>
      <div className="max-w-2xl mx-auto px-3 sm:px-4 py-4 sm:py-6">
        <div className="glass-light rounded-2xl p-5 mb-5 text-center animate-slide-up">
          <div className="text-5xl sm:text-6xl mb-2">{profileData.avatar_emoji || '😎'}</div>
          <h1 className="text-xl sm:text-2xl font-black">{profileData.display_name}</h1>
          <p className="text-white/30 text-sm">@{profileData.username}</p>
          {profileData.bio && <p className="text-white/50 text-sm mt-2 max-w-md mx-auto">{profileData.bio}</p>}
          {profileData.location && <p className="text-white/20 text-xs mt-1">📍 {profileData.location}</p>}

          <div className="flex justify-center gap-6 sm:gap-8 mt-4">
            {[{ n: stats.posts, l: 'Posts' }, { n: stats.friends, l: 'Friends' }, { n: stats.likes, l: 'Likes' }].map((s) => (
              <div key={s.l} className="text-center"><div className="font-bold text-lg">{formatCount(s.n)}</div><div className="text-[11px] text-white/25">{s.l}</div></div>
            ))}
          </div>

          {socialLinks.length > 0 && (
            <div className="flex justify-center gap-1.5 mt-3 flex-wrap">
              {socialLinks.map((l) => <a key={l.key} href={l.url} target="_blank" rel="noopener noreferrer" className="platform-pill px-2.5 py-1 rounded-lg text-[11px]" style={{ background: `${l.color}18`, color: l.color }}>{l.icon} {l.name} ↗</a>)}
            </div>
          )}

          {!isOwnProfile && (
            <div className="flex justify-center gap-2 mt-4">
              <button onClick={handleFriendAction} className={`px-5 py-2 rounded-xl text-sm font-semibold transition ${friendStatus === 'friends' ? 'bg-white/5 text-cyan-400 hover:bg-red-500/10 hover:text-red-400' : friendStatus === 'pending_sent' ? 'bg-white/5 text-white/25' : 'btn-primary'}`}>
                {friendStatus === 'friends' ? '✓ Friends' : friendStatus === 'pending_sent' ? '⏳ Pending' : friendStatus === 'pending_received' ? 'Accept' : '+ Add Friend'}
              </button>
              <Link href={`/chat?user=${profileData.id}`} className="px-5 py-2 rounded-xl text-sm font-semibold bg-white/5 border border-white/8 hover:bg-white/10 transition">💬 Message</Link>
            </div>
          )}
          {isOwnProfile && <Link href="/settings" className="inline-block mt-4 px-5 py-2 rounded-xl text-sm font-semibold bg-white/5 border border-white/8 hover:bg-white/10 transition">⚙️ Edit Profile</Link>}
        </div>

        <div className="flex gap-1.5 mb-4">
          {[{ key: 'posts', label: '📝 Posts' }, { key: 'viral', label: '🔥 Viral' }].map((t) => (
            <button key={t.key} onClick={() => setTab(t.key)} className={`platform-pill px-3 py-1.5 rounded-xl text-sm ${tab === t.key ? 'bg-white/10 text-white font-bold' : 'bg-white/4 text-white/35'}`}>{t.label}</button>
          ))}
        </div>

        <div className="space-y-3">
          {(tab === 'viral' ? posts.filter((p) => p.is_viral) : posts).length === 0 ? (
            <div className="text-center py-10 text-white/20 text-sm">{tab === 'viral' ? 'No viral posts yet' : 'No posts yet'}</div>
          ) : (tab === 'viral' ? posts.filter((p) => p.is_viral) : posts).map((post) => <PostCard key={post.id} post={post} />)}
        </div>
      </div>
    </AppShell>
  );
}
