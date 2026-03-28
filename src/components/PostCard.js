'use client';
import { useState } from 'react';
import Link from 'next/link';
import { useStore } from '@/lib/store';
import { createClient } from '@/lib/supabase-browser';
import { PLATFORMS, formatCount, timeAgo } from '@/lib/constants';

export default function PostCard({ post, onPostUpdated }) {
  const { user, profile, showToast } = useStore();
  const [liked, setLiked] = useState(post.user_liked || false);
  const [likesCount, setLikesCount] = useState(post.likes_count || 0);
  const [reposted, setReposted] = useState(post.user_reposted || false);
  const [repostsCount, setRepostsCount] = useState(post.reposts_count || 0);
  const [bookmarked, setBookmarked] = useState(post.user_bookmarked || false);
  const [showComments, setShowComments] = useState(false);
  const [comments, setComments] = useState([]);
  const [commentText, setCommentText] = useState('');
  const [showShareMenu, setShowShareMenu] = useState(false);
  const [showOptions, setShowOptions] = useState(false);
  const [loadingComments, setLoadingComments] = useState(false);
  const [editing, setEditing] = useState(false);
  const [editContent, setEditContent] = useState(post.content);
  const [savingEdit, setSavingEdit] = useState(false);

  const plat = PLATFORMS[post.source_platform] || PLATFORMS.midashub;
  const postUser = post.profiles || {};
  const isOwner = user?.id === post.user_id;

  // ===== LIKE =====
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
          await supabase.from('notifications').insert({
            user_id: post.user_id, from_user_id: user.id, type: 'like',
            reference_id: post.id, content: `${profile?.display_name} liked your post`
          });
        }
      }
    } catch (e) { console.warn('Like error:', e); }
  };

  // ===== REPOST =====
  const handleRepost = async () => {
    if (!user) return useStore.getState().setShowAuth(true);
    if (reposted) { showToast?.('Already reposted'); return; }
    const supabase = createClient();
    try {
      const { error } = await supabase.from('reposts').insert({ user_id: user.id, post_id: post.id });
      if (error) {
        if (error.code === '23505') { showToast?.('Already reposted'); setReposted(true); return; }
        throw error;
      }
      setReposted(true);
      setRepostsCount(c => c + 1);
      showToast?.('Reposted to your profile ✓');
      if (post.user_id !== user.id) {
        await supabase.from('notifications').insert({
          user_id: post.user_id, from_user_id: user.id, type: 'repost',
          reference_id: post.id, content: `${profile?.display_name} reposted your post`
        });
      }
    } catch (e) {
      console.warn('Repost error:', e);
      showToast?.('Could not repost. Try again.');
    }
  };

  // ===== BOOKMARK =====
  const handleBookmark = async () => {
    if (!user) return useStore.getState().setShowAuth(true);
    const supabase = createClient();
    try {
      if (bookmarked) {
        setBookmarked(false);
        await supabase.from('bookmarks').delete().match({ user_id: user.id, post_id: post.id });
        showToast?.('Removed from saved');
      } else {
        setBookmarked(true);
        await supabase.from('bookmarks').insert({ user_id: user.id, post_id: post.id });
        showToast?.('Saved to bookmarks ✓');
      }
    } catch (e) { console.warn('Bookmark error:', e); }
  };

  // ===== COMMENTS =====
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
        setComments(prev => [...prev, data]);
        setCommentText('');
        if (post.user_id !== user.id) {
          await supabase.from('notifications').insert({
            user_id: post.user_id, from_user_id: user.id, type: 'comment',
            reference_id: post.id, content: `${profile?.display_name} commented on your post`
          });
        }
      }
    } catch (e) { console.warn('Comment error:', e); }
  };

  // ===== EDIT POST =====
  const saveEdit = async () => {
    if (!editContent.trim() || savingEdit) return;
    setSavingEdit(true);
    try {
      const supabase = createClient();
      const { error } = await supabase.from('posts').update({ content: editContent.trim(), updated_at: new Date().toISOString() }).eq('id', post.id);
      if (!error) {
        post.content = editContent.trim();
        setEditing(false);
        showToast?.('Post updated ✓');
        onPostUpdated?.();
      } else {
        showToast?.('Failed to update');
      }
    } catch (e) { showToast?.('Error updating post'); }
    setSavingEdit(false);
  };

  // ===== DELETE POST =====
  const deletePost = async () => {
    if (!confirm('Delete this post? This cannot be undone.')) return;
    try {
      const supabase = createClient();
      await supabase.from('posts').delete().eq('id', post.id);
      showToast?.('Post deleted');
      onPostUpdated?.();
      window.dispatchEvent(new Event('midashub:newpost'));
    } catch (e) { showToast?.('Failed to delete'); }
  };

  // ===== SHARE =====
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
          🔥 Trending — {formatCount(post.views_count || post.likes_count * 10)} views
        </div>
      )}

      {/* Header: avatar, name, platform, time, options */}
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
              {plat.icon} via {plat.name}
            </span>
            <span className="text-[11px] text-white/20">{timeAgo(post.created_at)}</span>
            {post.updated_at && post.updated_at !== post.created_at && (
              <span className="text-[10px] text-white/15">(edited)</span>
            )}
          </div>
        </div>

        {/* Options menu (edit/delete for owner, report for others) */}
        <div className="relative">
          <button onClick={() => setShowOptions(!showOptions)} className="w-7 h-7 rounded-full flex items-center justify-center text-white/20 hover:bg-white/5 hover:text-white/50 transition text-sm">⋯</button>
          {showOptions && (
            <div className="absolute top-8 right-0 glass rounded-xl p-1.5 w-44 shadow-2xl z-20">
              {isOwner && (
                <>
                  <button onClick={() => { setEditing(true); setEditContent(post.content); setShowOptions(false); }}
                    className="w-full flex items-center gap-2 px-3 py-2 rounded-lg hover:bg-white/5 text-sm transition text-left">
                    ✏️ Edit post
                  </button>
                  <button onClick={() => { deletePost(); setShowOptions(false); }}
                    className="w-full flex items-center gap-2 px-3 py-2 rounded-lg hover:bg-red-500/10 text-red-400 text-sm transition text-left">
                    🗑️ Delete post
                  </button>
                </>
              )}
              {post.source_url && (
                <a href={post.source_url} target="_blank" rel="noopener noreferrer"
                  className="w-full flex items-center gap-2 px-3 py-2 rounded-lg hover:bg-white/5 text-sm transition text-left">
                  🔗 View original
                </a>
              )}
              <button onClick={() => { navigator.clipboard.writeText(`${window.location.origin}/post/${post.id}`); showToast?.('Link copied ✓'); setShowOptions(false); }}
                className="w-full flex items-center gap-2 px-3 py-2 rounded-lg hover:bg-white/5 text-sm transition text-left">
                📋 Copy link
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Content — normal or editing */}
      {editing ? (
        <div className="mb-3">
          <textarea value={editContent} onChange={e => setEditContent(e.target.value)}
            className="w-full h-24 p-3 rounded-xl bg-white/5 border border-[var(--accent)] text-white text-sm resize-none outline-none leading-relaxed" autoFocus />
          <div className="flex gap-2 mt-2">
            <button onClick={saveEdit} disabled={savingEdit || !editContent.trim()} className="btn-primary py-2 px-4 text-xs disabled:opacity-40">
              {savingEdit ? '⏳ Saving...' : '✓ Save changes'}
            </button>
            <button onClick={() => setEditing(false)} className="btn-secondary py-2 px-4 text-xs">Cancel</button>
          </div>
        </div>
      ) : (
        <p className="text-[15px] leading-relaxed whitespace-pre-wrap break-words">{post.content}</p>
      )}

      {/* Tags */}
      {post.tags?.length > 0 && (
        <div className="flex flex-wrap gap-1.5 mt-2">
          {post.tags.map(tag => <span key={tag} className="text-xs text-[var(--accent)] opacity-70">#{tag}</span>)}
        </div>
      )}

      {/* Media */}
      {post.media_urls?.length > 0 && (
        <div className={`grid gap-1.5 mt-3 rounded-xl overflow-hidden ${post.media_urls.length === 1 ? 'grid-cols-1' : 'grid-cols-2'}`}>
          {post.media_urls.map((url, i) => (
            <div key={i} className="aspect-video bg-white/5 rounded-xl overflow-hidden">
              <img src={url} alt="" className="w-full h-full object-cover" loading="lazy" />
            </div>
          ))}
        </div>
      )}

      {/* Action bar with clear labels */}
      <div className="flex items-center gap-1 mt-3 pt-3 border-t border-white/5">
        {/* Like */}
        <button onClick={handleLike} title="Like this post"
          className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm transition hover:bg-white/5 ${liked ? 'text-red-400' : 'text-white/35'}`}>
          {liked ? '❤️' : '🤍'} <span className="text-xs font-medium">{formatCount(likesCount)}</span>
        </button>

        {/* Comment */}
        <button onClick={loadComments} title="View comments"
          className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm transition hover:bg-white/5 ${showComments ? 'text-blue-400' : 'text-white/35'}`}>
          💬 <span className="text-xs font-medium">{formatCount(post.comments_count || 0)}</span>
        </button>

        {/* Repost */}
        <button onClick={handleRepost} title="Repost to your profile"
          className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm transition hover:bg-white/5 ${reposted ? 'text-green-400' : 'text-white/35 hover:text-green-400'}`}>
          🔄 <span className="text-xs font-medium">{formatCount(repostsCount)}</span>
        </button>

        {/* Share */}
        <div className="relative ml-auto">
          <button onClick={() => setShowShareMenu(!showShareMenu)} title="Share this post"
            className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm text-white/35 transition hover:bg-white/5">
            📤 <span className="text-xs hidden sm:inline">Share</span>
          </button>
          {showShareMenu && (
            <div className="absolute bottom-full right-0 mb-1 glass rounded-xl p-1.5 w-48 shadow-2xl z-10">
              <div className="text-[10px] text-white/25 px-3 py-1 font-semibold uppercase tracking-wider">Share to</div>
              {[
                { key: 'twitter', label: 'X (Twitter)' },
                { key: 'facebook', label: 'Facebook' },
                { key: 'whatsapp', label: 'WhatsApp' },
                { key: 'linkedin', label: 'LinkedIn' },
              ].map(p => (
                <button key={p.key} onClick={() => shareToSocial(p.key)} className="w-full flex items-center gap-2 px-3 py-2 rounded-lg hover:bg-white/5 text-sm transition text-left">
                  {PLATFORMS[p.key].icon} {p.label}
                </button>
              ))}
              <div className="border-t border-white/5 my-1" />
              <button onClick={() => { navigator.clipboard.writeText(`${window.location.origin}/post/${post.id}`); showToast?.('Link copied ✓'); setShowShareMenu(false); }}
                className="w-full flex items-center gap-2 px-3 py-2 rounded-lg hover:bg-white/5 text-sm transition text-left">📋 Copy link</button>
            </div>
          )}
        </div>

        {/* Bookmark */}
        <button onClick={handleBookmark} title={bookmarked ? 'Remove from saved' : 'Save for later'}
          className={`px-2 py-2 rounded-lg text-sm transition hover:bg-white/5 ${bookmarked ? 'text-[var(--accent)]' : 'text-white/35'}`}>
          {bookmarked ? '🔖' : '📑'}
        </button>
      </div>

      {/* Comments section */}
      {showComments && (
        <div className="mt-3 pt-3 border-t border-white/5 space-y-2.5">
          {loadingComments ? (
            <div className="text-center text-white/20 text-sm py-3">Loading comments...</div>
          ) : comments.length === 0 ? (
            <div className="text-center text-white/15 text-sm py-3">No comments yet — be the first!</div>
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
          {user ? (
            <div className="flex gap-2 mt-2">
              <span className="text-lg shrink-0">{profile?.avatar_emoji || '😎'}</span>
              <input value={commentText} onChange={e => setCommentText(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && submitComment()}
                placeholder="Write a comment..." className="input-field flex-1 py-2 text-sm" />
              <button onClick={submitComment} disabled={!commentText.trim()} className="btn-primary py-2 px-4 text-xs disabled:opacity-30">Post</button>
            </div>
          ) : (
            <div className="text-center py-2">
              <button onClick={() => useStore.getState().setShowAuth(true)} className="text-xs text-[var(--accent)] hover:underline">Log in to comment</button>
            </div>
          )}
        </div>
      )}
    </article>
  );
}
