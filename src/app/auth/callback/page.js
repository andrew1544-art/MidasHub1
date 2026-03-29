'use client';
import { useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { createClient } from '@/lib/supabase-browser';
import { Suspense } from 'react';

function CallbackInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [status, setStatus] = useState('Processing...');

  useEffect(() => {
    const handleCallback = async () => {
      try {
        const supabase = createClient();
        const type = searchParams.get('type');

        // Handle the auth code exchange
        const { data: { session }, error } = await supabase.auth.getSession();

        if (type === 'recovery') {
          // Password reset — redirect to app with reset mode
          setStatus('Redirecting to reset password...');
          // The session is set by Supabase from the recovery link
          // Open the auth modal in reset mode
          setTimeout(() => {
            window.location.href = '/feed?reset=true';
          }, 500);
          return;
        }

        if (session) {
          setStatus('Logged in! Redirecting...');
          setTimeout(() => router.push('/feed'), 500);
        } else if (error) {
          setStatus('Something went wrong. Redirecting...');
          setTimeout(() => router.push('/?verified=true'), 2000);
        } else {
          setStatus('Email verified! You can now log in.');
          setTimeout(() => router.push('/?verified=true'), 2000);
        }
      } catch (e) {
        setStatus('Redirecting...');
        setTimeout(() => router.push('/'), 2000);
      }
    };

    handleCallback();
  }, [router, searchParams]);

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
