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
    (async () => {
      const supabase = createClient();
      const { data: bookmarks } = await supabase.from('bookmarks').select('post_id').eq('user_id', user.id).order('created_at', { ascending: false });
      if (!bookmarks?.length) { setPosts([]); setLoading(false); return; }
      const ids = bookmarks.map((b) => b.post_id);
      const { data } = await supabase.from('posts').select('*, profiles(*)').in('id', ids);
      const [lr] = await Promise.all([supabase.from('likes').select('post_id').eq('user_id', user.id).in('post_id', ids)]);
      const liked = new Set((lr.data || []).map((l) => l.post_id));
      (data || []).forEach((p) => { p.user_liked = liked.has(p.id); p.user_bookmarked = true; });
      const postMap = new Map((data || []).map((p) => [p.id, p]));
      setPosts(ids.map((id) => postMap.get(id)).filter(Boolean));
      setLoading(false);
    })();
  }, [user]);

  if (!user) return (
    <AppShell><div className="max-w-2xl mx-auto px-4 py-16 text-center"><div className="text-5xl mb-3">🔖</div><h2 className="text-xl font-bold mb-2">Log in to see bookmarks</h2><button onClick={() => setShowAuth(true)} className="btn-primary mt-3">Log In</button></div></AppShell>
  );

  return (
    <AppShell>
      <div className="max-w-2xl mx-auto px-3 sm:px-4 py-4 sm:py-6">
        <h1 className="text-2xl sm:text-3xl font-black mb-1">🔖 Bookmarks</h1>
        <p className="text-white/30 text-sm mb-4 sm:mb-5">Posts you saved for later</p>
        {loading ? <div className="space-y-3">{[1,2].map((i) => <div key={i} className="post-card"><div className="h-16 skeleton" /></div>)}</div> :
        posts.length === 0 ? <div className="text-center py-14 text-white/20"><div className="text-4xl mb-2">📑</div>No bookmarks yet. Tap the bookmark icon on any post.</div> :
        <div className="space-y-3">{posts.map((post) => <PostCard key={post.id} post={post} />)}</div>}
      </div>
    </AppShell>
  );
}
