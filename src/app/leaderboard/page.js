'use client';
import { useState, useEffect } from 'react';
import Link from 'next/link';
import AppShell from '@/components/AppShell';
import { RankBadge } from '@/components/RankBadge';
import { useStore } from '@/lib/store';
import { createClient } from '@/lib/supabase-browser';
import { formatCount, getRank, RANKS } from '@/lib/constants';

export default function LeaderboardPage() {
  const { user, profile } = useStore();
  const [leaders, setLeaders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [myRankPos, setMyRankPos] = useState(null);

  const fetchLeaderboard = async () => {
    try {
      const supabase = createClient();
      const { data } = await supabase.from('profiles')
        .select('id, username, display_name, avatar_emoji, xp')
        .order('xp', { ascending: false })
        .limit(50);
      setLeaders(data || []);
      if (user && data) {
        const pos = data.findIndex(p => p.id === user.id);
        if (pos !== -1) setMyRankPos(pos + 1);
        else {
          const { count } = await supabase.from('profiles')
            .select('*', { count: 'exact', head: true })
            .gt('xp', profile?.xp || 0);
          setMyRankPos((count || 0) + 1);
        }
      }
    } catch (e) {}
    setLoading(false);
  };

  useEffect(() => {
    const safety = setTimeout(() => setLoading(false), 3000);
    fetchLeaderboard().finally(() => clearTimeout(safety));
    return () => clearTimeout(safety);
  }, [user, profile]);

  useEffect(() => {
    const onResumed = () => fetchLeaderboard();
    window.addEventListener('midashub:resumed', onResumed);
    return () => window.removeEventListener('midashub:resumed', onResumed);
  }, [user, profile]);

  const podiumMedals = ['🥇', '🥈', '🥉'];
  const podiumColors = ['#FFD700', '#C0C0C0', '#CD7F32'];

  return (
    <AppShell>
      <div className="max-w-2xl mx-auto px-3 sm:px-4 py-4 sm:py-6">
        <div className="flex items-center gap-3 mb-1">
          <span className="text-3xl">🏆</span>
          <h1 className="text-2xl sm:text-3xl font-black">Leaderboard</h1>
        </div>
        <p className="text-white/30 text-sm ml-12 mb-6">Top ranked members on MidasHub</p>

        {/* Your position */}
        {user && profile && (
          <div className="glass-light rounded-2xl p-4 mb-6 animate-slide-up">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full flex items-center justify-center font-black text-sm" style={{ background: 'var(--accent)', color: '#000' }}>
                #{myRankPos || '?'}
              </div>
              <span className="text-2xl">{profile.avatar_emoji || '😎'}</span>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="font-bold text-sm truncate">{profile.display_name}</span>
                  <RankBadge xp={profile.xp || 0} size="xs" />
                </div>
                <div className="text-xs text-white/30">Your position · {formatCount(profile.xp || 0)} XP</div>
              </div>
              <div className="text-right">
                <div className="text-lg">{getRank(profile.xp || 0).icon}</div>
              </div>
            </div>
            {/* Progress to next rank */}
            {(() => {
              const rank = getRank(profile.xp || 0);
              if (!rank.nextRank) return null;
              return (
                <div className="mt-3">
                  <div className="h-2 rounded-full bg-white/5 overflow-hidden">
                    <div className="h-full rounded-full transition-all" style={{ width: `${rank.progress * 100}%`, background: `linear-gradient(90deg, ${rank.color}, ${rank.nextRank.color})` }} />
                  </div>
                  <div className="text-[10px] text-white/20 mt-1 text-center">
                    {rank.xpInLevel.toLocaleString()} / {rank.xpNeeded.toLocaleString()} XP to {rank.nextRank.icon} {rank.nextRank.name}
                  </div>
                </div>
              );
            })()}
          </div>
        )}

        {/* Rank tiers guide */}
        <div className="glass-light rounded-2xl p-4 mb-6">
          <div className="text-xs font-bold text-white/40 mb-3">RANK TIERS</div>
          <div className="flex flex-wrap gap-1.5">
            {RANKS.map(r => (
              <div key={r.level} className="flex items-center gap-1 px-2 py-1 rounded-lg text-[10px]"
                style={{ background: `${r.color}10`, color: r.color, border: `1px solid ${r.color}20` }}
                title={`${r.minXP.toLocaleString()} XP — ${r.perk}`}>
                <span>{r.icon}</span>
                <span className="font-semibold">{r.name}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Top 3 podium */}
        {!loading && leaders.length >= 3 && (
          <div className="grid grid-cols-3 gap-3 mb-6">
            {[1, 0, 2].map(idx => {
              const p = leaders[idx];
              if (!p) return null;
              const rank = getRank(p.xp || 0);
              const isSecond = idx === 1;
              const isThird = idx === 2;
              return (
                <Link key={p.id} prefetch={false} href={`/profile/${p.username}`}
                  className={`glass-light rounded-2xl p-4 text-center hover-lift transition ${isSecond ? '' : 'mt-4'}`}>
                  <div className="text-2xl mb-1">{podiumMedals[idx]}</div>
                  <div className="text-4xl mb-2">{p.avatar_emoji || '😎'}</div>
                  <div className="font-bold text-sm truncate">{p.display_name}</div>
                  <div className="text-[10px] text-white/25 truncate">@{p.username}</div>
                  <div className="flex justify-center mt-1.5"><RankBadge xp={p.xp || 0} size="xs" /></div>
                  <div className="text-xs font-bold mt-1.5" style={{ color: podiumColors[idx] }}>{formatCount(p.xp || 0)} XP</div>
                </Link>
              );
            })}
          </div>
        )}

        {/* Full list */}
        {loading ? (
          <div className="space-y-2">
            {[1,2,3,4,5,6].map(i => (
              <div key={i} className="glass-light rounded-xl p-3 flex gap-3 items-center">
                <div className="w-8 h-8 rounded-full skeleton" />
                <div className="w-8 h-8 rounded-full skeleton" />
                <div className="flex-1 space-y-1.5"><div className="h-4 w-28 skeleton" /><div className="h-3 w-16 skeleton" /></div>
                <div className="h-4 w-16 skeleton" />
              </div>
            ))}
          </div>
        ) : leaders.length === 0 ? (
          <div className="text-center py-20">
            <div className="text-5xl mb-3">🏆</div>
            <p className="text-white/30">No ranked users yet</p>
          </div>
        ) : (
          <div className="space-y-1.5">
            {leaders.map((p, i) => {
              const rank = getRank(p.xp || 0);
              const isMe = user?.id === p.id;
              return (
                <Link key={p.id} prefetch={false} href={`/profile/${p.username}`}
                  className={`flex items-center gap-3 px-4 py-3 rounded-xl transition hover:bg-white/5 ${isMe ? 'bg-[var(--accent)]/5 border border-[var(--accent)]/20' : 'glass-light'}`}>
                  <div className={`w-8 text-center font-black text-sm shrink-0 ${i < 3 ? '' : 'text-white/20'}`}
                    style={i < 3 ? { color: podiumColors[i] } : {}}>
                    {i < 3 ? podiumMedals[i] : `#${i + 1}`}
                  </div>
                  <span className="text-2xl shrink-0">{p.avatar_emoji || '😎'}</span>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5">
                      <span className="font-bold text-sm truncate">{p.display_name}</span>
                      {isMe && <span className="text-[8px] px-1.5 py-0.5 rounded-full bg-white/10 text-white/50 shrink-0">YOU</span>}
                    </div>
                    <div className="flex items-center gap-1.5 mt-0.5">
                      <span className="text-[11px] text-white/25 truncate">@{p.username}</span>
                      <RankBadge xp={p.xp || 0} size="xs" />
                    </div>
                  </div>
                  <div className="text-right shrink-0">
                    <div className="text-sm font-bold" style={{ color: rank.color }}>{rank.icon}</div>
                    <div className="text-[10px] text-white/25">{formatCount(p.xp || 0)} XP</div>
                  </div>
                </Link>
              );
            })}
          </div>
        )}

        {/* XP guide */}
        <div className="glass-light rounded-2xl p-5 mt-6">
          <h3 className="font-bold text-sm mb-3">⚡ How to earn XP</h3>
          <div className="grid grid-cols-2 gap-2 text-xs">
            {[
              { action: 'Create a post', xp: '+10' },
              { action: 'Get a like', xp: '+2' },
              { action: 'Like someone', xp: '+1' },
              { action: 'Write a comment', xp: '+5' },
              { action: 'Get a comment', xp: '+3' },
              { action: 'Repost someone', xp: '+5' },
              { action: 'Get reposted', xp: '+8' },
              { action: 'Make a friend', xp: '+5' },
              { action: 'Daily login', xp: '+15' },
              { action: 'Go viral 🔥', xp: '+50' },
              { action: 'Send a message', xp: '+1' },
              { action: 'Friend accepted', xp: '+5' },
            ].map((item, i) => (
              <div key={i} className="flex justify-between items-center px-3 py-2 rounded-lg bg-white/3">
                <span className="text-white/50">{item.action}</span>
                <span className="font-bold text-[var(--accent)]">{item.xp}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </AppShell>
  );
}
