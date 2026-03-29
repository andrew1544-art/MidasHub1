'use client';
import { useEffect, useState } from 'react';
import { useStore } from '@/lib/store';
import Header from '@/components/Header';
import AuthModal from '@/components/AuthModal';
import ComposeModal from '@/components/ComposeModal';
import InstallPrompt from '@/components/InstallPrompt';

export default function AppShell({ children }) {
  const { initAuth, loading, theme, loadTheme, toast } = useStore();
  const [forceShow, setForceShow] = useState(false);

  useEffect(() => {
    initAuth();
    loadTheme();
    // If still loading after 2s, force show the page anyway
    const fallback = setTimeout(() => setForceShow(true), 2000);
    return () => clearTimeout(fallback);
  }, []);

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
      {toast && <div className="toast">{toast}</div>}
    </>
  );
}
