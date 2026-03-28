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

  useEffect(() => {
    if (user) router.push('/feed');
  }, [user]);

  useEffect(() => {
    if (searchParams.get('verified') === 'true') {
      setShowAuth(true, 'login');
    }
  }, [searchParams]);

  return (
    <AppShell>
      <div className="max-w-5xl mx-auto px-4">
        {/* Hero */}
        <section className="py-20 md:py-32 text-center relative">
          <div className="absolute inset-0 pointer-events-none">
            <div className="absolute w-96 h-96 rounded-full bg-yellow-500/5 -top-20 -left-20 blur-3xl animate-float" />
            <div className="absolute w-80 h-80 rounded-full bg-pink-500/5 -bottom-10 -right-10 blur-3xl animate-float" style={{ animationDelay: '3s' }} />
          </div>

          <div className="relative z-10">
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-yellow-500/10 border border-yellow-500/20 text-yellow-400 text-sm font-medium mb-8">
              ⚡ The social hub that changes everything
            </div>

            <h1 className="text-5xl md:text-7xl font-black leading-tight mb-6">
              Every Post.<br />
              <span className="midas-gradient-text">Every Platform.</span><br />
              One Feed.
            </h1>

            <p className="text-lg md:text-xl text-white/50 max-w-2xl mx-auto leading-relaxed mb-10">
              See what everyone is posting on Snap, Facebook, IG, TikTok, X, YouTube — all in one place. 
              No friend requests needed. No limits. No restrictions. Just pure, unfiltered social.
            </p>

            <div className="flex flex-col sm:flex-row items-center justify-center gap-4 mb-12">
              <button onClick={() => setShowAuth(true, 'signup')} className="btn-primary text-lg px-10 py-4 rounded-2xl">
                Join MidasHub — It&apos;s Free ⚡
              </button>
              <button onClick={() => router.push('/feed')} className="btn-secondary text-lg px-10 py-4 rounded-2xl">
                Browse Feed →
              </button>
            </div>

            {/* Platform icons */}
            <div className="flex items-center justify-center gap-3 flex-wrap">
              {PLATFORM_LIST.map(([key, p]) => (
                <div key={key} className="platform-pill px-4 py-2 rounded-xl text-sm"
                  style={{ background: `${p.color}15`, border: `1px solid ${p.color}25`, color: p.color }}
                >
                  {p.icon} {p.name}
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Features */}
        <section className="py-16">
          <div className="grid md:grid-cols-3 gap-6">
            {[
              {
                icon: '🌍',
                title: 'All Platforms, One Feed',
                desc: 'Repost from Snapchat, Facebook, Instagram, TikTok, X, WhatsApp, YouTube, LinkedIn — all visible to everyone in one place.',
              },
              {
                icon: '🔥',
                title: 'Viral Discovery',
                desc: 'Content goes viral organically. Everyone sees everything. No algorithms hiding your posts. Pure reach.',
              },
              {
                icon: '💬',
                title: 'Chat & Connect',
                desc: 'Make friends, chat in real-time, build your network. No friend request needed to see posts.',
              },
              {
                icon: '🚀',
                title: 'Cross-Post Anywhere',
                desc: 'Buttons to instantly jump to any platform and post. Share your MidasHub content everywhere.',
              },
              {
                icon: '🛡️',
                title: 'Verified Accounts',
                desc: 'Email verification keeps accounts real. No bots, no fakes. Real people, real content.',
              },
              {
                icon: '♾️',
                title: 'No Limits',
                desc: 'Post as much as you want. No character limits. No daily caps. No content type restrictions. Your world.',
              },
            ].map((feature, i) => (
              <div key={i} className="glass-light rounded-2xl p-6 hover-lift">
                <div className="text-3xl mb-3">{feature.icon}</div>
                <h3 className="font-bold text-lg mb-2">{feature.title}</h3>
                <p className="text-sm text-white/40 leading-relaxed">{feature.desc}</p>
              </div>
            ))}
          </div>
        </section>

        {/* CTA */}
        <section className="py-16 text-center">
          <div className="glass-light rounded-3xl p-12 relative overflow-hidden">
            <div className="absolute inset-0 midas-gradient opacity-5" />
            <div className="relative z-10">
              <h2 className="text-3xl md:text-4xl font-black mb-4">Ready to see everything?</h2>
              <p className="text-white/40 text-lg mb-8 max-w-lg mx-auto">
                Join thousands of people who are already seeing content from every platform in one place.
              </p>
              <button onClick={() => setShowAuth(true, 'signup')} className="btn-primary text-lg px-10 py-4 rounded-2xl">
                Create Free Account ⚡
              </button>
              <p className="text-[11px] text-white/20 mt-4">
                Free forever • Ages 15+ • Email verification required
              </p>
            </div>
          </div>
        </section>

        {/* Footer */}
        <footer className="py-8 border-t border-white/5 text-center text-sm text-white/20">
          <div className="flex items-center justify-center gap-2 mb-2">
            <span>⚡</span>
            <span className="font-bold gold-gradient">MidasHub</span>
          </div>
          <p>All your socials, one place. © {new Date().getFullYear()}</p>
        </footer>
      </div>
    </AppShell>
  );
}

export default function Home() {
  return (
    <Suspense fallback={<div className="min-h-screen flex items-center justify-center"><div className="text-4xl animate-pulse">⚡</div></div>}>
      <HomeInner />
    </Suspense>
  );
}