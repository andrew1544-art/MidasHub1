'use client';
import { useEffect, useState } from 'react';
import { useStore } from '@/lib/store';
import Header from '@/components/Header';
import AuthModal from '@/components/AuthModal';
import ComposeModal from '@/components/ComposeModal';
import InstallPrompt from '@/components/InstallPrompt';

export default function AppShell({ children }) {
  const { initAuth, loading, theme, loadTheme, toast, postingInBackground, setShowCompose, user } = useStore();
  const [forceShow, setForceShow] = useState(false);

  useEffect(() => {
    initAuth();
    loadTheme();
    const fallback = setTimeout(() => setForceShow(true), 2000);
    return () => clearTimeout(fallback);
  }, []);

  // Auto-open compose if user had a draft before reload
  useEffect(() => {
    if (user) {
      try {
        const draft = sessionStorage.getItem('mh-draft');
        if (draft && draft.trim()) {
          setTimeout(() => setShowCompose(true), 500);
        }
      } catch(e) {}
    }
  }, [user]);

  useEffect(() => {
    if (theme) document.documentElement.setAttribute('data-theme', theme);
  }, [theme]);

  if (loading && !forceShow) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="text-6xl mb-4 animate-pulse">⚡</div>
          <div className="text-xl font-bold accent-text">Loading MidasHub...</div>
          <p className="text-white/20 text-xs mt-3">Taking too long? <button onClick={() => setForceShow(true)} className="text-[var(--accent)] underline">Click here</button></p>
        </div>
      </div>
    );
  }

  return (
    <>
      <Header />
      <main className="pb-24 md:pb-8" style={{ paddingBottom: 'calc(80px + env(safe-area-inset-bottom, 0px))' }}>{children}</main>
      <AuthModal />
      <ComposeModal />
      <InstallPrompt />
      {postingInBackground && (
        <div className="fixed top-[env(safe-area-inset-top,0px)] left-0 right-0 z-[999] flex justify-center pointer-events-none" style={{ paddingTop: 'calc(4px + env(safe-area-inset-top, 0px))' }}>
          <div className="flex items-center gap-2 px-4 py-2 rounded-full bg-[var(--accent)] text-black text-xs font-bold shadow-lg pointer-events-auto">
            <span className="animate-spin">⏳</span> Posting in background...
          </div>
        </div>
      )}
      {toast && <div className="toast">{toast}</div>}
    </>
  );
}
