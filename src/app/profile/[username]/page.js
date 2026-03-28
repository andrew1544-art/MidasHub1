'use client';
import { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import AppShell from '@/components/AppShell';
import PostCard from '@/components/PostCard';
import { useStore } from '@/lib/store';
import { createClient } from '@/lib/supabase-browser';
import { PLATFORMS, PLATFORM_LIST, formatCount, timeAgo } from '@/lib/constants';

export default function ProfilePage() {
  const { username } = useParams();
  const { user, profile: myProfile, setShowAuth } = useStore();
  const [profileData, setProfileData] = useState(null);
  const [posts, setPosts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [friendStatus, setFriendStatus] = useState(null); // null | 'friends' | 'pending_sent' | 'pending_received' | 'none'
  const [friendshipId, setFriendshipId] = useState(null);
  const [stats, setStats] = useState({ posts: 0, friends: 0, likes: 0 });
  const [tab, setTab] = useState('posts');

  const isOwnProfile = myProfile?.username === username;

  useEffect(() => {
    fetchProfile();
  }, [username, user]);

  const fetchProfile = async () => {
    setLoading(true);
    const supabase = createClient();

    // Get profile
    const { data: prof } = await supabase
      .from('profiles')
      .select('*')
      .eq('username', username)
      .single();

    if (!prof) {
      setProfileData(null);
      setLoading(false);
      return;
    }
    setProfileData(prof);

    // Get posts
    const { data: userPosts } = await supabase
      .from('posts')
      .select('*, profiles(*)')
      .eq('user_id', prof.id)
      .order('created_at', { ascending: false });

    // Add user interactions
    if (user && userPosts) {
      const postIds = userPosts.map((p) => p.id);
      if (postIds.length > 0) {
        const [likesRes, bookmarksRes] = await Promise.all([
          supabase.from('likes').select('post_id').eq('user_id', user.id).in('post_id', postIds),
          supabase.from('bookmarks').select('post_id').eq('user_id', user.id).in('post_id', postIds),
        ]);
        const likedIds = new Set((likesRes.data || []).map((l) => l.post_id));
        const bookmarkedIds = new Set((bookmarksRes.data || []).map((b) => b.post_id));
        userPosts.forEach((p) => {
          p.user_liked = likedIds.has(p.id);
          p.user_bookmarked = bookmarkedIds.has(p.id);
        });
      }
    }
    setPosts(userPosts || []);

    // Get stats
    const { count: friendCount } = await supabase
      .from('friendships')
      .select('*', { count: 'exact', head: true })
      .or(`requester_id.eq.${prof.id},addressee_id.eq.${prof.id}`)
      .eq('status', 'accepted');

    const totalLikes = (userPosts || []).reduce((sum, p) => sum + (p.likes_count || 0), 0);

    setStats({
      posts: (userPosts || []).length,
      friends: friendCount || 0,
      likes: totalLikes,
    });

    // Check friendship
    if (user && user.id !== prof.id) {
      const { data: friendship } = await supabase
        .from('friendships')
        .select('*')
        .or(
          `and(requester_id.eq.${user.id},addressee_id.eq.${prof.id}),and(requester_id.eq.${prof.id},addressee_id.eq.${user.id})`
        )
        .single();

      if (friendship) {
        setFriendshipId(friendship.id);
        if (friendship.status === 'accepted') setFriendStatus('friends');
        else if (friendship.requester_id === user.id) setFriendStatus('pending_sent');
        else setFriendStatus('pending_received');
      } else {
        setFriendStatus('none');
      }
    }

    setLoading(false);
  };

  const handleFriendAction = async () => {
    if (!user) return setShowAuth(true);
    const supabase = createClient();

    if (friendStatus === 'none') {
      const { data } = await supabase.from('friendships').insert({
        requester_id: user.id,
        addressee_id: profileData.id,
      }).select().single();
      if (data) {
        setFriendStatus('pending_sent');
        setFriendshipId(data.id);
        await supabase.from('notifications').insert({
          user_id: profileData.id,
          from_user_id: user.id,
          type: 'friend_request',
        });
      }
    } else if (friendStatus === 'pending_received') {
      await supabase.from('friendships').update({ status: 'accepted' }).eq('id', friendshipId);
      setFriendStatus('friends');
      await supabase.from('notifications').insert({
        user_id: profileData.id,
        from_user_id: user.id,
        type: 'friend_accepted',
      });
    } else if (friendStatus === 'friends' || friendStatus === 'pending_sent') {
      await supabase.from('friendships').delete().eq('id', friendshipId);
      setFriendStatus('none');
      setFriendshipId(null);
    }
  };

  // Social link buttons
  const socialLinks = profileData ? PLATFORM_LIST
    .filter(([key]) => profileData[`link_${key}`])
    .map(([key, p]) => ({
      key,
      ...p,
      url: profileData[`link_${key}`],
    })) : [];

  if (loading) {
    return (
      <AppShell>
        <div className="max-w-2xl mx-auto px-4 py-10">
          <div className="text-center">
            <div className="w-20 h-20 rounded-full skeleton mx-auto mb-4" />
            <div className="h-6 w-40 rounded skeleton mx-auto mb-2" />
            <div className="h-4 w-24 rounded skeleton mx-auto" />
          </div>
        </div>
      </AppShell>
    );
  }

  if (!profileData) {
    return (
      <AppShell>
        <div className="max-w-2xl mx-auto px-4 py-20 text-center">
          <div className="text-6xl mb-4">🤷</div>
          <h2 className="text-2xl font-bold mb-2">User not found</h2>
          <p className="text-white/40">@{username} doesn&apos;t exist on MidasHub</p>
          <Link href="/people" className="btn-primary inline-block mt-6">Browse People</Link>
        </div>
      </AppShell>
    );
  }

  return (
    <AppShell>
      <div className="max-w-2xl mx-auto px-4 py-6">
        {/* Profile header */}
        <div className="glass-light rounded-2xl p-6 mb-6 text-center animate-slide-up">
          <div className="text-6xl mb-3">{profileData.avatar_emoji || '😎'}</div>
          <h1 className="text-2xl font-black">{profileData.display_name}</h1>
          <p className="text-white/40 text-sm">@{profileData.username}</p>

          {profileData.bio && (
            <p className="text-white/60 text-sm mt-3 max-w-md mx-auto">{profileData.bio}</p>
          )}

          {profileData.location && (
            <p className="text-white/30 text-xs mt-2">📍 {profileData.location}</p>
          )}

          {/* Stats */}
          <div className="flex justify-center gap-8 mt-5">
            <div className="text-center">
              <div className="font-bold text-lg">{formatCount(stats.posts)}</div>
              <div className="text-xs text-white/30">Posts</div>
            </div>
            <div className="text-center">
              <div className="font-bold text-lg">{formatCount(stats.friends)}</div>
              <div className="text-xs text-white/30">Friends</div>
            </div>
            <div className="text-center">
              <div className="font-bold text-lg">{formatCount(stats.likes)}</div>
              <div className="text-xs text-white/30">Likes</div>
            </div>
          </div>

          {/* Social links */}
          {socialLinks.length > 0 && (
            <div className="flex justify-center gap-2 mt-4 flex-wrap">
              {socialLinks.map((link) => (
                <a key={link.key} href={link.url} target="_blank" rel="noopener noreferrer"
                  className="platform-pill px-3 py-1.5 rounded-lg text-xs"
                  style={{ background: `${link.color}22`, color: link.color }}
                >
                  {link.icon} {link.name} ↗
                </a>
              ))}
            </div>
          )}

          {/* Actions */}
          {!isOwnProfile && (
            <div className="flex justify-center gap-3 mt-5">
              <button onClick={handleFriendAction}
                className={`px-6 py-2.5 rounded-xl text-sm font-semibold transition ${
                  friendStatus === 'friends' ? 'bg-cyan-500/15 text-cyan-400 hover:bg-red-500/15 hover:text-red-400' :
                  friendStatus === 'pending_sent' ? 'bg-white/5 text-white/30' :
                  friendStatus === 'pending_received' ? 'btn-primary' :
                  'btn-primary'
                }`}
              >
                {friendStatus === 'friends' ? '✓ Friends' :
                 friendStatus === 'pending_sent' ? '⏳ Pending' :
                 friendStatus === 'pending_received' ? 'Accept Request' :
                 '+ Add Friend'}
              </button>
              <Link href={`/chat?user=${profileData.id}`}
                className="px-6 py-2.5 rounded-xl text-sm font-semibold bg-white/5 border border-white/10 hover:bg-white/10 transition"
              >
                💬 Message
              </Link>
            </div>
          )}

          {isOwnProfile && (
            <Link href="/settings"
              className="inline-block mt-5 px-6 py-2.5 rounded-xl text-sm font-semibold bg-white/5 border border-white/10 hover:bg-white/10 transition"
            >
              ⚙️ Edit Profile
            </Link>
          )}
        </div>

        {/* Tabs */}
        <div className="flex gap-2 mb-6">
          {[
            { key: 'posts', label: '📝 Posts' },
            { key: 'viral', label: '🔥 Viral Posts' },
          ].map((t) => (
            <button key={t.key} onClick={() => setTab(t.key)}
              className={`platform-pill px-4 py-2 rounded-xl text-sm ${tab === t.key ? 'bg-white/12 text-white font-bold' : 'bg-white/4 text-white/40'}`}
            >
              {t.label}
            </button>
          ))}
        </div>

        {/* Posts */}
        <div className="space-y-4">
          {(tab === 'viral' ? posts.filter((p) => p.is_viral) : posts).length === 0 ? (
            <div className="text-center py-12 text-white/30 text-sm">
              {tab === 'viral' ? 'No viral posts yet' : 'No posts yet'}
            </div>
          ) : (
            (tab === 'viral' ? posts.filter((p) => p.is_viral) : posts).map((post) => (
              <PostCard key={post.id} post={post} />
            ))
          )}
        </div>
      </div>
    </AppShell>
  );
}
