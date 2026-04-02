'use client';
import { useState, useRef, useEffect } from 'react';
import { useStore } from '@/lib/store';
import { createClient, ensureFreshAuth, ensureAlive } from '@/lib/supabase-browser';
import { PLATFORMS, PLATFORM_LIST } from '@/lib/constants';
import { compressImage, checkVideoSize, formatSize } from '@/lib/media';

export default function ComposeModal() {
  const { showCompose, setShowCompose, user, profile, showToast, backgroundPost, postingInBackground } = useStore();
  const [content, setContent] = useState('');
  const [sourcePlatform, setSourcePlatform] = useState('midashub');
  const [sourceUrl, setSourceUrl] = useState('');
  const [tags, setTags] = useState('');
  const [mediaFiles, setMediaFiles] = useState([]);
  const [mediaPreviews, setMediaPreviews] = useState([]);
  const [error, setError] = useState('');
  const [showCrossPost, setShowCrossPost] = useState(false);
  const [quote, setQuote] = useState(null);
  const [isPublic, setIsPublic] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [uploadStatus, setUploadStatus] = useState('');
  const fileRef = useRef(null);

  // Pick up quote repost from PostCard
  useEffect(() => {
    if (showCompose && typeof window !== 'undefined' && window.__midashub_quote) {
      setQuote(window.__midashub_quote);
      window.__midashub_quote = null;
    } else if (!showCompose) {
      setQuote(null);
    }
    // Restore draft on open
    if (showCompose && !content) {
      try {
        const draft = sessionStorage.getItem('mh-draft');
        if (draft) { setContent(draft); sessionStorage.removeItem('mh-draft'); }
      } catch(e) {}
    }
  }, [showCompose]);

  // Save draft when composing
  useEffect(() => {
    if (showCompose && content) {
      try { sessionStorage.setItem('mh-draft', content); } catch(e) {}
    }
  }, [content, showCompose]);

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

  const handleMedia = async (e) => {
    const rawFiles = Array.from(e.target.files).slice(0, 4 - mediaFiles.length);
    const processed = [];
    const previews = [];
    for (const file of rawFiles) {
      if (file.type.startsWith('video/')) {
        const check = checkVideoSize(file, 50);
        if (!check.ok) { showToast(`Video too large (${check.sizeMB}MB). Max 50MB.`); continue; }
        processed.push(file);
        previews.push({ url: URL.createObjectURL(file), isVideo: true, size: formatSize(file.size) });
      } else {
        // Compress images automatically
        const compressed = await compressImage(file);
        processed.push(compressed);
        previews.push({ url: URL.createObjectURL(compressed), isVideo: false, size: formatSize(compressed.size) });
      }
    }
    setMediaFiles(prev => [...prev, ...processed].slice(0, 4));
    setMediaPreviews(prev => [...prev, ...previews].slice(0, 4));
  };

  const removeMedia = (idx) => {
    setMediaFiles(prev => prev.filter((_, j) => j !== idx));
    setMediaPreviews(prev => prev.filter((_, j) => j !== idx));
  };

  const handlePost = async () => {
    if (!content.trim() || uploading) return;
    setError('');
    
    // Check connection is alive before doing anything
    await ensureAlive();
    
    let mediaUrls = [];
    let hasVideo = false;

    // Step 1: Upload media WHILE modal is open (user stays on page)
    if (mediaFiles.length) {
      setUploading(true);
      setUploadStatus(`Uploading ${mediaFiles.length} file${mediaFiles.length > 1 ? 's' : ''}...`);
      try {
        const supabase = createClient();
        const results = await Promise.all(mediaFiles.map(async (file) => {
          try {
            if (file.type.startsWith('video/')) hasVideo = true;
            const ext = file.name.split('.').pop();
            const path = `${user.id}/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;
            let { data, error } = await supabase.storage.from('media').upload(path, file, { contentType: file.type, cacheControl: '3600' });
            if (error) {
              await ensureFreshAuth();
              const retry = await supabase.storage.from('media').upload(path, file, { contentType: file.type, cacheControl: '3600' });
              data = retry.data; error = retry.error;
            }
            if (data && !error) {
              const { data: u } = supabase.storage.from('media').getPublicUrl(data.path);
              return u.publicUrl;
            }
            return null;
          } catch(e) { return null; }
        }));
        mediaUrls = results.filter(Boolean);
        if (mediaUrls.length === 0 && mediaFiles.length > 0) {
          setError('Upload failed. Try again.');
          setUploading(false); setUploadStatus('');
          return;
        }
      } catch(e) {
        setError('Upload failed. Check your connection.');
        setUploading(false); setUploadStatus('');
        return;
      }
      setUploadStatus('Publishing...');
    }

    // Step 2: Close modal — DB insert is instant (no big files)
    const postContent = content.trim();
    const postQuote = quote;
    setContent(''); setSourcePlatform('midashub'); setSourceUrl(''); setTags('');
    setMediaFiles([]); setMediaPreviews([]); setQuote(null); setShowCompose(false);
    setUploading(false); setUploadStatus('');
    try { sessionStorage.removeItem('mh-draft'); } catch(e) {}

    // Step 3: Insert post to DB (fast, just text — survives backgrounding)
    backgroundPost({
      content: postContent, sourcePlatform, sourceUrl: sourceUrl.trim(),
      tags, mediaUrls, hasVideo, isPublic, quote: postQuote,
    });
  };

  return (
    <div className="modal-overlay"
      onClick={(e) => e.target === e.currentTarget && setShowCompose(false)}>
      <div className="modal-content max-w-lg p-5 sm:p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-bold">{quote ? '💬 Repost with Comment' : 'Create Post ⚡'}</h3>
          <button onClick={() => setShowCompose(false)} className="w-8 h-8 rounded-full bg-white/5 flex items-center justify-center text-white/40 hover:text-white text-sm transition">✕</button>
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
                    <video src={item.url} className="w-full h-full object-cover" preload="metadata" muted playsInline
                      onLoadedMetadata={e => { e.target.currentTime = 0.5; }} />
                    <div className="absolute inset-0 flex items-center justify-center bg-black/30">
                      <div className="w-10 h-10 rounded-full bg-[var(--accent)] flex items-center justify-center shadow-lg">
                        <span className="text-black text-sm ml-0.5">▶</span>
                      </div>
                    </div>
                    <div className="absolute top-1.5 left-1.5 px-1.5 py-0.5 rounded bg-black/60 text-[9px] text-white/70 font-semibold">VIDEO</div>
                    {item.size && <div className="absolute bottom-1.5 right-1.5 px-1.5 py-0.5 rounded bg-black/60 text-[9px] text-white/50">{item.size}</div>}
                  </>
                ) : (
                  <img src={item.url} alt="" className="w-full h-full object-cover" />
                )}
                <button onClick={() => removeMedia(i)}
                  className="absolute top-1.5 right-1.5 w-6 h-6 bg-black/60 rounded-full flex items-center justify-center text-xs text-white/80">✕</button>
                {item.size && <div className="absolute bottom-1.5 left-1.5 px-1.5 py-0.5 rounded bg-black/60 text-[9px] text-white/60">{item.size}</div>}
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

        <button onClick={handlePost} disabled={!content.trim() || uploading || postingInBackground} className="btn-primary w-full py-3 flex items-center justify-center gap-2 disabled:opacity-40">
          {uploading ? <><span className="animate-spin">⏳</span> {uploadStatus}</> : postingInBackground ? <><span className="animate-spin">⏳</span> Posting...</> : quote ? '💬 Post with Quote' : 'Post to MidasHub 🚀'}
        </button>
      </div>
    </div>
  );
}
