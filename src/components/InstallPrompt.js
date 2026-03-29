'use client';
import { useState, useEffect } from 'react';

export default function InstallPrompt() {
  const [show, setShow] = useState(false);
  const [deferredPrompt, setDeferredPrompt] = useState(null);
  const [isIOS, setIsIOS] = useState(false);

  useEffect(() => {
    // Already installed as PWA — never show
    if (window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone) return;
    // Already dismissed today — don't show
    const dismissed = localStorage.getItem('midashub-install-dismiss');
    if (dismissed && Date.now() - parseInt(dismissed) < 86400000) return;

    const ios = /iPad|iPhone|iPod/.test(navigator.userAgent) && !window.MSStream;
    setIsIOS(ios);

    // Show after 10 seconds (not 3)
    const timer = setTimeout(() => setShow(true), 10000);

    // Capture install prompt (don't preventDefault — let browser show its own too)
    const handler = (e) => { setDeferredPrompt(e); };
    window.addEventListener('beforeinstallprompt', handler);

    return () => { clearTimeout(timer); window.removeEventListener('beforeinstallprompt', handler); };
  }, []);

  const handleInstall = async () => {
    if (deferredPrompt) {
      deferredPrompt.prompt();
      await deferredPrompt.userChoice;
      setDeferredPrompt(null);
    }
    setShow(false);
  };

  const dismiss = () => {
    setShow(false);
    localStorage.setItem('midashub-install-dismiss', Date.now().toString());
  };

  if (!show) return null;

  return (
    <div className="fixed left-3 right-3 sm:left-auto sm:right-4 sm:w-80 z-[998] glass rounded-2xl p-4 shadow-2xl border border-[var(--accent)]/20"
      style={{ bottom: 'calc(70px + env(safe-area-inset-bottom, 0px))' }}>
      <div className="flex items-start gap-3">
        <div className="w-11 h-11 rounded-xl accent-gradient flex items-center justify-center text-xl shrink-0">⚡</div>
        <div className="flex-1 min-w-0">
          <div className="font-bold text-sm mb-0.5">Get MidasHub App</div>
          {isIOS ? (
            <p className="text-xs text-white/40 leading-relaxed">Tap <span className="text-blue-400">⬆️ Share</span> → <strong className="text-white/60">&quot;Add to Home Screen&quot;</strong></p>
          ) : deferredPrompt ? (
            <p className="text-xs text-white/40">Install for instant access!</p>
          ) : (
            <p className="text-xs text-white/40">Tap ⋮ menu → <strong className="text-white/60">&quot;Add to Home Screen&quot;</strong></p>
          )}
          <div className="flex gap-2 mt-2">
            {deferredPrompt && <button onClick={handleInstall} className="btn-primary py-1.5 px-4 text-[11px]">Install ⚡</button>}
            <button onClick={dismiss} className="text-[11px] text-white/30 hover:text-white/50 px-2 py-1.5">Not now</button>
          </div>
        </div>
        <button onClick={dismiss} className="text-white/20 hover:text-white/50 text-sm shrink-0">✕</button>
      </div>
    </div>
  );
}
