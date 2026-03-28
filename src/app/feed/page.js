'use client';
import { useState, useEffect, useCallback } from 'react';
import AppShell from '@/components/AppShell';
import PostCard from '@/components/PostCard';
import { useStore } from '@/lib/store';
import { createClient } from '@/lib/supabase-browser';
import { PLATFORM_LIST } from '@/lib/constants';

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
    let query = supabase.from('posts').select('*, profiles(*)').order('created_at', { ascending: false }).range(pageNum * PAGE_SIZE, (pageNum + 1) * PAGE_SIZE - 1);
    if (filter !== 'all') query = query.eq('source_platform', filter);
    const { data } = await query;
    if (data) {
      if (user) {
        const postIds = data.map((p) => p.id);
        if (postIds.length) {
          const [lr, br] = await Promise.all([
            supabase.from('likes').select('post_id').eq('user_id', user.id).in('post_id', postIds),
            supabase.from('bookmarks').select('post_id').eq('user_id', user.id).in('post_id', postIds),
          ]);
          const liked = new Set((lr.data || []).map((l) => l.post_id));
          const bookmarked = new Set((br.data || []).map((b) => b.post_id));
          data.forEach((p) => { p.user_liked = liked.has(p.id); p.user_bookmarked = bookmarked.has(p.id); });
        }
      }
      append ? setPosts((prev) => [...prev, ...data]) : setPosts(data);
      setHasMore(data.length === PAGE_SIZE);
    }
    setLoading(false); setLoadingMore(false);
  }, [filter, user]);

  useEffect(() => { setLoading(true); setPage(0); fetchPosts(0); }, [filter, fetchPosts]);

  useEffect(() => {
    const handler = () => { setPage(0); fetchPosts(0); };
    window.addEventListener('midashub:newpost', handler);
    return () => window.removeEventListener('midashub:newpost', handler);
  }, [fetchPosts]);

  useEffect(() => {
    const supabase = createClient();
    const ch = supabase.channel('feed').on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'posts' }, async (p) => {
      const { data } = await supabase.from('posts').select('*, profiles(*)').eq('id', p.new.id).single();
      if (data) setPosts((prev) => [data, ...prev]);
    }).subscribe();
    return () => { supabase.removeChannel(ch); };
  }, []);

  useEffect(() => {
    const handler = () => {
      if (!loadingMore && hasMore && window.innerHeight + window.scrollY >= document.body.offsetHeight - 500) {
        setLoadingMore(true);
        const next = page + 1; setPage(next); fetchPosts(next, true);
      }
    };
    window.addEventListener('scroll', handler);
    return () => window.removeEventListener('scroll', handler);
  }, [page, hasMore, loadingMore]);

  return (
    <AppShell>
      <div className="max-w-2xl mx-auto px-3 sm:px-4 py-4 sm:py-6">
        {user && (
          <div className="glass-light rounded-2xl p-4 mb-4 sm:mb-5 animate-slide-up">
            <div className="flex items-center justify-between">
              <h2 className="font-bold text-base">📡 Your Feed</h2>
              <button onClick={() => setShowCompose(true)} className="btn-primary py-1.5 px-4 text-xs">✏️ Post</button>
            </div>
          </div>
        )}

        <div className="flex gap-1.5 mb-4 sm:mb-5 overflow-x-auto no-scrollbar pb-1">
          <button onClick={() => setFilter('all')}
            className={`platform-pill shrink-0 px-3 py-1.5 rounded-xl ${filter === 'all' ? 'bg-white/10 text-white font-bold' : 'bg-white/4 text-white/35'}`}>🌐 All</button>
          {PLATFORM_LIST.map(([key, p]) => (
            <button key={key} onClick={() => setFilter(key)} className="platform-pill shrink-0 px-3 py-1.5 rounded-xl"
              style={filter === key ? { background: `${p.color}20`, color: p.color, fontWeight: 700 } : { background: 'rgba(255,255,255,0.03)', color: 'rgba(255,255,255,0.3)' }}>
              {p.icon} {p.name}
            </button>
          ))}
        </div>

        {loading ? (
          <div className="space-y-3">{[1, 2, 3].map((i) => <div key={i} className="post-card"><div className="flex gap-3 mb-3"><div className="w-9 h-9 rounded-full skeleton" /><div className="flex-1 space-y-2"><div className="h-3.5 w-28 skeleton" /><div className="h-3 w-16 skeleton" /></div></div><div className="space-y-2"><div className="h-3.5 w-full skeleton" /><div className="h-3.5 w-2/3 skeleton" /></div></div>)}</div>
        ) : posts.length === 0 ? (
          <div className="text-center py-16">
            <div className="text-5xl mb-3">🌟</div>
            <h3 className="text-lg font-bold mb-2">No posts yet</h3>
            <p className="text-white/30 text-sm mb-5">Be the first to share something!</p>
            <button onClick={() => user ? setShowCompose(true) : setShowAuth(true, 'signup')} className="btn-primary">{user ? 'Create Post ⚡' : 'Join MidasHub ⚡'}</button>
          </div>
        ) : (
          <div className="space-y-3">
            {posts.map((post) => <PostCard key={post.id} post={post} />)}
            {loadingMore && <div className="text-center py-4 text-white/20 text-sm">Loading more...</div>}
            {!hasMore && posts.length > 0 && <div className="text-center py-6 text-white/15 text-sm">You've seen everything 🎉</div>}
          </div>
        )}
      </div>
    </AppShell>
  );
}
