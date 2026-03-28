'use client';
import { useState } from 'react';
import Link from 'next/link';
import { useStore } from '@/lib/store';
import { createClient } from '@/lib/supabase-browser';
import { PLATFORMS, formatCount, timeAgo } from '@/lib/constants';

export default function PostCard({ post, onUpdate }) {
  const { user, profile } = useStore();
  const [liked, setLiked] = useState(post.user_liked || false);
  const [likesCount, setLikesCount] = useState(post.likes_count || 0);
  const [bookmarked, setBookmarked] = useState(post.user_bookmarked || false);
  const [showComments, setShowComments] = useState(false);
  const [comments, setComments] = useState([]);
  const [commentText, setCommentText] = useState('');
  const [showShareMenu, setShowShareMenu] = useState(false);
  const [loadingComments, setLoadingComments] = useState(false);

  const plat = PLATFORMS[post.source_platform] || PLATFORMS.midashub;
  const postUser = post.profiles || post.user || {};

  const handleLike = async () => {
    if (!user) return useStore.getState().setShowAuth(true);
    const supabase = createClient();
    if (liked) {
      setLiked(false);
      setLikesCount((c) => c - 1);
      await supabase.from('likes').delete().match({ user_id: user.id, post_id: post.id });
    } else {
      setLiked(true);
      setLikesCount((c) => c + 1);
      await supabase.from('likes').insert({ user_id: user.id, post_id: post.id });
      // Notify post owner
      if (post.user_id !== user.id) {
        await supabase.from('notifications').insert({
          user_id: post.user_id,
          from_user_id: user.id,
          type: 'like',
          reference_id: post.id,
        });
      }
    }
  };

  const handleBookmark = async () => {
    if (!user) return useStore.getState().setShowAuth(true);
    const supabase = createClient();
    if (bookmarked) {
      setBookmarked(false);
      await supabase.from('bookmarks').delete().match({ user_id: user.id, post_id: post.id });
    } else {
      setBookmarked(true);
      await supabase.from('bookmarks').insert({ user_id: user.id, post_id: post.id });
    }
  };

  const loadComments = async () => {
    setShowComments(!showComments);
    if (showComments) return;
    setLoadingComments(true);
    const supabase = createClient();
    const { data } = await supabase
      .from('comments')
      .select('*, profiles(*)')
      .eq('post_id', post.id)
      .order('created_at', { ascending: true })
      .limit(50);
    setComments(data || []);
    setLoadingComments(false);
  };

  const submitComment = async () => {
    if (!commentText.trim() || !user) return;
    const supabase = createClient();
    const { data } = await supabase
      .from('comments')
      .insert({ user_id: user.id, post_id: post.id, content: commentText.trim() })
      .select('*, profiles(*)')
      .single();
    if (data) {
      setComments([...comments, data]);
      setCommentText('');
      // Notify post owner
      if (post.user_id !== user.id) {
        await supabase.from('notifications').insert({
          user_id: post.user_id,
          from_user_id: user.id,
          type: 'comment',
          reference_id: post.id,
        });
      }
    }
  };

  const handleRepost = async () => {
    if (!user) return useStore.getState().setShowAuth(true);
    const supabase = createClient();
    await supabase.from('reposts').insert({ user_id: user.id, post_id: post.id });
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
      {/* Viral badge */}
      {post.is_viral && (
        <div className="flex items-center gap-1.5 text-[11px] font-bold text-orange-400 mb-3">
          <span>🔥</span> VIRAL — {formatCount(post.views_count || post.likes_count * 10)} views
        </div>
      )}

      {/* User info */}
      <div className="flex items-center gap-3 mb-3">
        <Link href={`/profile/${postUser.username}`} className="text-3xl hover:scale-110 transition-transform">
          {postUser.avatar_emoji || '😎'}
        </Link>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <Link href={`/profile/${postUser.username}`} className="font-bold text-sm hover:underline">
              {postUser.display_name || 'User'}
            </Link>
            <span className="text-xs text-white/30">@{postUser.username}</span>
          </div>
          <div className="flex items-center gap-2 mt-0.5">
            <span className="platform-pill text-[10px]" style={{ background: `${plat.color}22`, color: plat.color }}>
              {plat.icon} via {plat.name}
            </span>
            <span className="text-[11px] text-white/25">{timeAgo(post.created_at)}</span>
          </div>
        </div>
        {post.source_url && (
          <a href={post.source_url} target="_blank" rel="noopener noreferrer"
            className="text-xs text-white/30 hover:text-white/60 transition"
          >
            🔗 Source
          </a>
        )}
      </div>

      {/* Content */}
      <p className="text-[15px] leading-relaxed whitespace-pre-wrap break-words mb-3">
        {post.content}
      </p>

      {/* Tags */}
      {post.tags && post.tags.length > 0 && (
        <div className="flex flex-wrap gap-1.5 mb-3">
          {post.tags.map((tag) => (
            <span key={tag} className="text-xs text-yellow-400/80 hover:text-yellow-400 cursor-pointer">
              #{tag}
            </span>
          ))}
        </div>
      )}

      {/* Media */}
      {post.media_urls && post.media_urls.length > 0 && (
        <div className={`grid gap-2 mb-3 rounded-xl overflow-hidden ${post.media_urls.length === 1 ? 'grid-cols-1' : 'grid-cols-2'}`}>
          {post.media_urls.map((url, i) => (
            <div key={i} className="aspect-video bg-white/5 rounded-xl overflow-hidden">
              <img src={url} alt="" className="w-full h-full object-cover" loading="lazy" />
            </div>
          ))}
        </div>
      )}

      {/* Actions */}
      <div className="flex items-center gap-1 pt-3 border-t border-white/5">
        <button onClick={handleLike}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm transition hover:bg-white/5 ${liked ? 'text-red-400' : 'text-white/40'}`}
        >
          <span>{liked ? '❤️' : '🤍'}</span>
          <span>{formatCount(likesCount)}</span>
        </button>

        <button onClick={loadComments}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm transition hover:bg-white/5 ${showComments ? 'text-blue-400' : 'text-white/40'}`}
        >
          <span>💬</span>
          <span>{formatCount(post.comments_count || 0)}</span>
        </button>

        <button onClick={handleRepost}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm text-white/40 transition hover:bg-white/5 hover:text-green-400"
        >
          <span>🔄</span>
          <span>{formatCount(post.reposts_count || 0)}</span>
        </button>

        <div className="relative ml-auto">
          <button onClick={() => setShowShareMenu(!showShareMenu)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm text-white/40 transition hover:bg-white/5"
          >
            <span>📤</span> Share
          </button>
          {showShareMenu && (
            <div className="absolute bottom-full right-0 mb-2 glass rounded-xl p-2 w-48 shadow-2xl animate-slide-up z-10">
              <div className="text-xs text-white/30 px-2 py-1 mb-1">Share to...</div>
              {['twitter', 'facebook', 'whatsapp', 'linkedin'].map((p) => (
                <button key={p} onClick={() => shareToSocial(p)}
                  className="w-full flex items-center gap-2 px-3 py-2 rounded-lg hover:bg-white/5 text-sm transition text-left"
                >
                  <span>{PLATFORMS[p].icon}</span> {PLATFORMS[p].name}
                </button>
              ))}
              <button onClick={() => { navigator.clipboard.writeText(`${window.location.origin}/post/${post.id}`); setShowShareMenu(false); }}
                className="w-full flex items-center gap-2 px-3 py-2 rounded-lg hover:bg-white/5 text-sm transition text-left"
              >
                📋 Copy Link
              </button>
            </div>
          )}
        </div>

        <button onClick={handleBookmark}
          className={`px-2 py-1.5 rounded-lg text-sm transition hover:bg-white/5 ${bookmarked ? 'text-yellow-400' : 'text-white/40'}`}
        >
          {bookmarked ? '🔖' : '📑'}
        </button>
      </div>

      {/* Comments section */}
      {showComments && (
        <div className="mt-4 pt-4 border-t border-white/5 space-y-3 animate-fade-in">
          {loadingComments ? (
            <div className="text-center text-white/30 text-sm py-4">Loading comments...</div>
          ) : comments.length === 0 ? (
            <div className="text-center text-white/20 text-sm py-2">No comments yet — be the first!</div>
          ) : comments.map((c) => (
            <div key={c.id} className="flex gap-2.5">
              <Link href={`/profile/${c.profiles?.username}`} className="text-xl shrink-0">{c.profiles?.avatar_emoji || '😎'}</Link>
              <div className="flex-1 bg-white/3 rounded-xl px-3 py-2">
                <div className="flex items-center gap-2">
                  <Link href={`/profile/${c.profiles?.username}`} className="font-semibold text-xs hover:underline">{c.profiles?.display_name}</Link>
                  <span className="text-[10px] text-white/25">{timeAgo(c.created_at)}</span>
                </div>
                <p className="text-sm mt-1 text-white/80">{c.content}</p>
              </div>
            </div>
          ))}

          {/* Comment input */}
          {user && (
            <div className="flex gap-2 mt-2">
              <span className="text-xl shrink-0">{profile?.avatar_emoji || '😎'}</span>
              <input
                value={commentText}
                onChange={(e) => setCommentText(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && submitComment()}
                placeholder="Write a comment..."
                className="input-field flex-1 py-2 text-sm"
              />
              <button onClick={submitComment} className="btn-primary py-2 px-4 text-xs">
                Send
              </button>
            </div>
          )}
        </div>
      )}
    </article>
  );
}
