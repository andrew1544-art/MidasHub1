'use client';
import { Suspense, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import AppShell from '@/components/AppShell';
import { useStore } from '@/lib/store';
import { PLATFORM_LIST } from '@/lib/constants';

function HomeInner() {
  const { user, setShowAuth } = useStore();
  const router = useRouter();
  const searchParams = useSearchParams();

  useEffect(() => { if (user) router.push('/feed'); }, [user]);
  useEffect(() => { if (searchParams.get('verified') === 'true') setShowAuth(true, 'login'); }, [searchParams]);

  const features = [
    { icon: '🌍', title: 'All Platforms, One Feed', desc: 'Repost from Snapchat, Facebook, Instagram, TikTok, X, WhatsApp, YouTube, LinkedIn — visible to everyone.' },
    { icon: '🔥', title: 'Go Viral', desc: 'No algorithms hiding your content. Posts with 100+ likes auto-trend. Pure organic reach.' },
    { icon: '💬', title: 'Chat & Connect', desc: 'Make friends, real-time messaging, build your network. No gatekeeping.' },
    { icon: '🚀', title: 'Cross-Post Anywhere', desc: 'Buttons to jump to any platform and post. Share MidasHub content everywhere.' },
    { icon: '🛡️', title: 'Verified Accounts', desc: 'Email verification keeps it real. No bots, no fakes.' },
    { icon: '♾️', title: 'No Limits', desc: 'Post as much as you want. No character caps. No restrictions. Your world.' },
  ];

  return (
    <AppShell>
      <div className="max-w-5xl mx-auto px-4">
        <section className="py-16 sm:py-24 md:py-32 text-center">
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-white/5 border border-white/8 text-[var(--accent)] text-sm font-medium mb-6 sm:mb-8">
            ⚡ The social hub that changes everything
          </div>
          <h1 className="text-4xl sm:text-5xl md:text-7xl font-black leading-tight mb-5">
            Every Post.<br />
            <span className="accent-text">Every Platform.</span><br />
            One Feed.
          </h1>
          <p className="text-base sm:text-lg text-white/40 max-w-xl mx-auto leading-relaxed mb-8 sm:mb-10 px-4">
            See what everyone is posting on Snap, Facebook, IG, TikTok, X, YouTube — all in one place. No friend requests needed. No limits.
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-3 mb-10">
            <button onClick={() => setShowAuth(true, 'signup')} className="btn-primary text-base px-8 py-3.5 rounded-2xl w-full sm:w-auto">
              Join MidasHub — Free ⚡
            </button>
            <button onClick={() => router.push('/feed')} className="btn-secondary text-base px-8 py-3.5 rounded-2xl w-full sm:w-auto">
              Browse Feed →
            </button>
          </div>
          <div className="flex items-center justify-center gap-2 flex-wrap px-4">
            {PLATFORM_LIST.map(([key, p]) => (
              <span key={key} className="platform-pill px-3 py-1.5 text-[11px]" style={{ background: `${p.color}12`, border: `1px solid ${p.color}20`, color: p.color }}>
                {p.icon} {p.name}
              </span>
            ))}
          </div>
        </section>

        <section className="py-12 sm:py-16">
          <div className="grid sm:grid-cols-2 md:grid-cols-3 gap-4">
            {features.map((f, i) => (
              <div key={i} className="glass-light rounded-2xl p-5 hover-lift">
                <div className="text-2xl mb-2">{f.icon}</div>
                <h3 className="font-bold text-base mb-1.5">{f.title}</h3>
                <p className="text-sm text-white/35 leading-relaxed">{f.desc}</p>
              </div>
            ))}
          </div>
        </section>

        <section className="py-12 sm:py-16 text-center">
          <div className="glass-light rounded-2xl sm:rounded-3xl p-8 sm:p-12">
            <h2 className="text-2xl sm:text-3xl font-black mb-3">Ready to see everything?</h2>
            <p className="text-white/35 text-base mb-6 max-w-md mx-auto">Join people already seeing content from every platform in one place.</p>
            <button onClick={() => setShowAuth(true, 'signup')} className="btn-primary text-base px-8 py-3.5 rounded-2xl">Create Free Account ⚡</button>
            <p className="text-[11px] text-white/15 mt-3">Free forever · Ages 15+ · Email verification</p>
          </div>
        </section>

        <footer className="py-6 border-t border-white/5 text-center text-sm text-white/15">
          <span>⚡</span> <span className="font-bold accent-text">MidasHub</span> · All your socials, one place © {new Date().getFullYear()}
        </footer>
      </div>
    </AppShell>
  );
}

export default function Home() {
  return <Suspense fallback={<div className="min-h-screen flex items-center justify-center"><div className="text-4xl animate-pulse">⚡</div></div>}><HomeInner /></Suspense>;
}
