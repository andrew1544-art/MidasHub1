'use client';
import { useState, useRef } from 'react';
import { useStore } from '@/lib/store';
import { createClient } from '@/lib/supabase-browser';
import { PLATFORMS, PLATFORM_LIST } from '@/lib/constants';

export default function ComposeModal() {
  const { showCompose, setShowCompose, user, profile } = useStore();
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
    const previews = files.map((f) => URL.createObjectURL(f));
    setMediaPreviews(previews);
  };

  const handlePost = async () => {
    if (!content.trim()) return;
    setLoading(true);

    const supabase = createClient();
    let mediaUrls = [];

    // Upload media
    for (const file of mediaFiles) {
      const ext = file.name.split('.').pop();
      const path = `${user.id}/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;
      const { data, error } = await supabase.storage.from('media').upload(path, file);
      if (!error && data) {
        const { data: urlData } = supabase.storage.from('media').getPublicUrl(data.path);
        mediaUrls.push(urlData.publicUrl);
      }
    }

    // Parse tags
    const parsedTags = tags.split(',').map((t) => t.trim().replace('#', '').toLowerCase()).filter(Boolean);

    // Create post
    const { data: post, error } = await supabase
      .from('posts')
      .insert({
        user_id: user.id,
        content: content.trim(),
        source_platform: sourcePlatform,
        source_url: sourceUrl.trim() || null,
        media_urls: mediaUrls,
        media_type: mediaUrls.length > 0 ? 'image' : null,
        tags: parsedTags,
      })
      .select('*, profiles(*)')
      .single();

    if (!error) {
      setContent('');
      setSourcePlatform('midashub');
      setSourceUrl('');
      setTags('');
      setMediaFiles([]);
      setMediaPreviews([]);
      setShowCompose(false);
      // Reload feed
      window.dispatchEvent(new Event('midashub:newpost'));
    }
    setLoading(false);
  };

  const openSocialForPosting = (platformKey) => {
    const plat = PLATFORMS[platformKey];
    if (plat.postUrl) {
      window.open(plat.postUrl, '_blank');
    }
  };

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-md z-[999] flex items-center justify-center p-4 animate-fade-in"
      onClick={(e) => e.target === e.currentTarget && setShowCompose(false)}
    >
      <div className="w-full max-w-lg glass rounded-3xl p-6 animate-slide-up max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-5">
          <div>
            <h3 className="text-xl font-bold">Create Post ⚡</h3>
            <p className="text-xs text-white/30 mt-1">Share with everyone on MidasHub</p>
          </div>
          <button onClick={() => setShowCompose(false)} className="text-white/30 hover:text-white text-2xl transition">✕</button>
        </div>

        {/* User */}
        <div className="flex items-center gap-3 mb-4">
          <span className="text-3xl">{profile?.avatar_emoji || '😎'}</span>
          <div>
            <div className="font-semibold text-sm">{profile?.display_name}</div>
            <div className="text-xs text-white/30">@{profile?.username}</div>
          </div>
        </div>

        {/* Content */}
        <textarea
          value={content}
          onChange={(e) => setContent(e.target.value)}
          placeholder="What's happening? Share anything — memes, stories, thoughts, reposts..."
          className="w-full h-32 p-4 rounded-xl bg-white/5 border border-white/10 text-white text-[15px] resize-none outline-none focus:border-yellow-500/50 leading-relaxed"
          autoFocus
        />

        {/* Character count */}
        <div className="flex justify-between items-center mt-2 mb-4">
          <div className="text-xs text-white/20">{content.length} characters</div>
        </div>

        {/* Media previews */}
        {mediaPreviews.length > 0 && (
          <div className="grid grid-cols-2 gap-2 mb-4">
            {mediaPreviews.map((url, i) => (
              <div key={i} className="relative aspect-video rounded-xl overflow-hidden bg-white/5">
                <img src={url} alt="" className="w-full h-full object-cover" />
                <button onClick={() => {
                  setMediaFiles(mediaFiles.filter((_, j) => j !== i));
                  setMediaPreviews(mediaPreviews.filter((_, j) => j !== i));
                }} className="absolute top-2 right-2 w-6 h-6 bg-black/60 rounded-full flex items-center justify-center text-xs">✕</button>
              </div>
            ))}
          </div>
        )}

        {/* Source platform */}
        <div className="mb-4">
          <div className="text-xs text-white/40 mb-2">Reposting from:</div>
          <div className="flex flex-wrap gap-2">
            <button onClick={() => setSourcePlatform('midashub')}
              className={`platform-pill ${sourcePlatform === 'midashub' ? 'bg-yellow-500/20 border border-yellow-500/40 text-yellow-400' : 'bg-white/5 text-white/50'}`}
            >
              ⚡ Original Post
            </button>
            {PLATFORM_LIST.map(([key, p]) => (
              <button key={key} onClick={() => setSourcePlatform(key)}
                className={`platform-pill ${sourcePlatform === key ? 'border' : 'bg-white/5 text-white/50'}`}
                style={sourcePlatform === key ? { background: `${p.color}22`, borderColor: `${p.color}66`, color: p.color } : {}}
              >
                {p.icon} {p.name}
              </button>
            ))}
          </div>
        </div>

        {/* Source URL (if reposting) */}
        {sourcePlatform !== 'midashub' && (
          <input
            value={sourceUrl}
            onChange={(e) => setSourceUrl(e.target.value)}
            placeholder="Paste original post URL (optional)"
            className="input-field mb-4 text-sm"
          />
        )}

        {/* Tags */}
        <input
          value={tags}
          onChange={(e) => setTags(e.target.value)}
          placeholder="Tags (comma separated): funny, viral, memes"
          className="input-field mb-4 text-sm"
        />

        {/* Action bar */}
        <div className="flex items-center gap-3 mb-5">
          <input type="file" ref={fileRef} multiple accept="image/*,video/*" className="hidden" onChange={handleMedia} />
          <button onClick={() => fileRef.current?.click()} className="p-2 rounded-lg bg-white/5 hover:bg-white/10 transition text-lg" title="Add media">
            🖼️
          </button>
          <button onClick={() => setShowCrossPost(!showCrossPost)} className="p-2 rounded-lg bg-white/5 hover:bg-white/10 transition text-lg" title="Post to other platforms">
            🌐
          </button>
        </div>

        {/* Cross-post buttons — redirect to each platform */}
        {showCrossPost && (
          <div className="mb-5 p-4 rounded-xl bg-white/3 border border-white/5 animate-slide-up">
            <div className="text-xs text-white/40 mb-3">📡 Post to other platforms too (opens in new tab):</div>
            <div className="grid grid-cols-2 gap-2">
              {PLATFORM_LIST.map(([key, p]) => (
                <button key={key} onClick={() => openSocialForPosting(key)}
                  className="flex items-center gap-2 px-3 py-2.5 rounded-xl text-sm font-medium transition hover:scale-[1.02]"
                  style={{ background: `${p.color}15`, border: `1px solid ${p.color}30`, color: p.color }}
                >
                  <span className="text-lg">{p.icon}</span>
                  <span>Post to {p.name}</span>
                  <span className="ml-auto text-xs opacity-50">↗</span>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Submit */}
        <button onClick={handlePost} disabled={!content.trim() || loading}
          className="btn-primary w-full disabled:opacity-40 flex items-center justify-center gap-2 py-3.5 text-base"
        >
          {loading ? <span className="animate-spin">⏳</span> : <>Post to MidasHub 🚀</>}
        </button>
      </div>
    </div>
  );
}
