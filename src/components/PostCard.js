'use client';
import { useState } from 'react';
import Link from 'next/link';
import { useStore } from '@/lib/store';
import { createClient } from '@/lib/supabase-browser';
import { PLATFORMS, formatCount, timeAgo } from '@/lib/constants';

export default function PostCard({ post }) {
  const { user, profile, showToast } = useStore();
  const [liked, setLiked] = useState(post.user_liked || false);
  const [likesCount, setLikesCount] = useState(post.likes_count || 0);
  const [bookmarked, setBookmarked] = useState(post.user_bookmarked || false);
  const [showComments, setShowComments] = useState(false);
  const [comments, setComments] = useState([]);
  const [commentText, setCommentText] = useState('');
  const [showShareMenu, setShowShareMenu] = useState(false);
  const [loadingComments, setLoadingComments] = useState(false);

  const plat = PLATFORMS[post.source_platform] || PLATFORMS.midashub;
  const postUser = post.profiles || {};

  const handleLike = async () => {
    if (!user) return useStore.getState().setShowAuth(true);
    const supabase = createClient();
    try {
      if (liked) {
        setLiked(false); setLikesCount(c => c - 1);
        await supabase.from('likes').delete().match({ user_id: user.id, post_id: post.id });
      } else {
        setLiked(true); setLikesCount(c => c + 1);
        await supabase.from('likes').insert({ user_id: user.id, post_id: post.id });
        if (post.user_id !== user.id) {
          await supabase.from('notifications').insert({ user_id: post.user_id, from_user_id: user.id, type: 'like', reference_id: post.id });
        }
      }
    } catch (e) { console.warn('Like error:', e); }
  };

  const handleBookmark = async () => {
    if (!user) return useStore.getState().setShowAuth(true);
    const supabase = createClient();
    try {
      if (bookmarked) {
        setBookmarked(false);
        await supabase.from('bookmarks').delete().match({ user_id: user.id, post_id: post.id });
        showToast?.('Removed from bookmarks');
      } else {
        setBookmarked(true);
        await supabase.from('bookmarks').insert({ user_id: user.id, post_id: post.id });
        showToast?.('Saved ✓');
      }
    } catch (e) { console.warn('Bookmark error:', e); }
  };

  const loadComments = async () => {
    setShowComments(!showComments);
    if (showComments) return;
    setLoadingComments(true);
    try {
      const supabase = createClient();
      const { data } = await supabase.from('comments').select('*, profiles(*)').eq('post_id', post.id).order('created_at', { ascending: true }).limit(50);
      setComments(data || []);
    } catch (e) { console.warn('Comments error:', e); }
    setLoadingComments(false);
  };

  const submitComment = async () => {
    if (!commentText.trim() || !user) return;
    try {
      const supabase = createClient();
      const { data } = await supabase.from('comments').insert({ user_id: user.id, post_id: post.id, content: commentText.trim() }).select('*, profiles(*)').single();
      if (data) {
        setComments([...comments, data]);
        setCommentText('');
        if (post.user_id !== user.id) {
          await supabase.from('notifications').insert({ user_id: post.user_id, from_user_id: user.id, type: 'comment', reference_id: post.id });
        }
      }
    } catch (e) { console.warn('Comment error:', e); }
  };

  const shareToSocial = (platform) => {
    const text = encodeURIComponent(post.content.slice(0, 280));
    const url = encodeURIComponent(`${window.location.origin}/post/${post.id}`);
    const links = {
      twitter: `https://twitter.com/intent/tweet?text=${text}&url=${url}`,
      facebook: `https://www.facebook.com/sharer/sharer.php?u=${url}`,
      whatsapp: `https://wa.me/?text=${text}%20${url}`,
      linkedin: `https://www.linkedin.com/shareArticle?mini=true&url=${url}&title=${text}`,
    };
    if (links[platform]) window.open(links[platform], '_blank');
    setShowShareMenu(false);
  };

  return (
    <article className="post-card animate-slide-up">
      {post.is_viral && (
        <div className="flex items-center gap-1.5 text-[11px] font-bold text-orange-400 mb-3">
          🔥 VIRAL — {formatCount(post.views_count || post.likes_count * 10)} views
        </div>
      )}

      <div className="flex items-center gap-3 mb-3">
        <Link href={`/profile/${postUser.username || 'unknown'}`} className="text-3xl hover:scale-110 transition-transform shrink-0">
          {postUser.avatar_emoji || '😎'}
        </Link>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <Link href={`/profile/${postUser.username || 'unknown'}`} className="font-bold text-sm hover:underline truncate">{postUser.display_name || 'User'}</Link>
            <span className="text-xs text-white/25 truncate">@{postUser.username || 'user'}</span>
          </div>
          <div className="flex items-center gap-2 mt-0.5">
            <span className="platform-pill text-[10px] py-0.5" style={{ background: `${plat.color}18`, color: plat.color }}>
              {plat.icon} {plat.name}
            </span>
            <span className="text-[11px] text-white/20">{timeAgo(post.created_at)}</span>
          </div>
        </div>
        {post.source_url && (
          <a href={post.source_url} target="_blank" rel="noopener noreferrer" className="text-xs text-white/20 hover:text-white/50 transition shrink-0">🔗</a>
        )}
      </div>

      <p className="text-[15px] leading-relaxed whitespace-pre-wrap break-words">{post.content}</p>

      {post.tags?.length > 0 && (
        <div className="flex flex-wrap gap-1.5 mt-2">
          {post.tags.map(tag => <span key={tag} className="text-xs text-[var(--accent)] opacity-70">#{tag}</span>)}
        </div>
      )}

      {post.media_urls?.length > 0 && (
        <div className={`grid gap-1.5 mt-3 rounded-xl overflow-hidden ${post.media_urls.length === 1 ? 'grid-cols-1' : 'grid-cols-2'}`}>
          {post.media_urls.map((url, i) => (
            <div key={i} className="aspect-video bg-white/5 rounded-xl overflow-hidden">
              <img src={url} alt="" className="w-full h-full object-cover" loading="lazy" />
            </div>
          ))}
        </div>
      )}

      <div className="flex items-center gap-0.5 mt-3 pt-3 border-t border-white/5">
        <button onClick={handleLike}
          className={`flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-sm transition hover:bg-white/5 ${liked ? 'text-red-400' : 'text-white/35'}`}>
          {liked ? '❤️' : '🤍'} <span className="text-xs">{formatCount(likesCount)}</span>
        </button>
        <button onClick={loadComments}
          className={`flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-sm transition hover:bg-white/5 ${showComments ? 'text-blue-400' : 'text-white/35'}`}>
          💬 <span className="text-xs">{formatCount(post.comments_count || 0)}</span>
        </button>
        <button onClick={async () => {
          if (!user) return useStore.getState().setShowAuth(true);
          try {
            const supabase = createClient();
            await supabase.from('reposts').upsert({ user_id: user.id, post_id: post.id });
            showToast?.('Reposted ✓');
          } catch (e) {}
        }} className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-sm text-white/35 transition hover:bg-white/5 hover:text-green-400">
          🔄 <span className="text-xs">{formatCount(post.reposts_count || 0)}</span>
        </button>
        <div className="relative ml-auto">
          <button onClick={() => setShowShareMenu(!showShareMenu)} className="px-2.5 py-1.5 rounded-lg text-sm text-white/35 transition hover:bg-white/5">📤</button>
          {showShareMenu && (
            <div className="absolute bottom-full right-0 mb-1 glass rounded-xl p-1.5 w-44 shadow-2xl z-10">
              {['twitter', 'facebook', 'whatsapp', 'linkedin'].map(p => (
                <button key={p} onClick={() => shareToSocial(p)} className="w-full flex items-center gap-2 px-3 py-2 rounded-lg hover:bg-white/5 text-sm transition text-left">
                  {PLATFORMS[p].icon} {PLATFORMS[p].name}
                </button>
              ))}
              <button onClick={() => { navigator.clipboard.writeText(`${window.location.origin}/post/${post.id}`); showToast?.('Link copied ✓'); setShowShareMenu(false); }}
                className="w-full flex items-center gap-2 px-3 py-2 rounded-lg hover:bg-white/5 text-sm transition text-left">📋 Copy Link</button>
            </div>
          )}
        </div>
        <button onClick={handleBookmark} className={`px-2 py-1.5 rounded-lg text-sm transition hover:bg-white/5 ${bookmarked ? 'text-[var(--accent)]' : 'text-white/35'}`}>
          {bookmarked ? '🔖' : '📑'}
        </button>
      </div>

      {showComments && (
        <div className="mt-3 pt-3 border-t border-white/5 space-y-2.5">
          {loadingComments ? (
            <div className="text-center text-white/20 text-sm py-3">Loading...</div>
          ) : comments.length === 0 ? (
            <div className="text-center text-white/15 text-sm py-2">No comments yet</div>
          ) : comments.map(c => (
            <div key={c.id} className="flex gap-2">
              <Link href={`/profile/${c.profiles?.username || 'unknown'}`} className="text-lg shrink-0">{c.profiles?.avatar_emoji || '😎'}</Link>
              <div className="flex-1 bg-white/3 rounded-xl px-3 py-2">
                <div className="flex items-center gap-2">
                  <Link href={`/profile/${c.profiles?.username || 'unknown'}`} className="font-semibold text-xs hover:underline">{c.profiles?.display_name || 'User'}</Link>
                  <span className="text-[10px] text-white/20">{timeAgo(c.created_at)}</span>
                </div>
                <p className="text-sm mt-0.5 text-white/70">{c.content}</p>
              </div>
            </div>
          ))}
          {user && (
            <div className="flex gap-2 mt-2">
              <span className="text-lg shrink-0">{profile?.avatar_emoji || '😎'}</span>
              <input value={commentText} onChange={e => setCommentText(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && submitComment()}
                placeholder="Write a comment..." className="input-field flex-1 py-2 text-sm" />
              <button onClick={submitComment} disabled={!commentText.trim()} className="btn-primary py-2 px-3 text-xs disabled:opacity-30">Send</button>
            </div>
          )}
        </div>
      )}
    </article>
  );
}
