'use client';
import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase-browser';

export default function AuthCallback() {
  const router = useRouter();

  useEffect(() => {
    const supabase = createClient();
    
    const handleCallback = async () => {
      const { data: { session }, error } = await supabase.auth.getSession();
      if (session) {
        router.push('/feed');
      } else {
        router.push('/?verified=true');
      }
    };

    handleCallback();
  }, [router]);

  return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="text-center animate-pulse">
        <div className="text-6xl mb-4">⚡</div>
        <h2 className="text-2xl font-bold gold-gradient">Verifying your email...</h2>
        <p className="text-white/40 mt-2">Hold tight, setting up your MidasHub account</p>
      </div>
    </div>
  );
}
