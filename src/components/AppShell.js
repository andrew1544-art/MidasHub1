'use client';
import { useEffect, useRef } from 'react';
import { useStore } from '@/lib/store';
import Header from '@/components/Header';
import AuthModal from '@/components/AuthModal';
import ComposeModal from '@/components/ComposeModal';

export default function AppShell({ children }) {
  const { initAuth, loading, theme, loadTheme, toast } = useStore();
  const initialized = useRef(false);

  useEffect(() => {
    // Prevent double-init in React strict mode
    if (initialized.current) return;
    initialized.current = true;
    initAuth();
    loadTheme();
  }, []);

  useEffect(() => {
    if (theme) document.documentElement.setAttribute('data-theme', theme);
  }, [theme]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="text-6xl mb-4 animate-pulse">⚡</div>
          <div className="text-xl font-bold accent-text">Loading MidasHub...</div>
        </div>
      </div>
    );
  }

  return (
    <>
      <Header />
      <main className="pb-20 md:pb-8">{children}</main>
      <AuthModal />
      <ComposeModal />
      {toast && <div className="toast">{toast}</div>}
    </>
  );
}
