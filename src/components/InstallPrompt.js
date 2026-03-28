'use client';
import { useState, useEffect } from 'react';

export default function InstallPrompt() {
  const [show, setShow] = useState(false);
  const [deferredPrompt, setDeferredPrompt] = useState(null);
  const [isIOS, setIsIOS] = useState(false);
  const [isInstalled, setIsInstalled] = useState(false);

  useEffect(() => {
    // Check if already installed
    if (window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone) {
      setIsInstalled(true);
      return;
    }

    // Check if dismissed recently
    const dismissed = localStorage.getItem('midashub-install-dismissed');
    if (dismissed && Date.now() - parseInt(dismissed) < 7 * 24 * 60 * 60 * 1000) return; // 7 days

    // iOS detection
    const ios = /iPad|iPhone|iPod/.test(navigator.userAgent) && !window.MSStream;
    setIsIOS(ios);

    // Android/Chrome install prompt
    const handler = (e) => {
      e.preventDefault();
      setDeferredPrompt(e);
      // Show after 30 seconds of browsing
      setTimeout(() => setShow(true), 30000);
    };
    window.addEventListener('beforeinstallprompt', handler);

    // For iOS, show manual instructions after delay
    if (ios) {
      setTimeout(() => setShow(true), 45000);
    }

    return () => window.removeEventListener('beforeinstallprompt', handler);
  }, []);

  const handleInstall = async () => {
    if (deferredPrompt) {
      deferredPrompt.prompt();
      const { outcome } = await deferredPrompt.userChoice;
      if (outcome === 'accepted') setShow(false);
      setDeferredPrompt(null);
    }
  };

  const dismiss = () => {
    setShow(false);
    localStorage.setItem('midashub-install-dismissed', Date.now().toString());
  };

  if (!show || isInstalled) return null;

  return (
    <div className="fixed bottom-20 sm:bottom-4 left-4 right-4 sm:left-auto sm:right-4 sm:w-80 z-[998] glass rounded-2xl p-4 shadow-2xl border border-[var(--accent)]/20">
      <div className="flex items-start gap-3">
        <div className="w-12 h-12 rounded-xl accent-gradient flex items-center justify-center text-2xl shrink-0">⚡</div>
        <div className="flex-1 min-w-0">
          <div className="font-bold text-sm mb-0.5">Add MidasHub to Home Screen</div>
          {isIOS ? (
            <p className="text-xs text-white/40 leading-relaxed">
              Tap <span className="inline-block text-blue-400 mx-0.5">⬆️ Share</span> then <strong className="text-white/60">&quot;Add to Home Screen&quot;</strong> for instant access like a real app!
            </p>
          ) : (
            <p className="text-xs text-white/40 leading-relaxed">
              Install MidasHub for instant access — works like a real app, no app store needed!
            </p>
          )}
          <div className="flex gap-2 mt-2.5">
            {!isIOS && deferredPrompt && (
              <button onClick={handleInstall} className="btn-primary py-1.5 px-4 text-[11px]">
                Install App ⚡
              </button>
            )}
            <button onClick={dismiss} className="text-[11px] text-white/30 hover:text-white/50 transition px-2 py-1.5">
              Maybe later
            </button>
          </div>
        </div>
        <button onClick={dismiss} className="text-white/20 hover:text-white/50 text-sm shrink-0">✕</button>
      </div>
    </div>
  );
}
