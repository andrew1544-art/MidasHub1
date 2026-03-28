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
    const fetchViral = async () => {
      setLoading(true);
      const supabase = createClient();

      const orderCol = sortBy === 'likes' ? 'likes_count' : sortBy === 'comments' ? 'comments_count' : 'reposts_count';

      const { data } = await supabase
        .from('posts')
        .select('*, profiles(*)')
        .eq('is_viral', true)
        .order(orderCol, { ascending: false })
        .limit(50);

      let results = data || [];

      // If not enough viral posts, also get top posts by engagement
      if (results.length < 10) {
        const { data: topPosts } = await supabase
          .from('posts')
          .select('*, profiles(*)')
          .order(orderCol, { ascending: false })
          .limit(50);
        const existingIds = new Set(results.map((p) => p.id));
        const extra = (topPosts || []).filter((p) => !existingIds.has(p.id));
        results = [...results, ...extra];
      }

      // Check user interactions
      if (user && results.length > 0) {
        const postIds = results.map((p) => p.id);
        const [likesRes, bookmarksRes] = await Promise.all([
          supabase.from('likes').select('post_id').eq('user_id', user.id).in('post_id', postIds),
          supabase.from('bookmarks').select('post_id').eq('user_id', user.id).in('post_id', postIds),
        ]);
        const likedIds = new Set((likesRes.data || []).map((l) => l.post_id));
        const bookmarkedIds = new Set((bookmarksRes.data || []).map((b) => b.post_id));
        results.forEach((p) => {
          p.user_liked = likedIds.has(p.id);
          p.user_bookmarked = bookmarkedIds.has(p.id);
        });
      }

      setPosts(results);
      setLoading(false);
    };
    fetchViral();
  }, [sortBy, user]);

  return (
    <AppShell>
      <div className="max-w-2xl mx-auto px-4 py-6">
        {/* Header */}
        <div className="mb-6">
          <h1 className="text-3xl font-black mb-2">🔥 Viral</h1>
          <p className="text-white/40 text-sm">The hottest posts blowing up right now across all platforms</p>
        </div>

        {/* Sort */}
        <div className="flex gap-2 mb-6">
          {[
            { key: 'likes', icon: '❤️', label: 'Most Liked' },
            { key: 'comments', icon: '💬', label: 'Most Discussed' },
            { key: 'reposts', icon: '🔄', label: 'Most Shared' },
          ].map((s) => (
            <button key={s.key} onClick={() => setSortBy(s.key)}
              className={`platform-pill px-4 py-2 rounded-xl text-sm ${sortBy === s.key ? 'bg-orange-500/15 text-orange-400 font-bold' : 'bg-white/4 text-white/40'}`}
            >
              {s.icon} {s.label}
            </button>
          ))}
        </div>

        {/* Posts */}
        {loading ? (
          <div className="space-y-4">
            {[1, 2, 3].map((i) => (
              <div key={i} className="post-card">
                <div className="h-4 w-20 rounded skeleton mb-4" />
                <div className="flex gap-3 mb-4">
                  <div className="w-10 h-10 rounded-full skeleton" />
                  <div className="flex-1 space-y-2">
                    <div className="h-4 w-32 rounded skeleton" />
                    <div className="h-3 w-20 rounded skeleton" />
                  </div>
                </div>
                <div className="space-y-2">
                  <div className="h-4 w-full rounded skeleton" />
                  <div className="h-4 w-2/3 rounded skeleton" />
                </div>
              </div>
            ))}
          </div>
        ) : posts.length === 0 ? (
          <div className="text-center py-20">
            <div className="text-6xl mb-4">🔥</div>
            <h3 className="text-xl font-bold mb-2">Nothing viral yet</h3>
            <p className="text-white/40">Posts with 100+ likes automatically go viral. Start posting!</p>
          </div>
        ) : (
          <div className="space-y-4">
            {posts.map((post, i) => (
              <div key={post.id} className="relative">
                {i < 3 && (
                  <div className="absolute -left-2 -top-2 w-8 h-8 rounded-full bg-gradient-to-br from-yellow-500 to-orange-500 flex items-center justify-center text-sm font-black text-black z-10 shadow-lg">
                    {i + 1}
                  </div>
                )}
                <PostCard post={post} />
              </div>
            ))}
          </div>
        )}
      </div>
    </AppShell>
  );
}
