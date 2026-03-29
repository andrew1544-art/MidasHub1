'use client';
import { useState, useRef, useEffect } from 'react';
import { useStore } from '@/lib/store';
import { createClient } from '@/lib/supabase-browser';
import { PLATFORMS, PLATFORM_LIST } from '@/lib/constants';

export default function ComposeModal() {
  const { showCompose, setShowCompose, user, profile, showToast } = useStore();
  const [content, setContent] = useState('');
  const [sourcePlatform, setSourcePlatform] = useState('midashub');
  const [sourceUrl, setSourceUrl] = useState('');
  const [tags, setTags] = useState('');
  const [mediaFiles, setMediaFiles] = useState([]);
  const [mediaPreviews, setMediaPreviews] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [showCrossPost, setShowCrossPost] = useState(false);
  const [quote, setQuote] = useState(null);
  const [isPublic, setIsPublic] = useState(true);
  const fileRef = useRef(null);

  // Pick up quote repost from PostCard
  useEffect(() => {
    if (showCompose && typeof window !== 'undefined' && window.__midashub_quote) {
      setQuote(window.__midashub_quote);
      window.__midashub_quote = null;
    } else if (!showCompose) {
      setQuote(null);
    }
  }, [showCompose]);

  // Lock body scroll when modal is open
  useEffect(() => {
    if (showCompose) {
      const scrollY = window.scrollY;
      document.body.style.position = 'fixed';
      document.body.style.top = `-${scrollY}px`;
      document.body.style.width = '100%';
      return () => {
        document.body.style.position = '';
        document.body.style.top = '';
        document.body.style.width = '';
        window.scrollTo(0, scrollY);
      };
    }
  }, [showCompose]);

  if (!showCompose || !user) return null;

  const handleMedia = (e) => {
    const files = Array.from(e.target.files).slice(0, 4);
    setMediaFiles(prev => [...prev, ...files].slice(0, 4));
    setMediaPreviews(prev => [...prev, ...files.map(f => ({ url: URL.createObjectURL(f), isVideo: f.type.startsWith('video/') }))].slice(0, 4));
  };

  const removeMedia = (idx) => {
    setMediaFiles(prev => prev.filter((_, j) => j !== idx));
    setMediaPreviews(prev => prev.filter((_, j) => j !== idx));
  };

  const handlePost = async () => {
    if (!content.trim() || loading) return;
    setLoading(true); setError('');
    try {
      const supabase = createClient();
      let hasVideo = false;
      
      // Upload ALL media in PARALLEL (not one by one)
      const uploadPromises = mediaFiles.map(async (file) => {
        try {
          if (file.type.startsWith('video/')) hasVideo = true;
          const ext = file.name.split('.').pop();
          const path = `${user.id}/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;
          const { data, error } = await supabase.storage.from('media').upload(path, file, { contentType: file.type, cacheControl: '3600' });
          if (data && !error) {
            const { data: u } = supabase.storage.from('media').getPublicUrl(data.path);
            return u.publicUrl;
          }
          return null;
        } catch (e) { return null; }
      });
      const results = await Promise.all(uploadPromises);
      const mediaUrls = results.filter(Boolean);

      const parsedTags = tags.split(',').map(t => t.trim().replace('#', '').toLowerCase()).filter(Boolean);
      let finalContent = content.trim();
      if (quote) {
        finalContent += `\n\n💬 Reposting @${quote.username}:\n"${quote.content.slice(0, 200)}${quote.content.length > 200 ? '...' : ''}"`;
      }
      const { error: postErr } = await supabase.from('posts').insert({
        user_id: user.id, content: finalContent, source_platform: sourcePlatform,
        source_url: sourceUrl.trim() || null, media_urls: mediaUrls,
        media_type: mediaUrls.length > 0 ? (hasVideo ? 'video' : 'image') : null, tags: parsedTags,
        is_public: isPublic,
      });
      if (postErr) { setError('Failed to post: ' + (postErr.message || 'Unknown error')); setLoading(false); return; }
      setContent(''); setSourcePlatform('midashub'); setSourceUrl(''); setTags('');
      setMediaFiles([]); setMediaPreviews([]); setQuote(null); setShowCompose(false);
      showToast('Posted! ⚡');
      window.dispatchEvent(new Event('midashub:newpost'));
    } catch (err) { setError('Something went wrong. Try again.'); }
    setLoading(false);
  };

  return (
    <div className="modal-overlay"
      onClick={(e) => e.target === e.currentTarget && !loading && setShowCompose(false)}>
      <div className="modal-content max-w-lg p-5 sm:p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-bold">{quote ? '💬 Repost with Comment' : 'Create Post ⚡'}</h3>
          <button onClick={() => !loading && setShowCompose(false)} className="w-8 h-8 rounded-full bg-white/5 flex items-center justify-center text-white/40 hover:text-white text-sm transition">✕</button>
        </div>

        <div className="flex items-center gap-2.5 mb-3">
          <span className="text-2xl">{profile?.avatar_emoji || '😎'}</span>
          <div>
            <div className="font-semibold text-sm">{profile?.display_name}</div>
            <div className="text-[11px] text-white/25">@{profile?.username}</div>
          </div>
        </div>

        {/* Quote preview */}
        {quote && (
          <div className="mb-3 p-3 rounded-xl border border-white/10 bg-white/3">
            <div className="flex items-center gap-1.5 mb-1">
              <span className="text-[10px] text-white/30">Quoting</span>
              <span className="text-xs font-semibold text-white/50">@{quote.username}</span>
              <button onClick={() => setQuote(null)} className="ml-auto text-white/20 text-xs hover:text-white/50">✕ Remove</button>
            </div>
            <p className="text-xs text-white/40 line-clamp-3 italic">"{quote.content.slice(0, 150)}{quote.content.length > 150 ? '...' : ''}"</p>
          </div>
        )}

        <textarea value={content} onChange={(e) => setContent(e.target.value)} autoFocus
          placeholder={quote ? "Add your thoughts about this post..." : "What's on your mind? Share anything..."}
          className="w-full h-28 p-3 rounded-xl bg-white/5 border border-white/8 text-white resize-none outline-none focus:border-[var(--accent)] leading-relaxed placeholder:text-white/25"
          style={{ fontSize: '16px' }} />
        <div className="text-[11px] text-white/15 text-right mt-1">{content.length} chars</div>

        {mediaPreviews.length > 0 && (
          <div className="grid grid-cols-2 gap-1.5 my-3">
            {mediaPreviews.map((item, i) => (
              <div key={i} className="relative aspect-video rounded-xl overflow-hidden bg-white/5">
                {item.isVideo ? (
                  <>
                    <video src={item.url} className="w-full h-full object-cover" preload="metadata" />
                    <div className="absolute inset-0 flex items-center justify-center bg-black/30">
                      <div className="w-10 h-10 rounded-full bg-white/20 flex items-center justify-center text-lg">▶</div>
                    </div>
                    <div className="absolute top-1.5 left-1.5 px-1.5 py-0.5 rounded bg-black/60 text-[9px] text-white/70 font-semibold">VIDEO</div>
                  </>
                ) : (
                  <img src={item.url} alt="" className="w-full h-full object-cover" />
                )}
                <button onClick={() => removeMedia(i)}
                  className="absolute top-1.5 right-1.5 w-6 h-6 bg-black/60 rounded-full flex items-center justify-center text-xs text-white/80">✕</button>
              </div>
            ))}
          </div>
        )}

        <div className="mb-3">
          <div className="text-xs text-white/40 mb-2">📡 Where is this from?</div>
          <div className="flex flex-wrap gap-1.5">
            <button onClick={() => setSourcePlatform('midashub')}
              className={`platform-pill ${sourcePlatform === 'midashub' ? 'accent-gradient text-black' : 'bg-white/5 text-white/40'}`}>⚡ My Original Post</button>
            {PLATFORM_LIST.map(([key, p]) => (
              <button key={key} onClick={() => setSourcePlatform(key)} className="platform-pill"
                style={sourcePlatform === key ? { background: `${p.color}25`, color: p.color, border: `1px solid ${p.color}50` } : { background: 'rgba(255,255,255,0.04)', color: 'rgba(255,255,255,0.35)' }}>
                {p.icon} {p.name}
              </button>
            ))}
          </div>
        </div>

        {sourcePlatform !== 'midashub' && (
          <input value={sourceUrl} onChange={(e) => setSourceUrl(e.target.value)} placeholder="Paste original post URL (optional)" className="input-field mb-3 text-sm py-2" />
        )}
        <input value={tags} onChange={(e) => setTags(e.target.value)} placeholder="Add tags (comma separated): funny, viral, trending" className="input-field mb-3 text-sm py-2" />

        <div className="flex items-center gap-2 mb-4">
          <input type="file" ref={fileRef} multiple accept="image/*,video/*" className="hidden" onChange={handleMedia} />
          <button onClick={() => fileRef.current?.click()} className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-white/5 hover:bg-white/10 transition text-sm text-white/50">🖼️ <span className="hidden sm:inline">Add Media</span></button>
          <button onClick={() => setShowCrossPost(!showCrossPost)} className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-white/5 hover:bg-white/10 transition text-sm text-white/50">🌐 <span className="hidden sm:inline">Cross-Post</span></button>
        </div>

        {showCrossPost && (
          <div className="mb-4 p-3 rounded-xl bg-white/3 border border-white/5">
            <div className="text-xs text-white/30 mb-2">📡 Also post on (opens in new tab):</div>
            <div className="grid grid-cols-2 gap-1.5">
              {PLATFORM_LIST.map(([key, p]) => (
                <button key={key} onClick={() => p.postUrl && window.open(p.postUrl, '_blank')}
                  className="flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-medium transition hover:scale-[1.02]"
                  style={{ background: `${p.color}12`, border: `1px solid ${p.color}25`, color: p.color }}>
                  {p.icon} {p.name} <span className="ml-auto opacity-40">↗</span>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Public/Private toggle */}
        <div className="flex items-center justify-between mb-3 p-3 rounded-xl bg-white/3 border border-white/5">
          <div className="flex items-center gap-2">
            <span className="text-lg">{isPublic ? '🌍' : '🔒'}</span>
            <div>
              <div className="text-sm font-semibold">{isPublic ? 'Public Post' : 'Private Post'}</div>
              <div className="text-[10px] text-white/30">{isPublic ? 'Anyone can see this, even without an account' : 'Only logged-in MidasHub users can see this'}</div>
            </div>
          </div>
          <button onClick={() => setIsPublic(!isPublic)}
            className={`w-12 h-7 rounded-full transition-all relative ${isPublic ? 'bg-green-500' : 'bg-white/10'}`}>
            <div className={`w-5 h-5 rounded-full bg-white absolute top-1 transition-all ${isPublic ? 'right-1' : 'left-1'}`} />
          </button>
        </div>

        {error && <div className="mb-3 p-3 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-sm">{error}</div>}

        <button onClick={handlePost} disabled={!content.trim() || loading} className="btn-primary w-full py-3 flex items-center justify-center gap-2 disabled:opacity-40">
          {loading ? <><span className="animate-spin">⏳</span> Posting...</> : quote ? '💬 Post with Quote' : 'Post to MidasHub 🚀'}
        </button>
      </div>
    </div>
  );
}
