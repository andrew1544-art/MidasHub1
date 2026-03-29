'use client';
import { useState, useEffect } from 'react';

export default function InstallPrompt() {
  const [show, setShow] = useState(false);
  const [deferredPrompt, setDeferredPrompt] = useState(null);
  const [isIOS, setIsIOS] = useState(false);
  const [isInstalled, setIsInstalled] = useState(false);

  useEffect(() => {
    // Check if already running as PWA
    if (window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone) {
      setIsInstalled(true);
      return;
    }

    const ios = /iPad|iPhone|iPod/.test(navigator.userAgent) && !window.MSStream;
    setIsIOS(ios);

    // Show prompt immediately after 3 seconds (every time until installed)
    const timer = setTimeout(() => {
      if (!window.matchMedia('(display-mode: standalone)').matches) {
        setShow(true);
      }
    }, 3000);

    // Capture the install prompt event
    const handler = (e) => {
      e.preventDefault();
      setDeferredPrompt(e);
      setShow(true);
    };
    window.addEventListener('beforeinstallprompt', handler);

    return () => {
      clearTimeout(timer);
      window.removeEventListener('beforeinstallprompt', handler);
    };
  }, []);

  const handleInstall = async () => {
    if (deferredPrompt) {
      deferredPrompt.prompt();
      const { outcome } = await deferredPrompt.userChoice;
      if (outcome === 'accepted') {
        setIsInstalled(true);
        setShow(false);
      }
      setDeferredPrompt(null);
    }
  };

  const dismiss = () => {
    setShow(false);
    // Show again after 60 seconds
    setTimeout(() => {
      if (!window.matchMedia('(display-mode: standalone)').matches) {
        setShow(true);
      }
    }, 60000);
  };

  if (!show || isInstalled) return null;

  return (
    <div className="fixed left-3 right-3 sm:left-auto sm:right-4 sm:w-80 z-[998] glass rounded-2xl p-4 shadow-2xl border border-[var(--accent)]/20"
      style={{ bottom: 'calc(70px + env(safe-area-inset-bottom, 0px))' }}>
      <div className="flex items-start gap-3">
        <div className="w-11 h-11 rounded-xl accent-gradient flex items-center justify-center text-xl shrink-0">⚡</div>
        <div className="flex-1 min-w-0">
          <div className="font-bold text-sm mb-0.5">Get MidasHub App</div>
          {isIOS ? (
            <p className="text-xs text-white/40 leading-relaxed">
              Tap <span className="text-blue-400">⬆️ Share</span> at the bottom → <strong className="text-white/60">&quot;Add to Home Screen&quot;</strong>
            </p>
          ) : deferredPrompt ? (
            <p className="text-xs text-white/40 leading-relaxed">
              Install for instant access — works like a real app!
            </p>
          ) : (
            <p className="text-xs text-white/40 leading-relaxed">
              Add to home screen: tap your browser menu (⋮) → <strong className="text-white/60">&quot;Add to Home Screen&quot;</strong>
            </p>
          )}
          <div className="flex gap-2 mt-2">
            {deferredPrompt && (
              <button onClick={handleInstall} className="btn-primary py-1.5 px-4 text-[11px]">Install ⚡</button>
            )}
            <button onClick={dismiss} className="text-[11px] text-white/30 hover:text-white/50 px-2 py-1.5">Later</button>
          </div>
        </div>
        <button onClick={dismiss} className="text-white/20 hover:text-white/50 text-sm shrink-0 mt-0.5">✕</button>
      </div>
    </div>
  );
}
