'use client';
import { useState, useEffect, useRef } from 'react';

export default function MediaViewer({ media = [], startIndex = 0, onClose }) {
  const [index, setIndex] = useState(startIndex);
  const [zoomed, setZoomed] = useState(false);
  const videoRef = useRef(null);
  const current = media[index];
  const isVideo = current && (current.type === 'video' || /\.(mp4|webm|mov|avi)$/i.test(current.url));

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

  // Keyboard nav
  useEffect(() => {
    const handler = (e) => {
      if (e.key === 'Escape') onClose();
      if (e.key === 'ArrowRight' && index < media.length - 1) setIndex(i => i + 1);
      if (e.key === 'ArrowLeft' && index > 0) setIndex(i => i - 1);
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [index, media.length, onClose]);

  // Swipe support for mobile
  const touchStart = useRef(null);
  const handleTouchStart = (e) => { touchStart.current = e.touches[0].clientX; };
  const handleTouchEnd = (e) => {
    if (!touchStart.current) return;
    const diff = touchStart.current - e.changedTouches[0].clientX;
    if (Math.abs(diff) > 60) {
      if (diff > 0 && index < media.length - 1) setIndex(i => i + 1);
      if (diff < 0 && index > 0) setIndex(i => i - 1);
    }
    touchStart.current = null;
  };

  const download = async () => {
    try {
      const response = await fetch(current.url);
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `midashub-media-${Date.now()}.${isVideo ? 'mp4' : 'jpg'}`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (e) {
      // Fallback: open in new tab
      window.open(current.url, '_blank');
    }
  };

  if (!current) return null;

  return (
    <div className="fixed inset-0 z-[9999] bg-black/95 flex flex-col"
      style={{ paddingTop: 'env(safe-area-inset-top, 0px)', paddingBottom: 'env(safe-area-inset-bottom, 0px)' }}
      onTouchStart={handleTouchStart} onTouchEnd={handleTouchEnd}>

      {/* Top bar */}
      <div className="flex items-center justify-between px-4 py-3 shrink-0">
        <div className="text-sm text-white/50">
          {media.length > 1 && `${index + 1} / ${media.length}`}
        </div>
        <div className="flex items-center gap-2">
          <button onClick={download}
            className="w-10 h-10 rounded-full bg-white/10 flex items-center justify-center text-white/70 hover:bg-white/20 transition"
            title="Download">
            ⬇️
          </button>
          <button onClick={onClose}
            className="w-10 h-10 rounded-full bg-white/10 flex items-center justify-center text-white/70 hover:bg-white/20 transition text-lg"
            title="Close">
            ✕
          </button>
        </div>
      </div>

      {/* Media */}
      <div className="flex-1 flex items-center justify-center px-4 relative overflow-hidden"
        onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>

        {/* Left arrow */}
        {index > 0 && (
          <button onClick={() => setIndex(i => i - 1)}
            className="absolute left-2 sm:left-4 z-10 w-10 h-10 sm:w-12 sm:h-12 rounded-full bg-black/50 flex items-center justify-center text-white/70 hover:bg-black/70 transition text-lg">
            ‹
          </button>
        )}

        {/* Content */}
        {isVideo ? (
          <video ref={videoRef} src={current.url} controls autoPlay
            className="max-w-full max-h-[80vh] rounded-xl"
            style={{ objectFit: 'contain' }}>
            Your browser does not support video.
          </video>
        ) : (
          <img src={current.url} alt=""
            onClick={() => setZoomed(!zoomed)}
            className="transition-transform duration-300 rounded-lg cursor-zoom-in select-none"
            style={{
              maxWidth: zoomed ? 'none' : '100%',
              maxHeight: zoomed ? 'none' : '80vh',
              objectFit: 'contain',
              transform: zoomed ? 'scale(1.8)' : 'scale(1)',
              cursor: zoomed ? 'zoom-out' : 'zoom-in',
            }}
            draggable={false} />
        )}

        {/* Right arrow */}
        {index < media.length - 1 && (
          <button onClick={() => setIndex(i => i + 1)}
            className="absolute right-2 sm:right-4 z-10 w-10 h-10 sm:w-12 sm:h-12 rounded-full bg-black/50 flex items-center justify-center text-white/70 hover:bg-black/70 transition text-lg">
            ›
          </button>
        )}
      </div>

      {/* Bottom dots */}
      {media.length > 1 && (
        <div className="flex items-center justify-center gap-1.5 py-3 shrink-0">
          {media.map((_, i) => (
            <button key={i} onClick={() => setIndex(i)}
              className={`w-2 h-2 rounded-full transition-all ${i === index ? 'bg-white w-6' : 'bg-white/30'}`} />
          ))}
        </div>
      )}
    </div>
  );
}
