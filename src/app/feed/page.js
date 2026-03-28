'use client';
import { useState, useEffect, useCallback } from 'react';
import AppShell from '@/components/AppShell';
import PostCard from '@/components/PostCard';
import { useStore } from '@/lib/store';
import { createClient } from '@/lib/supabase-browser';
import { PLATFORMS, PLATFORM_LIST } from '@/lib/constants';

export default function FeedPage() {
  const { user, setShowAuth, setShowCompose } = useStore();
  const [posts, setPosts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('all');
  const [page, setPage] = useState(0);
  const [hasMore, setHasMore] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const PAGE_SIZE = 20;

  const fetchPosts = useCallback(async (pageNum = 0, append = false) => {
    const supabase = createClient();
    let query = supabase
      .from('posts')
      .select('*, profiles(*)')
      .order('created_at', { ascending: false })
      .range(pageNum * PAGE_SIZE, (pageNum + 1) * PAGE_SIZE - 1);

    if (filter !== 'all') {
      query = query.eq('source_platform', filter);
    }

    const { data, error } = await query;

    if (!error && data) {
      // Check user likes/bookmarks
      if (user) {
        const postIds = data.map((p) => p.id);
        const [likesRes, bookmarksRes] = await Promise.all([
          supabase.from('likes').select('post_id').eq('user_id', user.id).in('post_id', postIds),
          supabase.from('bookmarks').select('post_id').eq('user_id', user.id).in('post_id', postIds),
        ]);
        const likedIds = new Set((likesRes.data || []).map((l) => l.post_id));
        const bookmarkedIds = new Set((bookmarksRes.data || []).map((b) => b.post_id));
        data.forEach((p) => {
          p.user_liked = likedIds.has(p.id);
          p.user_bookmarked = bookmarkedIds.has(p.id);
        });
      }

      if (append) {
        setPosts((prev) => [...prev, ...data]);
      } else {
        setPosts(data);
      }
      setHasMore(data.length === PAGE_SIZE);
    }
    setLoading(false);
    setLoadingMore(false);
  }, [filter, user]);

  useEffect(() => {
    setLoading(true);
    setPage(0);
    fetchPosts(0, false);
  }, [filter, fetchPosts]);

  // Listen for new posts
  useEffect(() => {
    const handler = () => {
      setPage(0);
      fetchPosts(0, false);
    };
    window.addEventListener('midashub:newpost', handler);
    return () => window.removeEventListener('midashub:newpost', handler);
  }, [fetchPosts]);

  // Real-time new posts
  useEffect(() => {
    const supabase = createClient();
    const channel = supabase
      .channel('feed-posts')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'posts' }, async (payload) => {
        const { data } = await supabase
          .from('posts')
          .select('*, profiles(*)')
          .eq('id', payload.new.id)
          .single();
        if (data) {
          setPosts((prev) => [data, ...prev]);
        }
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, []);

  const loadMore = () => {
    if (loadingMore || !hasMore) return;
    setLoadingMore(true);
    const nextPage = page + 1;
    setPage(nextPage);
    fetchPosts(nextPage, true);
  };

  // Infinite scroll
  useEffect(() => {
    const handler = () => {
      if (window.innerHeight + window.scrollY >= document.body.offsetHeight - 500) {
        loadMore();
      }
    };
    window.addEventListener('scroll', handler);
    return () => window.removeEventListener('scroll', handler);
  }, [page, hasMore, loadingMore]);

  return (
    <AppShell>
      <div className="max-w-2xl mx-auto px-4 py-6">
        {/* Welcome banner for logged in users */}
        {user && (
          <div className="glass-light rounded-2xl p-5 mb-6 animate-slide-up">
            <div className="flex items-center justify-between mb-3">
              <h2 className="font-bold text-lg">📡 Your Feed</h2>
              <button onClick={() => setShowCompose(true)} className="btn-primary py-2 px-5 text-xs">
                ✏️ New Post
              </button>
            </div>
            <p className="text-sm text-white/40">Everything from everyone, everywhere. All in one place.</p>
          </div>
        )}

        {/* Platform filters */}
        <div className="flex gap-2 mb-6 overflow-x-auto pb-2 scrollbar-hide">
          <button onClick={() => setFilter('all')}
            className={`platform-pill shrink-0 px-4 py-2 rounded-xl ${filter === 'all' ? 'bg-white/12 text-white font-bold' : 'bg-white/4 text-white/40'}`}
          >
            🌐 All
          </button>
          {PLATFORM_LIST.map(([key, p]) => (
            <button key={key} onClick={() => setFilter(key)}
              className="platform-pill shrink-0 px-4 py-2 rounded-xl"
              style={filter === key
                ? { background: `${p.color}22`, color: p.color, fontWeight: 700 }
                : { background: 'rgba(255,255,255,0.04)', color: 'rgba(255,255,255,0.4)' }
              }
            >
              {p.icon} {p.name}
            </button>
          ))}
        </div>

        {/* Posts */}
        {loading ? (
          <div className="space-y-4">
            {[1, 2, 3].map((i) => (
              <div key={i} className="post-card">
                <div className="flex gap-3 mb-4">
                  <div className="w-10 h-10 rounded-full skeleton" />
                  <div className="flex-1 space-y-2">
                    <div className="h-4 w-32 rounded skeleton" />
                    <div className="h-3 w-20 rounded skeleton" />
                  </div>
                </div>
                <div className="space-y-2">
                  <div className="h-4 w-full rounded skeleton" />
                  <div className="h-4 w-3/4 rounded skeleton" />
                </div>
              </div>
            ))}
          </div>
        ) : posts.length === 0 ? (
          <div className="text-center py-20">
            <div className="text-6xl mb-4">🌟</div>
            <h3 className="text-xl font-bold mb-2">No posts yet</h3>
            <p className="text-white/40 mb-6">Be the first to share something!</p>
            {user ? (
              <button onClick={() => setShowCompose(true)} className="btn-primary">
                Create First Post ⚡
              </button>
            ) : (
              <button onClick={() => setShowAuth(true, 'signup')} className="btn-primary">
                Join MidasHub ⚡
              </button>
            )}
          </div>
        ) : (
          <div className="space-y-4">
            {posts.map((post) => (
              <PostCard key={post.id} post={post} />
            ))}

            {loadingMore && (
              <div className="text-center py-6 text-white/30 text-sm">
                Loading more posts...
              </div>
            )}

            {!hasMore && posts.length > 0 && (
              <div className="text-center py-8 text-white/20 text-sm">
                You&apos;ve seen everything 🎉
              </div>
            )}
          </div>
        )}
      </div>
    </AppShell>
  );
}
