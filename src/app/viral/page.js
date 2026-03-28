'use client';
import { useState, useEffect } from 'react';
import AppShell from '@/components/AppShell';
import PostCard from '@/components/PostCard';
import { useStore } from '@/lib/store';
import { createClient } from '@/lib/supabase-browser';

export default function ViralPage() {
  const { user } = useStore();
  const [posts, setPosts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [sortBy, setSortBy] = useState('likes');

  useEffect(() => {
    (async () => {
      setLoading(true);
      const supabase = createClient();
      const col = sortBy === 'likes' ? 'likes_count' : sortBy === 'comments' ? 'comments_count' : 'reposts_count';
      let { data } = await supabase.from('posts').select('*, profiles(*)').order(col, { ascending: false }).limit(50);
      let results = data || [];
      if (user && results.length) {
        const ids = results.map((p) => p.id);
        const [lr, br] = await Promise.all([
          supabase.from('likes').select('post_id').eq('user_id', user.id).in('post_id', ids),
          supabase.from('bookmarks').select('post_id').eq('user_id', user.id).in('post_id', ids),
        ]);
        const liked = new Set((lr.data || []).map((l) => l.post_id));
        const bm = new Set((br.data || []).map((b) => b.post_id));
        results.forEach((p) => { p.user_liked = liked.has(p.id); p.user_bookmarked = bm.has(p.id); });
      }
      setPosts(results); setLoading(false);
    })();
  }, [sortBy, user]);

  return (
    <AppShell>
      <div className="max-w-2xl mx-auto px-3 sm:px-4 py-4 sm:py-6">
        <h1 className="text-2xl sm:text-3xl font-black mb-1">🔥 Viral</h1>
        <p className="text-white/30 text-sm mb-4 sm:mb-5">Hottest posts across all platforms</p>
        <div className="flex gap-1.5 mb-4 sm:mb-5">
          {[{ key: 'likes', icon: '❤️', label: 'Liked' }, { key: 'comments', icon: '💬', label: 'Discussed' }, { key: 'reposts', icon: '🔄', label: 'Shared' }].map((s) => (
            <button key={s.key} onClick={() => setSortBy(s.key)}
              className={`platform-pill px-3 py-1.5 rounded-xl text-sm ${sortBy === s.key ? 'bg-orange-500/15 text-orange-400 font-bold' : 'bg-white/4 text-white/35'}`}>
              {s.icon} {s.label}
            </button>
          ))}
        </div>
        {loading ? (
          <div className="space-y-3">{[1, 2, 3].map((i) => <div key={i} className="post-card"><div className="h-16 skeleton" /></div>)}</div>
        ) : posts.length === 0 ? (
          <div className="text-center py-16"><div className="text-5xl mb-3">🔥</div><h3 className="text-lg font-bold mb-2">Nothing viral yet</h3><p className="text-white/30 text-sm">Posts with lots of likes go viral. Start posting!</p></div>
        ) : (
          <div className="space-y-3">
            {posts.map((post, i) => (
              <div key={post.id} className="relative">
                {i < 3 && <div className="absolute -left-1 -top-1 w-7 h-7 rounded-full accent-gradient flex items-center justify-center text-xs font-black text-black z-10 shadow-lg">{i + 1}</div>}
                <PostCard post={post} />
              </div>
            ))}
          </div>
        )}
      </div>
    </AppShell>
  );
}
