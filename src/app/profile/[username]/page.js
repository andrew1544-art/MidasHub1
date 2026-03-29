'use client';
import { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import AppShell from '@/components/AppShell';
import PostCard from '@/components/PostCard';
import { RankBadge, RankCard } from '@/components/RankBadge';
import { useStore } from '@/lib/store';
import { createClient } from '@/lib/supabase-browser';
import { sendNotification } from '@/lib/notifications';
import { PLATFORM_LIST, formatCount, timeAgo } from '@/lib/constants';
import { InlineBadges, BadgePill, BADGE_TYPES } from '@/components/Badge';

export default function ProfilePage() {
  const { username } = useParams();
  const { user, profile: myProfile, setShowAuth, showToast } = useStore();
  const [prof, setProf] = useState(null);
  const [posts, setPosts] = useState([]);
  const [reposts, setReposts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [friendStatus, setFriendStatus] = useState(null);
  const [friendshipId, setFriendshipId] = useState(null);
  const [stats, setStats] = useState({ posts: 0, friends: 0, likes: 0 });
  const [tab, setTab] = useState('posts');

  const isOwn = myProfile?.username === username;

  useEffect(() => {
    const safety = setTimeout(() => setLoading(false), 3000);
    fetchProfile().finally(() => clearTimeout(safety));
    return () => clearTimeout(safety);
  }, [username, user]);

  const fetchProfile = async () => {
    setLoading(true);
    const supabase = createClient();
    const { data: p } = await supabase.from('profiles').select('*').eq('username', username).maybeSingle();
    if (!p) { setProf(null); setLoading(false); return; }
    setProf(p);

    // Fetch posts + reposts + friend count in PARALLEL
    const [postsRes, repostRes, friendRes] = await Promise.all([
      supabase.from('posts').select('*, profiles(*)').eq('user_id', p.id).order('created_at', { ascending: false }),
      supabase.from('reposts').select('post_id, created_at').eq('user_id', p.id).order('created_at', { ascending: false }),
      supabase.from('friendships').select('*', { count: 'exact', head: true }).or(`requester_id.eq.${p.id},addressee_id.eq.${p.id}`).eq('status', 'accepted'),
    ]);

    const userPosts = postsRes.data || [];

    // Fetch reposted posts if any
    let repostedPosts = [];
    const repostIds = (repostRes.data || []).map(r => r.post_id);
    if (repostIds.length) {
      const { data: rp } = await supabase.from('posts').select('*, profiles(*)').in('id', repostIds);
      repostedPosts = (rp || []).map(post => ({ ...post, _reposted: true, _reposted_at: (repostRes.data || []).find(r => r.post_id === post.id)?.created_at }));
    }

    // Mark liked/bookmarked for current user
    if (user) {
      const allPosts = [...userPosts, ...repostedPosts];
      const ids = allPosts.map(x => x.id);
      if (ids.length) {
        const [lr, br] = await Promise.all([
          supabase.from('likes').select('post_id').eq('user_id', user.id).in('post_id', ids),
          supabase.from('bookmarks').select('post_id').eq('user_id', user.id).in('post_id', ids),
        ]);
        const liked = new Set((lr.data||[]).map(l=>l.post_id));
        const bkd = new Set((br.data||[]).map(b=>b.post_id));
        allPosts.forEach(x => { x.user_liked = liked.has(x.id); x.user_bookmarked = bkd.has(x.id); });
      }
    }

    setPosts(userPosts);
    setReposts(repostedPosts);
    setStats({ posts: userPosts.length, friends: friendRes.count || 0, likes: userPosts.reduce((s,x)=>s+(x.likes_count||0),0), reposts: repostedPosts.length });

    if (user && user.id !== p.id) {
      const { data: ship } = await supabase.from('friendships').select('*').or(`and(requester_id.eq.${user.id},addressee_id.eq.${p.id}),and(requester_id.eq.${p.id},addressee_id.eq.${user.id})`).maybeSingle();
      if (ship) {
        setFriendshipId(ship.id);
        setFriendStatus(ship.status === 'accepted' ? 'friends' : ship.requester_id === user.id ? 'pending_sent' : 'pending_received');
      } else { setFriendStatus('none'); }
    }
    setLoading(false);
  };

  const handleFriend = async () => {
    if (!user) return setShowAuth(true);
    const supabase = createClient();
    if (friendStatus === 'none') {
      const { data } = await supabase.from('friendships').insert({ requester_id: user.id, addressee_id: prof.id }).select().single();
      if (data) { setFriendStatus('pending_sent'); setFriendshipId(data.id);
        sendNotification({ toUserId: prof.id, fromUserId: user.id, type: 'friend_request', content: 'sent you a friend request 👋' });
        showToast('Friend request sent ✓');
      }
    } else if (friendStatus === 'pending_received') {
      await supabase.from('friendships').update({ status: 'accepted' }).eq('id', friendshipId);
      setFriendStatus('friends');
      showToast('Friend request accepted ✓');
    } else if (friendStatus === 'friends' || friendStatus === 'pending_sent') {
      await supabase.from('friendships').delete().eq('id', friendshipId);
      setFriendStatus('none'); setFriendshipId(null);
    }
  };

  const socialLinks = prof ? PLATFORM_LIST.filter(([k]) => prof[`link_${k}`]).map(([k, p]) => ({ key: k, ...p, url: prof[`link_${k}`] })) : [];

  if (loading) {
    return <AppShell><div className="max-w-2xl mx-auto px-4 py-10 text-center">
      <div className="w-16 h-16 rounded-full skeleton mx-auto mb-4"/><div className="h-5 w-32 skeleton mx-auto mb-2"/><div className="h-4 w-20 skeleton mx-auto"/>
    </div></AppShell>;
  }

  if (!prof) {
    return <AppShell><div className="max-w-2xl mx-auto px-4 py-20 text-center">
      <div className="text-6xl mb-4">🤷</div><h2 className="text-2xl font-bold mb-2">User not found</h2>
      <p className="text-white/30 mb-6">@{username} doesn&apos;t exist</p>
      <Link href="/people" className="btn-primary inline-block px-6 py-3">Browse People</Link>
    </div></AppShell>;
  }

  return (
    <AppShell>
      <div className="max-w-2xl mx-auto px-3 sm:px-4 py-4 sm:py-6">
        {/* Profile card */}
        <div className="glass-light rounded-2xl p-6 sm:p-8 mb-6 animate-slide-up">
          <div className="text-center">
            <div className="text-6xl sm:text-7xl mb-3">{prof.avatar_emoji || '😎'}</div>
            <h1 className="text-2xl font-black flex items-center justify-center gap-1.5">{prof.display_name} <InlineBadges profile={prof} /></h1>
            <p className="text-white/30 text-sm">@{prof.username}</p>
            {prof.is_suspended && <div className="mt-2 px-3 py-1.5 rounded-full bg-red-500/15 text-red-400 text-xs font-bold border border-red-500/30">⛔ Account Suspended</div>}
            <div className="flex justify-center gap-2 mt-2 flex-wrap">
              <RankBadge xp={prof.xp || 0} size="md" />
              {prof.is_verified && <BadgePill type="verified" />}
              {prof.trade_count >= 2 && <BadgePill type="trader" />}
              {(() => {
                try {
                  const custom = typeof prof.badges === 'string' ? JSON.parse(prof.badges) : prof.badges;
                  if (Array.isArray(custom)) return custom.filter(b => b !== 'verified' && b !== 'trader').map(b => <BadgePill key={b} type={b} />);
                } catch(e) {}
                return null;
              })()}
            </div>
            {prof.bio && <p className="text-white/50 text-sm mt-3 max-w-sm mx-auto leading-relaxed">{prof.bio}</p>}
            {prof.location && <p className="text-white/20 text-xs mt-2">📍 {prof.location}</p>}

            {/* Stats */}
            <div className="flex justify-center gap-8 mt-6">
              {[
                { val: formatCount(stats.posts), label: 'Posts' },
                { val: formatCount(stats.friends), label: 'Friends' },
                { val: formatCount(stats.likes), label: 'Likes' },
                { val: formatCount(prof.xp || 0), label: 'XP' },
                { val: prof.total_reviews ? `${parseFloat(prof.trade_rating || 0).toFixed(1)}⭐` : '—', label: `${prof.total_reviews || 0} Reviews` },
              ].map((s, i) => (
                <div key={i} className="text-center">
                  <div className="font-black text-xl">{s.val}</div>
                  <div className="text-[11px] text-white/25 mt-0.5">{s.label}</div>
                </div>
              ))}
            </div>

            {/* Social links */}
            {socialLinks.length > 0 && (
              <div className="flex justify-center gap-2 mt-5 flex-wrap">
                {socialLinks.map(l => (
                  <a key={l.key} href={l.url} target="_blank" rel="noopener noreferrer"
                    className="platform-pill px-3 py-1.5 rounded-lg text-xs" style={{ background: `${l.color}18`, color: l.color }}>
                    {l.icon} {l.name} ↗
                  </a>
                ))}
              </div>
            )}

            {/* Actions */}
            {!isOwn && (
              <div className="flex justify-center gap-3 mt-6">
                <button onClick={handleFriend}
                  className={`px-6 py-2.5 rounded-xl text-sm font-semibold transition ${
                    friendStatus === 'friends' ? 'bg-green-500/10 text-green-400' :
                    friendStatus === 'pending_sent' ? 'bg-white/5 text-white/25' :
                    friendStatus === 'pending_received' ? 'btn-primary' : 'btn-primary'
                  }`}>
                  {friendStatus === 'friends' ? '✓ Friends' : friendStatus === 'pending_sent' ? '⏳ Pending' : friendStatus === 'pending_received' ? 'Accept Request' : '+ Add Friend'}
                </button>
                <Link href={`/chat?user=${prof.id}`} className="btn-secondary px-6 py-2.5 text-sm">💬 Message</Link>
              </div>
            )}
            {isOwn && <Link href="/settings" className="inline-block mt-6 btn-secondary px-6 py-2.5 text-sm">⚙️ Edit Profile</Link>}
          </div>
        </div>

        {/* Rank Card */}
        <div className="mb-6">
          <RankCard xp={prof.xp || 0} />
        </div>

        {/* Tabs */}
        <div className="flex gap-2 mb-5">
          {[{ key: 'posts', label: `📝 Posts (${posts.length})` }, { key: 'reposts', label: `🔄 Reposts (${reposts.length})` }, { key: 'viral', label: '🔥 Viral' }].map(t => (
            <button key={t.key} onClick={() => setTab(t.key)}
              className={`platform-pill px-4 py-2 rounded-xl text-sm ${tab === t.key ? 'bg-white/10 text-white font-bold' : 'bg-white/4 text-white/35'}`}>
              {t.label}
            </button>
          ))}
        </div>

        {/* Posts */}
        <div className="space-y-3">
          {tab === 'posts' && (
            posts.length === 0 ? <div className="text-center py-16 text-white/20 text-sm">No posts yet</div>
            : posts.map(post => <PostCard key={post.id} post={post} onPostUpdated={fetchProfile}/>)
          )}
          {tab === 'reposts' && (
            reposts.length === 0 ? <div className="text-center py-16 text-white/20 text-sm">No reposts yet</div>
            : reposts.map(post => (
              <div key={`rp-${post.id}`}>
                <div className="text-xs text-white/25 mb-1.5 pl-1">🔄 {prof?.display_name} reposted · {timeAgo(post._reposted_at)}</div>
                <PostCard post={post} onPostUpdated={fetchProfile}/>
              </div>
            ))
          )}
          {tab === 'viral' && (
            posts.filter(p => p.is_viral).length === 0 ? <div className="text-center py-16 text-white/20 text-sm">No viral posts yet</div>
            : posts.filter(p => p.is_viral).map(post => <PostCard key={post.id} post={post} onPostUpdated={fetchProfile}/>)
          )}
        </div>
      </div>
    </AppShell>
  );
}
