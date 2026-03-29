'use client';
import { Suspense, useState, useEffect, useCallback, useRef } from 'react';
import { useSearchParams } from 'next/navigation';
import AppShell from '@/components/AppShell';
import PostCard from '@/components/PostCard';
import { useStore } from '@/lib/store';
import { createClient } from '@/lib/supabase-browser';
import { PLATFORM_LIST } from '@/lib/constants';

function FeedInner() {
  const { user, profile, setShowAuth, setShowCompose } = useStore();
  const searchParams = useSearchParams();
  const [posts, setPosts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('all');
  const [hasMore, setHasMore] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const PAGE_SIZE = 20;
  const pageRef = useRef(0);
  const hasMoreRef = useRef(true);
  const loadingMoreRef = useRef(false);

  const fetchPosts = useCallback(async (pageNum = 0, append = false) => {
    try {
      const supabase = createClient();
      let query = supabase.from('posts').select('*, profiles(*)').order('created_at', { ascending: false }).range(pageNum * PAGE_SIZE, (pageNum + 1) * PAGE_SIZE - 1);
      if (filter !== 'all') query = query.eq('source_platform', filter);
      // Non-logged-in users only see public posts
      if (!user) query = query.eq('is_public', true);
      const { data, error } = await query;
      if (error) { console.error('Feed error:', error); setLoading(false); setLoadingMore(false); loadingMoreRef.current = false; return; }
      if (data) {
        if (user) {
          const ids = data.map(p => p.id);
          if (ids.length) {
            const [lr, br, rr] = await Promise.all([
              supabase.from('likes').select('post_id').eq('user_id', user.id).in('post_id', ids),
              supabase.from('bookmarks').select('post_id').eq('user_id', user.id).in('post_id', ids),
              supabase.from('reposts').select('post_id').eq('user_id', user.id).in('post_id', ids),
            ]);
            const liked = new Set((lr.data||[]).map(l=>l.post_id));
            const bk = new Set((br.data||[]).map(b=>b.post_id));
            const rp = new Set((rr.data||[]).map(r=>r.post_id));
            data.forEach(p => { p.user_liked = liked.has(p.id); p.user_bookmarked = bk.has(p.id); p.user_reposted = rp.has(p.id); });
          }
        }
        append ? setPosts(prev => [...prev, ...data]) : setPosts(data);
        const more = data.length === PAGE_SIZE;
        setHasMore(more); hasMoreRef.current = more;
      }
    } catch (e) { console.error('Feed exception:', e); }
    setLoading(false); setLoadingMore(false); loadingMoreRef.current = false;
  }, [filter, user]);

  // Load on filter change
  // Load posts with safety timeout
  useEffect(() => {
    setLoading(true); pageRef.current = 0;
    const safety = setTimeout(() => setLoading(false), 3000);
    fetchPosts(0).finally(() => clearTimeout(safety));
    return () => clearTimeout(safety);
  }, [filter, fetchPosts]);

  // Detect password reset redirect
  useEffect(() => {
    if (searchParams.get('reset') === 'true' && user) {
      setShowAuth(true, 'reset');
      window.history.replaceState({}, '', '/feed');
    }
  }, [searchParams, user]);

  // Listen for new posts from compose
  useEffect(() => {
    const handler = () => { pageRef.current = 0; fetchPosts(0); };
    window.addEventListener('midashub:newpost', handler);
    return () => window.removeEventListener('midashub:newpost', handler);
  }, [fetchPosts]);

  // Refresh feed when returning from background (after auth is refreshed)
  useEffect(() => {
    const onResumed = () => {
      pageRef.current = 0;
      fetchPosts(0);
    };
    window.addEventListener('midashub:resumed', onResumed);
    return () => window.removeEventListener('midashub:resumed', onResumed);
  }, [fetchPosts]);

  // Realtime new posts — one channel, created once
  useEffect(() => {
    const supabase = createClient();
    const ch = supabase.channel('feed-realtime').on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'posts' }, async (payload) => {
      try {
        const { data } = await supabase.from('posts').select('*, profiles(*)').eq('id', payload.new.id).maybeSingle();
        if (data) setPosts(prev => {
          if (prev.some(p => p.id === data.id)) return prev; // prevent dupes
          return [data, ...prev];
        });
      } catch (e) {}
    }).subscribe();
    return () => { supabase.removeChannel(ch); };
  }, []);

  // Infinite scroll — use refs to avoid re-creating listener
  useEffect(() => {
    const handler = () => {
      if (loadingMoreRef.current || !hasMoreRef.current) return;
      if (window.innerHeight + window.scrollY >= document.body.offsetHeight - 600) {
        loadingMoreRef.current = true;
        setLoadingMore(true);
        const next = pageRef.current + 1;
        pageRef.current = next;
        fetchPosts(next, true);
      }
    };
    window.addEventListener('scroll', handler, { passive: true });
    return () => window.removeEventListener('scroll', handler);
  }, [fetchPosts]);

  const refreshFeed = () => { pageRef.current = 0; fetchPosts(0); };

  return (
    <AppShell>
      <div className="max-w-2xl mx-auto px-3 sm:px-4 py-4 sm:py-6">
        {/* Compose bar (logged in) */}
        {user && (
          <div className="glass-light rounded-2xl p-4 mb-5">
            <div className="flex items-center gap-3">
              <span className="text-3xl">{profile?.avatar_emoji || '😎'}</span>
              <button onClick={() => setShowCompose(true)}
                className="flex-1 text-left px-4 py-3 rounded-xl bg-white/5 text-white/30 text-sm hover:bg-white/8 transition cursor-text">
                What&apos;s on your mind? Share anything...
              </button>
              <button onClick={() => setShowCompose(true)} className="btn-primary py-2.5 px-5 text-xs shrink-0">✏️ Post</button>
            </div>
          </div>
        )}

        {/* Sign up banner (not logged in) */}
        {!user && (
          <div className="glass-light rounded-2xl p-5 mb-5 text-center">
            <div className="text-3xl mb-2">⚡</div>
            <h3 className="font-bold text-lg mb-1">Welcome to MidasHub</h3>
            <p className="text-white/40 text-sm mb-4">You&apos;re viewing public posts. Sign up to see everything, post, chat, and trade!</p>
            <div className="flex gap-2 justify-center">
              <button onClick={() => setShowAuth(true, 'signup')} className="btn-primary px-6 py-2.5 text-sm">Join Free ⚡</button>
              <button onClick={() => setShowAuth(true, 'login')} className="btn-secondary px-6 py-2.5 text-sm">Log In</button>
            </div>
          </div>
        )}

        {/* Filters */}
        <div className="flex gap-1.5 mb-5 overflow-x-auto no-scrollbar pb-1">
          <button onClick={() => setFilter('all')}
            className={`platform-pill shrink-0 px-4 py-2 rounded-xl text-sm ${filter === 'all' ? 'bg-white/10 text-white font-bold' : 'bg-white/4 text-white/35'}`}>
            🌐 All
          </button>
          {PLATFORM_LIST.map(([key, p]) => (
            <button key={key} onClick={() => setFilter(key)} className="platform-pill shrink-0 px-4 py-2 rounded-xl text-sm"
              style={filter === key ? { background: `${p.color}20`, color: p.color, fontWeight: 700 } : { background: 'rgba(255,255,255,0.03)', color: 'rgba(255,255,255,0.3)' }}>
              {p.icon} {p.name}
            </button>
          ))}
        </div>

        {/* Content */}
        {loading ? (
          <div className="space-y-3">
            {[1,2,3,4].map(i => (
              <div key={i} className="post-card">
                <div className="flex gap-3 mb-4"><div className="w-10 h-10 rounded-full skeleton"/><div className="flex-1 space-y-2"><div className="h-4 w-32 skeleton"/><div className="h-3 w-20 skeleton"/></div></div>
                <div className="space-y-2"><div className="h-4 w-full skeleton"/><div className="h-4 w-3/4 skeleton"/><div className="h-4 w-1/2 skeleton"/></div>
              </div>
            ))}
          </div>
        ) : posts.length === 0 ? (
          <div className="text-center py-20">
            <div className="text-6xl mb-4">
              {filter !== 'all' ? PLATFORM_LIST.find(([k]) => k === filter)?.[1]?.icon || '📭' : '🌟'}
            </div>
            <h3 className="text-xl font-bold mb-2">
              {filter !== 'all' ? `No ${PLATFORM_LIST.find(([k]) => k === filter)?.[1]?.name || ''} posts yet` : 'No posts yet'}
            </h3>
            <p className="text-white/30 text-sm mb-6">Be the first to share something!</p>
            <button onClick={() => user ? setShowCompose(true) : setShowAuth(true, 'signup')} className="btn-primary px-8 py-3">
              {user ? 'Create First Post ⚡' : 'Join MidasHub ⚡'}
            </button>
          </div>
        ) : (
          <div className="space-y-3">
            {posts.map(post => <PostCard key={post.id} post={post} onPostUpdated={refreshFeed} />)}
            {loadingMore && (
              <div className="flex items-center justify-center gap-2 py-6 text-white/25 text-sm">
                <span className="animate-spin">⏳</span> Loading more posts...
              </div>
            )}
            {!hasMore && posts.length > 5 && (
              <div className="text-center py-8">
                <div className="text-3xl mb-2">🎉</div>
                <p className="text-white/15 text-sm">You&apos;ve seen everything!</p>
              </div>
            )}
          </div>
        )}
      </div>
    </AppShell>
  );
}

export default function FeedPage() {
  return <Suspense fallback={<div className="min-h-screen flex items-center justify-center"><div className="text-4xl animate-pulse">⚡</div></div>}><FeedInner /></Suspense>;
}
