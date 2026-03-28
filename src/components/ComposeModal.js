'use client';
import { useState, useRef } from 'react';
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
  const [showCrossPost, setShowCrossPost] = useState(false);
  const fileRef = useRef(null);

  if (!showCompose || !user) return null;

  const handleMedia = (e) => {
    const files = Array.from(e.target.files).slice(0, 4);
    setMediaFiles(files);
    setMediaPreviews(files.map((f) => URL.createObjectURL(f)));
  };

  const handlePost = async () => {
    if (!content.trim()) return;
    setLoading(true);
    const supabase = createClient();
    let mediaUrls = [];
    for (const file of mediaFiles) {
      const ext = file.name.split('.').pop();
      const path = `${user.id}/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;
      const { data } = await supabase.storage.from('media').upload(path, file);
      if (data) {
        const { data: urlData } = supabase.storage.from('media').getPublicUrl(data.path);
        mediaUrls.push(urlData.publicUrl);
      }
    }
    const parsedTags = tags.split(',').map((t) => t.trim().replace('#', '').toLowerCase()).filter(Boolean);
    await supabase.from('posts').insert({
      user_id: user.id, content: content.trim(), source_platform: sourcePlatform,
      source_url: sourceUrl.trim() || null, media_urls: mediaUrls,
      media_type: mediaUrls.length > 0 ? 'image' : null, tags: parsedTags,
    });
    setContent(''); setSourcePlatform('midashub'); setSourceUrl(''); setTags('');
    setMediaFiles([]); setMediaPreviews([]); setShowCompose(false);
    showToast('Posted! ⚡');
    window.dispatchEvent(new Event('midashub:newpost'));
    setLoading(false);
  };

  return (
    <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-[999] flex items-center justify-center p-3 sm:p-4 animate-fade-in"
      onClick={(e) => e.target === e.currentTarget && setShowCompose(false)}>
      <div className="w-full max-w-lg glass rounded-2xl sm:rounded-3xl p-5 sm:p-6 animate-slide-up max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-bold">Create Post ⚡</h3>
          <button onClick={() => setShowCompose(false)} className="w-8 h-8 rounded-full bg-white/5 flex items-center justify-center text-white/40 hover:text-white text-sm transition">✕</button>
        </div>

        <div className="flex items-center gap-2.5 mb-3">
          <span className="text-2xl">{profile?.avatar_emoji || '😎'}</span>
          <div>
            <div className="font-semibold text-sm">{profile?.display_name}</div>
            <div className="text-[11px] text-white/25">@{profile?.username}</div>
          </div>
        </div>

        <textarea value={content} onChange={(e) => setContent(e.target.value)} autoFocus
          placeholder="What's on your mind? Share anything..."
          className="w-full h-28 p-3 rounded-xl bg-white/5 border border-white/8 text-white text-sm resize-none outline-none focus:border-[var(--accent)] leading-relaxed placeholder:text-white/25" />
        <div className="text-[11px] text-white/15 text-right mt-1">{content.length} chars</div>

        {mediaPreviews.length > 0 && (
          <div className="grid grid-cols-2 gap-1.5 my-3">
            {mediaPreviews.map((url, i) => (
              <div key={i} className="relative aspect-video rounded-xl overflow-hidden bg-white/5">
                <img src={url} alt="" className="w-full h-full object-cover" />
                <button onClick={() => { setMediaFiles(mediaFiles.filter((_, j) => j !== i)); setMediaPreviews(mediaPreviews.filter((_, j) => j !== i)); }}
                  className="absolute top-1.5 right-1.5 w-6 h-6 bg-black/60 rounded-full flex items-center justify-center text-xs">✕</button>
              </div>
            ))}
          </div>
        )}

        <div className="mb-3">
          <div className="text-xs text-white/25 mb-2">Reposting from:</div>
          <div className="flex flex-wrap gap-1.5">
            <button onClick={() => setSourcePlatform('midashub')}
              className={`platform-pill ${sourcePlatform === 'midashub' ? 'accent-gradient text-black' : 'bg-white/5 text-white/40'}`}>⚡ Original</button>
            {PLATFORM_LIST.map(([key, p]) => (
              <button key={key} onClick={() => setSourcePlatform(key)}
                className="platform-pill"
                style={sourcePlatform === key ? { background: `${p.color}25`, color: p.color, border: `1px solid ${p.color}50` } : { background: 'rgba(255,255,255,0.04)', color: 'rgba(255,255,255,0.35)' }}>
                {p.icon} {p.name}
              </button>
            ))}
          </div>
        </div>

        {sourcePlatform !== 'midashub' && (
          <input value={sourceUrl} onChange={(e) => setSourceUrl(e.target.value)} placeholder="Paste original post URL (optional)" className="input-field mb-3 text-sm py-2" />
        )}

        <input value={tags} onChange={(e) => setTags(e.target.value)} placeholder="Tags: funny, viral, memes" className="input-field mb-3 text-sm py-2" />

        <div className="flex items-center gap-2 mb-4">
          <input type="file" ref={fileRef} multiple accept="image/*,video/*" className="hidden" onChange={handleMedia} />
          <button onClick={() => fileRef.current?.click()} className="w-9 h-9 rounded-lg bg-white/5 hover:bg-white/10 transition text-base flex items-center justify-center" title="Media">🖼️</button>
          <button onClick={() => setShowCrossPost(!showCrossPost)} className="w-9 h-9 rounded-lg bg-white/5 hover:bg-white/10 transition text-base flex items-center justify-center" title="Cross-post">🌐</button>
        </div>

        {showCrossPost && (
          <div className="mb-4 p-3 rounded-xl bg-white/3 border border-white/5 animate-slide-up">
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

        <button onClick={handlePost} disabled={!content.trim() || loading} className="btn-primary w-full py-3 flex items-center justify-center gap-2">
          {loading ? <span className="animate-spin">⏳</span> : 'Post to MidasHub 🚀'}
        </button>
      </div>
    </div>
  );
}
