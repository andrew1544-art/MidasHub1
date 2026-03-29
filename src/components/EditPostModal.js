'use client';
import { useState, useRef, useEffect } from 'react';
import { useStore } from '@/lib/store';
import { createClient } from '@/lib/supabase-browser';
import { PLATFORMS, PLATFORM_LIST } from '@/lib/constants';
import { compressImage, checkVideoSize, formatSize } from '@/lib/media';

export default function EditPostModal({ post, onClose, onSaved }) {
  const { user, profile, showToast } = useStore();
  const [content, setContent] = useState(post.content || '');
  const [sourcePlatform, setSourcePlatform] = useState(post.source_platform || 'midashub');
  const [sourceUrl, setSourceUrl] = useState(post.source_url || '');
  const [tags, setTags] = useState((post.tags || []).join(', '));
  const [isPublic, setIsPublic] = useState(post.is_public !== false);
  const [existingMedia, setExistingMedia] = useState(post.media_urls || []);
  const [newMediaFiles, setNewMediaFiles] = useState([]);
  const [newMediaPreviews, setNewMediaPreviews] = useState([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const fileRef = useRef(null);

  // Lock body scroll
  useEffect(() => {
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
  }, []);

  const handleNewMedia = async (e) => {
    const rawFiles = Array.from(e.target.files).slice(0, 4 - existingMedia.length);
    const processed = [];
    const previews = [];
    for (const file of rawFiles) {
      if (file.type.startsWith('video/')) {
        const check = checkVideoSize(file, 50);
        if (!check.ok) continue;
        processed.push(file);
        previews.push({ url: URL.createObjectURL(file), isVideo: true });
      } else {
        const compressed = await compressImage(file);
        processed.push(compressed);
        previews.push({ url: URL.createObjectURL(compressed), isVideo: false });
      }
    }
    setNewMediaFiles(prev => [...prev, ...processed].slice(0, 4 - existingMedia.length));
    setNewMediaPreviews(prev => [...prev, ...previews].slice(0, 4 - existingMedia.length));
  };

  const removeExisting = (idx) => {
    setExistingMedia(prev => prev.filter((_, j) => j !== idx));
  };

  const removeNew = (idx) => {
    setNewMediaFiles(prev => prev.filter((_, j) => j !== idx));
    setNewMediaPreviews(prev => prev.filter((_, j) => j !== idx));
  };

  const handleSave = async () => {
    if (!content.trim() || saving) return;
    setSaving(true); setError('');
    try {
      const supabase = createClient();

      // Upload new media in PARALLEL
      const uploadResults = await Promise.all(
        newMediaFiles.map(async (file) => {
          try {
            const ext = file.name.split('.').pop();
            const path = `${user.id}/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;
            const { data, error } = await supabase.storage.from('media').upload(path, file, { contentType: file.type, cacheControl: '3600' });
            if (data && !error) {
              const { data: u } = supabase.storage.from('media').getPublicUrl(data.path);
              return u.publicUrl;
            }
            return null;
          } catch (e) { return null; }
        })
      );
      const allMediaUrls = [...existingMedia, ...uploadResults.filter(Boolean)];

      const parsedTags = tags.split(',').map(t => t.trim().replace('#', '').toLowerCase()).filter(Boolean);
      const hasVideo = allMediaUrls.some(url => /\.(mp4|webm|mov|avi|ogg)$/i.test(url)) || newMediaFiles.some(f => f.type.startsWith('video/'));

      const { error: updateErr } = await supabase.from('posts').update({
        content: content.trim(),
        source_platform: sourcePlatform,
        source_url: sourceUrl.trim() || null,
        tags: parsedTags,
        media_urls: allMediaUrls,
        media_type: allMediaUrls.length > 0 ? (hasVideo ? 'video' : 'image') : null,
        is_public: isPublic,
        updated_at: new Date().toISOString(),
      }).eq('id', post.id);

      if (updateErr) {
        setError('Failed to update: ' + updateErr.message);
        setSaving(false);
        return;
      }

      showToast?.('Post updated ✓');
      onSaved?.();
      onClose();
    } catch (e) {
      setError('Something went wrong');
    }
    setSaving(false);
  };

  const totalMedia = existingMedia.length + newMediaPreviews.length;

  return (
    <div className="modal-overlay" onClick={(e) => e.target === e.currentTarget && !saving && onClose()}>
      <div className="modal-content max-w-lg p-5 sm:p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-bold">✏️ Edit Post</h3>
          <button onClick={() => !saving && onClose()} className="w-8 h-8 rounded-full bg-white/5 flex items-center justify-center text-white/40 hover:text-white text-sm">✕</button>
        </div>

        <div className="flex items-center gap-2.5 mb-3">
          <span className="text-2xl">{profile?.avatar_emoji || '😎'}</span>
          <div>
            <div className="font-semibold text-sm">{profile?.display_name}</div>
            <div className="text-[11px] text-white/25">@{profile?.username}</div>
          </div>
        </div>

        {/* Content */}
        <textarea value={content} onChange={(e) => setContent(e.target.value)} autoFocus
          placeholder="What's on your mind?"
          className="w-full h-28 p-3 rounded-xl bg-white/5 border border-white/8 text-white resize-none outline-none focus:border-[var(--accent)] leading-relaxed placeholder:text-white/25"
          style={{ fontSize: '16px' }} />
        <div className="text-[11px] text-white/15 text-right mt-1">{content.length} chars</div>

        {/* Existing + New Media */}
        {totalMedia > 0 && (
          <div className="grid grid-cols-2 gap-1.5 my-3">
            {existingMedia.map((url, i) => {
              const isVid = /\.(mp4|webm|mov)$/i.test(url);
              return (
                <div key={`ex-${i}`} className="relative aspect-video rounded-xl overflow-hidden bg-white/5">
                  {isVid ? (
                    <video src={url} className="w-full h-full object-cover" preload="metadata" />
                  ) : (
                    <img src={url} alt="" className="w-full h-full object-cover" />
                  )}
                  <button onClick={() => removeExisting(i)}
                    className="absolute top-1.5 right-1.5 w-6 h-6 bg-black/60 rounded-full flex items-center justify-center text-xs text-white/80">✕</button>
                </div>
              );
            })}
            {newMediaPreviews.map((item, i) => (
              <div key={`new-${i}`} className="relative aspect-video rounded-xl overflow-hidden bg-white/5">
                {item.isVideo ? (
                  <>
                    <video src={item.url} className="w-full h-full object-cover" preload="metadata" />
                    <div className="absolute top-1.5 left-1.5 px-1.5 py-0.5 rounded bg-black/60 text-[9px] text-white/70 font-semibold">NEW</div>
                  </>
                ) : (
                  <img src={item.url} alt="" className="w-full h-full object-cover" />
                )}
                <button onClick={() => removeNew(i)}
                  className="absolute top-1.5 right-1.5 w-6 h-6 bg-black/60 rounded-full flex items-center justify-center text-xs text-white/80">✕</button>
              </div>
            ))}
          </div>
        )}

        {/* Platform source */}
        <div className="mb-3">
          <div className="text-xs text-white/40 mb-2">📡 Where is this from?</div>
          <div className="flex flex-wrap gap-1.5">
            <button onClick={() => setSourcePlatform('midashub')}
              className={`platform-pill ${sourcePlatform === 'midashub' ? 'accent-gradient text-black' : 'bg-white/5 text-white/40'}`}>⚡ Original</button>
            {PLATFORM_LIST.map(([key, p]) => (
              <button key={key} onClick={() => setSourcePlatform(key)} className="platform-pill"
                style={sourcePlatform === key ? { background: `${p.color}25`, color: p.color, border: `1px solid ${p.color}50` } : { background: 'rgba(255,255,255,0.04)', color: 'rgba(255,255,255,0.35)' }}>
                {p.icon} {p.name}
              </button>
            ))}
          </div>
        </div>

        {sourcePlatform !== 'midashub' && (
          <input value={sourceUrl} onChange={(e) => setSourceUrl(e.target.value)} placeholder="Original post URL (optional)" className="input-field mb-3 text-sm" style={{ fontSize: '16px' }} />
        )}

        {/* Tags */}
        <input value={tags} onChange={(e) => setTags(e.target.value)} placeholder="Tags (comma separated): funny, viral, trending" className="input-field mb-3 text-sm" style={{ fontSize: '16px' }} />

        {/* Add media */}
        <div className="flex items-center gap-2 mb-3">
          <input type="file" ref={fileRef} multiple accept="image/*,video/*" className="hidden" onChange={handleNewMedia} />
          {totalMedia < 4 && (
            <button onClick={() => fileRef.current?.click()} className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-white/5 hover:bg-white/10 transition text-sm text-white/50">
              🖼️ {totalMedia > 0 ? 'Add More' : 'Add Media'}
            </button>
          )}
          <span className="text-[10px] text-white/20">{totalMedia}/4 media</span>
        </div>

        {/* Public/Private toggle */}
        <div className="flex items-center justify-between mb-4 p-3 rounded-xl bg-white/3 border border-white/5">
          <div className="flex items-center gap-2">
            <span className="text-lg">{isPublic ? '🌍' : '🔒'}</span>
            <div>
              <div className="text-sm font-semibold">{isPublic ? 'Public' : 'Private'}</div>
              <div className="text-[10px] text-white/30">{isPublic ? 'Anyone can see' : 'Only logged-in users'}</div>
            </div>
          </div>
          <button onClick={() => setIsPublic(!isPublic)}
            className={`w-12 h-7 rounded-full transition-all relative ${isPublic ? 'bg-green-500' : 'bg-white/10'}`}>
            <div className={`w-5 h-5 rounded-full bg-white absolute top-1 transition-all ${isPublic ? 'right-1' : 'left-1'}`} />
          </button>
        </div>

        {error && <div className="mb-3 p-3 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-sm">{error}</div>}

        <div className="flex gap-2">
          <button onClick={handleSave} disabled={!content.trim() || saving} className="btn-primary flex-1 py-3 flex items-center justify-center gap-2 disabled:opacity-40">
            {saving ? <><span className="animate-spin">⏳</span> Saving...</> : '✓ Save Changes'}
          </button>
          <button onClick={() => !saving && onClose()} className="btn-secondary px-6 py-3">Cancel</button>
        </div>
      </div>
    </div>
  );
}
