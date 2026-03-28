'use client';
import { useState } from 'react';
import { getRank, RANKS } from '@/lib/constants';

// Small inline badge — shows next to usernames
export function RankBadge({ xp = 0, size = 'sm' }) {
  const rank = getRank(xp);
  const sizes = {
    xs: 'text-[9px] px-1.5 py-0.5 gap-0.5',
    sm: 'text-[10px] px-2 py-0.5 gap-1',
    md: 'text-xs px-2.5 py-1 gap-1.5',
    lg: 'text-sm px-3 py-1.5 gap-2',
  };

  return (
    <span className={`inline-flex items-center rounded-full font-bold shrink-0 ${sizes[size]}`}
      style={{ background: `${rank.color}18`, color: rank.color, border: `1px solid ${rank.color}30` }}
      title={`${rank.name} — ${rank.perk}`}>
      <span>{rank.icon}</span>
      <span>{rank.name}</span>
    </span>
  );
}

// Full rank card — shows on profile with progress bar
export function RankCard({ xp = 0 }) {
  const rank = getRank(xp);
  const [showAll, setShowAll] = useState(false);

  return (
    <div className="glass-light rounded-2xl p-5">
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-bold text-sm">🏆 Rank</h3>
        <button onClick={() => setShowAll(!showAll)} className="text-[10px] text-white/30 hover:text-white/50 transition">
          {showAll ? 'Hide ranks' : 'View all ranks'}
        </button>
      </div>

      {/* Current rank */}
      <div className="flex items-center gap-3 mb-4">
        <div className="w-14 h-14 rounded-2xl flex items-center justify-center text-3xl"
          style={{ background: `${rank.color}15`, border: `2px solid ${rank.color}40` }}>
          {rank.icon}
        </div>
        <div className="flex-1">
          <div className="flex items-center gap-2">
            <span className="font-black text-lg" style={{ color: rank.color }}>{rank.name}</span>
            <span className="text-[10px] text-white/20">Lvl {rank.level}</span>
          </div>
          <p className="text-xs text-white/40 mt-0.5">{rank.perk}</p>
          <div className="text-[10px] text-white/20 mt-1">{rank.xp.toLocaleString()} XP total</div>
        </div>
      </div>

      {/* Progress bar to next rank */}
      {rank.nextRank && (
        <div className="mb-2">
          <div className="flex justify-between text-[10px] text-white/25 mb-1.5">
            <span>{rank.icon} {rank.name}</span>
            <span>{rank.nextRank.icon} {rank.nextRank.name}</span>
          </div>
          <div className="h-2.5 rounded-full bg-white/5 overflow-hidden">
            <div className="h-full rounded-full transition-all duration-700 ease-out"
              style={{
                width: `${rank.progress * 100}%`,
                background: `linear-gradient(90deg, ${rank.color}, ${rank.nextRank.color})`,
                boxShadow: `0 0 8px ${rank.color}40`,
              }} />
          </div>
          <div className="text-[10px] text-white/20 mt-1.5 text-center">
            {rank.xpInLevel.toLocaleString()} / {rank.xpNeeded.toLocaleString()} XP to {rank.nextRank.name}
          </div>
        </div>
      )}
      {!rank.nextRank && (
        <div className="text-center text-xs text-white/30 py-2">
          ♾️ You've reached the highest rank — Legendary status!
        </div>
      )}

      {/* All ranks list */}
      {showAll && (
        <div className="mt-4 pt-4 border-t border-white/5 space-y-1.5">
          <div className="text-xs text-white/30 mb-2">All ranks:</div>
          {RANKS.map((r) => {
            const achieved = xp >= r.minXP;
            const isCurrent = r.level === rank.level;
            return (
              <div key={r.level}
                className={`flex items-center gap-3 px-3 py-2 rounded-xl transition ${isCurrent ? 'bg-white/5' : ''}`}
                style={{ opacity: achieved ? 1 : 0.35 }}>
                <span className="text-lg w-7 text-center">{r.icon}</span>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold" style={{ color: achieved ? r.color : 'inherit' }}>{r.name}</span>
                    {isCurrent && <span className="text-[8px] px-1.5 py-0.5 rounded-full bg-white/10 text-white/50">YOU</span>}
                  </div>
                  <span className="text-[10px] text-white/20">{r.perk}</span>
                </div>
                <span className="text-[10px] text-white/15 shrink-0">{r.minXP.toLocaleString()} XP</span>
                {achieved && <span className="text-green-400 text-xs">✓</span>}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
