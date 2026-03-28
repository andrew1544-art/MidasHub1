'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase-browser';

export default function AuthCallback() {
  const router = useRouter();
  const [status, setStatus] = useState('verifying');
  const [error, setError] = useState('');

  useEffect(() => {
    const handleCallback = async () => {
      try {
        const supabase = createClient();

        // The hash fragment contains the token — Supabase client auto-handles it
        const { data: { session }, error: sessionError } = await supabase.auth.getSession();

        if (sessionError) {
          console.error('Callback error:', sessionError);
          setError(sessionError.message);
          setStatus('error');
          return;
        }

        if (session) {
          setStatus('success');
          setTimeout(() => router.push('/feed'), 1500);
        } else {
          // No session yet — might need to exchange the code
          const params = new URLSearchParams(window.location.search);
          const code = params.get('code');

          if (code) {
            const { error: exchangeError } = await supabase.auth.exchangeCodeForSession(code);
            if (exchangeError) {
              console.error('Code exchange error:', exchangeError);
              setStatus('verified');
              setTimeout(() => router.push('/?verified=true'), 2000);
            } else {
              setStatus('success');
              setTimeout(() => router.push('/feed'), 1500);
            }
          } else {
            // Email verified but no auto-login — redirect to login
            setStatus('verified');
            setTimeout(() => router.push('/?verified=true'), 2000);
          }
        }
      } catch (err) {
        console.error('Callback exception:', err);
        setStatus('verified');
        setTimeout(() => router.push('/?verified=true'), 2000);
      }
    };

    handleCallback();
  }, [router]);

  return (
    <div className="min-h-screen flex items-center justify-center p-4" style={{ background: 'var(--bg, #0a0a0f)' }}>
      <div className="text-center max-w-sm">
        {status === 'verifying' && (
          <>
            <div className="text-6xl mb-4 animate-pulse">⚡</div>
            <h2 className="text-2xl font-bold mb-2" style={{ color: '#FFD700' }}>Verifying your email...</h2>
            <p className="text-white/40 text-sm">Hold tight, we&apos;re setting up your account</p>
          </>
        )}
        {status === 'success' && (
          <>
            <div className="text-6xl mb-4">🎉</div>
            <h2 className="text-2xl font-bold text-green-400 mb-2">You&apos;re in!</h2>
            <p className="text-white/40 text-sm">Email verified. Redirecting to your feed...</p>
          </>
        )}
        {status === 'verified' && (
          <>
            <div className="text-6xl mb-4">✅</div>
            <h2 className="text-2xl font-bold text-green-400 mb-2">Email Verified!</h2>
            <p className="text-white/40 text-sm">Your account is ready. Redirecting to login...</p>
          </>
        )}
        {status === 'error' && (
          <>
            <div className="text-6xl mb-4">⚠️</div>
            <h2 className="text-2xl font-bold text-red-400 mb-2">Something went wrong</h2>
            <p className="text-white/40 text-sm mb-4">{error || 'Please try logging in manually.'}</p>
            <button onClick={() => router.push('/')} className="px-6 py-3 rounded-xl font-semibold text-sm"
              style={{ background: 'linear-gradient(135deg, #FFD700, #FFA500)', color: '#000' }}>
              Go to MidasHub →
            </button>
          </>
        )}
      </div>
    </div>
  );
}
