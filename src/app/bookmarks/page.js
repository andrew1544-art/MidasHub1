'use client';
import { useState, useEffect } from 'react';
import AppShell from '@/components/AppShell';
import PostCard from '@/components/PostCard';
import { useStore } from '@/lib/store';
import { createClient } from '@/lib/supabase-browser';

export default function BookmarksPage() {
  const { user, setShowAuth } = useStore();
  const [posts, setPosts] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) { setLoading(false); return; }
    const fetchBookmarks = async () => {
      const supabase = createClient();
      const { data: bookmarks } = await supabase
        .from('bookmarks')
        .select('post_id')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });

      if (!bookmarks || bookmarks.length === 0) {
        setPosts([]);
        setLoading(false);
        return;
      }

      const postIds = bookmarks.map((b) => b.post_id);
      const { data: postsData } = await supabase
        .from('posts')
        .select('*, profiles(*)')
        .in('id', postIds);

      // Add like/bookmark status
      const [likesRes] = await Promise.all([
        supabase.from('likes').select('post_id').eq('user_id', user.id).in('post_id', postIds),
      ]);
      const likedIds = new Set((likesRes.data || []).map((l) => l.post_id));

      (postsData || []).forEach((p) => {
        p.user_liked = likedIds.has(p.id);
        p.user_bookmarked = true;
      });

      // Sort in bookmark order
      const postMap = new Map((postsData || []).map((p) => [p.id, p]));
      const sorted = postIds.map((id) => postMap.get(id)).filter(Boolean);
      setPosts(sorted);
      setLoading(false);
    };
    fetchBookmarks();
  }, [user]);

  if (!user) {
    return (
      <AppShell>
        <div className="max-w-2xl mx-auto px-4 py-20 text-center">
          <div className="text-6xl mb-4">🔖</div>
          <h2 className="text-2xl font-bold mb-3">Log in to see bookmarks</h2>
          <button onClick={() => setShowAuth(true)} className="btn-primary mt-4">Log In</button>
        </div>
      </AppShell>
    );
  }

  return (
    <AppShell>
      <div className="max-w-2xl mx-auto px-4 py-6">
        <h1 className="text-3xl font-black mb-2">🔖 Bookmarks</h1>
        <p className="text-white/40 text-sm mb-6">Posts you&apos;ve saved for later</p>

        {loading ? (
          <div className="space-y-4">
            {[1, 2].map((i) => (
              <div key={i} className="post-card"><div className="h-20 skeleton rounded" /></div>
            ))}
          </div>
        ) : posts.length === 0 ? (
          <div className="text-center py-16 text-white/30">
            <div className="text-4xl mb-3">📑</div>
            No bookmarks yet. Tap the bookmark icon on any post to save it here.
          </div>
        ) : (
          <div className="space-y-4">
            {posts.map((post) => <PostCard key={post.id} post={post} />)}
          </div>
        )}
      </div>
    </AppShell>
  );
}
