'use client';
import { useState, useEffect, useCallback } from 'react';
import AppShell from '@/components/AppShell';
import PostCard from '@/components/PostCard';
import { useStore } from '@/lib/store';
import { createClient } from '@/lib/supabase-browser';

export default function ViralPage() {
  const { user } = useStore();
  const [posts, setPosts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [sortBy, setSortBy] = useState('likes');

  const fetchViral = useCallback(async () => {
    setLoading(true);
    try {
      const supabase = createClient();
      const col = sortBy === 'likes' ? 'likes_count' : sortBy === 'comments' ? 'comments_count' : 'reposts_count';
      let query = supabase.from('posts').select('*, profiles(*)').order(col, { ascending: false }).limit(50);
      if (!user) query = query.eq('is_public', true);
      const { data } = await query;
      let results = data || [];
      if (user && results.length) {
        const ids = results.map(p => p.id);
        const [lr, br, rr] = await Promise.all([
          supabase.from('likes').select('post_id').eq('user_id', user.id).in('post_id', ids),
          supabase.from('bookmarks').select('post_id').eq('user_id', user.id).in('post_id', ids),
          supabase.from('reposts').select('post_id').eq('user_id', user.id).in('post_id', ids),
        ]);
        const liked = new Set((lr.data||[]).map(l=>l.post_id));
        const bkd = new Set((br.data||[]).map(b=>b.post_id));
        const rp = new Set((rr.data||[]).map(r=>r.post_id));
        results.forEach(p => { p.user_liked = liked.has(p.id); p.user_bookmarked = bkd.has(p.id); p.user_reposted = rp.has(p.id); });
      }
      setPosts(results);
    } catch (e) { console.error('Viral fetch error:', e); }
    setLoading(false);
  }, [sortBy, user]);

  useEffect(() => {
    const safety = setTimeout(() => setLoading(false), 3000);
    fetchViral().finally(() => clearTimeout(safety));
    return () => clearTimeout(safety);
  }, [fetchViral]);

  useEffect(() => {
    const onResumed = () => fetchViral();
    window.addEventListener('midashub:resumed', onResumed);
    return () => window.removeEventListener('midashub:resumed', onResumed);
  }, [fetchViral]);

  const medals = ['🥇','🥈','🥉'];

  return (
    <AppShell>
      <div className="max-w-2xl mx-auto px-3 sm:px-4 py-4 sm:py-6">
        <div className="mb-6">
          <div className="flex items-center gap-3 mb-1"><span className="text-3xl">🔥</span><h1 className="text-2xl sm:text-3xl font-black">Trending</h1></div>
          <p className="text-white/30 text-sm ml-12">The hottest posts right now</p>
        </div>

        <div className="flex gap-2 mb-5">
          {[{ key: 'likes', icon: '❤️', label: 'Most Liked' }, { key: 'comments', icon: '💬', label: 'Most Discussed' }, { key: 'reposts', icon: '🔄', label: 'Most Shared' }].map(s => (
            <button key={s.key} onClick={() => setSortBy(s.key)}
              className={`platform-pill px-4 py-2 rounded-xl text-sm transition ${sortBy === s.key ? 'bg-orange-500/15 text-orange-400 font-bold border border-orange-500/20' : 'bg-white/4 text-white/35'}`}>
              {s.icon} {s.label}
            </button>
          ))}
        </div>

        {loading ? (
          <div className="space-y-3">{[1,2,3].map(i => <div key={i} className="post-card"><div className="flex gap-3 mb-4"><div className="w-10 h-10 rounded-full skeleton"/><div className="flex-1 space-y-2"><div className="h-4 w-32 skeleton"/><div className="h-3 w-20 skeleton"/></div></div><div className="space-y-2"><div className="h-4 w-full skeleton"/><div className="h-4 w-2/3 skeleton"/></div></div>)}</div>
        ) : posts.length === 0 ? (
          <div className="text-center py-20"><div className="text-6xl mb-4">🔥</div><h3 className="text-xl font-bold mb-2">Nothing trending yet</h3><p className="text-white/30 text-sm">Posts with lots of engagement will appear here</p></div>
        ) : (
          <div className="space-y-3">
            {posts.map((post, i) => (
              <div key={post.id} className="relative">
                {i < 3 && <div className="absolute -left-1 -top-1 w-8 h-8 rounded-full flex items-center justify-center text-base z-10 shadow-lg" style={{ background: 'var(--card)', border: '2px solid rgba(255,165,0,0.3)' }}>{medals[i]}</div>}
                <PostCard post={post} onPostUpdated={fetchViral} />
              </div>
            ))}
          </div>
        )}
      </div>
    </AppShell>
  );
}
