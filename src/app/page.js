'use client';
import { Suspense, useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import AppShell from '@/components/AppShell';
import { useStore } from '@/lib/store';
import { PLATFORM_LIST } from '@/lib/constants';

const FEED_PREVIEW = [
  { avatar: '🧑🏾', name: 'Alex K.', platform: 'snapchat', platformColor: '#FFFC00', platformIcon: '👻', content: 'Wild night out with the crew 🔥 no cap this was legendary', time: '2m', likes: '1.2K', viral: true },
  { avatar: '👩🏽', name: 'Priya S.', platform: 'instagram', platformColor: '#E4405F', platformIcon: '📸', content: 'Golden hour hits different when you\'re at peace ✨ New chapter loading...', time: '15m', likes: '3.4K', viral: true },
  { avatar: '👨🏼', name: 'Jake M.', platform: 'twitter', platformColor: '#1DA1F2', platformIcon: '𝕏', content: 'Hot take: pineapple on pizza is elite and I\'m tired of pretending 🍍🍕', time: '32m', likes: '12K', viral: true },
  { avatar: '👩🏿', name: 'Aisha B.', platform: 'tiktok', platformColor: '#010101', platformIcon: '🎵', content: 'This dance trend is taking over 💃 Wait for the ending 😂', time: '1h', likes: '45K', viral: true },
  { avatar: '👨🏻', name: 'Marco R.', platform: 'facebook', platformColor: '#1877F2', platformIcon: '📘', content: 'Just got promoted!! 🎉 Hard work pays off. Thank you everyone 🙏', time: '2h', likes: '890' },
  { avatar: '👩🏻', name: 'Yuki T.', platform: 'youtube', platformColor: '#FF0000', platformIcon: '▶️', content: 'NEW VIDEO: I tried living without social media for 30 days...', time: '3h', likes: '8.9K', viral: true },
];

const STATS = [
  { value: '∞', label: 'Post Limit' },
  { value: '8+', label: 'Platforms' },
  { value: '15+', label: 'Min Age' },
  { value: '$0', label: 'Forever' },
];

function HomeInner() {
  const { user, setShowAuth } = useStore();
  const router = useRouter();
  const searchParams = useSearchParams();
  const [mounted, setMounted] = useState(false);
  const [visibleCards, setVisibleCards] = useState(0);
  const [tutorialUrl, setTutorialUrl] = useState('');
  const [showTutorial, setShowTutorial] = useState(false);

  useEffect(() => { setMounted(true); }, []);
  useEffect(() => { if (user) router.push('/feed'); }, [user, router]);
  useEffect(() => { if (searchParams.get('verified') === 'true') setShowAuth(true, 'login'); }, [searchParams, setShowAuth]);

  // Load tutorial video URL
  useEffect(() => {
    (async () => {
      try {
        const { createClient } = await import('@/lib/supabase-browser');
        const sb = createClient();
        const { data } = await sb.storage.from('media').list('site', { limit: 10 });
        const tut = (data||[]).find(f => f.name.startsWith('tutorial'));
        if (tut) { const { data: u } = sb.storage.from('media').getPublicUrl('site/' + tut.name); setTutorialUrl(u.publicUrl); }
      } catch(e) {}
    })();
  }, []);

  // Returning user — skip landing, go to feed
  useEffect(() => {
    if (!mounted) return;
    // If URL has trade or referral params, go to feed with them
    const joinTrade = searchParams.get('join_trade');
    const ref = searchParams.get('ref') || searchParams.get('referral');
    if (joinTrade) { router.push(`/feed?join_trade=${joinTrade}`); return; }
    if (ref) { try { localStorage.setItem('midashub-ref', ref.toUpperCase()); } catch(e) {} router.push('/feed'); return; }
    // Returning user — skip landing
    try {
      const wasLoggedIn = localStorage.getItem('mh-logged-in');
      if (wasLoggedIn) router.push('/feed');
    } catch(e) {}
  }, [mounted]);

  useEffect(() => {
    if (!mounted) return;
    const timer = setInterval(() => {
      setVisibleCards(prev => prev < FEED_PREVIEW.length ? prev + 1 : prev);
    }, 200);
    return () => clearInterval(timer);
  }, [mounted]);

  // Stagger helper — returns style that transitions from invisible to visible
  const fadeUp = (delay = 0) => ({
    opacity: mounted ? 1 : 0,
    transform: mounted ? 'translateY(0)' : 'translateY(20px)',
    transition: `opacity 0.6s ease ${delay}s, transform 0.6s ease ${delay}s`,
  });

  return (
    <AppShell>
      <div className="relative">

        {/* ===== HERO ===== */}
        <section className="relative min-h-[90vh] flex items-center overflow-hidden">
          {/* Background effects */}
          <div className="absolute inset-0 pointer-events-none overflow-hidden">
            <div className="absolute w-[500px] h-[500px] rounded-full top-[-10%] left-[-5%] opacity-30"
              style={{ background: 'radial-gradient(circle, rgba(255,215,0,0.15) 0%, transparent 70%)', animation: 'heroFloat 12s ease-in-out infinite' }} />
            <div className="absolute w-[400px] h-[400px] rounded-full bottom-[5%] right-[-5%] opacity-25"
              style={{ background: 'radial-gradient(circle, rgba(255,165,0,0.12) 0%, transparent 70%)', animation: 'heroFloat 15s ease-in-out infinite reverse' }} />
            <div className="absolute w-[300px] h-[300px] rounded-full top-[40%] left-[50%] opacity-20"
              style={{ background: 'radial-gradient(circle, rgba(99,102,241,0.1) 0%, transparent 70%)', animation: 'heroFloat 10s ease-in-out infinite 2s' }} />
            <div className="absolute inset-0 opacity-[0.02]"
              style={{ backgroundImage: 'linear-gradient(rgba(255,215,0,0.3) 1px, transparent 1px), linear-gradient(90deg, rgba(255,215,0,0.3) 1px, transparent 1px)', backgroundSize: '60px 60px' }} />
          </div>

          <div className="max-w-6xl mx-auto px-4 sm:px-6 w-full">
            <div className="grid lg:grid-cols-2 gap-12 lg:gap-8 items-center">

              {/* Left — Copy */}
              <div className="relative z-10 text-center lg:text-left pt-8 lg:pt-0">
                <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full mb-6 text-sm font-semibold"
                  style={{ ...fadeUp(0.1), background: 'rgba(255,215,0,0.08)', border: '1px solid rgba(255,215,0,0.15)', color: '#FFD700' }}>
                  <span className="w-2 h-2 rounded-full bg-green-400 animate-pulse" />
                  Live now — Join thousands of people
                </div>

                <h1 style={fadeUp(0.2)}
                  className="text-[clamp(2.5rem,6vw,4.5rem)] font-black leading-[1.05] mb-6">
                  All Your{' '}
                  <span className="accent-text">Socials</span>
                  <br />
                  One{' '}
                  <span className="relative inline-block">
                    <span className="accent-text">Hub</span>
                    <span className="absolute -top-2 -right-4 text-lg" style={{ animation: 'sparkle 2s ease-in-out infinite' }}>⚡</span>
                  </span>
                </h1>

                <p style={fadeUp(0.3)}
                  className="text-base sm:text-lg text-white/45 max-w-lg leading-relaxed mb-8 mx-auto lg:mx-0">
                  Stop switching apps. See everything your friends post on Snapchat, Instagram, TikTok, X, Facebook, YouTube — all in one beautiful feed. No friend requests needed.
                </p>

                <div style={fadeUp(0.4)} className="flex flex-col sm:flex-row gap-3 justify-center lg:justify-start mb-8">
                  <button onClick={() => setShowAuth(true, 'signup')}
                    className="group relative px-8 py-4 rounded-2xl font-bold text-base text-black overflow-hidden transition-all hover:scale-[1.02] hover:shadow-[0_0_30px_rgba(255,215,0,0.3)]"
                    style={{ background: 'linear-gradient(135deg, #FFD700, #FFA500)' }}>
                    <span className="relative z-10 flex items-center justify-center gap-2">
                      Join MidasHub Free
                      <span className="group-hover:translate-x-1 transition-transform">→</span>
                    </span>
                  </button>
                  <button onClick={() => router.push('/feed')}
                    className="px-8 py-4 rounded-2xl font-semibold text-base text-white/70 transition-all hover:text-white hover:bg-white/5"
                    style={{ border: '1px solid rgba(255,255,255,0.1)' }}>
                    Browse Feed
                  </button>
                </div>

                <div style={fadeUp(0.5)} className="grid grid-cols-4 gap-4 max-w-md mx-auto lg:mx-0">
                  {STATS.map((stat, i) => (
                    <div key={i} className="text-center lg:text-left">
                      <div className="text-xl sm:text-2xl font-black accent-text">{stat.value}</div>
                      <div className="text-[11px] text-white/30 font-medium mt-0.5">{stat.label}</div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Right — Live feed preview */}
              <div className="relative z-10 hidden sm:block" style={fadeUp(0.4)}>
                <div className="relative">
                  <div className="relative mx-auto max-w-sm rounded-[2rem] p-[2px] overflow-hidden"
                    style={{ background: 'linear-gradient(135deg, rgba(255,215,0,0.3), rgba(255,165,0,0.1), rgba(99,102,241,0.2))' }}>
                    <div className="rounded-[calc(2rem-2px)] overflow-hidden" style={{ background: 'var(--bg)' }}>
                      <div className="flex items-center justify-between px-6 py-3" style={{ background: 'var(--card)' }}>
                        <div className="flex items-center gap-2">
                          <span className="text-base">⚡</span>
                          <span className="text-xs font-bold accent-text">MIDASHUB</span>
                        </div>
                        <div className="flex gap-1">
                          {['🌐', '🔥', '👥', '💬'].map((icon, i) => (
                            <span key={i} className="text-[10px] opacity-40 px-1">{icon}</span>
                          ))}
                        </div>
                      </div>

                      <div className="px-3 py-2 space-y-2 h-[420px] overflow-hidden">
                        {FEED_PREVIEW.map((post, i) => (
                          <div key={i}
                            className="rounded-xl p-3"
                            style={{
                              background: 'var(--card)',
                              border: '1px solid var(--border)',
                              opacity: i < visibleCards ? 1 : 0,
                              transform: i < visibleCards ? 'translateY(0)' : 'translateY(12px)',
                              transition: `opacity 0.4s ease ${i * 0.08}s, transform 0.4s ease ${i * 0.08}s`,
                            }}>
                            <div className="flex items-center gap-2 mb-1.5">
                              <span className="text-lg">{post.avatar}</span>
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-1.5">
                                  <span className="text-[11px] font-bold truncate">{post.name}</span>
                                  <span className="text-[9px] px-1.5 py-0.5 rounded-full font-bold"
                                    style={{ background: `${post.platformColor}18`, color: post.platformColor }}>
                                    {post.platformIcon} {post.platform}
                                  </span>
                                </div>
                              </div>
                              <span className="text-[9px] text-white/20">{post.time}</span>
                            </div>
                            <p className="text-[11px] text-white/60 leading-relaxed line-clamp-2">{post.content}</p>
                            <div className="flex items-center gap-3 mt-1.5 text-[10px] text-white/25">
                              <span>❤️ {post.likes}</span>
                              <span>💬</span>
                              <span>🔄</span>
                              {post.viral && <span className="ml-auto text-orange-400 font-bold">🔥 VIRAL</span>}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>

                  {[
                    { icon: '👻', color: '#FFFC00', top: '8%', left: '-8%', delay: '0s' },
                    { icon: '📸', color: '#E4405F', top: '25%', right: '-10%', delay: '0.5s' },
                    { icon: '🎵', color: '#69C9D0', bottom: '30%', left: '-12%', delay: '1s' },
                    { icon: '📘', color: '#1877F2', bottom: '15%', right: '-8%', delay: '1.5s' },
                    { icon: '𝕏', color: '#fff', top: '50%', left: '-6%', delay: '0.8s' },
                    { icon: '▶️', color: '#FF0000', top: '5%', right: '-5%', delay: '1.2s' },
                  ].map((badge, i) => (
                    <div key={i} className="absolute w-10 h-10 rounded-xl flex items-center justify-center text-lg shadow-lg"
                      style={{
                        background: `${badge.color}15`, border: `1px solid ${badge.color}30`,
                        top: badge.top, bottom: badge.bottom, left: badge.left, right: badge.right,
                        animation: `badgeFloat 4s ease-in-out infinite ${badge.delay}`,
                      }}>
                      {badge.icon}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* ===== PLATFORM STRIP ===== */}
        <section className="py-10 border-y" style={{ borderColor: 'var(--border)' }}>
          <div className="max-w-6xl mx-auto px-4">
            <p className="text-center text-xs text-white/20 font-semibold tracking-widest uppercase mb-6">
              All your platforms in one place
            </p>
            <div className="flex items-center justify-center gap-3 sm:gap-5 flex-wrap">
              {PLATFORM_LIST.map(([key, p]) => (
                <div key={key} className="flex items-center gap-2 px-4 py-2.5 rounded-xl transition-all hover:scale-105 cursor-default"
                  style={{ background: `${p.color}08`, border: `1px solid ${p.color}15` }}>
                  <span className="text-lg">{p.icon}</span>
                  <span className="text-sm font-semibold hidden sm:block" style={{ color: `${p.color}CC` }}>{p.name}</span>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ===== HOW IT WORKS ===== */}
        <section className="py-16 sm:py-24">
          <div className="max-w-5xl mx-auto px-4">
            <div className="text-center mb-12">
              <span className="text-xs font-bold tracking-widest uppercase text-white/20">How it works</span>
              <h2 className="text-3xl sm:text-4xl font-black mt-3 mb-4">
                Three steps to{' '}<span className="accent-text">everything</span>
              </h2>
              <p className="text-white/35 max-w-md mx-auto">No complicated setup. Join, connect, and see every post from everywhere.</p>
            </div>

            <div className="grid sm:grid-cols-3 gap-6">
              {[
                { step: '01', icon: '📧', title: 'Sign up free', desc: 'Create your account with email verification. Takes 30 seconds. Ages 15+.', color: '#FFD700' },
                { step: '02', icon: '🔗', title: 'Connect your world', desc: 'Link your social profiles. Repost content from any platform into your MidasHub feed.', color: '#FFA500' },
                { step: '03', icon: '🌍', title: 'See everything', desc: 'Browse all posts from everyone, everywhere. Like, comment, chat, go viral.', color: '#6366f1' },
              ].map((item, i) => (
                <div key={i} className="relative group">
                  <div className="glass-light rounded-2xl p-6 hover-lift h-full">
                    <div className="flex items-center gap-3 mb-4">
                      <span className="text-3xl">{item.icon}</span>
                      <span className="text-xs font-black tracking-wider" style={{ color: item.color }}>{item.step}</span>
                    </div>
                    <h3 className="text-lg font-bold mb-2">{item.title}</h3>
                    <p className="text-sm text-white/35 leading-relaxed">{item.desc}</p>
                  </div>
                  {i < 2 && (
                    <div className="hidden sm:block absolute top-1/2 -right-3 w-6 text-white/10 text-center text-lg">→</div>
                  )}
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ===== INSTALL TUTORIAL ===== */}
        {tutorialUrl && (
          <section className="py-12 sm:py-16">
            <div className="max-w-3xl mx-auto px-4 text-center">
              <span className="text-xs font-bold tracking-widest uppercase text-white/20">Get the app</span>
              <h2 className="text-2xl sm:text-3xl font-black mt-3 mb-2">Add MidasHub to your <span className="accent-text">Home Screen</span></h2>
              <p className="text-sm text-white/35 mb-6 max-w-md mx-auto">Works like a real app — instant access, push notifications, and full-screen experience. Watch how:</p>

              <button onClick={() => setShowTutorial(true)}
                className="relative inline-block rounded-2xl overflow-hidden border border-white/10 hover:border-[var(--accent)]/30 transition group cursor-pointer">
                <div className="w-64 h-44 sm:w-80 sm:h-52 bg-white/3 flex items-center justify-center">
                  <div className="w-16 h-16 rounded-full bg-[var(--accent)]/20 flex items-center justify-center group-hover:scale-110 transition-transform">
                    <span className="text-3xl ml-1">▶️</span>
                  </div>
                </div>
                <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/80 to-transparent p-3">
                  <span className="text-xs font-bold">📱 How to install MidasHub</span>
                </div>
              </button>
            </div>
          </section>
        )}

        {/* Tutorial video modal */}
        {showTutorial && tutorialUrl && (
          <div className="fixed inset-0 bg-black/90 z-[9999] flex items-center justify-center p-4" onClick={() => setShowTutorial(false)}>
            <div className="relative max-w-lg w-full" onClick={e => e.stopPropagation()}>
              <button onClick={() => setShowTutorial(false)} className="absolute -top-10 right-0 text-white/50 text-2xl hover:text-white">✕</button>
              <video src={tutorialUrl} controls autoPlay playsInline className="w-full rounded-2xl" style={{ maxHeight: '80vh' }} />
              <p className="text-center text-xs text-white/30 mt-3">Tap the share button → &quot;Add to Home Screen&quot;</p>
            </div>
          </div>
        )}

        {/* ===== FEATURES GRID ===== */}
        <section className="py-16 sm:py-24" style={{ background: 'rgba(255,255,255,0.01)' }}>
          <div className="max-w-5xl mx-auto px-4">
            <div className="text-center mb-12">
              <span className="text-xs font-bold tracking-widest uppercase text-white/20">Features</span>
              <h2 className="text-3xl sm:text-4xl font-black mt-3">
                Built for{' '}<span className="accent-text">real people</span>
              </h2>
            </div>

            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {[
                { icon: '🔥', title: 'Viral Discovery', desc: 'Posts auto-trend at 100+ likes. No algorithm hiding your content. Pure organic reach.', accent: '#ef4444' },
                { icon: '💬', title: 'Real-time Chat', desc: 'Message anyone instantly. No friend request needed to see posts. Connect freely.', accent: '#22d3ee' },
                { icon: '🚀', title: 'Cross-Post', desc: 'One-click buttons to jump to Snap, IG, TikTok, X and post there too.', accent: '#8b5cf6' },
                { icon: '🛡️', title: 'Verified Users', desc: 'Email verification keeps accounts real. No bots. No fakes.', accent: '#22c55e' },
                { icon: '👥', title: 'Find Anyone', desc: 'Discover people from all platforms. Add friends, build your network.', accent: '#f97316' },
                { icon: '♾️', title: 'Zero Limits', desc: 'No character limits. No daily caps. No restrictions. Post whatever, whenever.', accent: '#FFD700' },
              ].map((feature, i) => (
                <div key={i} className="glass-light rounded-2xl p-5 hover-lift group cursor-default">
                  <div className="w-10 h-10 rounded-xl flex items-center justify-center text-xl mb-3 transition-transform group-hover:scale-110"
                    style={{ background: `${feature.accent}12`, border: `1px solid ${feature.accent}20` }}>
                    {feature.icon}
                  </div>
                  <h3 className="font-bold mb-1.5">{feature.title}</h3>
                  <p className="text-sm text-white/30 leading-relaxed">{feature.desc}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ===== CTA ===== */}
        <section className="py-16 sm:py-24">
          <div className="max-w-4xl mx-auto px-4">
            <div className="relative rounded-3xl overflow-hidden p-8 sm:p-14 text-center"
              style={{ background: 'linear-gradient(135deg, rgba(255,215,0,0.06), rgba(255,165,0,0.03), rgba(99,102,241,0.04))', border: '1px solid rgba(255,215,0,0.1)' }}>
              <div className="absolute inset-0 opacity-5" style={{
                backgroundImage: 'radial-gradient(circle at 20% 50%, #FFD700 1px, transparent 1px), radial-gradient(circle at 80% 20%, #FFA500 1px, transparent 1px)',
                backgroundSize: '60px 60px, 80px 80px'
              }} />
              <div className="relative z-10">
                <div className="flex items-center justify-center -space-x-2 mb-6">
                  {['🧑🏾','👩🏽','👨🏼','👩🏿','👨🏻','👩🏻','🧑🏻','👩🏾'].map((emoji, i) => (
                    <div key={i} className="w-10 h-10 rounded-full flex items-center justify-center text-xl ring-2"
                      style={{ background: 'var(--card)', ringColor: 'var(--bg)' }}>{emoji}</div>
                  ))}
                  <div className="w-10 h-10 rounded-full flex items-center justify-center text-[10px] font-bold ring-2"
                    style={{ background: 'rgba(255,215,0,0.15)', color: '#FFD700', ringColor: 'var(--bg)' }}>+999</div>
                </div>
                <h2 className="text-3xl sm:text-4xl font-black mb-4">Ready to see{' '}<span className="accent-text">everything</span>?</h2>
                <p className="text-white/35 text-base sm:text-lg mb-8 max-w-lg mx-auto leading-relaxed">
                  Your friends are already here. Every meme, every story, every post — one place, zero effort.
                </p>
                <button onClick={() => setShowAuth(true, 'signup')}
                  className="group px-10 py-4 rounded-2xl font-bold text-base text-black transition-all hover:scale-[1.02] hover:shadow-[0_0_40px_rgba(255,215,0,0.25)]"
                  style={{ background: 'linear-gradient(135deg, #FFD700, #FFA500)' }}>
                  <span className="flex items-center gap-2">Create Free Account <span className="group-hover:translate-x-1 transition-transform">⚡</span></span>
                </button>
                <p className="text-[11px] text-white/15 mt-4 tracking-wide">Free forever · No credit card · Ages 15+ · Email verification</p>
              </div>
            </div>
          </div>
        </section>

        {/* ===== FOOTER ===== */}
        <footer className="py-8 text-center" style={{ borderTop: '1px solid var(--border)' }}>
          <div className="max-w-5xl mx-auto px-4">
            <div className="flex items-center justify-center gap-2 mb-3">
              <span className="text-lg">⚡</span>
              <span className="text-base font-extrabold accent-text">MIDASHUB</span>
            </div>
            <p className="text-xs text-white/15">All your socials, one place. © {new Date().getFullYear()} MidasHub</p>
            <div className="flex items-center justify-center gap-4 mt-3">
              {[{ label: 'Feed', href: '/feed' }, { label: 'People', href: '/people' }, { label: 'Viral', href: '/viral' }].map((link, i) => (
                <button key={i} onClick={() => router.push(link.href)} className="text-xs text-white/20 hover:text-white/50 transition">{link.label}</button>
              ))}
            </div>
          </div>
        </footer>
      </div>

      <style jsx global>{`
        @keyframes heroFloat {
          0%, 100% { transform: translate(0, 0) scale(1); }
          33% { transform: translate(15px, -20px) scale(1.05); }
          66% { transform: translate(-10px, 10px) scale(0.97); }
        }
        @keyframes badgeFloat {
          0%, 100% { transform: translateY(0); }
          50% { transform: translateY(-8px); }
        }
        @keyframes sparkle {
          0%, 100% { opacity: 1; transform: scale(1) rotate(0deg); }
          50% { opacity: 0.6; transform: scale(1.2) rotate(10deg); }
        }
      `}</style>
    </AppShell>
  );
}

export default function Home() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center" style={{ background: '#0a0a0f' }}>
        <div className="text-center">
          <div className="text-5xl mb-3 animate-pulse">⚡</div>
          <div className="text-sm font-bold" style={{ color: '#FFD700' }}>Loading MidasHub...</div>
        </div>
      </div>
    }>
      <HomeInner />
    </Suspense>
  );
}
