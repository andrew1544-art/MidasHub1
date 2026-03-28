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
    const fetch = async () => {
      const supabase = createClient();
      const { data: bk } = await supabase.from('bookmarks').select('post_id').eq('user_id', user.id).order('created_at', { ascending: false });
      if (!bk?.length) { setPosts([]); setLoading(false); return; }
      const ids = bk.map(b => b.post_id);
      const { data } = await supabase.from('posts').select('*, profiles(*)').in('id', ids);
      const [lr] = await Promise.all([supabase.from('likes').select('post_id').eq('user_id', user.id).in('post_id', ids)]);
      const liked = new Set((lr.data||[]).map(l => l.post_id));
      (data||[]).forEach(p => { p.user_liked = liked.has(p.id); p.user_bookmarked = true; });
      const map = new Map((data||[]).map(p => [p.id, p]));
      setPosts(ids.map(id => map.get(id)).filter(Boolean));
      setLoading(false);
    };
    fetch();
  }, [user]);

  if (!user) return <AppShell><div className="max-w-2xl mx-auto px-4 py-20 text-center"><div className="text-6xl mb-4">🔖</div><h2 className="text-2xl font-bold mb-3">Log in to see bookmarks</h2><button onClick={() => setShowAuth(true)} className="btn-primary mt-4 px-8 py-3">Log In</button></div></AppShell>;

  return (
    <AppShell>
      <div className="max-w-2xl mx-auto px-3 sm:px-4 py-4 sm:py-6">
        <div className="flex items-center gap-3 mb-1"><span className="text-3xl">🔖</span><h1 className="text-2xl sm:text-3xl font-black">Saved</h1></div>
        <p className="text-white/30 text-sm ml-12 mb-6">Posts you bookmarked for later</p>

        {loading ? (
          <div className="space-y-3">{[1,2].map(i => <div key={i} className="post-card"><div className="h-20 skeleton rounded"/></div>)}</div>
        ) : posts.length === 0 ? (
          <div className="text-center py-20">
            <div className="text-6xl mb-4">📑</div>
            <h3 className="text-xl font-bold mb-2">No bookmarks yet</h3>
            <p className="text-white/30 text-sm">Tap the bookmark icon on any post to save it here</p>
          </div>
        ) : (
          <div className="space-y-3">{posts.map(p => <PostCard key={p.id} post={p} onPostUpdated={() => window.location.reload()}/>)}</div>
        )}
      </div>
    </AppShell>
  );
}
