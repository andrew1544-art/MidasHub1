'use client';
import { useState, useRef, useEffect } from 'react';
import Link from 'next/link';
import { useStore } from '@/lib/store';
import { createClient } from '@/lib/supabase-browser';
import { sendNotification } from '@/lib/notifications';
import { PLATFORMS, formatCount, timeAgo } from '@/lib/constants';
import { RankBadge } from '@/components/RankBadge';
import MediaViewer from '@/components/MediaViewer';
import EditPostModal from '@/components/EditPostModal';

function CommentItem({ comment, postOwnerId, onDelete }) {
  const { user, showToast } = useStore();
  const [editing, setEditing] = useState(false);
  const [editText, setEditText] = useState(comment.content);
  const [displayText, setDisplayText] = useState(comment.content);
  const [saving, setSaving] = useState(false);
  const [showMenu, setShowMenu] = useState(false);
  const isOwner = user?.id === comment.user_id;
  const isPostOwner = user?.id === postOwnerId;
  const menuRef = useRef(null);

  useEffect(() => {
    const h = (e) => { if (menuRef.current && !menuRef.current.contains(e.target)) setShowMenu(false); };
    document.addEventListener('mousedown', h);
    return () => document.removeEventListener('mousedown', h);
  }, []);

  const saveEdit = async () => {
    if (!editText.trim() || saving) return;
    setSaving(true);
    try {
      const supabase = createClient();
      const { error } = await supabase.from('comments').update({ content: editText.trim() }).eq('id', comment.id);
      if (!error) { setDisplayText(editText.trim()); setEditing(false); showToast?.('Comment updated ✓'); }
      else showToast?.('Failed to update');
    } catch (e) { showToast?.('Error saving'); }
    setSaving(false);
  };

  const handleDelete = async () => {
    if (!confirm('Delete this comment?')) return;
    try {
      const supabase = createClient();
      await supabase.from('comments').delete().eq('id', comment.id);
      onDelete?.(comment.id);
      showToast?.('Comment deleted');
    } catch (e) { showToast?.('Failed to delete'); }
  };

  return (
    <div className="flex gap-2">
      <Link href={`/profile/${comment.profiles?.username || 'unknown'}`} className="text-lg shrink-0 mt-0.5">{comment.profiles?.avatar_emoji || '😎'}</Link>
      <div className="flex-1 min-w-0">
        <div className="bg-white/3 rounded-xl px-3 py-2">
          <div className="flex items-center gap-1.5 mb-0.5 flex-wrap">
            <Link href={`/profile/${comment.profiles?.username || 'unknown'}`} className="font-semibold text-xs hover:underline">{comment.profiles?.display_name || 'User'}</Link>
            <RankBadge xp={comment.profiles?.xp || 0} size="xs" />
            <span className="text-[10px] text-white/20">{timeAgo(comment.created_at)}</span>
            {(isOwner || isPostOwner) && (
              <div className="relative ml-auto" ref={menuRef}>
                <button onClick={() => setShowMenu(!showMenu)}
                  className="w-6 h-6 rounded-full flex items-center justify-center text-white/30 hover:text-white/60 hover:bg-white/10 text-xs">⋯</button>
                {showMenu && (
                  <div className="absolute top-7 right-0 glass rounded-lg p-1 w-36 shadow-xl z-20">
                    {isOwner && <button onClick={() => { setEditing(true); setEditText(displayText); setShowMenu(false); }} className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-xs hover:bg-white/5 text-left">✏️ Edit</button>}
                    <button onClick={() => { handleDelete(); setShowMenu(false); }} className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-xs hover:bg-red-500/10 text-red-400 text-left">🗑️ Delete</button>
                  </div>
                )}
              </div>
            )}
          </div>
          {editing ? (
            <div>
              <input value={editText} onChange={e => setEditText(e.target.value)} onKeyDown={e => e.key === 'Enter' && saveEdit()}
                className="w-full bg-white/5 border border-[var(--accent)] rounded-lg px-2.5 py-1.5 text-sm text-white outline-none" autoFocus style={{ fontSize: '16px' }} />
              <div className="flex gap-1.5 mt-1.5">
                <button onClick={saveEdit} disabled={saving} className="text-[11px] font-semibold px-3 py-1.5 rounded-lg accent-gradient text-black">{saving ? '...' : 'Save'}</button>
                <button onClick={() => setEditing(false)} className="text-[11px] font-semibold px-3 py-1.5 rounded-lg bg-white/5 text-white/50">Cancel</button>
              </div>
            </div>
          ) : (
            <p className="text-sm text-white/70 break-words">{displayText}</p>
          )}
        </div>
      </div>
    </div>
  );
}

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
  const [commentsCount, setCommentsCount] = useState(post.comments_count || 0);
  const [showShareMenu, setShowShareMenu] = useState(false);
  const [showOptions, setShowOptions] = useState(false);
  const [loadingComments, setLoadingComments] = useState(false);
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [displayContent, setDisplayContent] = useState(post.content);
  const [displayMedia, setDisplayMedia] = useState(post.media_urls || []);
  const [displayTags, setDisplayTags] = useState(post.tags || []);
  const [displayPublic, setDisplayPublic] = useState(post.is_public !== false);
  const [displayPlatform, setDisplayPlatform] = useState(post.source_platform);
  const [showRepostMenu, setShowRepostMenu] = useState(false);
  const [viewerOpen, setViewerOpen] = useState(false);
  const [viewerIndex, setViewerIndex] = useState(0);
  const optionsRef = useRef(null);
  const shareRef = useRef(null);
  const repostRef = useRef(null);

  const plat = PLATFORMS[displayPlatform] || PLATFORMS.midashub;
  const postUser = post.profiles || {};
  const isOwner = user?.id === post.user_id;

  useEffect(() => {
    const h = (e) => {
      if (optionsRef.current && !optionsRef.current.contains(e.target)) setShowOptions(false);
      if (shareRef.current && !shareRef.current.contains(e.target)) setShowShareMenu(false);
      if (repostRef.current && !repostRef.current.contains(e.target)) setShowRepostMenu(false);
    };
    document.addEventListener('mousedown', h);
    return () => document.removeEventListener('mousedown', h);
  }, []);

  const handleLike = async () => {
    if (!user) return useStore.getState().setShowAuth(true);
    const supabase = createClient();
    if (liked) {
      setLiked(false); setLikesCount(c => c - 1);
      try { await supabase.from('likes').delete().match({ user_id: user.id, post_id: post.id }); } catch (e) {}
    } else {
      setLiked(true); setLikesCount(c => c + 1);
      try {
        const { error } = await supabase.from('likes').insert({ user_id: user.id, post_id: post.id });
        if (error) { console.warn('Like insert failed:', error.message); return; }
        // Send notification — don't await, fire and forget
        sendNotification({ toUserId: post.user_id, fromUserId: user.id, type: 'like', referenceId: post.id, content: 'liked your post ❤️' });
      } catch (e) { console.warn('Like error:', e); }
    }
  };

  const handleRepost = async () => {
    if (!user) return useStore.getState().setShowAuth(true);
    if (reposted) { showToast?.('Already reposted'); setShowRepostMenu(false); return; }
    try {
      const supabase = createClient();
      const { error } = await supabase.from('reposts').insert({ user_id: user.id, post_id: post.id });
      if (error && error.code === '23505') { showToast?.('Already reposted'); setReposted(true); setShowRepostMenu(false); return; }
      if (error) { showToast?.('Repost failed'); return; }
      setReposted(true); setRepostsCount(c => c + 1); setShowRepostMenu(false);
      showToast?.('Reposted ✓');
      sendNotification({ toUserId: post.user_id, fromUserId: user.id, type: 'repost', referenceId: post.id, content: 'reposted your post 🔄' });
    } catch (e) { showToast?.('Could not repost'); }
  };

  const handleRepostWithComment = () => {
    if (!user) return useStore.getState().setShowAuth(true);
    setShowRepostMenu(false);
    useStore.getState().setShowCompose(true);
    if (typeof window !== 'undefined') {
      window.__midashub_quote = { content: post.content, user: postUser.display_name, username: postUser.username };
    }
  };

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
        showToast?.('Saved ✓');
      }
    } catch (e) {}
  };

  const loadComments = async () => {
    const next = !showComments;
    setShowComments(next);
    if (!next) return;
    setLoadingComments(true);
    try {
      const supabase = createClient();
      const { data } = await supabase.from('comments').select('*, profiles(*)').eq('post_id', post.id).order('created_at', { ascending: true }).limit(100);
      setComments(data || []);
    } catch (e) {}
    setLoadingComments(false);
  };

  const submitComment = async () => {
    if (!commentText.trim() || !user) return;
    const text = commentText.trim();
    setCommentText('');
    try {
      const supabase = createClient();
      const { data, error } = await supabase.from('comments').insert({ user_id: user.id, post_id: post.id, content: text }).select('*, profiles(*)').single();
      if (error) { console.warn('Comment insert failed:', error.message); setCommentText(text); return; }
      if (data) {
        setComments(prev => [...prev, data]);
        setCommentsCount(c => c + 1);
        sendNotification({ toUserId: post.user_id, fromUserId: user.id, type: 'comment', referenceId: post.id, content: `commented: "${text.slice(0, 60)}" 💬` });
      }
    } catch (e) { setCommentText(text); }
  };

  const handleEditSaved = () => {
    // Refresh the post data from parent
    onPostUpdated?.();
  };

  const deletePost = async () => {
    if (!confirm('Delete this post permanently?')) return;
    try {
      const supabase = createClient();
      await supabase.from('posts').delete().eq('id', post.id);
      showToast?.('Post deleted'); onPostUpdated?.();
    } catch (e) { showToast?.('Failed to delete'); }
  };

  const shareToSocial = (platform) => {
    const text = encodeURIComponent(displayContent.slice(0, 280));
    const url = encodeURIComponent(`${window.location.origin}/post/${post.id}`);
    const links = { twitter: `https://twitter.com/intent/tweet?text=${text}&url=${url}`, facebook: `https://www.facebook.com/sharer/sharer.php?u=${url}`, whatsapp: `https://wa.me/?text=${text}%20${url}`, linkedin: `https://www.linkedin.com/shareArticle?mini=true&url=${url}&title=${text}` };
    if (links[platform]) window.open(links[platform], '_blank');
    setShowShareMenu(false);
  };

  const handleDeleteComment = (cid) => { setComments(prev => prev.filter(c => c.id !== cid)); setCommentsCount(c => Math.max(0, c - 1)); };

  return (
    <article className="post-card">
      {post.is_viral && <div className="flex items-center gap-1.5 text-[11px] font-bold text-orange-400 mb-3">🔥 Trending — {formatCount(post.views_count || post.likes_count * 10)} views</div>}

      <div className="flex items-center gap-3 mb-3">
        <Link href={`/profile/${postUser.username || 'unknown'}`} className="text-3xl shrink-0">{postUser.avatar_emoji || '😎'}</Link>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5 flex-wrap">
            <Link href={`/profile/${postUser.username || 'unknown'}`} className="font-bold text-sm hover:underline truncate">{postUser.display_name || 'User'}</Link>
            {postUser.trade_count >= 2 && <span className="text-xs" title="Verified Trader">✅</span>}
            <RankBadge xp={postUser.xp || 0} size="xs" />
            <span className="text-xs text-white/25 truncate">@{postUser.username || 'user'}</span>
          </div>
          <div className="flex items-center gap-2 mt-0.5">
            <span className="platform-pill text-[10px] py-0.5" style={{ background: `${plat.color}18`, color: plat.color }}>{plat.icon} via {plat.name}</span>
            <span className="text-[11px] text-white/20">{timeAgo(post.created_at)}</span>
            {post.updated_at && post.updated_at !== post.created_at && <span className="text-[10px] text-white/15 italic">edited</span>}
            {isOwner && <span className="text-[10px] text-white/15">{displayPublic === false ? '🔒' : '🌍'}</span>}
          </div>
        </div>
        <div className="relative" ref={optionsRef}>
          <button onClick={() => setShowOptions(!showOptions)} className="w-8 h-8 rounded-full flex items-center justify-center text-white/25 hover:bg-white/5 text-sm">⋯</button>
          {showOptions && (
            <div className="absolute top-9 right-0 glass rounded-xl p-1.5 w-44 shadow-2xl z-20">
              {isOwner && <>
                <button onClick={() => { setEditModalOpen(true); setShowOptions(false); }} className="w-full flex items-center gap-2 px-3 py-2.5 rounded-lg hover:bg-white/5 text-sm text-left">✏️ Edit post</button>
                <button onClick={() => { deletePost(); setShowOptions(false); }} className="w-full flex items-center gap-2 px-3 py-2.5 rounded-lg hover:bg-red-500/10 text-red-400 text-sm text-left">🗑️ Delete post</button>
              </>}
              {post.source_url && <a href={post.source_url} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 px-3 py-2.5 rounded-lg hover:bg-white/5 text-sm">🔗 View original</a>}
              <button onClick={() => { navigator.clipboard.writeText(`${window.location.origin}/post/${post.id}`); showToast?.('Link copied ✓'); setShowOptions(false); }} className="w-full flex items-center gap-2 px-3 py-2.5 rounded-lg hover:bg-white/5 text-sm text-left">📋 Copy link</button>
            </div>
          )}
        </div>
      </div>

      {/* Content */}
      <p className="text-[15px] leading-relaxed whitespace-pre-wrap break-words">{displayContent}</p>

      {displayTags.length > 0 && <div className="flex flex-wrap gap-1.5 mt-2">{displayTags.map(tag => <span key={tag} className="text-xs text-[var(--accent)] opacity-70">#{tag}</span>)}</div>}

      {displayMedia.length > 0 && (
        <>
          <div className={`grid gap-1.5 mt-3 rounded-xl overflow-hidden ${displayMedia.length === 1 ? 'grid-cols-1' : 'grid-cols-2'}`}>
            {displayMedia.map((url, i) => {
              const isVid = /\.(mp4|webm|mov|avi|ogg)$/i.test(url) || post.media_type === 'video';
              return (
                <div key={i} className="aspect-video bg-white/5 rounded-xl overflow-hidden relative cursor-pointer group"
                  onClick={() => { setViewerIndex(i); setViewerOpen(true); }}>
                  {isVid ? (
                    <>
                      <video src={url} className="w-full h-full object-cover" preload="metadata" muted />
                      <div className="absolute inset-0 flex items-center justify-center bg-black/20 group-hover:bg-black/30 transition">
                        <div className="w-12 h-12 rounded-full bg-white/20 backdrop-blur flex items-center justify-center text-xl">▶</div>
                      </div>
                    </>
                  ) : (
                    <img src={url} alt="" className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" loading="lazy" />
                  )}
                </div>
              );
            })}
          </div>
          {viewerOpen && (
            <MediaViewer
              media={displayMedia.map(url => ({
                url,
                type: /\.(mp4|webm|mov|avi|ogg)$/i.test(url) || post.media_type === 'video' ? 'video' : 'image',
              }))}
              startIndex={viewerIndex}
              onClose={() => setViewerOpen(false)}
            />
          )}
        </>
      )}

      <div className="flex items-center gap-0.5 mt-3 pt-3 border-t border-white/5">
        <button onClick={handleLike} className={`flex items-center gap-1.5 px-2.5 py-2 rounded-lg text-sm ${liked ? 'text-red-400' : 'text-white/35'}`}>{liked ? '❤️' : '🤍'} <span className="text-xs font-medium">{formatCount(likesCount)}</span></button>
        <button onClick={loadComments} className={`flex items-center gap-1.5 px-2.5 py-2 rounded-lg text-sm ${showComments ? 'text-blue-400' : 'text-white/35'}`}>💬 <span className="text-xs font-medium">{formatCount(commentsCount)}</span></button>
        <div className="relative" ref={repostRef}>
          <button onClick={() => setShowRepostMenu(!showRepostMenu)} className={`flex items-center gap-1.5 px-2.5 py-2 rounded-lg text-sm ${reposted ? 'text-green-400' : 'text-white/35'}`}>🔄 <span className="text-xs font-medium">{formatCount(repostsCount)}</span></button>
          {showRepostMenu && (
            <div className="absolute bottom-full left-0 mb-1 glass rounded-xl p-1.5 w-52 shadow-2xl z-10">
              <button onClick={handleRepost} className="w-full flex items-center gap-2 px-3 py-2.5 rounded-lg hover:bg-white/5 text-sm text-left">{reposted ? '✓ Already reposted' : '🔄 Repost'}</button>
              <button onClick={handleRepostWithComment} className="w-full flex items-center gap-2 px-3 py-2.5 rounded-lg hover:bg-white/5 text-sm text-left">💬 Repost with comment</button>
            </div>
          )}
        </div>
        <div className="relative ml-auto" ref={shareRef}>
          <button onClick={() => setShowShareMenu(!showShareMenu)} className="flex items-center gap-1.5 px-2.5 py-2 rounded-lg text-sm text-white/35">📤 <span className="text-xs hidden sm:inline">Share</span></button>
          {showShareMenu && (
            <div className="absolute bottom-full right-0 mb-1 glass rounded-xl p-1.5 w-48 shadow-2xl z-10">
              <div className="text-[10px] text-white/25 px-3 py-1 font-semibold uppercase">Share to</div>
              {[{key:'twitter',label:'X (Twitter)'},{key:'facebook',label:'Facebook'},{key:'whatsapp',label:'WhatsApp'},{key:'linkedin',label:'LinkedIn'}].map(p=>(<button key={p.key} onClick={()=>shareToSocial(p.key)} className="w-full flex items-center gap-2 px-3 py-2 rounded-lg hover:bg-white/5 text-sm text-left">{PLATFORMS[p.key].icon} {p.label}</button>))}
              <div className="border-t border-white/5 my-1"/>
              <button onClick={()=>{navigator.clipboard.writeText(`${window.location.origin}/post/${post.id}`);showToast?.('Link copied ✓');setShowShareMenu(false);}} className="w-full flex items-center gap-2 px-3 py-2 rounded-lg hover:bg-white/5 text-sm text-left">📋 Copy link</button>
            </div>
          )}
        </div>
        <button onClick={handleBookmark} className={`px-2 py-2 rounded-lg text-sm ${bookmarked ? 'text-[var(--accent)]' : 'text-white/35'}`}>{bookmarked ? '🔖' : '📑'}</button>
      </div>

      {showComments && (
        <div className="mt-3 pt-3 border-t border-white/5 space-y-2">
          {loadingComments ? <div className="text-center text-white/20 text-sm py-3">Loading...</div>
          : comments.length === 0 ? <div className="text-center text-white/15 text-sm py-3">No comments yet — be the first!</div>
          : comments.map(c => <CommentItem key={c.id} comment={c} postOwnerId={post.user_id} onDelete={handleDeleteComment} />)}
          {user ? (
            <div className="flex gap-2 mt-2 pt-2 border-t border-white/5">
              <span className="text-lg shrink-0 mt-1">{profile?.avatar_emoji || '😎'}</span>
              <input value={commentText} onChange={e => setCommentText(e.target.value)} onKeyDown={e => e.key === 'Enter' && submitComment()}
                placeholder="Write a comment..." className="input-field flex-1 py-2" style={{ fontSize: '16px' }} />
              <button onClick={submitComment} disabled={!commentText.trim()} className="btn-primary py-2 px-4 text-xs disabled:opacity-30">Post</button>
            </div>
          ) : (
            <div className="text-center py-2"><button onClick={() => useStore.getState().setShowAuth(true)} className="text-xs text-[var(--accent)] hover:underline">Log in to comment</button></div>
          )}
        </div>
      )}

      {/* Edit Post Modal */}
      {editModalOpen && (
        <EditPostModal
          post={{ ...post, content: displayContent, media_urls: displayMedia, tags: displayTags, is_public: displayPublic, source_platform: displayPlatform }}
          onClose={() => setEditModalOpen(false)}
          onSaved={handleEditSaved}
        />
      )}
    </article>
  );
}
