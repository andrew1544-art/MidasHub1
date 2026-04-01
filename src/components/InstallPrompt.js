'use client';
import { useState, useEffect } from 'react';

export default function InstallPrompt() {
  const [show, setShow] = useState(false);
  const [deferredPrompt, setDeferredPrompt] = useState(null);
  const [isIOS, setIsIOS] = useState(false);
  const [installed, setInstalled] = useState(false);

  useEffect(() => {
    // Already installed as PWA
    if (window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone) return;
    // Already dismissed today
    const dismissed = localStorage.getItem('midashub-install-dismiss');
    if (dismissed && Date.now() - parseInt(dismissed) < 86400000) return;
    // Already installed before
    if (localStorage.getItem('midashub-installed')) return;

    const ios = /iPad|iPhone|iPod/.test(navigator.userAgent) && !window.MSStream;
    setIsIOS(ios);

    // Capture install prompt — MUST preventDefault to keep it
    const handler = (e) => { e.preventDefault(); setDeferredPrompt(e); };
    window.addEventListener('beforeinstallprompt', handler);

    // Show after 3 seconds
    const timer = setTimeout(() => setShow(true), 3000);

    return () => { clearTimeout(timer); window.removeEventListener('beforeinstallprompt', handler); };
  }, []);

  const handleInstall = async () => {
    if (deferredPrompt) {
      // Triggers native browser "Add to Home Screen" dialog
      deferredPrompt.prompt();
      const { outcome } = await deferredPrompt.userChoice;
      setDeferredPrompt(null);
      if (outcome === 'accepted') {
        setInstalled(true);
        localStorage.setItem('midashub-installed', '1');
        try {
          const { createClient } = await import('@/lib/supabase-browser');
          const sb = createClient();
          const { data: { session } } = await sb.auth.getSession();
          if (session?.user) await sb.from('profiles').update({ has_installed_pwa: true }).eq('id', session.user.id);
        } catch(e) {}
        setTimeout(() => setShow(false), 2000);
        return;
      }
    }
    setShow(false);
    localStorage.setItem('midashub-install-dismiss', Date.now().toString());
  };

  const dismiss = () => {
    setShow(false);
    localStorage.setItem('midashub-install-dismiss', Date.now().toString());
  };

  if (!show) return null;

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center p-6" style={{ background: 'rgba(0,0,0,0.7)' }}>
      <div className="glass rounded-3xl p-6 max-w-sm w-full shadow-2xl border border-[var(--accent)]/20 text-center"
        style={{ animation: 'installFade 0.3s ease' }}>
        {installed ? (
          <>
            <div className="text-5xl mb-3">🎉</div>
            <h3 className="text-xl font-black mb-1">App Installed!</h3>
            <p className="text-sm text-white/40">Check your home screen</p>
          </>
        ) : (
          <>
            <div className="w-16 h-16 rounded-2xl accent-gradient flex items-center justify-center text-3xl mx-auto mb-4 shadow-lg">⚡</div>
            <h3 className="text-xl font-black mb-1">Add MidasHub to Home Screen?</h3>
            <p className="text-sm text-white/40 mb-5 leading-relaxed">
              {isIOS
                ? <>Tap <span className="text-blue-400 font-semibold">Share ⬆️</span> then <span className="text-white/70 font-semibold">&quot;Add to Home Screen&quot;</span></>
                : 'Get instant access like a real app — push notifications, full screen, one tap to open.'
              }
            </p>
            <div className="flex flex-col gap-2">
              {deferredPrompt ? (
                <button onClick={handleInstall}
                  className="w-full py-3.5 rounded-xl accent-gradient text-black font-bold text-sm shadow-lg active:scale-[0.98] transition-transform">
                  Install App ⚡
                </button>
              ) : isIOS ? (
                <div className="text-xs text-white/30 py-2">Follow the steps above to install</div>
              ) : (
                <div className="text-xs text-white/30 py-2">
                  Tap <span className="text-white/60 font-semibold">⋮</span> menu → <span className="text-white/60 font-semibold">&quot;Add to Home Screen&quot;</span>
                </div>
              )}
              <button onClick={dismiss}
                className="w-full py-2.5 rounded-xl bg-white/5 text-white/40 text-sm font-medium hover:bg-white/8 transition">
                Maybe Later
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
