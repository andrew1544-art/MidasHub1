'use client';
import { Suspense, useState, useEffect, useCallback, useRef } from 'react';
import { useSearchParams } from 'next/navigation';
import AppShell from '@/components/AppShell';
import PostCard from '@/components/PostCard';
import { useStore } from '@/lib/store';
import { createClient } from '@/lib/supabase-browser';
import { PLATFORM_LIST } from '@/lib/constants';

function FeedInner() {
  const { user, profile, setShowAuth, setShowCompose, showToast } = useStore();
  const searchParams = useSearchParams();
  const [posts, setPosts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState(() => {
    try { return sessionStorage.getItem('mh-filter') || 'all'; } catch(e) { return 'all'; }
  });

  const changeFilter = (f) => {
    setFilter(f);
    try { sessionStorage.setItem('mh-filter', f); } catch(e) {}
  };
  const [hasMore, setHasMore] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [joinTrade, setJoinTrade] = useState(null);
  const [joiningRole, setJoiningRole] = useState(null);
  const [joinRoles, setJoinRoles] = useState([]);
  const [joining, setJoining] = useState(false);
  const [hasDraft, setHasDraft] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  useEffect(() => {
    try { setHasDraft(!!sessionStorage.getItem('mh-draft')); } catch(e) {}
  }, []);
  const [pullDistance, setPullDistance] = useState(0);
  const touchStartY = useRef(0);
  const isPulling = useRef(false);
  const PAGE_SIZE = 20;
  const pageRef = useRef(0);
  const hasMoreRef = useRef(true);
  const loadingMoreRef = useRef(false);
  const postsCountRef = useRef(0);

  // Keep ref in sync
  useEffect(() => { postsCountRef.current = posts.length; }, [posts.length]);

  const fetchPosts = useCallback(async (pageNum = 0, append = false) => {
    try {
      const supabase = createClient();
      let query = supabase.from('posts').select('*, profiles(*)').order('created_at', { ascending: false }).range(pageNum * PAGE_SIZE, (pageNum + 1) * PAGE_SIZE - 1);
      if (filter !== 'all') query = query.eq('source_platform', filter);
      if (!user) query = query.eq('is_public', true);
      let { data, error } = await query;

      // If query failed OR returned empty when we have posts — connection is stale
      if (error || (pageNum === 0 && !append && (!data || data.length === 0) && postsCountRef.current > 0)) {
        // Refresh auth and retry
        const { ensureFreshAuth } = await import('@/lib/supabase-browser');
        await ensureFreshAuth();
        const retry = await supabase.from('posts').select('*, profiles(*)').order('created_at', { ascending: false }).range(pageNum * PAGE_SIZE, (pageNum + 1) * PAGE_SIZE - 1);
        if (retry.data && retry.data.length > 0) {
          data = retry.data;
          error = null;
        } else {
          // Still failing — keep existing posts, don't blank the screen
          setLoading(false); setLoadingMore(false); loadingMoreRef.current = false;
          setRefreshing(false);
          return;
        }
      }

      if (data && data.length > 0) {
        if (user) {
          const ids = data.map(p => p.id);
          const [lr, br, rr] = await Promise.all([
            supabase.from('likes').select('post_id').eq('user_id', user.id).in('post_id', ids),
            supabase.from('bookmarks').select('post_id').eq('user_id', user.id).in('post_id', ids),
            supabase.from('reposts').select('post_id').eq('user_id', user.id).in('post_id', ids),
          ]);
          const liked = new Set((lr.data||[]).map(l=>l.post_id));
          const bk = new Set((br.data||[]).map(b=>b.post_id));
          const rp = new Set((rr.data||[]).map(r=>r.post_id));
          data.forEach(p => { p.user_liked = liked.has(p.id); p.user_bookmarked = bk.has(p.id); p.user_reposted = rp.has(p.id); });
        }
        append ? setPosts(prev => [...prev, ...data]) : setPosts(data);
        const more = data.length === PAGE_SIZE;
        setHasMore(more); hasMoreRef.current = more;
      } else if (pageNum === 0 && !append && postsCountRef.current === 0) {
        // Genuinely no posts (first load, empty DB)
        setPosts([]);
      }
    } catch (e) { /* Keep existing posts on error */ }
    setLoading(false); setLoadingMore(false); loadingMoreRef.current = false;
  }, [filter, user]);

  // Load on filter change
  // Load posts with safety timeout
  useEffect(() => {
    setLoading(true); pageRef.current = 0;
    const safety = setTimeout(() => setLoading(false), 1500);
    fetchPosts(0).finally(() => clearTimeout(safety));
    return () => clearTimeout(safety);
  }, [filter, fetchPosts]);

  // Detect password reset redirect (from URL or sessionStorage)
  useEffect(() => {
    const fromUrl = searchParams.get('reset') === 'true';
    const fromStorage = typeof sessionStorage !== 'undefined' && sessionStorage.getItem('midashub-reset-password') === '1';
    if ((fromUrl || fromStorage) && user) {
      setShowAuth(true, 'reset');
      if (fromStorage) sessionStorage.removeItem('midashub-reset-password');
      window.history.replaceState({}, '', '/feed');
    }
  }, [searchParams, user]);

  // Capture referral code from URL
  useEffect(() => {
    const ref = searchParams.get('ref') || searchParams.get('referral');
    if (ref) {
      try { localStorage.setItem('midashub-ref', ref.toUpperCase()); } catch(e) {}
      // If not logged in, prompt signup
      if (!user) setShowAuth(true, 'signup');
    }
  }, [searchParams]);

  // Detect join trade link
  useEffect(() => {
    const code = searchParams.get('join_trade');
    if (!code) return;
    // Save code for after login if not logged in
    if (!user) {
      try { sessionStorage.setItem('mh-join-trade', code); } catch(e) {}
      setShowAuth(true, 'login');
      return;
    }
    (async () => {
      try {
        const { ensureFreshAuth } = await import('@/lib/supabase-browser');
        await ensureFreshAuth();
        const sb = createClient();
        const { data: trade, error } = await sb.from('trades').select('*').eq('share_code', code).maybeSingle();
        if (trade) {
          setJoinTrade(trade);
          try {
            const { data: roles } = await sb.from('trade_roles').select('*').eq('is_active', true).order('display_order');
            setJoinRoles(roles?.length ? roles : [
              { id: 'seller', name: 'Seller', icon: '🏪', description: 'Selling' },
              { id: 'buyer', name: 'Buyer', icon: '🛒', description: 'Buying' },
            ]);
          } catch(e) {}
        } else {
          showToast?.('Trade not found or expired');
        }
      } catch(e) {}
      window.history.replaceState({}, '', '/feed');
    })();
  }, [searchParams, user]);

  // Check for saved trade code after login
  useEffect(() => {
    if (!user) return;
    try {
      const saved = sessionStorage.getItem('mh-join-trade');
      if (saved) {
        sessionStorage.removeItem('mh-join-trade');
        window.history.replaceState({}, '', `/feed?join_trade=${saved}`);
        window.location.reload();
      }
    } catch(e) {}
  }, [user]);

  const handleJoinTrade = async () => {
    if (!joinTrade || !joiningRole || !user) return;
    // Must verify KYC first
    if (profile?.kyc_status !== 'verified' && profile?.kyc_status !== 'pending') {
      showToast?.('You must verify your identity first. Go to Chat → Start Trade to verify.');
      return;
    }
    setJoining(true);
    try {
      const sb = createClient();
      const selectedRole = joinRoles.find(r => r.id === joiningRole);
      await sb.from('trade_participants').insert({
        trade_id: joinTrade.id,
        user_id: user.id,
        role: selectedRole?.name || joiningRole,
        role_id: selectedRole?.id !== 'seller' && selectedRole?.id !== 'buyer' ? selectedRole?.id : null,
        kyc_verified: profile?.kyc_status === 'verified',
      });
      await sb.from('trade_messages').insert({
        trade_id: joinTrade.id,
        content: `👤 ${profile?.display_name || 'Someone'} joined the trade as ${selectedRole?.icon || ''}${selectedRole?.name || joiningRole}`,
        is_system: true,
      });
      showToast?.('Joined trade ✓');
      setJoinTrade(null); setJoiningRole(null);
    } catch(e) {
      if (e.message?.includes('duplicate') || e.message?.includes('unique')) {
        showToast?.('You already joined this trade');
      } else {
        showToast?.('Failed to join trade');
      }
    }
    setJoining(false);
  };

  // Listen for new posts from compose
  useEffect(() => {
    const handler = () => { pageRef.current = 0; fetchPosts(0); };
    window.addEventListener('midashub:newpost', handler);
    return () => window.removeEventListener('midashub:newpost', handler);
  }, [fetchPosts]);

  // Refresh feed when returning from background (after auth is refreshed)
  useEffect(() => {
    const onResumed = () => {
      pageRef.current = 0;
      fetchPosts(0);
    };
    window.addEventListener('midashub:resumed', onResumed);
    return () => window.removeEventListener('midashub:resumed', onResumed);
  }, [fetchPosts]);

  // Realtime new posts — one channel, created once
  useEffect(() => {
    const supabase = createClient();
    const ch = supabase.channel('feed-realtime').on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'posts' }, async (payload) => {
      try {
        const { data } = await supabase.from('posts').select('*, profiles(*)').eq('id', payload.new.id).maybeSingle();
        if (data) setPosts(prev => {
          if (prev.some(p => p.id === data.id)) return prev; // prevent dupes
          return [data, ...prev];
        });
      } catch (e) {}
    }).subscribe();
    return () => { supabase.removeChannel(ch); };
  }, []);

  // Infinite scroll — use refs to avoid re-creating listener
  useEffect(() => {
    const handler = () => {
      if (loadingMoreRef.current || !hasMoreRef.current) return;
      if (window.innerHeight + window.scrollY >= document.body.offsetHeight - 600) {
        loadingMoreRef.current = true;
        setLoadingMore(true);
        const next = pageRef.current + 1;
        pageRef.current = next;
        fetchPosts(next, true);
      }
    };
    window.addEventListener('scroll', handler, { passive: true });
    return () => window.removeEventListener('scroll', handler);
  }, [fetchPosts]);

  const refreshFeed = useCallback(async (showIndicator = false) => {
    if (showIndicator) setRefreshing(true);
    pageRef.current = 0;
    await fetchPosts(0);
    setRefreshing(false);
    setPullDistance(0);
  }, [fetchPosts]);

  // Soft-refresh for short background returns (under reload threshold)
  useEffect(() => {
    let bgTime = 0;
    const handler = async () => {
      if (document.visibilityState === 'hidden') { bgTime = Date.now(); return; }
      if (!bgTime) return;
      const away = Date.now() - bgTime;
      bgTime = 0;
      // Only soft-refresh if under the hard-reload threshold
      // (hard reload handles longer absences via layout.js)
      if (away > 2000 && away < 15000) {
        try {
          const { ensureFreshAuth } = await import('@/lib/supabase-browser');
          await ensureFreshAuth();
        } catch(e) {}
        refreshFeed(false);
      }
    };
    document.addEventListener('visibilitychange', handler);
    return () => document.removeEventListener('visibilitychange', handler);
  }, [refreshFeed]);

  // Pull-to-refresh handlers
  const onTouchStart = useCallback((e) => {
    if (window.scrollY <= 5) {
      touchStartY.current = e.touches[0].clientY;
      isPulling.current = true;
    }
  }, []);

  const onTouchMove = useCallback((e) => {
    if (!isPulling.current) return;
    const diff = e.touches[0].clientY - touchStartY.current;
    if (diff > 0 && window.scrollY <= 5) {
      setPullDistance(Math.min(diff * 0.4, 80));
    } else {
      setPullDistance(0);
    }
  }, []);

  const onTouchEnd = useCallback(() => {
    if (pullDistance > 50) {
      refreshFeed(true);
    } else {
      setPullDistance(0);
    }
    isPulling.current = false;
  }, [pullDistance, refreshFeed]);

  return (
    <AppShell>
      <div className="max-w-2xl mx-auto px-3 sm:px-4 py-4 sm:py-6"
        onTouchStart={onTouchStart} onTouchMove={onTouchMove} onTouchEnd={onTouchEnd}>

        {/* Pull-to-refresh indicator */}
        {(pullDistance > 0 || refreshing) && (
          <div className="flex justify-center mb-3 transition-all" style={{ height: refreshing ? 40 : pullDistance, opacity: refreshing ? 1 : pullDistance / 60 }}>
            <div className="flex items-center gap-2 text-xs text-[var(--accent)]">
              {refreshing ? <><span className="animate-spin">⏳</span> Refreshing...</> : pullDistance > 50 ? '↓ Release to refresh' : '↓ Pull down to refresh'}
            </div>
          </div>
        )}
        {/* Compose bar (logged in) */}
        {user && (
          <div className="glass-light rounded-2xl p-4 mb-5">
            <div className="flex items-center gap-3">
              <span className="text-3xl">{profile?.avatar_emoji || '😎'}</span>
              <button onClick={() => setShowCompose(true)}
                className="flex-1 text-left px-4 py-3 rounded-xl bg-white/5 text-white/30 text-sm hover:bg-white/8 transition cursor-text">
                {hasDraft ? <span className="text-[var(--accent)]">📝 Continue your draft...</span> : "What's on your mind? Share anything..."}
              </button>
              <button onClick={() => setShowCompose(true)} className="btn-primary py-2.5 px-5 text-xs shrink-0">✏️ Post</button>
            </div>
          </div>
        )}

        {/* Sign up banner (not logged in) */}
        {!user && (
          <div className="glass-light rounded-2xl p-5 mb-5 text-center">
            <div className="text-3xl mb-2">⚡</div>
            <h3 className="font-bold text-lg mb-1">Welcome to MidasHub</h3>
            <p className="text-white/40 text-sm mb-4">You&apos;re viewing public posts. Sign up to see everything, post, chat, and trade!</p>
            <div className="flex gap-2 justify-center">
              <button onClick={() => setShowAuth(true, 'signup')} className="btn-primary px-6 py-2.5 text-sm">Join Free ⚡</button>
              <button onClick={() => setShowAuth(true, 'login')} className="btn-secondary px-6 py-2.5 text-sm">Log In</button>
            </div>
          </div>
        )}

        {/* Filters */}
        <div className="flex gap-1.5 mb-5 overflow-x-auto no-scrollbar pb-1">
          <button onClick={() => changeFilter('all')}
            className={`platform-pill shrink-0 px-4 py-2 rounded-xl text-sm ${filter === 'all' ? 'bg-white/10 text-white font-bold' : 'bg-white/4 text-white/35'}`}>
            🌐 All
          </button>
          {PLATFORM_LIST.map(([key, p]) => (
            <button key={key} onClick={() => changeFilter(key)} className="platform-pill shrink-0 px-4 py-2 rounded-xl text-sm"
              style={filter === key ? { background: `${p.color}20`, color: p.color, fontWeight: 700 } : { background: 'rgba(255,255,255,0.03)', color: 'rgba(255,255,255,0.3)' }}>
              {p.icon} {p.name}
            </button>
          ))}
        </div>

        {/* Content */}
        {loading ? (
          <div className="space-y-3">
            {[1,2,3,4].map(i => (
              <div key={i} className="post-card">
                <div className="flex gap-3 mb-4"><div className="w-10 h-10 rounded-full skeleton"/><div className="flex-1 space-y-2"><div className="h-4 w-32 skeleton"/><div className="h-3 w-20 skeleton"/></div></div>
                <div className="space-y-2"><div className="h-4 w-full skeleton"/><div className="h-4 w-3/4 skeleton"/><div className="h-4 w-1/2 skeleton"/></div>
              </div>
            ))}
          </div>
        ) : posts.length === 0 ? (
          <div className="text-center py-20">
            <div className="text-6xl mb-4">
              {filter !== 'all' ? PLATFORM_LIST.find(([k]) => k === filter)?.[1]?.icon || '📭' : '🌟'}
            </div>
            <h3 className="text-xl font-bold mb-2">
              {filter !== 'all' ? `No ${PLATFORM_LIST.find(([k]) => k === filter)?.[1]?.name || ''} posts yet` : 'No posts yet'}
            </h3>
            <p className="text-white/30 text-sm mb-4">Pull down to refresh or tap below</p>
            <div className="flex gap-2 justify-center">
              <button onClick={() => refreshFeed(true)} className="btn-secondary px-6 py-2.5 text-sm">🔄 Refresh</button>
              <button onClick={() => user ? setShowCompose(true) : setShowAuth(true, 'signup')} className="btn-primary px-6 py-2.5 text-sm">
                {user ? 'Create Post ⚡' : 'Join MidasHub ⚡'}
              </button>
            </div>
          </div>
        ) : (
          <div className="space-y-3">
            {posts.map(post => <PostCard key={post.id} post={post} onPostUpdated={refreshFeed} />)}
            {loadingMore && (
              <div className="flex items-center justify-center gap-2 py-6 text-white/25 text-sm">
                <span className="animate-spin">⏳</span> Loading more posts...
              </div>
            )}
            {!hasMore && posts.length > 5 && (
              <div className="text-center py-8">
                <div className="text-3xl mb-2">🎉</div>
                <p className="text-white/15 text-sm">You&apos;ve seen everything!</p>
              </div>
            )}
          </div>
        )}
      </div>
      {/* Join Trade Modal */}
      {joinTrade && (
        <div className="modal-overlay" onClick={e => e.target === e.currentTarget && setJoinTrade(null)}>
          <div className="modal-content max-w-md p-5 sm:p-6">
            <div className="flex items-center justify-between mb-4"><h3 className="font-bold text-lg">🔒 Join Trade</h3><button onClick={() => setJoinTrade(null)} className="w-8 h-8 rounded-full bg-white/5 flex items-center justify-center text-white/40 text-sm">✕</button></div>

            <div className="p-3 rounded-xl bg-white/5 border border-white/10 mb-4">
              <div className="font-bold text-sm">{joinTrade.title}</div>
              {joinTrade.description && <div className="text-xs text-white/40 mt-1">{joinTrade.description}</div>}
              <div className="flex items-center gap-3 mt-2 text-xs text-white/30">
                <span>💰 {joinTrade.currency} {parseFloat(joinTrade.amount).toFixed(2)}</span>
                {joinTrade.delivery_estimate && <span>📦 {joinTrade.delivery_estimate}</span>}
              </div>
            </div>

            {profile?.kyc_status !== 'verified' && profile?.kyc_status !== 'pending' && (
              <div className="p-3 rounded-xl bg-red-500/10 border border-red-500/20 text-xs text-red-300 mb-4">
                ⚠️ You must verify your identity to join trades. Go to Chat → 🔒 Trade to start verification.
              </div>
            )}

            <div className="text-sm font-semibold mb-2">Pick your role:</div>
            <div className={`grid gap-2 mb-4 ${joinRoles.length <= 2 ? 'grid-cols-2' : 'grid-cols-2'}`}>
              {joinRoles.map(r => (
                <button key={r.id} onClick={() => setJoiningRole(r.id)}
                  className={`p-3 rounded-xl border text-center transition ${joiningRole === r.id ? 'bg-[var(--accent)]/10 border-[var(--accent)]/30' : 'bg-white/3 border-white/10'}`}>
                  <div className="text-xl mb-0.5">{r.icon}</div>
                  <div className="text-xs font-bold">{r.name}</div>
                </button>
              ))}
            </div>

            <button onClick={handleJoinTrade}
              disabled={!joiningRole || joining || (profile?.kyc_status !== 'verified' && profile?.kyc_status !== 'pending')}
              className="btn-primary w-full py-3 text-sm disabled:opacity-30">
              {joining ? '⏳ Joining...' : '🔒 Join This Trade'}
            </button>
          </div>
        </div>
      )}
    </AppShell>
  );
}

export default function FeedPage() {
  return <Suspense fallback={<div className="min-h-screen flex items-center justify-center"><div className="text-4xl animate-pulse">⚡</div></div>}><FeedInner /></Suspense>;
}
