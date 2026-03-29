'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase-browser';
import { Suspense } from 'react';

function CallbackInner() {
  const router = useRouter();
  const [status, setStatus] = useState('Processing...');

  useEffect(() => {
    const handleCallback = async () => {
      try {
        const supabase = createClient();
        
        // Check URL hash for recovery token (Supabase puts tokens in hash)
        const hash = window.location.hash;
        const params = new URLSearchParams(window.location.search);
        const isRecovery = hash.includes('type=recovery') || params.get('type') === 'recovery';
        
        // Exchange the code/token
        if (params.get('code')) {
          const { error } = await supabase.auth.exchangeCodeForSession(params.get('code'));
          if (error) console.warn('Code exchange error:', error.message);
        }

        // Check if we have a session now
        const { data: { session } } = await supabase.auth.getSession();

        if (isRecovery && session) {
          setStatus('Redirecting to reset password...');
          // Store a flag that the password reset modal should open
          sessionStorage.setItem('midashub-reset-password', '1');
          setTimeout(() => { window.location.href = '/feed'; }, 300);
          return;
        }

        if (session) {
          setStatus('Logged in! Redirecting...');
          setTimeout(() => { window.location.href = '/feed'; }, 300);
        } else {
          setStatus('Email verified! You can now log in.');
          setTimeout(() => { window.location.href = '/?verified=true'; }, 1500);
        }
      } catch (e) {
        console.warn('Callback error:', e);
        setStatus('Redirecting...');
        setTimeout(() => { window.location.href = '/'; }, 1500);
      }
    };

    handleCallback();
  }, []);

  return (
    <div className="min-h-screen flex items-center justify-center" style={{ background: 'linear-gradient(135deg, #0a0a0f, #1a0a2e, #0d1b2a)' }}>
      <div className="text-center">
        <div className="text-6xl mb-4 animate-pulse">⚡</div>
        <div className="text-xl font-bold text-white mb-2">{status}</div>
        <div className="text-white/30 text-sm">Please wait...</div>
      </div>
    </div>
  );
}

export default function AuthCallbackPage() {
  return <Suspense fallback={<div className="min-h-screen flex items-center justify-center" style={{ background: '#0a0a0f' }}><div className="text-4xl animate-pulse">⚡</div></div>}><CallbackInner /></Suspense>;
}
